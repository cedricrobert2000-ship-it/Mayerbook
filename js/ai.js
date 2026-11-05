'use strict';

/* =========================================================
   Création avec une IA externe (Claude, ChatGPT…)
   L'application prépare la demande (prompt) ; le prof la colle
   dans l'IA de son choix puis recolle la réponse ici.
   Aucune clé API, aucun coût supplémentaire.
   ========================================================= */

const AI = { result: null, params: null, file: null, uploaded: null };

const AI_LINKS = `
  <a class="btn small" href="https://claude.ai/new" target="_blank" rel="noopener">Ouvrir Claude ${icon('external-link')}</a>
  <a class="btn small" href="https://chatgpt.com/" target="_blank" rel="noopener">Ouvrir ChatGPT ${icon('external-link')}</a>`;

/* ---------- Demande (prompt) de création ---------- */

function buildCreationPrompt(p) {
  const level = `${p.level}${p.subject ? ', en ' + p.subject : ''}`;
  const ctx = [
    `Je suis professeur particulier en France. Mon élève est en ${level}.`,
    p.topic ? `Sujet / notion : ${p.topic}.` : '',
    p.difficulty ? `Difficulté : ${p.difficulty}.` : '',
    p.withDoc ? 'Appuie-toi sur le document que je joins (si c’est une fiche d’exercices, reprends ses exercices fidèlement).' : '',
    p.instructions ? `Consignes : ${p.instructions}` : '',
    'Respecte les programmes de l’Éducation nationale et adapte le vocabulaire à l’âge de l’élève.',
    'Écris les calculs en texte simple (ex : 3/4, x², √2), sans LaTeX. Tu peux utiliser **gras**. N’invente pas de liens internet.'
  ].filter(Boolean).join('\n');

  const formats = {
    exercice: {
      ask: `Crée ${p.count} exercice(s). Pour chacun : un titre, un énoncé complet (l’élève répondra par écrit ou en photo) et une correction détaillée étape par étape pour moi.`,
      json: `{
  "type": "exercice",
  "items": [
    { "title": "Titre court", "content": "Énoncé complet", "model_answer": "Correction détaillée" }
  ]
}`
    },
    notion: {
      ask: `Rédige ${p.count} fiche(s) « notion à revoir » : le nom de la notion et un rappel de cours court avec un exemple.`,
      json: `{
  "type": "notion",
  "items": [
    { "title": "Nom de la notion", "content": "Rappel de cours avec un exemple" }
  ]
}`
    },
    mixte: {
      ask: `Prépare une séance complète : 1 ou 2 fiches « notion à revoir » (rappel de cours avec un exemple), ` +
        `${p.count} exercice(s) (énoncé complet + correction détaillée étape par étape pour moi) ` +
        `et 1 quiz de 6 à 10 questions en variant les types : "qcm" (3 ou 4 choix), "vf" (vrai/faux) et "texte" (réponse courte : un nombre ou un mot, sans ambiguïté).`,
      json: `{
  "elements": [
    { "type": "notion", "title": "Nom de la notion", "content": "Rappel de cours avec un exemple" },
    { "type": "exercice", "title": "Titre court", "content": "Énoncé complet", "model_answer": "Correction détaillée" },
    { "type": "quiz", "title": "Titre du quiz", "intro": "Consigne courte (peut être vide)", "questions": [
      { "type": "qcm", "prompt": "Question ?", "options": ["Choix A", "Choix B", "Choix C"], "correct_option": 1, "answer_text": "", "explanation": "Pourquoi" },
      { "type": "vf", "prompt": "Affirmation.", "options": ["Vrai", "Faux"], "correct_option": 0, "answer_text": "", "explanation": "Pourquoi" },
      { "type": "texte", "prompt": "Combien font 6 × 7 ?", "options": [], "correct_option": -1, "answer_text": "42|quarante-deux", "explanation": "" }
    ] }
  ]
}`
    },
    quiz: {
      ask: `Crée un quiz de ${p.count} question(s), en variant les types : "qcm" (3 ou 4 choix), "vf" (vrai/faux) et "texte" (réponse courte : un nombre ou un mot, sans ambiguïté).`,
      json: `{
  "type": "quiz",
  "quiz": {
    "title": "Titre du quiz",
    "intro": "Consigne courte (peut être vide)",
    "questions": [
      { "type": "qcm", "prompt": "Question ?", "options": ["Choix A", "Choix B", "Choix C"], "correct_option": 1, "answer_text": "", "explanation": "Pourquoi" },
      { "type": "vf", "prompt": "Affirmation.", "options": ["Vrai", "Faux"], "correct_option": 0, "answer_text": "", "explanation": "Pourquoi" },
      { "type": "texte", "prompt": "Combien font 6 × 7 ?", "options": [], "correct_option": -1, "answer_text": "42|quarante-deux", "explanation": "" }
    ]
  }
}`
    }
  };
  const f = formats[p.type];
  return `${ctx}\n\n${f.ask}\n\n` +
    `Réponds UNIQUEMENT avec un bloc de code JSON valide, sans texte avant ni après, exactement dans ce format :\n` +
    '```json\n' + f.json + '\n```' +
    (p.type === 'quiz' || p.type === 'mixte' ? '\n"correct_option" est la position de la bonne réponse en partant de 0. Pour "texte", mets les réponses acceptées dans "answer_text", séparées par |.' : '');
}

/**
 * Extrait et lit le JSON collé (tolère les blocs ```json, le texte autour, les guillemets typographiques).
 * Accepte un seul type ({"type":"exercice","items":[…]}, {"type":"quiz","quiz":{…}})
 * ou un mélange ({"elements":[…]}, {"exercices":[…],"quiz":{…},"notions":[…]}, ou une liste).
 * Renvoie { entries: [...] }.
 */
function parseAiReply(text, expectedType) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1];
  const starts = [t.indexOf('{'), t.indexOf('[')].filter(i => i >= 0);
  const start = starts.length ? Math.min(...starts) : -1;
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error('Je ne trouve pas de JSON dans le texte collé. Copie bien toute la réponse de l’IA.');
  t = t.slice(start, end + 1)
    .replace(/[“”]/g, '"')
    .replace(/,\s*([}\]])/g, '$1'); // virgules en trop
  let data;
  try { data = JSON.parse(t); }
  catch { throw new Error('Le JSON collé est incomplet ou abîmé. Redemande à l’IA de répondre « uniquement avec le JSON ».'); }

  const entries = [];
  const itemType = expectedType === 'notion' ? 'notion' : 'exercice';
  const push = (x, fallback) => {
    if (!x || typeof x !== 'object') return;
    const type = x.type || fallback;
    if (type === 'quiz' || Array.isArray(x.questions) || x.quiz) {
      const q = x.quiz || x;
      if (Array.isArray(q.questions) && q.questions.length) {
        entries.push({ type: 'quiz', subject: x.subject || q.subject, title: q.title || x.title, intro: q.intro || q.content || '', questions: q.questions });
      }
      return;
    }
    if (!(x.title || x.titre || x.content || x.enonce)) return;
    entries.push({
      type: type === 'notion' ? 'notion' : 'exercice',
      subject: x.subject || x.matiere,
      title: String(x.title || x.titre || 'Sans titre'),
      content: String(x.content || x.enonce || x.contenu || ''),
      model_answer: String(x.model_answer || x.correction || '')
    });
  };

  if (Array.isArray(data)) data.forEach(x => push(x, itemType));
  else {
    (data.elements || data.éléments || []).forEach(x => push(x, itemType));
    const itemsType = data.type === 'notion' ? 'notion' : data.type === 'exercice' ? 'exercice' : itemType;
    (data.items || []).forEach(x => push(x, itemsType));
    (data.notions || []).forEach(x => push(x, 'notion'));
    (data.exercices || []).forEach(x => push(x, 'exercice'));
    if (data.quiz) push({ ...data.quiz, type: 'quiz' }, 'quiz');
    (data.quizzes || data.quizs || []).forEach(q => push({ ...q, type: 'quiz' }, 'quiz'));
    if (!entries.length && Array.isArray(data.questions)) push({ ...data, type: 'quiz' }, 'quiz');
  }
  if (!entries.length) throw new Error('Aucun exercice, quiz ou notion trouvé dans la réponse.');
  return { entries };
}

/* ---------- Fenêtre « Créer avec l'IA » ---------- */

function openAiDialog() {
  const { student: s } = T.week;
  const subjects = unique([...(s.subjects || []), ...SUBJECTS]);
  const d = Modal.open(`
    <form class="form" id="ai-form">
      <h2>${icon('sparkles')} Créer avec Claude ou ChatGPT</h2>
      <ol class="steps">
        <li>Choisis ce que tu veux : la demande se prépare automatiquement.</li>
        <li>Copie-la et colle-la dans Claude ou ChatGPT (joins ton document si besoin).</li>
        <li>Copie la réponse de l’IA, colle-la en bas et clique sur <strong>Importer</strong>.</li>
      </ol>

      <fieldset class="field"><legend>Que veux-tu créer ?</legend>
        <div class="seg">
          <label><input type="radio" name="type" value="exercice" checked><span>${icon('pencil')} Exercices</span></label>
          <label><input type="radio" name="type" value="quiz"><span>${icon('circle-help')} Quiz</span></label>
          <label><input type="radio" name="type" value="notion"><span>${icon('lightbulb')} Notions</span></label>
          <label><input type="radio" name="type" value="mixte"><span>${icon('layers')} Séance complète</span></label>
        </div>
      </fieldset>
      <div class="row">
        <label class="field"><span>Matière</span>
          <select name="subject">${subjects.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
        <label class="field"><span>Classe</span>
          <select name="level">${LEVELS.map(l => `<option ${l === s.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Sujet / notion</span>
        <input name="topic" maxlength="200" placeholder="Ex : le théorème de Pythagore, le passé composé…"></label>
      <div class="row">
        <label class="field"><span id="count-label">Nombre d’exercices</span>
          <input name="count" type="number" min="1" max="20" value="3"></label>
        <label class="field"><span>Difficulté</span>
          <select name="difficulty"><option>facile</option><option selected>moyen</option><option>difficile</option></select></label>
      </div>
      <label class="field"><span>Consignes supplémentaires <span class="muted">(optionnel)</span></span>
        <textarea name="instructions" rows="2" placeholder="Ex : avec des situations de la vie quotidienne…"></textarea></label>
      <label class="check"><input type="checkbox" name="withDoc"> Je joins un document à l’IA (fiche d’exercices, cours, photo…)</label>

      <div class="prompt-box">
        <div class="prompt-head"><strong>① Demande à copier</strong>
          <div class="actions"><button type="button" class="btn small primary" data-action="copy-prompt">${icon('copy')} Copier</button>${AI_LINKS}</div></div>
        <textarea id="ai-prompt" rows="7" readonly></textarea>
      </div>

      <label class="field"><span>② Colle ici la réponse de l’IA</span>
        <textarea name="reply" rows="6" placeholder="Colle toute la réponse (le bloc JSON)…"></textarea></label>
      <div class="field">
        <span>Fichier à joindre aux exercices pour l’élève <span class="muted">(optionnel)</span></span>
        <input type="file" name="file" accept="application/pdf,image/*,.doc,.docx,.txt">
      </div>
      <p class="form-error" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">Importer</button>
      </div>
    </form>`, { wide: true });

  const form = $('#ai-form', d);
  if (s.subjects?.[0]) form.elements.subject.value = s.subjects[0];
  let lastType = 'exercice';
  const params = () => {
    const f = new FormData(form);
    return {
      type: f.get('type'), subject: f.get('subject'), level: f.get('level'),
      topic: String(f.get('topic')).trim(), count: Math.min(Math.max(Number(f.get('count')) || 3, 1), 20),
      difficulty: f.get('difficulty'), instructions: String(f.get('instructions')).trim(), withDoc: !!f.get('withDoc')
    };
  };
  const sync = () => {
    const p = params();
    if (p.type !== lastType) {
      form.elements.count.value = p.type === 'quiz' ? 8 : 3;
      lastType = p.type;
      p.count = Number(form.elements.count.value);
    }
    $('#count-label', d).textContent = { exercice: 'Nombre d’exercices', quiz: 'Nombre de questions', notion: 'Nombre de notions', mixte: 'Nombre d’exercices' }[p.type];
    $('#ai-prompt', d).value = buildCreationPrompt(p);
  };
  form.addEventListener('input', e => { if (e.target.name !== 'reply') sync(); });
  form.addEventListener('change', e => { if (e.target.name !== 'reply' && e.target.name !== 'file') sync(); });
  sync();

  form.onsubmit = e => {
    e.preventDefault();
    const errEl = $('.form-error', d);
    errEl.hidden = true;
    const p = params();
    try {
      AI.result = parseAiReply(form.elements.reply.value, p.type);
    } catch (ex) {
      errEl.textContent = ex.message; errEl.hidden = false; return;
    }
    AI.params = p;
    AI.file = AI.result.entries.some(x => x.type !== 'quiz') ? (form.elements.file.files[0] || null) : null;
    AI.uploaded = null;
    showAiPreview();
  };
}

/** Convertit un quiz importé en élément + corrigé. */
function quizToItem(q, subject) {
  const questions = [], answers = {};
  (q.questions || []).forEach((x, i) => {
    const id = 'q' + (i + 1);
    const type = ['qcm', 'vf', 'texte'].includes(x.type) ? x.type : (x.options?.length ? 'qcm' : 'texte');
    const options = type === 'vf' ? ['Vrai', 'Faux'] : type === 'texte' ? [] : (x.options || []).map(String).filter(Boolean);
    questions.push({ id, type, prompt: String(x.prompt || x.question || ''), options });
    answers[id] = {
      answer: type === 'texte' ? String(x.answer_text ?? x.answer ?? '') : Math.max(0, Math.min(Number(x.correct_option) || 0, options.length - 1)),
      explanation: String(x.explanation || '')
    };
  });
  return {
    item: { type: 'quiz', subject: subject || AI.params.subject, title: q.title || 'Quiz', content: q.intro || '', questions, instant_result: true },
    key: { answers, model_answer: '' }
  };
}

function aiPresets() {
  return AI.result.entries.map(x => x.type === 'quiz'
    ? quizToItem(x, x.subject)
    : {
      item: { type: x.type, subject: x.subject || AI.params.subject, title: x.title, content: x.content, answer_mode: 'les_deux', share_model: true, instant_result: true },
      key: { answers: {}, model_answer: x.model_answer || '' }
    });
}

function showAiPreview() {
  const presets = aiPresets();
  const cards = presets.map((p, i) => {
    const it = p.item;
    let body;
    if (it.type === 'quiz') {
      body = `<ol class="answers">${it.questions.map(q => `
        <li><p><strong>${rich(q.prompt)}</strong></p>
          ${q.options.length ? `<p class="small">${q.options.map((o, j) => j === Number(p.key.answers[q.id].answer) ? `<strong>${icon('check')} ${esc(o)}</strong>` : esc(o)).join(' · ')}</p>`
            : `<p class="small">Réponse : <strong>${esc(p.key.answers[q.id].answer)}</strong></p>`}
          ${p.key.answers[q.id].explanation ? `<p class="small muted">${rich(p.key.answers[q.id].explanation)}</p>` : ''}</li>`).join('')}</ol>`;
    } else {
      body = `<div class="content">${rich(it.content)}</div>
        ${p.key.model_answer ? `<details><summary class="small">${icon('lock')} Correction type</summary><div class="content small">${rich(p.key.model_answer)}</div></details>` : ''}`;
    }
    return `
      <div class="card ai-preview type-${it.type}">
        <div class="ai-preview-head">
          <label class="check"><input type="checkbox" data-ai-pick="${i}" checked> ${icon(TYPES[it.type].icon)} <strong>${esc(it.title)}</strong></label>
          <button type="button" class="btn small ghost" data-action="ai-edit" data-index="${i}">${icon('pencil')} Modifier puis ajouter</button>
        </div>
        ${body}
      </div>`;
  }).join('');

  Modal.open(`
    <div class="form">
      <h2>${icon('sparkles')} Vérifie avant d’ajouter</h2>
      <p class="muted small">Tu pourras tout modifier ensuite. ${AI.file ? `Le fichier « ${esc(AI.file.name)} » sera joint.` : ''}</p>
      <div class="ai-results">${cards}</div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="open-ai">${icon('rotate-ccw')} Recommencer</button>
        <button type="button" class="btn primary" data-action="ai-add">Ajouter la sélection à la semaine</button>
      </div>
    </div>`, { wide: true });
}

async function aiAttachment() {
  if (!AI.file) return [];
  if (!AI.uploaded) AI.uploaded = await Api.uploadFile(T.week.student.id, 'prof', AI.file);
  return [AI.uploaded];
}

async function aiAddSelected(btn) {
  const presets = aiPresets();
  const picked = $$('[data-ai-pick]').filter(c => c.checked).map(c => presets[Number(c.dataset.aiPick)]);
  if (!picked.length) return toast('Sélectionne au moins un élément.');
  try {
    await busy(btn, 'Ajout…', async () => {
      const att = await aiAttachment();
      for (const p of picked) {
        await Api.saveItem({ ...p.item, week_id: T.week.week.id, attachments: p.item.type === 'quiz' ? [] : att }, p.key);
      }
    });
    AI.uploaded = null;
    Modal.close();
    rerender();
    toast(plural(picked.length, 'élément ajouté', 'éléments ajoutés'));
  } catch (ex) { showError(ex); }
}

async function aiEdit(index) {
  const p = aiPresets()[index];
  try {
    const att = p.item.type === 'quiz' ? [] : await aiAttachment();
    openItemForm(p.item.type, null, { item: { ...p.item, attachments: att }, key: p.key });
  } catch (ex) { showError(ex); }
}

/* ---------- Aide à la correction ---------- */

function buildCorrectionPrompt() {
  const { sub, item, key, student } = T.copy;
  let t = `Je suis professeur particulier. Aide-moi à corriger le travail de mon élève (${student.level}, ${item.subject || 'matière non précisée'}).\n\n` +
    `ÉNONCÉ « ${item.title} » :\n${item.content || '(voir document joint)'}\n\n`;
  if (item.type === 'quiz') {
    t += 'QUESTIONS ET RÉPONSES DE L’ÉLÈVE :\n';
    (item.questions || []).forEach((q, i) => {
      const k = key.answers?.[q.id];
      t += `${i + 1}. ${q.prompt}\n   Réponse de l’élève : ${answerText(q, sub.answers?.[q.id])}\n   Bonne réponse : ${expectedText(q, k?.answer)}\n`;
    });
    if (sub.total) t += `Score : ${sub.score}/${sub.total}\n`;
  } else {
    t += `RÉPONSE ÉCRITE DE L’ÉLÈVE :\n${sub.answer || '(pas de réponse écrite)'}\n`;
    if (sub.files?.length) t += `L’élève a aussi envoyé ${plural(sub.files.length, 'photo/fichier', 'photos/fichiers')} : je les joins.\n`;
  }
  if (key.model_answer) t += `\nMA CORRECTION TYPE :\n${key.model_answer}\n`;
  t += `\nRédige une correction détaillée adressée directement à l’élève (tutoiement, ton bienveillant, adapté à son âge) : ` +
    `ce qui est juste, chaque erreur expliquée avec la bonne démarche, puis un conseil pour progresser. ` +
    `Termine par une proposition de note ou d’appréciation sur une ligne « Note : … ». ` +
    `Écris en texte simple (pas de LaTeX) ; tu peux utiliser **gras**.`;
  return t;
}

function openCorrectionHelper() {
  const { sub } = T.copy;
  const prompt = buildCorrectionPrompt();
  const d = Modal.open(`
    <form class="form" id="corr-ai-form">
      <h2>${icon('sparkles')} Corriger avec Claude ou ChatGPT</h2>
      <div class="prompt-box">
        <div class="prompt-head"><strong>① Demande à copier</strong>
          <div class="actions"><button type="button" class="btn small primary" data-action="copy" data-text="${esc(prompt)}">${icon('copy')} Copier</button>${AI_LINKS}</div></div>
        <textarea rows="8" readonly>${esc(prompt)}</textarea>
      </div>
      ${sub.files?.length ? `<div class="field"><span>Photos / fichiers de l’élève à joindre dans l’IA</span>
        <p class="hint">Ouvre chaque fichier et enregistre-le (ou fais une capture), puis ajoute-le à ta conversation avec l’IA.</p>
        ${fileList(sub.files)}</div>` : ''}
      <label class="field"><span>② Colle ici la correction proposée</span>
        <textarea name="reply" rows="8" placeholder="Colle la réponse de l’IA…"></textarea></label>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">Utiliser cette correction</button>
      </div>
    </form>`, { wide: true });
  const form = $('#corr-ai-form', d);
  form.onsubmit = e => {
    e.preventDefault();
    let text = form.elements.reply.value.trim();
    if (!text) return;
    const cform = $('#correction-form');
    const m = text.match(/^\s*\**\s*Note\s*\**\s*:\s*\**\s*(.+?)\s*\**\s*$/im);
    if (m && !cform.elements.grade.value) {
      cform.elements.grade.value = m[1].replace(/\*+/g, '').trim().slice(0, 60);
      text = text.replace(m[0], '').trim();
    }
    const ta = cform.elements.feedback;
    ta.value = ta.value.trim() ? ta.value.trim() + '\n\n' + text : text;
    Modal.close();
    ta.focus();
    toast('Correction insérée : relis et ajuste avant d’envoyer.');
  };
}
