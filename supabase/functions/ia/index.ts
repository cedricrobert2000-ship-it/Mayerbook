// Génération d'exercices, de quiz et de notions par l'IA (Claude),
// et proposition de correction détaillée d'une copie d'élève.
// La clé ANTHROPIC_API_KEY est un « secret » Supabase : elle n'est jamais envoyée au navigateur.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@0.135.0/helpers/beta/zod";
import { z } from "npm:zod@4.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function requireTutor(req: Request, admin: SupabaseClient): Promise<string> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Non connecté");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Session invalide");
  const { data: tutor } = await admin.from("tutors").select("id").eq("id", data.user.id).maybeSingle();
  if (!tutor) throw new HttpError(403, "Réservé au prof");
  return data.user.id;
}

function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof Anthropic.AuthenticationError) {
        return json({ error: "Clé API Claude invalide : vérifie le secret ANTHROPIC_API_KEY dans Supabase." }, 500);
      }
      if (e instanceof Anthropic.RateLimitError) {
        return json({ error: "L'IA est très demandée en ce moment, réessaie dans une minute." }, 429);
      }
      if (e instanceof Anthropic.APIError) {
        return json({ error: "Erreur de l'IA : " + e.message }, 502);
      }
      console.error(e);
      return json({ error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) }, 500);
    }
  });
}

// ---------------------------------------------------------------------
//  Appel à Claude
// ---------------------------------------------------------------------

const MODEL = "claude-opus-5-5";
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const SYSTEM = `Tu assistes un professeur particulier en France qui suit des élèves du CM1 à la Terminale.
Tu écris en français, en respectant les programmes de l'Éducation nationale et le niveau de la classe indiquée.
Adapte le vocabulaire et la longueur à l'âge de l'élève : phrases simples et concrètes pour le primaire,
plus de rigueur au lycée. Pour les maths et les sciences, écris les calculs en texte simple
(ex : 3/4, x², √2, 10^3) sans LaTeX. Utilise **gras** pour les mots importants.
N'invente jamais de liens internet.`;

type Block = Anthropic.Beta.Messages.BetaContentBlockParam;

/** Transforme un fichier (base64) en bloc lisible par Claude. */
function fileBlock(name: string, mime: string, base64: string): Block[] {
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_FILE_BYTES) throw new HttpError(413, `Fichier « ${name} » trop lourd (15 Mo max).`);
  if (mime === "application/pdf") {
    return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 }, title: name }];
  }
  if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime)) {
    return [{ type: "image", source: { type: "base64", media_type: mime as "image/jpeg", data: base64 } }];
  }
  if (mime.startsWith("text/") || /\.(txt|md|csv)$/i.test(name)) {
    const text = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
    return [{ type: "text", text: `Contenu du fichier « ${name} » :\n\n${text}` }];
  }
  throw new HttpError(415, `Format non pris en charge pour « ${name} » : utilise un PDF, une image (JPG, PNG) ou un fichier texte.`);
}

async function ask<T extends z.ZodType>(content: Block[], schema: T, effort: "low" | "medium" | "high"): Promise<z.infer<T>> {
  const client = new Anthropic(); // lit ANTHROPIC_API_KEY
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") {
    throw new HttpError(422, "L'IA a refusé cette demande. Reformule le sujet ou les consignes.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new HttpError(422, "La réponse de l'IA était trop longue : demande moins d'éléments à la fois.");
  }
  if (!response.parsed_output) throw new HttpError(502, "Réponse de l'IA illisible, réessaie.");
  return response.parsed_output as z.infer<T>;
}

// ---------------------------------------------------------------------
//  Formats de réponse attendus
// ---------------------------------------------------------------------

const ExercicesSchema = z.object({
  items: z.array(z.object({
    title: z.string().describe("Titre court de l'exercice"),
    content: z.string().describe("Énoncé complet, prêt à être lu par l'élève"),
    model_answer: z.string().describe("Correction détaillée étape par étape, destinée au prof"),
  })),
});

const NotionsSchema = z.object({
  items: z.array(z.object({
    title: z.string().describe("Nom de la notion"),
    content: z.string().describe("Rappel de cours clair avec un exemple"),
  })),
});

const QuizSchema = z.object({
  title: z.string(),
  intro: z.string().describe("Consigne courte pour l'élève (peut être vide)"),
  questions: z.array(z.object({
    type: z.enum(["qcm", "vf", "texte"]).describe("qcm = choix multiple, vf = vrai/faux, texte = réponse courte"),
    prompt: z.string(),
    options: z.array(z.string()).describe("Choix pour qcm (3 ou 4) ; [\"Vrai\",\"Faux\"] pour vf ; [] pour texte"),
    correct_option: z.number().int().describe("Index (à partir de 0) de la bonne réponse pour qcm/vf ; -1 pour texte"),
    answer_text: z.string().describe("Pour texte : réponses acceptées séparées par | (ex : 12|douze). Vide sinon."),
    explanation: z.string().describe("Explication courte affichée après la correction"),
  })),
});

const CorrectionSchema = z.object({
  feedback: z.string().describe("Correction détaillée et bienveillante adressée à l'élève (tutoiement)"),
  grade: z.string().describe("Appréciation ou note proposée, ex : 14/20, Acquis, En cours d'acquisition"),
});

// ---------------------------------------------------------------------

function describe(p: Record<string, unknown>): string {
  const lines = [
    `Classe : ${p.level || "non précisée"}`,
    `Matière : ${p.subject || "non précisée"}`,
    p.topic ? `Sujet / notion : ${p.topic}` : "",
    p.difficulty ? `Difficulté : ${p.difficulty}` : "",
    p.instructions ? `Consignes du prof : ${p.instructions}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

async function generate(p: Record<string, unknown>) {
  const count = Math.min(Math.max(Number(p.count) || 3, 1), 10);
  const content: Block[] = [];
  const file = p.file as { name: string; mime: string; data: string } | undefined;
  if (file?.data) content.push(...fileBlock(file.name, file.mime, file.data));
  const source = file?.data
    ? "Appuie-toi sur le document fourni (si c'est une fiche d'exercices, reprends ses exercices fidèlement)."
    : "";

  switch (p.type) {
    case "exercice": {
      content.push({
        type: "text",
        text: `Crée ${count} exercice(s) pour cet élève.\n${describe(p)}\n${source}\n` +
          `Pour chaque exercice : un titre, un énoncé complet (l'élève répondra par écrit ou en envoyant une photo de sa feuille), ` +
          `et une correction détaillée pour le prof.`,
      });
      return { type: "exercice", ...(await ask(content, ExercicesSchema, "medium")) };
    }
    case "notion": {
      content.push({
        type: "text",
        text: `Rédige ${count} fiche(s) « notion à revoir » pour cet élève.\n${describe(p)}\n${source}\n` +
          `Chaque fiche : le nom de la notion et un rappel de cours court avec un exemple.`,
      });
      return { type: "notion", ...(await ask(content, NotionsSchema, "low")) };
    }
    case "quiz": {
      content.push({
        type: "text",
        text: `Crée un quiz de ${count} question(s) pour cet élève.\n${describe(p)}\n${source}\n` +
          `Varie les types (qcm, vrai/faux, réponse courte). Pour les réponses courtes, attends une réponse brève ` +
          `et non ambiguë (un nombre, un mot) et liste les variantes acceptées.`,
      });
      return { type: "quiz", quiz: await ask(content, QuizSchema, "medium") };
    }
    default:
      throw new HttpError(400, "Type inconnu");
  }
}

async function downloadAsBlocks(admin: SupabaseClient, files: Array<{ path: string; name: string; type: string }>) {
  const blocks: Block[] = [];
  for (const f of files.slice(0, 6)) {
    const { data } = await admin.storage.from("fichiers").download(f.path);
    if (!data) continue;
    const buf = new Uint8Array(await data.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    try {
      blocks.push(...fileBlock(f.name, f.type || data.type, btoa(bin)));
    } catch {
      // format non lisible par l'IA : on l'ignore
    }
  }
  return blocks;
}

async function proposeCorrection(admin: SupabaseClient, tutorId: string, submissionId: string) {
  const { data: sub } = await admin.from("submissions").select("*").eq("id", submissionId).maybeSingle();
  if (!sub) throw new HttpError(404, "Copie introuvable");
  const { data: student } = await admin.from("students").select("*").eq("id", sub.student_id).eq("tutor_id", tutorId).maybeSingle();
  if (!student) throw new HttpError(404, "Copie introuvable");
  const { data: item } = await admin.from("items").select("*").eq("id", sub.item_id).single();
  const { data: key } = await admin.from("item_keys").select("*").eq("item_id", sub.item_id).maybeSingle();

  const content: Block[] = [];
  content.push(...await downloadAsBlocks(admin, item.attachments || []));
  let text = `Élève : ${student.name} (${student.level}).\nMatière : ${item.subject}\n\n` +
    `EXERCICE « ${item.title} »\n${item.content}\n\n`;
  if (item.type === "quiz") {
    text += "QUESTIONS ET RÉPONSES DE L'ÉLÈVE :\n";
    for (const q of item.questions || []) {
      const k = key?.answers?.[q.id];
      const v = sub.answers?.[q.id];
      const fmt = (x: unknown) => q.type === "texte" ? String(x ?? "—") : (q.options?.[Number(x)] ?? "—");
      text += `- ${q.prompt}\n  Réponse de l'élève : ${fmt(v)}\n  Bonne réponse : ${q.type === "texte" ? String(k?.answer ?? "").split("|")[0] : fmt(k?.answer)}\n`;
    }
    text += `Score automatique : ${sub.score}/${sub.total}\n`;
  } else {
    text += `RÉPONSE ÉCRITE DE L'ÉLÈVE :\n${sub.answer || "(aucune réponse écrite)"}\n`;
  }
  if (key?.model_answer) text += `\nCORRECTION TYPE (du prof) :\n${key.model_answer}\n`;
  const studentFiles = await downloadAsBlocks(admin, sub.files || []);
  if (studentFiles.length) {
    content.push({ type: "text", text: "Ci-dessous : les fichiers / photos envoyés par l'élève." });
    content.push(...studentFiles);
  }
  text += `\nRédige une correction détaillée adressée directement à l'élève (tutoiement, ton bienveillant) : ` +
    `ce qui est juste, chaque erreur expliquée avec la bonne démarche, puis un conseil pour progresser. ` +
    `Propose aussi une note ou appréciation. Le prof relira et modifiera avant d'envoyer.`;
  content.push({ type: "text", text });
  return await ask(content, CorrectionSchema, "medium");
}

serve(async (req) => {
  const admin = adminClient();
  const tutorId = await requireTutor(req, admin);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    throw new HttpError(500, "La clé API Claude n'est pas configurée (secret ANTHROPIC_API_KEY dans Supabase).");
  }
  const body = await req.json();
  if (body.mode === "generer") return json(await generate(body));
  if (body.mode === "corriger") return json(await proposeCorrection(admin, tutorId, String(body.submission_id)));
  throw new HttpError(400, "Mode inconnu");
});
