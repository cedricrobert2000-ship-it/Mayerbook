'use strict';

/* =========================================================
   Génération par l'IA (espace prof)
   ========================================================= */

const AI = { result: null, params: null, file: null };

function openAiDialog() {
  const { student: s } = T.week;
  const subjects = unique([...(s.subjects || []), ...SUBJECTS]);
  const d = Modal.open(`
    <form class="form" id="ai-form">
      <h2>✨ Créer avec l’IA</h2>
      ${Api.mode === 'demo' ? '<p class="notice">Mode démo : l’IA renvoie un exemple fictif. Elle rédige un vrai contenu une fois Supabase et la clé Claude configurés.</p>' : ''}
      <fieldset class="field"><legend>Que veux-tu créer ?</legend>
        <div class="seg">
          <label><input type="radio" name="type" value="exercice" checked><span>✏️ Exercices</span></label>
          <label><input type="radio" name="type" value="quiz"><span>❓ Quiz</span></label>
          <label><input type="radio" name="type" value="notion"><span>💡 Notions</span></label>
        </div>
      </fieldset>
      <div class="row">
        <label class="field"><span>Matière</span>
          <select name="subject">${subjects.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
        <label class="field"><span>Classe</span>
          <select name="level">${LEVELS.map(l => `<option ${l === s.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Sujet / notion</span>
        <input name="topic" maxlength="200" placeholder="Ex : le théorème de Pythagore, le passé composé, les fractions…"></label>
      <div class="row">
        <label class="field"><span id="count-label">Nombre d’exercices</span>
          <input name="count" type="number" min="1" max="10" value="3"></label>
        <label class="field"><span>Difficulté</span>
          <select name="difficulty"><option>facile</option><option selected>moyen</option><option>difficile</option></select></label>
      </div>
      <div class="field">
        <span>À partir d’un fichier <span class="muted">(optionnel : PDF, photo d’une fiche, texte)</span></span>
        <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp,text/plain">
        <span class="hint">Ex : importe une fiche d’exercices pour la convertir, ou un cours pour en tirer un quiz.</span>
        <label class="check" id="attach-wrap" hidden><input type="checkbox" name="attach" checked> Joindre aussi ce fichier aux exercices pour l’élève</label>
      </div>
      <label class="field"><span>Consignes supplémentaires <span class="muted">(optionnel)</span></span>
        <textarea name="instructions" rows="2" placeholder="Ex : avec des situations de la vie quotidienne, sans fractions…"></textarea></label>
      <p class="form-error" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">✨ Générer</button>
      </div>
    </form>`, { wide: true });

  const form = $('#ai-form', d);
  const sync = () => {
    const type = form.elements.type.value;
    $('#count-label', d).textContent = { exercice: 'Nombre d’exercices', quiz: 'Nombre de questions', notion: 'Nombre de notions' }[type];
    if (type === 'quiz' && Number(form.elements.count.value) < 5) form.elements.count.value = 5;
    if (type !== 'quiz' && Number(form.elements.count.value) > 5) form.elements.count.value = 3;
    $('#attach-wrap', d).hidden = !(form.elements.file.files.length && type !== 'quiz');
  };
  form.addEventListener('change', sync);
  if (s.subjects?.[0]) form.elements.subject.value = s.subjects[0];

  form.onsubmit = async e => {
    e.preventDefault();
    const errEl = $('.form-error', d);
    errEl.hidden = true;
    const f = new FormData(form);
    const file = form.elements.file.files[0] || null;
    if (!f.get('topic') && !file) { errEl.textContent = 'Indique un sujet ou importe un fichier.'; errEl.hidden = false; return; }
    if (file && file.size > 15e6) { errEl.textContent = 'Fichier trop lourd (15 Mo max).'; errEl.hidden = false; return; }
    AI.params = {
      mode: 'generer', type: f.get('type'), subject: f.get('subject'), level: f.get('level'),
      topic: String(f.get('topic')).trim(), count: Number(f.get('count')), difficulty: f.get('difficulty'),
      instructions: String(f.get('instructions')).trim()
    };
    AI.file = file && f.get('attach') && AI.params.type !== 'quiz' ? file : null;
    try {
      await busy(form.querySelector('button.primary'), 'L’IA rédige… (jusqu’à 1 minute)', async () => {
        const body = { ...AI.params };
        if (file) body.file = { name: file.name, mime: file.type || 'text/plain', data: await readFileBase64(file) };
        AI.result = await Api.ai(body);
      });
      showAiPreview();
    } catch (ex) {
      errEl.textContent = ex.message; errEl.hidden = false;
    }
  };
}

/** Convertit un quiz généré en élément + corrigé. */
function quizToItem(q) {
  const questions = [], answers = {};
  (q.questions || []).forEach((x, i) => {
    const id = 'q' + (i + 1);
    const type = ['qcm', 'vf', 'texte'].includes(x.type) ? x.type : 'qcm';
    const options = type === 'vf' ? ['Vrai', 'Faux'] : type === 'texte' ? [] : (x.options || []).filter(Boolean);
    questions.push({ id, type, prompt: x.prompt, options });
    answers[id] = {
      answer: type === 'texte' ? (x.answer_text || '') : Math.max(0, Math.min(Number(x.correct_option) || 0, options.length - 1)),
      explanation: x.explanation || ''
    };
  });
  return {
    item: { type: 'quiz', subject: AI.params.subject, title: q.title || 'Quiz', content: q.intro || '', questions, instant_result: true },
    key: { answers, model_answer: '' }
  };
}

function aiPresets() {
  const r = AI.result;
  if (r.type === 'quiz') return [quizToItem(r.quiz)];
  return (r.items || []).map(x => ({
    item: { type: r.type, subject: AI.params.subject, title: x.title, content: x.content, answer_mode: 'les_deux', share_model: true },
    key: { answers: {}, model_answer: x.model_answer || '' }
  }));
}

function showAiPreview() {
  const presets = aiPresets();
  const r = AI.result;
  const cards = presets.map((p, i) => {
    const it = p.item;
    let body;
    if (it.type === 'quiz') {
      body = `<ol class="answers">${it.questions.map(q => `
        <li><p><strong>${rich(q.prompt)}</strong></p>
          ${q.options.length ? `<p class="small">${q.options.map((o, j) => j === Number(p.key.answers[q.id].answer) ? `<strong>✓ ${esc(o)}</strong>` : esc(o)).join(' · ')}</p>`
            : `<p class="small">Réponse : <strong>${esc(p.key.answers[q.id].answer)}</strong></p>`}
          ${p.key.answers[q.id].explanation ? `<p class="small muted">${rich(p.key.answers[q.id].explanation)}</p>` : ''}</li>`).join('')}</ol>`;
    } else {
      body = `<div class="content">${rich(it.content)}</div>
        ${p.key.model_answer ? `<details><summary class="small">🔒 Correction type</summary><div class="content small">${rich(p.key.model_answer)}</div></details>` : ''}`;
    }
    return `
      <div class="card ai-preview type-${it.type}">
        <div class="ai-preview-head">
          <label class="check"><input type="checkbox" data-ai-pick="${i}" checked> <strong>${esc(it.title)}</strong></label>
          <button type="button" class="btn small ghost" data-action="ai-edit" data-index="${i}">✎ Modifier puis ajouter</button>
        </div>
        ${body}
      </div>`;
  }).join('');

  Modal.open(`
    <div class="form">
      <h2>✨ Proposition de l’IA</h2>
      <p class="muted small">Relis avant d’ajouter : tu pourras tout modifier ensuite. ${AI.file ? `Le fichier « ${esc(AI.file.name)} » sera joint.` : ''}</p>
      <div class="ai-results">${cards || '<p>Aucun résultat.</p>'}</div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="open-ai">↺ Recommencer</button>
        <button type="button" class="btn primary" data-action="ai-add">Ajouter ${r.type === 'quiz' ? 'le quiz' : 'la sélection'} à la semaine</button>
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
    toast(`${plural(picked.length, 'élément ajouté', 'éléments ajoutés')} ✓`);
  } catch (ex) { showError(ex); }
}

async function aiEdit(index) {
  const p = aiPresets()[index];
  try {
    const att = p.item.type === 'quiz' ? [] : await aiAttachment();
    openItemForm(p.item.type, null, { item: { ...p.item, attachments: att }, key: p.key });
  } catch (ex) { showError(ex); }
}

async function aiProposeCorrection(btn) {
  const form = $('#correction-form');
  try {
    const r = await busy(btn, 'L’IA corrige…', () => Api.ai({ mode: 'corriger', submission_id: T.copy.sub.id }));
    const ta = form.elements.feedback;
    if (ta.value.trim() && !confirm('Remplacer ta correction actuelle par celle proposée par l’IA ?')) {
      ta.value += '\n\n' + r.feedback;
    } else {
      ta.value = r.feedback;
    }
    if (!form.elements.grade.value) form.elements.grade.value = r.grade || '';
    toast('Proposition insérée : relis et ajuste avant d’envoyer.');
  } catch (ex) { showError(ex); }
}
