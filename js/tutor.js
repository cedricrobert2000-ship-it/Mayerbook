'use strict';

/* =========================================================
   Espace prof
   ========================================================= */

const T = {
  levelFilter: 'all',
  week: null,      // données de la semaine affichée
  copy: null,      // copie en cours de correction
  student: null    // fiche élève affichée
};

/* ---------- Tableau de bord ---------- */

async function viewTutorHome() {
  const { students, weeks, items, subs } = await Api.tutorOverview();
  const weeksBy = groupBy(weeks, 'student_id');
  const itemsBy = groupBy(items, 'week_id');
  const subsBy = groupBy(subs, 'student_id');
  const toCorrect = subs.filter(s => s.status === 'envoye');

  const all = students.slice().sort((a, b) =>
    LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.name.localeCompare(b.name, 'fr'));
  const levels = unique(all.map(s => s.level));
  if (T.levelFilter !== 'all' && !levels.includes(T.levelFilter)) T.levelFilter = 'all';
  const shown = T.levelFilter === 'all' ? all : all.filter(s => s.level === T.levelFilter);

  const head = `
    <div class="page-head">
      <div>
        <h1>Mes élèves</h1>
        <p class="muted">${all.length ? plural(all.length, 'élève suivi', 'élèves suivis') : 'Commence par ajouter un élève.'}</p>
      </div>
      <div class="actions">
        ${toCorrect.length ? `<a class="btn" href="#/corrections">📝 À corriger <span class="count-badge">${toCorrect.length}</span></a>` : ''}
        <button class="btn primary" data-action="new-student">＋ Nouvel élève</button>
      </div>
    </div>`;

  if (!all.length) {
    return head + `
      <div class="empty card">
        <div class="empty-icon">👩‍🏫</div>
        <h2>Bienvenue sur Mayerbook</h2>
        <p>Crée une fiche par élève : Mayerbook lui donne un <strong>identifiant</strong> et un <strong>code</strong>
        pour se connecter à son espace. Chaque semaine, tu lui prépares des notions, des exercices et des quiz
        (à la main ou avec l’IA), il répond en ligne et tu corriges.</p>
        <div class="actions center"><button class="btn primary" data-action="new-student">＋ Ajouter mon premier élève</button></div>
      </div>`;
  }

  const chips = levels.length > 1 ? `
    <div class="chips">
      <button class="chip ${T.levelFilter === 'all' ? 'active' : ''}" data-action="filter-level" data-level="all">Tous</button>
      ${levels.map(l => `<button class="chip ${T.levelFilter === l ? 'active' : ''}" data-action="filter-level" data-level="${esc(l)}">${esc(l)}</button>`).join('')}
    </div>` : '';

  const cards = shown.map(s => {
    const sw = weeksBy[s.id] || [];
    const w = sw.find(isCurrentWeek) || sw[0];
    const pending = (subsBy[s.id] || []).filter(x => x.status === 'envoye').length;
    let info = '<p class="muted small">Aucune semaine préparée</p>';
    if (w) {
      const its = itemsBy[w.id] || [];
      const p = progressOf(its, indexBy((subsBy[s.id] || []).filter(x => its.some(i => i.id === x.item_id)), 'item_id'));
      info = `
        <p class="small"><strong>${esc(weekLabel(w))}</strong> ${w.published ? '' : '<span class="pill">Brouillon</span>'}</p>
        ${progressBar(p, { small: true })}
        <p class="small muted">${p.done}/${p.total} terminé${p.done > 1 ? 's' : ''}</p>`;
    }
    return `
      <a class="card student-card" href="#/eleve/${s.id}">
        <div class="student-card-head">
          ${avatar(s.name)}
          <div class="grow">
            <h3>${esc(s.name)}</h3>
            <span class="badge">${esc(s.level)}</span>
          </div>
          ${pending ? `<span class="count-badge" title="Copies à corriger">${pending}</span>` : ''}
        </div>
        <div class="tags">${(s.subjects || []).map(subjectTag).join('')}</div>
        <div class="student-card-week">${info}</div>
      </a>`;
  }).join('');

  return head + chips + `<div class="grid">${cards}</div>`;
}

/* ---------- Fiche élève ---------- */

async function viewTutorStudent(sid) {
  const data = await Api.studentFull(sid);
  if (!data) return notFound();
  T.student = data.student;
  const { student: s, weeks, items, subs } = data;
  const itemsBy = groupBy(items, 'week_id');
  const subsByItem = indexBy(subs, 'item_id');

  // Statistiques
  const exos = items.filter(i => i.type === 'exercice');
  const quizzes = items.filter(i => i.type === 'quiz');
  const exDone = exos.filter(i => isItemDone(i, subsByItem[i.id])).length;
  const qScored = quizzes.map(i => subsByItem[i.id]).filter(x => x && x.total && x.status === 'corrige');
  const qAvg = qScored.length ? Math.round(100 * qScored.reduce((a, x) => a + x.score / x.total, 0) / qScored.length) : null;

  const weekRows = weeks.map(w => {
    const its = itemsBy[w.id] || [];
    const p = progressOf(its, subsByItem);
    const pending = its.filter(i => subsByItem[i.id]?.status === 'envoye').length;
    const counts = TYPE_ORDER.map(t => {
      const n = its.filter(i => i.type === t).length;
      return n ? `<span>${TYPES[t].icon} ${n}</span>` : '';
    }).join('');
    return `
      <a class="card week-row" href="#/semaine/${w.id}">
        <div class="week-row-main">
          <h3>${esc(weekLabel(w))} ${isCurrentWeek(w) ? '<span class="pill now">Cette semaine</span>' : ''}</h3>
          ${w.title ? `<p class="muted">${esc(w.title)}</p>` : ''}
          <div class="counts">${counts || '<span class="muted">Vide</span>'}
            ${w.published ? '' : '<span class="pill">Brouillon, non visible</span>'}
            ${pending ? `<span class="status ko">${pending} à corriger</span>` : ''}</div>
        </div>
        <div class="week-row-side">
          <span class="pct">${p.pct}%</span>${progressBar(p, { small: true })}
        </div>
      </a>`;
  }).join('');

  return `
    <nav class="crumbs"><a href="#/">← Mes élèves</a></nav>
    <div class="page-head">
      <div class="student-head">
        ${avatar(s.name, 'lg')}
        <div>
          <h1>${esc(s.name)}</h1>
          <div class="tags"><span class="badge">${esc(s.level)}</span>${(s.subjects || []).map(subjectTag).join('')}</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn" data-action="edit-student">Modifier</button>
        <button class="btn danger ghost" data-action="delete-student">Supprimer</button>
      </div>
    </div>

    <div class="stat-row">
      <div class="card stat"><span class="stat-num">${weeks.length}</span><span class="muted small">semaine${weeks.length > 1 ? 's' : ''}</span></div>
      <div class="card stat"><span class="stat-num">${exDone}/${exos.length}</span><span class="muted small">exercices rendus</span></div>
      <div class="card stat"><span class="stat-num">${qAvg === null ? '—' : qAvg + '%'}</span><span class="muted small">moyenne aux quiz</span></div>
    </div>

    <div class="card account">
      <div>
        <h3>🔑 Connexion de l’élève</h3>
        <p class="small">Identifiant : <code class="big-code">${esc(s.username)}</code></p>
        <p class="small muted">Le code est choisi par toi. Tu peux le changer à tout moment.</p>
      </div>
      <div class="actions">
        <button class="btn" data-action="reset-code">Changer le code</button>
        <button class="btn" data-action="copy-login" data-username="${esc(s.username)}">Copier les instructions</button>
      </div>
    </div>

    ${s.notes || s.contact ? `
      <div class="card subtle">
        ${s.contact ? `<p><strong>Contact :</strong> ${esc(s.contact)}</p>` : ''}
        ${s.notes ? `<p><strong>Notes :</strong> ${rich(s.notes)}</p>` : ''}
      </div>` : ''}

    <div class="section-head">
      <h2>Semaines</h2>
      <button class="btn primary" data-action="new-week">＋ Nouvelle semaine</button>
    </div>
    ${weekRows || '<div class="empty card"><p>Aucune semaine pour l’instant.</p></div>'}`;
}

/* ---------- Semaine ---------- */

async function viewTutorWeek(wid) {
  const data = await Api.weekFull(wid);
  if (!data) return notFound();
  T.week = data;
  const { week: w, student: s, items, subs } = data;
  const p = progressOf(items, subs);

  const sections = TYPE_ORDER.map(type => {
    const list = items.filter(i => i.type === type);
    return `
      <section class="item-section">
        <div class="section-head">
          <h2>${TYPES[type].icon} ${TYPES[type].plural} <span class="muted count">${list.length}</span></h2>
          <button class="btn small" data-action="add-item" data-type="${type}">＋ Ajouter</button>
        </div>
        ${list.length ? list.map((it, i) => tutorItemCard(it, subs[it.id], i, list.length)).join('')
          : `<p class="muted small empty-line">Rien pour l’instant.</p>`}
      </section>`;
  }).join('');

  return `
    <nav class="crumbs"><a href="#/">Mes élèves</a> › <a href="#/eleve/${s.id}">${esc(s.name)}</a></nav>
    <div class="page-head">
      <div>
        <h1>${esc(weekLabel(w))}</h1>
        <p class="muted">${esc(s.name)} · ${esc(s.level)}${w.title ? ' · ' + esc(w.title) : ''}</p>
      </div>
      <div class="actions">
        <button class="btn" data-action="edit-week">Modifier</button>
        <button class="btn danger ghost" data-action="delete-week">Supprimer</button>
      </div>
    </div>

    <div class="layout">
      <div class="layout-main">
        <div class="card ai-card">
          <div>
            <h3>✨ Créer avec l’IA</h3>
            <p class="small muted">Prépare en un clic la demande à coller dans Claude ou ChatGPT (exercices, quiz, notions
            adaptés au niveau de ${esc(firstName(s.name))}), puis importe sa réponse ici.</p>
          </div>
          <button class="btn primary" data-action="open-ai">Créer / importer</button>
        </div>

        <div class="card">
          <label class="field">
            <span>Message pour ${esc(firstName(s.name))} <span class="muted">(affiché en haut de sa semaine)</span></span>
            <textarea rows="2" data-field="week-message" placeholder="Ex : Super séance ! Cette semaine on se concentre sur…">${esc(w.message)}</textarea>
          </label>
        </div>
        ${sections}
      </div>

      <aside class="layout-side">
        <div class="card publish-card ${w.published ? 'is-published' : ''}">
          <h3>${w.published ? '✅ Visible par l’élève' : '🙈 Brouillon'}</h3>
          <p class="small muted">${w.published
            ? `${esc(firstName(s.name))} voit cette semaine dans son espace.`
            : `${esc(firstName(s.name))} ne voit pas encore cette semaine. Publie-la quand elle est prête.`}</p>
          <button class="btn ${w.published ? '' : 'primary'} block" data-action="toggle-publish" ${items.length || w.published ? '' : 'disabled'}>
            ${w.published ? 'Masquer' : 'Publier pour l’élève'}</button>
        </div>
        <div class="card">
          <h3>📊 Avancement</h3>
          <div class="big-pct">${p.pct}%</div>
          ${progressBar(p)}
          <p class="small">${p.done} / ${p.total} terminé${p.done > 1 ? 's' : ''}</p>
        </div>
        <div class="card">
          <h3>➡️ Semaine suivante</h3>
          <p class="small muted">Crée la semaine d’après en reprenant ce qui n’est pas acquis.</p>
          <button class="btn block" data-action="next-week">Préparer la semaine suivante</button>
        </div>
      </aside>
    </div>`;
}

function tutorItemCard(it, sub, idx, count) {
  let status = '';
  if (it.type === 'notion') {
    status = sub?.understood ? '<span class="status ok">✓ Comprise</span>' : '';
  } else if (sub?.status === 'envoye') {
    status = `<a class="status ko" href="#/copie/${sub.id}">📝 À corriger</a>`;
  } else if (sub?.status === 'corrige') {
    const score = it.type === 'quiz' && sub.total ? ` · ${sub.score}/${sub.total}` : (sub.grade ? ` · ${esc(sub.grade)}` : '');
    status = `<a class="status ok" href="#/copie/${sub.id}">✓ Corrigé${score}</a>`;
  } else if (sub && (sub.answer || Object.keys(sub.answers || {}).length || sub.files?.length)) {
    status = '<span class="status mid">En cours</span>';
  }
  const meta = it.type === 'quiz'
    ? `${plural(it.questions?.length || 0, 'question')} · ${it.instant_result ? 'score affiché à l’envoi' : 'score après ta validation'}`
    : truncate(it.content, 140);
  const extras = [
    it.attachments?.length ? `📎 ${plural(it.attachments.length, 'fichier')}` : '',
    it.type === 'exercice' ? ANSWER_MODES[it.answer_mode] : '',
    it.type === 'exercice' && T.week.keys[it.id]?.model_answer
      ? (!it.share_model ? 'Correction privée' : it.instant_result ? 'Correction montrée après l’envoi' : 'Correction montrée après ta correction') : '',
    it.link ? '🔗 Lien' : ''
  ].filter(Boolean).join(' · ');
  return `
    <div class="card item-card type-${it.type}">
      <div class="item-card-main" data-action="edit-item" data-iid="${it.id}">
        <div class="item-card-top">${subjectTag(it.subject)}${status}</div>
        <h4>${esc(it.title)}</h4>
        ${meta ? `<p class="small muted">${esc(meta)}</p>` : ''}
        ${extras ? `<p class="tiny muted">${esc(extras)}</p>` : ''}
      </div>
      <div class="item-card-tools">
        <button class="icon-btn" title="Monter" data-action="move-item" data-dir="-1" data-iid="${it.id}" ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" title="Descendre" data-action="move-item" data-dir="1" data-iid="${it.id}" ${idx === count - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn" title="Modifier" data-action="edit-item" data-iid="${it.id}">✎</button>
        <button class="icon-btn danger" title="Supprimer" data-action="delete-item" data-iid="${it.id}">🗑</button>
      </div>
    </div>`;
}

function notFound() {
  return `<div class="empty card"><h2>Introuvable</h2><p>Cette page n’existe pas ou a été supprimée.</p><a class="btn" href="#/">Retour à l’accueil</a></div>`;
}

/* ---------- Copies à corriger ---------- */

async function viewTutorCorrections() {
  const list = await Api.listToCorrect();
  const rows = list.map(({ sub, item, student }) => `
    <a class="card week-row" href="#/copie/${sub.id}">
      <div class="week-row-main">
        <div class="item-card-top">${avatar(student.name, 'sm')} <strong>${esc(student.name)}</strong> <span class="badge">${esc(student.level)}</span> ${subjectTag(item.subject)}</div>
        <h3>${TYPES[item.type].icon} ${esc(item.title)}</h3>
        <p class="small muted">Envoyé le ${fmtDateTime(sub.submitted_at)}</p>
      </div>
      <div class="week-row-side"><span class="btn small primary">Corriger →</span></div>
    </a>`).join('');
  return `
    <nav class="crumbs"><a href="#/">← Mes élèves</a></nav>
    <div class="page-head"><div><h1>📝 À corriger</h1>
      <p class="muted">${list.length ? plural(list.length, 'copie envoyée', 'copies envoyées') + ' par tes élèves' : 'Tout est corrigé 🎉'}</p></div></div>
    ${rows || '<div class="empty card"><div class="empty-icon">✅</div><p>Aucune copie en attente.</p></div>'}`;
}

async function viewTutorCopy(subId) {
  const data = await Api.submissionFull(subId);
  if (!data) return notFound();
  T.copy = { ...data, feedbackFiles: [...(data.sub.feedback_files || [])] };
  const { sub, item, key, week, student } = data;
  const sent = sub.status !== 'brouillon';

  let answerHtml;
  if (item.type === 'quiz') {
    answerHtml = `
      <div class="quiz-score">${sub.total ? `Score automatique : <strong>${sub.score} / ${sub.total}</strong>` : 'Pas encore envoyé'}</div>
      <ol class="answers">${(item.questions || []).map(q => {
        const k = key.answers?.[q.id];
        const val = sub.answers?.[q.id];
        const ok = isCorrect(q, k?.answer, val);
        return `<li class="${ok ? 'ok' : 'ko'}">
          <p><strong>${rich(q.prompt)}</strong></p>
          <p>${ok ? '✅' : '❌'} Réponse : ${esc(answerText(q, val))}</p>
          ${ok ? '' : `<p class="muted">Attendu : ${esc(expectedText(q, k?.answer))}</p>`}
        </li>`;
      }).join('')}</ol>`;
  } else {
    answerHtml = `
      ${sub.answer ? `<div class="student-answer">${rich(sub.answer)}</div>` : '<p class="muted">Pas de réponse écrite.</p>'}
      ${imagePreviews(sub.files)}
      ${fileList(sub.files)}`;
  }

  return `
    <nav class="crumbs"><a href="#/corrections">À corriger</a> › <a href="#/semaine/${week.id}">${esc(student.name)} · ${esc(weekLabel(week))}</a></nav>
    <div class="page-head">
      <div>
        <h1>${TYPES[item.type].icon} ${esc(item.title)}</h1>
        <p class="muted">${esc(student.name)} · ${esc(student.level)} · ${subjectTag(item.subject)}
          ${sub.submitted_at ? ` · envoyé le ${fmtDateTime(sub.submitted_at)}` : ''}</p>
      </div>
      <span class="status ${sub.status === 'corrige' ? 'ok' : sub.status === 'envoye' ? 'ko' : 'mid'} big">
        ${{ brouillon: 'Pas encore envoyé', envoye: 'À corriger', corrige: 'Corrigé' }[sub.status]}</span>
    </div>

    <div class="layout">
      <div class="layout-main">
        <details class="card" ${item.type === 'quiz' ? '' : 'open'}>
          <summary><strong>Énoncé</strong></summary>
          <div class="content">${rich(item.content)}</div>
          ${fileList(item.attachments)}
        </details>

        <div class="card">
          <h2>Réponse de ${esc(firstName(student.name))}</h2>
          ${answerHtml}
        </div>

        ${key.model_answer ? `
          <details class="card subtle">
            <summary><strong>📘 Ta correction type</strong> <span class="muted small">(${!item.share_model ? 'privée' : item.instant_result ? 'déjà visible par l’élève depuis son envoi' : 'sera montrée à l’élève avec ta correction'})</span></summary>
            <div class="content">${rich(key.model_answer)}</div>
            <button class="btn small" data-action="insert-model">Insérer dans ma correction</button>
          </details>` : ''}

        <form class="card form-inline" id="correction-form">
          <div class="section-head tight">
            <h2>✍️ Ma correction détaillée</h2>
            <button type="button" class="btn small" data-action="ai-correct" ${sent ? '' : 'disabled'}>✨ Corriger avec Claude / ChatGPT</button>
          </div>
          <textarea name="feedback" rows="10" placeholder="Explique ce qui est juste, chaque erreur et comment progresser…">${esc(sub.feedback)}</textarea>
          <span class="hint">**texte** pour mettre en gras. Ta correction n’est visible par l’élève qu’après avoir cliqué sur « Envoyer la correction ».</span>
          <label class="field"><span>Note ou appréciation</span>
            <input name="grade" value="${esc(sub.grade)}" placeholder="Ex : 15/20, Acquis, Très bien…"></label>
          <div class="field">
            <span>Fichiers joints <span class="muted">(ex : photo de la copie annotée)</span></span>
            <div id="feedback-files">${fileList(T.copy.feedbackFiles, { removable: true, dataAttr: 'data-list="feedback"' })}</div>
            <label class="btn small file-btn">📎 Ajouter un fichier<input type="file" data-upload="feedback" multiple hidden></label>
          </div>
          <div class="form-actions static">
            ${sent ? '<button type="button" class="btn ghost" data-action="return-copy">↩︎ Renvoyer à l’élève pour qu’il refasse</button>' : ''}
            <button class="btn primary" ${sent ? '' : 'disabled'}>${sub.status === 'corrige' ? 'Mettre à jour la correction' : 'Envoyer la correction'}</button>
          </div>
          ${sent ? '' : '<p class="hint">L’élève n’a pas encore envoyé ce travail.</p>'}
        </form>
      </div>
      <aside class="layout-side">
        <div class="card">
          <h3>Élève</h3>
          <p>${avatar(student.name, 'sm')} <a href="#/eleve/${student.id}">${esc(student.name)}</a></p>
          <a class="btn block" href="#/semaine/${week.id}">Voir la semaine</a>
        </div>
      </aside>
    </div>`;
}

/* ---------- Formulaires : élève ---------- */

function openStudentForm(existing) {
  const s = existing || null;
  const subj = s ? s.subjects || [] : [];
  const custom = subj.filter(x => !SUBJECTS.includes(x));
  const d = Modal.open(`
    <form class="form">
      <h2>${s ? 'Modifier l’élève' : 'Nouvel élève'}</h2>
      <label class="field"><span>Nom de l’élève *</span>
        <input name="name" required maxlength="80" value="${esc(s?.name)}" placeholder="Prénom Nom" autofocus></label>
      <label class="field"><span>Classe *</span>
        <select name="level" required>
          ${LEVELS.map(l => `<option ${(s?.level || '') === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      ${s ? '' : `
        <div class="row">
          <label class="field"><span>Identifiant de connexion *</span>
            <input name="username" required maxlength="30" pattern="[a-z0-9][a-z0-9._\\-]{2,29}" placeholder="prenom.nom" autocomplete="off">
            <span class="hint">Lettres minuscules, chiffres, point ou tiret.</span></label>
          <label class="field"><span>Code secret *</span>
            <input name="code" required minlength="4" maxlength="40" value="${randomCode()}" autocomplete="off">
            <span class="hint">4 caractères minimum.</span></label>
        </div>`}
      <fieldset class="field"><legend>Matières suivies</legend>
        <div class="check-grid">
          ${SUBJECTS.map(x => `<label class="check"><input type="checkbox" name="subjects" value="${esc(x)}" ${subj.includes(x) ? 'checked' : ''}> ${esc(x)}</label>`).join('')}
        </div>
        <input name="custom" placeholder="Autres matières (séparées par des virgules)" value="${esc(custom.join(', '))}">
      </fieldset>
      <label class="field"><span>Contact (parents, téléphone…)</span>
        <input name="contact" maxlength="160" value="${esc(s?.contact)}"></label>
      <label class="field"><span>Notes perso <span class="muted">(jamais visibles par l’élève)</span></span>
        <textarea name="notes" rows="3">${esc(s?.notes)}</textarea></label>
      <p class="form-error" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">${s ? 'Enregistrer' : 'Créer l’élève'}</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  if (!s) {
    const name = form.elements.name, user = form.elements.username;
    name.addEventListener('input', () => { if (!user.dataset.touched) user.value = slugify(name.value); });
    user.addEventListener('input', () => { user.dataset.touched = '1'; });
  }
  form.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(form);
    const data = {
      name: String(f.get('name')).trim(),
      level: f.get('level'),
      subjects: unique([...f.getAll('subjects'), ...String(f.get('custom')).split(',').map(x => x.trim())]),
      contact: String(f.get('contact')).trim(),
      notes: String(f.get('notes')).trim()
    };
    const btn = form.querySelector('button.primary');
    try {
      await busy(btn, 'Enregistrement…', async () => {
        if (s) {
          await Api.updateStudent(s.id, data);
          Modal.close();
          rerender();
          toast('Élève enregistré ✓');
        } else {
          data.username = String(f.get('username')).trim().toLowerCase();
          data.code = String(f.get('code')).trim();
          const ns = await Api.createStudent(data);
          showLoginInfo(ns, data.code);
        }
      });
    } catch (err) {
      const el = $('.form-error', d); el.textContent = err.message; el.hidden = false;
    }
  };
}

function loginInstructions(username, code) {
  return `Bonjour ! Voici ton accès à Mayerbook pour suivre ton travail de la semaine :\n` +
    `🔗 ${location.href.split('#')[0]}\n👤 Identifiant : ${username}\n🔑 Code : ${code || '(donné par ton prof)'}`;
}

function showLoginInfo(student, code) {
  const text = loginInstructions(student.username, code);
  Modal.open(`
    <div class="form">
      <h2>🎉 ${esc(student.name)} a son compte</h2>
      <p>Donne-lui ces informations pour se connecter (sur téléphone, tablette ou ordinateur) :</p>
      <div class="login-card">
        <p>Identifiant <code class="big-code">${esc(student.username)}</code></p>
        <p>Code <code class="big-code">${esc(code)}</code></p>
      </div>
      <p class="hint">Note bien le code : pour des raisons de sécurité, il ne sera plus affiché. Tu pourras en choisir un nouveau à tout moment.</p>
      <div class="actions wrap">
        <button type="button" class="btn" data-action="copy" data-text="${esc(text)}">📋 Copier le message</button>
        <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">💬 WhatsApp</a>
      </div>
      <div class="form-actions"><a class="btn primary" href="#/eleve/${student.id}" data-action="close-modal-go">Continuer</a></div>
    </div>`);
}

function openResetCode() {
  const s = T.student;
  const d = Modal.open(`
    <form class="form">
      <h2>🔑 Nouveau code pour ${esc(s.name)}</h2>
      <label class="field"><span>Nouveau code</span>
        <input name="code" required minlength="4" maxlength="40" value="${randomCode()}" autocomplete="off"></label>
      <p class="form-error" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">Enregistrer le code</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  form.onsubmit = async e => {
    e.preventDefault();
    const code = form.elements.code.value.trim();
    try {
      await busy(form.querySelector('button.primary'), 'Enregistrement…', () => Api.resetCode(s.id, code));
      showLoginInfo(s, code);
    } catch (err) {
      const el = $('.form-error', d); el.textContent = err.message; el.hidden = false;
    }
  };
}

/* ---------- Formulaires : semaine ---------- */

async function openWeekForm(existing, s) {
  const w = existing || null;
  let defStart = mondayOf(todayISO());
  if (!w) {
    const full = await Api.studentFull(s.id);
    if (full.weeks[0] && full.weeks[0].start_date >= defStart) defStart = addDays(full.weeks[0].start_date, 7);
  }
  const d = Modal.open(`
    <form class="form">
      <h2>${w ? 'Modifier la semaine' : 'Nouvelle semaine'} · ${esc(s.name)}</h2>
      <label class="field"><span>Début de la semaine *</span>
        <input type="date" name="start" required value="${w ? w.start_date : defStart}"></label>
      <label class="field"><span>Thème <span class="muted">(optionnel)</span></span>
        <input name="title" maxlength="100" value="${esc(w?.title)}" placeholder="Ex : Révisions contrôle fractions"></label>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">${w ? 'Enregistrer' : 'Créer la semaine'}</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  form.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      await busy(form.querySelector('button.primary'), 'Enregistrement…', async () => {
        const saved = await Api.saveWeek({ ...(w || { student_id: s.id, message: '', published: false }), start_date: f.get('start'), title: String(f.get('title')).trim() });
        Modal.close();
        if (w) rerender(); else location.hash = `#/semaine/${saved.id}`;
      });
    } catch (err) { showError(err); }
  };
}

function openNextWeekForm() {
  const { week: w, student: s, items, subs, keys } = T.week;
  const notions = items.filter(i => i.type === 'notion' && !subs[i.id]?.understood);
  const exos = items.filter(i => i.type === 'exercice' && subs[i.id]?.status !== 'corrige');
  const quizzes = items.filter(i => i.type === 'quiz' && !(subs[i.id]?.status === 'corrige' && subs[i.id].score === subs[i.id].total));
  const opt = (name, list, label) => list.length
    ? `<label class="check"><input type="checkbox" name="${name}" checked> ${label} <span class="muted">(${list.length})</span></label>
       <ul class="mini-list">${list.map(i => `<li>${esc(i.title)}</li>`).join('')}</ul>` : '';
  const any = notions.length + exos.length + quizzes.length;
  const d = Modal.open(`
    <form class="form">
      <h2>Semaine suivante · ${esc(s.name)}</h2>
      <label class="field"><span>Début de la semaine</span>
        <input type="date" name="start" required value="${addDays(w.start_date, 7)}"></label>
      ${any ? `<fieldset class="field"><legend>Reprendre dans la nouvelle semaine</legend>
        ${opt('notions', notions, 'Notions pas encore comprises')}
        ${opt('exos', exos, 'Exercices non rendus ou non corrigés')}
        ${opt('quizzes', quizzes, 'Quiz non réussis à 100 %')}
      </fieldset>` : '<p class="notice ok">🎉 Tout est acquis ! La nouvelle semaine sera vide.</p>'}
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">Créer la semaine</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  form.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(form);
    const chosen = [...(f.get('notions') ? notions : []), ...(f.get('exos') ? exos : []), ...(f.get('quizzes') ? quizzes : [])];
    try {
      await busy(form.querySelector('button.primary'), 'Création…', async () => {
        const nw = await Api.saveWeek({ student_id: s.id, start_date: f.get('start'), title: '', message: '', published: false });
        for (const it of chosen) {
          const { id, week_id, position, created_at, ...rest } = it;
          await Api.saveItem({ ...rest, week_id: nw.id }, keys[it.id]);
        }
        Modal.close();
        location.hash = `#/semaine/${nw.id}`;
        toast('Nouvelle semaine créée ✓');
      });
    } catch (err) { showError(err); }
  };
}

/* ---------- Formulaire : élément ---------- */

function newQuestion(type = 'qcm') {
  return {
    id: uid().slice(0, 8), type, prompt: '',
    options: type === 'qcm' ? ['', ''] : type === 'vf' ? ['Vrai', 'Faux'] : [],
    answer: type === 'texte' ? '' : 0,
    explanation: ''
  };
}

/** Ouvre l'éditeur. `preset` permet de pré-remplir (ex. contenu généré par l'IA). */
function openItemForm(type, iid, preset) {
  const { week: w, student: s, items, keys } = T.week;
  const existing = iid ? items.find(i => i.id === iid) : null;
  type = existing ? existing.type : type;
  const key = existing ? (keys[existing.id] || {}) : (preset?.key || {});
  const base = existing || preset?.item || {};
  const draft = {
    id: existing?.id,
    week_id: w.id,
    type,
    subject: base.subject || s.subjects?.[0] || '',
    title: base.title || '',
    content: base.content || '',
    link: base.link || '',
    attachments: [...(base.attachments || [])],
    answer_mode: base.answer_mode || 'les_deux',
    instant_result: base.instant_result !== false,
    share_model: !!base.share_model,
    model_answer: key.model_answer || '',
    // questions avec leurs réponses (fusion questions + corrigé)
    questions: (base.questions || (type === 'quiz' ? [newQuestion('qcm')] : [])).map(q => ({
      ...q, options: [...(q.options || [])],
      answer: key.answers?.[q.id]?.answer ?? q.answer ?? (q.type === 'texte' ? '' : 0),
      explanation: key.answers?.[q.id]?.explanation ?? q.explanation ?? ''
    }))
  };
  const subjects = unique([draft.subject, ...(s.subjects || []), ...SUBJECTS]);
  const contentLabel = { notion: 'Explication / rappel de cours', exercice: 'Énoncé', quiz: 'Consigne (optionnel)' }[type];

  const d = Modal.open(`
    <form class="form" novalidate>
      <h2>${TYPES[type].icon} ${existing ? 'Modifier' : 'Ajouter'} ${TYPES[type].un}</h2>
      <div class="row">
        <label class="field"><span>Matière</span>
          <select name="subject">${subjects.map(x => `<option ${x === draft.subject ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="field grow"><span>Titre *</span>
          <input name="title" required maxlength="120" value="${esc(draft.title)}" autofocus></label>
      </div>
      <label class="field"><span>${contentLabel}</span>
        <textarea name="content" rows="${type === 'quiz' ? 2 : 6}">${esc(draft.content)}</textarea>
        <span class="hint">**texte** pour mettre en gras. Les liens http… deviennent cliquables.</span></label>
      ${type !== 'quiz' ? `
        <div class="field">
          <span>Fichiers pour l’élève <span class="muted">(fiche d’exercices PDF, photo, document…)</span></span>
          <div id="att-list"></div>
          <label class="btn small file-btn">📎 Importer un fichier<input type="file" data-upload="attachments" multiple hidden></label>
        </div>` : ''}
      ${type === 'notion' ? `
        <label class="field"><span>Lien utile <span class="muted">(vidéo, fiche… optionnel)</span></span>
          <input name="link" type="url" value="${esc(draft.link)}" placeholder="https://"></label>` : ''}
      ${type === 'exercice' ? `
        <label class="field"><span>Comment l’élève répond</span>
          <select name="answer_mode">${Object.entries(ANSWER_MODES).map(([k, v]) => `<option value="${k}" ${draft.answer_mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>🔒 Correction type <span class="muted">(visible seulement par toi, sert aussi à l’IA pour corriger)</span></span>
          <textarea name="model_answer" rows="4">${esc(draft.model_answer)}</textarea></label>
        <label class="field"><span>Quand l’élève voit cette correction</span>
          <select name="show_model">
            <option value="instant" ${draft.share_model && draft.instant_result ? 'selected' : ''}>Juste après avoir envoyé sa réponse (jamais avant)</option>
            <option value="after" ${draft.share_model && !draft.instant_result ? 'selected' : ''}>Après ma correction personnalisée</option>
            <option value="never" ${!draft.share_model ? 'selected' : ''}>Jamais (elle reste privée)</option>
          </select>
          <span class="hint">Dans tous les cas, la copie arrive dans « À corriger » : tu peux ensuite lui envoyer une correction personnalisée.</span></label>` : ''}
      ${type === 'quiz' ? `
        <label class="check"><input type="checkbox" name="instant_result" ${draft.instant_result ? 'checked' : ''}> Afficher le score et les corrections à l’élève dès qu’il envoie
          <span class="hint">Sinon, il les verra après ta validation.</span></label>
        <div class="q-list" id="q-list"></div>
        <div class="actions">
          <button type="button" class="btn small" data-q="add" data-qtype="qcm">＋ QCM</button>
          <button type="button" class="btn small" data-q="add" data-qtype="vf">＋ Vrai / Faux</button>
          <button type="button" class="btn small" data-q="add" data-qtype="texte">＋ Réponse courte</button>
        </div>` : ''}
      <p class="form-error" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">Enregistrer</button>
      </div>
    </form>`, { wide: type !== 'notion' });

  const form = d.querySelector('form');
  const err = msg => { const el = $('.form-error', d); el.textContent = msg; el.hidden = !msg; };

  // Fichiers joints
  const attList = $('#att-list', d);
  const drawAtt = () => {
    if (!attList) return;
    attList.innerHTML = fileList(draft.attachments, { removable: true, dataAttr: 'data-list="att"' });
    hydrateFiles(attList);
  };
  drawAtt();
  form.addEventListener('change', async e => {
    if (e.target.dataset.upload !== 'attachments') return;
    const files = [...e.target.files];
    e.target.value = '';
    const label = e.target.closest('label');
    try {
      await busy(label, 'Envoi…', async () => {
        for (const file of files) draft.attachments.push(await Api.uploadFile(s.id, 'prof', file));
      });
      drawAtt();
    } catch (ex) { err(ex.message); }
  });
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-action="remove-file"][data-list="att"]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    draft.attachments.splice(Number(b.dataset.index), 1);
    drawAtt();
  });

  // Questions du quiz
  const qList = $('#q-list', d);
  if (qList) {
    const redraw = () => { qList.innerHTML = draft.questions.map(questionEditor).join(''); };
    redraw();
    form.addEventListener('click', e => {
      const b = e.target.closest('[data-q]');
      if (!b) return;
      e.preventDefault();
      draft.questions = readQuestions(qList);
      const qi = Number(b.closest('.q-edit')?.dataset.qi);
      const q = draft.questions[qi];
      switch (b.dataset.q) {
        case 'add': draft.questions.push(newQuestion(b.dataset.qtype)); break;
        case 'remove': draft.questions.splice(qi, 1); break;
        case 'up': if (qi > 0) [draft.questions[qi - 1], draft.questions[qi]] = [draft.questions[qi], draft.questions[qi - 1]]; break;
        case 'add-opt': if (q.options.length < 6) q.options.push(''); break;
        case 'remove-opt': {
          const oi = Number(b.dataset.oi);
          q.options.splice(oi, 1);
          if (q.answer === oi) q.answer = 0; else if (q.answer > oi) q.answer--;
          break;
        }
      }
      redraw();
      if (b.dataset.q === 'add') {
        const last = qList.lastElementChild;
        last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        last?.querySelector('textarea')?.focus();
      }
    });
    form.addEventListener('change', e => {
      if (!e.target.matches('.q-type')) return;
      const qs = readQuestions(qList);
      const qi = Number(e.target.closest('.q-edit').dataset.qi);
      const old = qs[qi];
      qs[qi] = { ...newQuestion(e.target.value), id: old.id, prompt: old.prompt, explanation: old.explanation };
      draft.questions = qs;
      redraw();
    });
  }

  form.onsubmit = async e => {
    e.preventDefault();
    err('');
    const f = new FormData(form);
    const item = {
      id: draft.id, week_id: w.id, type,
      subject: f.get('subject'),
      title: String(f.get('title')).trim(),
      content: String(f.get('content')).trim(),
      link: type === 'notion' ? String(f.get('link') || '').trim() : '',
      attachments: draft.attachments,
      answer_mode: type === 'exercice' ? f.get('answer_mode') : 'texte',
      instant_result: type === 'quiz' ? !!f.get('instant_result') : type === 'exercice' ? f.get('show_model') !== 'after' : true,
      share_model: type === 'exercice' ? f.get('show_model') !== 'never' : false,
      questions: []
    };
    const k = { answers: {}, model_answer: type === 'exercice' ? String(f.get('model_answer') || '').trim() : '' };
    if (!item.title) return err('Donne un titre.');
    if (type === 'quiz') {
      const qs = readQuestions(qList);
      if (!qs.length) return err('Ajoute au moins une question.');
      for (const [i, q] of qs.entries()) {
        const n = `Question ${i + 1} : `;
        if (!q.prompt) return err(n + 'écris la question.');
        if (q.type === 'qcm') {
          if (q.options.filter(Boolean).length < 2) return err(n + 'il faut au moins 2 choix remplis.');
          if (!q.options[q.answer]) return err(n + 'la bonne réponse cochée est vide.');
          const good = q.options[q.answer];
          q.options = q.options.filter(Boolean);
          q.answer = q.options.indexOf(good);
        }
        if (q.type === 'texte' && !q.answer) return err(n + 'indique la réponse attendue.');
        item.questions.push({ id: q.id, type: q.type, prompt: q.prompt, options: q.options });
        k.answers[q.id] = { answer: q.answer, explanation: q.explanation };
      }
    }
    try {
      await busy(form.querySelector('button.primary'), 'Enregistrement…', () => Api.saveItem(item, k));
      Modal.close();
      rerender();
      toast('Enregistré ✓');
    } catch (ex) { err(ex.message); }
  };
}

function questionEditor(q, i) {
  let body;
  if (q.type === 'qcm') {
    body = `
      <div class="opts">
        ${q.options.map((o, j) => `
          <div class="opt-row">
            <label class="radio" title="Bonne réponse"><input type="radio" name="ok-${q.id}" value="${j}" ${Number(q.answer) === j ? 'checked' : ''}></label>
            <input class="q-opt" value="${esc(o)}" placeholder="Choix ${j + 1}">
            ${q.options.length > 2 ? `<button type="button" class="icon-btn" data-q="remove-opt" data-oi="${j}" title="Retirer">✕</button>` : ''}
          </div>`).join('')}
        ${q.options.length < 6 ? '<button type="button" class="btn small ghost" data-q="add-opt">＋ Ajouter un choix</button>' : ''}
        <p class="hint">Coche le rond de la bonne réponse.</p>
      </div>`;
  } else if (q.type === 'vf') {
    body = `
      <div class="opts inline">
        <span class="hint">Bonne réponse :</span>
        <label class="check"><input type="radio" name="ok-${q.id}" value="0" ${Number(q.answer) === 0 ? 'checked' : ''}> Vrai</label>
        <label class="check"><input type="radio" name="ok-${q.id}" value="1" ${Number(q.answer) === 1 ? 'checked' : ''}> Faux</label>
      </div>`;
  } else {
    body = `
      <label class="field"><span>Réponse attendue</span>
        <input class="q-answer" value="${esc(q.answer)}" placeholder="Ex : 12">
        <span class="hint">Plusieurs réponses acceptées ? Sépare-les par | (ex : 7|sept). Majuscules et accents ignorés.</span></label>`;
  }
  return `
    <div class="q-edit" data-qi="${i}" data-qid="${esc(q.id)}">
      <div class="q-edit-head">
        <strong>Question ${i + 1}</strong>
        <select class="q-type">
          <option value="qcm" ${q.type === 'qcm' ? 'selected' : ''}>QCM</option>
          <option value="vf" ${q.type === 'vf' ? 'selected' : ''}>Vrai / Faux</option>
          <option value="texte" ${q.type === 'texte' ? 'selected' : ''}>Réponse courte</option>
        </select>
        <span class="spacer"></span>
        ${i > 0 ? '<button type="button" class="icon-btn" data-q="up" title="Monter">↑</button>' : ''}
        <button type="button" class="icon-btn danger" data-q="remove" title="Supprimer la question">🗑</button>
      </div>
      <textarea class="q-prompt" rows="2" placeholder="Énoncé de la question">${esc(q.prompt)}</textarea>
      ${body}
      <input class="q-expl" value="${esc(q.explanation)}" placeholder="Explication affichée après la correction (optionnel)">
    </div>`;
}

function readQuestions(container) {
  return $$('.q-edit', container).map(el => {
    const type = $('.q-type', el).value;
    const q = { id: el.dataset.qid, type, prompt: $('.q-prompt', el).value.trim(), explanation: $('.q-expl', el).value.trim(), options: [], answer: 0 };
    const checked = $('input[type=radio]:checked', el);
    if (type === 'qcm') { q.options = $$('.q-opt', el).map(i => i.value.trim()); q.answer = checked ? Number(checked.value) : 0; }
    else if (type === 'vf') { q.options = ['Vrai', 'Faux']; q.answer = checked ? Number(checked.value) : 0; }
    else q.answer = $('.q-answer', el).value.trim();
    return q;
  });
}

/* ---------- Correction ---------- */

function drawFeedbackFiles() {
  const box = $('#feedback-files');
  if (!box) return;
  box.innerHTML = fileList(T.copy.feedbackFiles, { removable: true, dataAttr: 'data-list="feedback"' });
  hydrateFiles(box);
}

async function submitCorrection(form) {
  const f = new FormData(form);
  const feedback = String(f.get('feedback')).trim();
  if (!feedback && !confirm('Envoyer la correction sans commentaire ?')) return;
  await busy(form.querySelector('button.primary'), 'Envoi…', () =>
    Api.correct(T.copy.sub.id, { feedback, grade: String(f.get('grade')).trim(), feedback_files: T.copy.feedbackFiles }));
  toast('Correction envoyée à l’élève ✓');
  const next = (await Api.listToCorrect())[0];
  location.hash = next ? `#/copie/${next.sub.id}` : `#/semaine/${T.copy.week.id}`;
}
