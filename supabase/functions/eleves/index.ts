// Gestion des comptes élèves (création, changement de code, suppression).
// Les élèves se connectent avec un identifiant + un code : on leur crée un
// compte Supabase avec une adresse interne qui ne reçoit jamais d'e-mail.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

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

/** Client « administrateur » (clé service_role, jamais envoyée au navigateur). */
function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Vérifie que l'appel vient du prof connecté et renvoie son id. */
async function requireTutor(req: Request, admin: SupabaseClient): Promise<string> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Non connecté");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Session invalide");
  const { data: tutor } = await admin.from("tutors").select("id").eq("id", data.user.id).maybeSingle();
  if (!tutor) throw new HttpError(403, "Réservé au prof");
  return data.user.id;
}

/** Vérifie que l'élève appartient bien au prof. */
async function requireOwnStudent(admin: SupabaseClient, tutorId: string, studentId: string) {
  const { data } = await admin.from("students").select("*").eq("id", studentId).eq("tutor_id", tutorId).maybeSingle();
  if (!data) throw new HttpError(404, "Élève introuvable");
  return data;
}

function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) }, 500);
    }
  });
}

// ---------------------------------------------------------------------

const EMAIL_DOMAIN = "eleves.mayerbook.example.com";
const studentEmail = (username: string) => `${username}@${EMAIL_DOMAIN}`;
// Supabase exige 6 caractères minimum : on préfixe le code choisi par le prof.
const studentPassword = (code: string) => `mayerbook-${code}`;

function cleanUsername(u: unknown): string {
  const s = String(u ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(s)) {
    throw new HttpError(400, "Identifiant invalide : 3 à 30 caractères, lettres minuscules, chiffres, point ou tiret.");
  }
  return s;
}

function cleanCode(c: unknown): string {
  const s = String(c ?? "").trim();
  if (s.length < 4 || s.length > 40) throw new HttpError(400, "Le code doit faire au moins 4 caractères.");
  return s;
}

serve(async (req) => {
  const admin = adminClient();
  const tutorId = await requireTutor(req, admin);
  const body = await req.json();

  switch (body.action) {
    case "create": {
      const username = cleanUsername(body.username);
      const code = cleanCode(body.code);
      const name = String(body.name ?? "").trim();
      if (!name) throw new HttpError(400, "Nom manquant");

      const { data: taken } = await admin.from("students").select("id").eq("username", username).maybeSingle();
      if (taken) throw new HttpError(409, "Cet identifiant est déjà pris.");

      const { data: created, error } = await admin.auth.admin.createUser({
        email: studentEmail(username),
        password: studentPassword(code),
        email_confirm: true,
        user_metadata: { role: "student", name },
      });
      if (error || !created.user) throw new HttpError(400, "Création du compte impossible : " + (error?.message ?? ""));

      const { data: student, error: e2 } = await admin.from("students").insert({
        tutor_id: tutorId,
        user_id: created.user.id,
        username,
        name,
        level: String(body.level ?? ""),
        subjects: Array.isArray(body.subjects) ? body.subjects.map(String) : [],
      }).select().single();
      if (e2) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw new HttpError(400, e2.message);
      }
      await admin.from("student_private").insert({
        student_id: student.id,
        contact: String(body.contact ?? ""),
        notes: String(body.notes ?? ""),
      });
      return json({ student });
    }

    case "reset_code": {
      const student = await requireOwnStudent(admin, tutorId, body.student_id);
      const code = cleanCode(body.code);
      if (!student.user_id) throw new HttpError(400, "Cet élève n'a pas de compte.");
      const { error } = await admin.auth.admin.updateUserById(student.user_id, { password: studentPassword(code) });
      if (error) throw new HttpError(400, error.message);
      return json({ ok: true });
    }

    case "delete": {
      const student = await requireOwnStudent(admin, tutorId, body.student_id);
      // Fichiers de l'élève
      for (const folder of ["prof", "eleve"]) {
        const prefix = `${student.id}/${folder}`;
        const { data: files } = await admin.storage.from("fichiers").list(prefix, { limit: 1000 });
        if (files?.length) await admin.storage.from("fichiers").remove(files.map((f) => `${prefix}/${f.name}`));
      }
      await admin.from("students").delete().eq("id", student.id);
      if (student.user_id) await admin.auth.admin.deleteUser(student.user_id);
      return json({ ok: true });
    }

    default:
      throw new HttpError(400, "Action inconnue");
  }
});
