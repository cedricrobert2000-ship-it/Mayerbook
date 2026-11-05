'use strict';

/* =========================================================
   Espace prof : tableau de bord, fiche élève, semaine
   ========================================================= */

const TutorUI = { levelFilter: 'all' };

/* ---------- Tableau de bord ---------- */

function viewDashboard() {
  const all = Store.students.slice().sort((a, b) =>
    LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.name.localeCompare(b.name, 'fr'));
  const levels = unique(all.map(s => s.level));
  if (TutorUI.levelFilter !== 'all' && !levels.includes(TutorUI.levelFilter)) TutorUI.levelFilter = 'all';
  const shown = TutorUI.levelFilter === 'all' ? all : all.filter(s => s.level === TutorUI.levelFilter);

  const header = `
    <div class="page-head">
      <div>
        <h1>Mes élèves</h1>
        <p class="muted">${all.length ? `${all.length} élève${all.length > 1 ? 's' : ''} suivi${all.length > 1 ? 's' : ''}` : 'Commence par ajouter un élève.'}</p>
      </div>
      <div class="actions">
        <button class="btn" data-action="import-results">📥 Importer des résultats</button>
        <button class="btn primary" data-action="new-student">＋ Nouvel élève</button>
      </div>
    </div>`;

  if (!all.length) {
    return header + `
      <div class="empty card">
        <div class="empty-icon">👩‍🏫</div>
        <h2>Bienvenue sur Mayerbook</h2>
        <p>Crée une fiche par élève, prépare chaque semaine les <strong>notions à revoir</strong>,
        les <strong>exercices</strong> et les <strong>quiz</strong>, puis envoie-lui son lien personnel.</p>
        <div class="actions center">
          <button class="btn primary" data-action="new-student">＋ Ajouter mon premier élève</button>
          <button class="btn" data-action="load-demo">Voir un exemple</button>
          <button class="btn ghost" data-action="import-data">Restaurer une sauvegarde</button>
        </div>
      </div>`;
  }

  const chips = levels.length > 1 ? `
    <div class="chips">
      <button class="chip ${TutorUI.levelFilter === 'all' ? 'active' : ''}" data-action="filter-level" data-level="all">Tous</button>
      ${levels.map(l => `<button class="chip ${TutorUI.levelFilter === l ? 'active' : ''}" data-action="filter-level" data-level="${esc(l)}">${esc(l)}</button>`).join('')}
    </div>` : '';

  const cards = shown.map(s => {
    const w = Store.latestWeek(s);
    let weekInfo = '<p class="muted small">Aucune semaine préparée</p>';
    if (w) {
      const p = computeProgress(w.items, w.results);
      weekInfo = `
        <p class="small"><strong>${esc(weekLabel(w))}</strong></p>
        ${w.results
          ? `${progressBar(p, { small: true })}<p class="small muted">${p.done}/${p.total} terminé${p.done > 1 ? 's' : ''} · résultats du ${fmtDateTime(w.results.at)}</p>`
          : `<p class="small muted">${w.items.length} élément${w.items.length > 1 ? 's' : ''} · en attente des résultats</p>`}`;
    }
    return `
      <a class="card student-card" href="#/eleve/${s.id}">
        <div class="student-card-head">
          ${avatar(s.name)}
          <div>
            <h3>${esc(s.name)}</h3>
            <span class="badge">${esc(s.level)}</span>
          </div>
        </div>
        <div class="tags">${s.subjects.map(subjectTag).join('')}</div>
        <div class="student-card-week">${weekInfo}</div>
      </a>`;
  }).join('');

  return header + chips + `<div class="grid">${cards}</div>
    <div class="backup-note card subtle">
      <p>💾 Tes données sont enregistrées <strong>dans ce navigateur</strong>. Fais une sauvegarde de temps en temps
      (et pour passer sur un autre ordinateur).</p>
      <div class="actions">
        <button class="btn small" data-action="export-data">Exporter une sauvegarde</button>
        <button class="btn small ghost" data-action="import-data">Restaurer</button>
      </div>
    </div>`;
}

/* ---------- Fiche élève ---------- */

function viewStudent(sid) {
  const s = Store.student(sid);
  if (!s) return notFound();

  const weeks = s.weeks.map(w => {
    const p = computeProgress(w.items, w.results);
    const counts = TYPE_ORDER.map(t => {
      const n = w.items.filter(i => i.type === t).length;
      return n ? `<span>${TYPES[t].icon} ${n}</span>` : '';
    }).join('');
    return `
      <a class="card week-row" href="#/eleve/${s.id}/semaine/${w.id}">
        <div class="week-row-main">
          <h3>${esc(weekLabel(w))}</h3>
          ${w.title ? `<p class="muted">${esc(w.title)}</p>` : ''}
          <div class="counts">${counts || '<span class="muted">Vide</span>'}</div>
        </div>
        <div class="week-row-side">
          ${w.results
            ? `<span class="pct">${p.pct}%</span>${progressBar(p, { small: true })}`
            : '<span class="pill">En attente</span>'}
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
          <div class="tags"><span class="badge">${esc(s.level)}</span>${s.subjects.map(subjectTag).join('')}</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn" data-action="edit-student" data-sid="${s.id}">Modifier</button>
        <button class="btn danger ghost" data-action="delete-student" data-sid="${s.id}">Supprimer</button>
      </div>
    </div>

    ${s.notes || s.contact ? `
      <div class="card subtle">
        ${s.contact ? `<p><strong>Contact :</strong> ${esc(s.contact)}</p>` : ''}
        ${s.notes ? `<p><strong>Notes :</strong> ${rich(s.notes)}</p>` : ''}
      </div>` : ''}

    <div class="section-head">
      <h2>Semaines</h2>
      <button class="btn primary" data-action="new-week" data-sid="${s.id}">＋ Nouvelle semaine</button>
    </div>
    ${weeks || `<div class="empty card"><p>Aucune semaine pour l’instant. Crée la première pour ajouter des notions, exercices et quiz.</p></div>`}`;
}

/* ---------- Semaine (édition) ---------- */

function viewWeek(sid, wid) {
  const s = Store.student(sid);
  const w = Store.week(s, wid);
  if (!w) return notFound();
  const r = w.results;
  const p = computeProgress(w.items, r);

  const sections = TYPE_ORDER.map(type => {
    const items = w.items.filter(i => i.type === type);
    return `
      <section class="item-section">
        <div class="section-head">
          <h2>${TYPES[type].icon} ${TYPES[type].plural} <span class="muted count">${items.length}</span></h2>
          <button class="btn small" data-action="add-item" data-sid="${sid}" data-wid="${wid}" data-type="${type}">＋ Ajouter</button>
        </div>
        ${items.length ? items.map((it, idx) => tutorItemCard(s, w, it, idx, items.length)).join('')
          : `<p class="muted small empty-line">Aucun${type === 'notion' ? 'e notion' : type === 'quiz' ? ' quiz' : ' exercice'}.</p>`}
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
        <button class="btn" data-action="preview-week" data-sid="${sid}" data-wid="${wid}">👁 Aperçu élève</button>
        <button class="btn" data-action="edit-week" data-sid="${sid}" data-wid="${wid}">Modifier</button>
        <button class="btn danger ghost" data-action="delete-week" data-sid="${sid}" data-wid="${wid}">Supprimer</button>
      </div>
    </div>

    <div class="layout">
      <div class="layout-main">
        <div class="card">
          <label class="field">
            <span>Message pour ${esc(firstName(s.name))} <span class="muted">(affiché en haut de sa page)</span></span>
            <textarea rows="2" data-field="week-message" data-sid="${sid}" data-wid="${wid}" placeholder="Ex : Super séance ! Cette semaine on se concentre sur…">${esc(w.message)}</textarea>
          </label>
        </div>
        ${sections}
      </div>

      <aside class="layout-side">
        <div class="card">
          <h3>📤 Envoyer à l’élève</h3>
          <p class="small muted">Génère un lien personnel avec le contenu de la semaine. Renvoie-le si tu fais des modifications.</p>
          <button class="btn primary block" data-action="share-week" data-sid="${sid}" data-wid="${wid}" ${w.items.length ? '' : 'disabled'}>Obtenir le lien</button>
        </div>

        <div class="card">
          <h3>📊 Résultats</h3>
          ${r ? `
            <p class="small muted">Reçus le ${fmtDateTime(r.at)}</p>
            <div class="big-pct">${p.pct}%</div>
            ${progressBar(p)}
            <p class="small">${p.done} / ${p.total} élément${p.total > 1 ? 's' : ''} terminé${p.done > 1 ? 's' : ''}</p>
            ${r.comment ? `<blockquote class="comment">💬 ${rich(r.comment)}</blockquote>` : ''}
          ` : `<p class="small muted">Quand ${esc(firstName(s.name))} a fini, il/elle t’envoie un lien de résultats : ouvre-le ici ou colle-le ci-dessous.</p>`}
          <button class="btn block" data-action="import-results">📥 ${r ? 'Mettre à jour' : 'Importer'} les résultats</button>
        </div>

        <div class="card">
          <h3>➡️ Semaine suivante</h3>
          <p class="small muted">Crée la semaine d’après en reprenant ce qui n’est pas encore acquis.</p>
          <button class="btn block" data-action="next-week" data-sid="${sid}" data-wid="${wid}">Préparer la semaine suivante</button>
        </div>
      </aside>
    </div>`;
}

function tutorItemCard(s, w, it, idx, count) {
  const r = w.results;
  let status = '';
  if (r) {
    if (it.type === 'notion') status = r.understood?.[it.id] ? '<span class="status ok">✓ Comprise</span>' : '<span class="status ko">À revoir</span>';
    if (it.type === 'exercice') status = r.done?.[it.id] ? '<span class="status ok">✓ Fait</span>' : '<span class="status ko">Pas fait</span>';
    if (it.type === 'quiz') {
      const q = r.quiz?.[it.id];
      status = q?.submitted
        ? `<button class="status ${q.score === q.total ? 'ok' : q.score >= q.total / 2 ? 'mid' : 'ko'}" data-action="quiz-answers" data-sid="${s.id}" data-wid="${w.id}" data-iid="${it.id}">${q.score}/${q.total} · voir</button>`
        : '<span class="status ko">Pas fait</span>';
    }
  }
  const meta = it.type === 'quiz'
    ? `${it.questions?.length || 0} question${(it.questions?.length || 0) > 1 ? 's' : ''}`
    : truncate(it.content, 140);
  const extras = [
    it.type === 'exercice' && it.correction ? (it.showCorrection ? 'Correction visible' : 'Correction cachée') : '',
    it.link ? '🔗 Lien' : ''
  ].filter(Boolean).join(' · ');
  const d = `data-sid="${s.id}" data-wid="${w.id}" data-iid="${it.id}"`;
  return `
    <div class="card item-card type-${it.type}">
      <div class="item-card-main" data-action="edit-item" ${d}>
        <div class="item-card-top">${subjectTag(it.subject)}${status}</div>
        <h4>${esc(it.title)}</h4>
        ${meta ? `<p class="small muted">${esc(meta)}</p>` : ''}
        ${extras ? `<p class="tiny muted">${esc(extras)}</p>` : ''}
      </div>
      <div class="item-card-tools">
        <button class="icon-btn" title="Monter" data-action="move-item" data-dir="-1" ${d} ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" title="Descendre" data-action="move-item" data-dir="1" ${d} ${idx === count - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn" title="Modifier" data-action="edit-item" ${d}>✎</button>
        <button class="icon-btn danger" title="Supprimer" data-action="delete-item" ${d}>🗑</button>
      </div>
    </div>`;
}

function notFound() {
  return `<div class="empty card"><h2>Introuvable</h2><p>Cette page n’existe pas ou a été supprimée.</p><a class="btn" href="#/">Retour à mes élèves</a></div>`;
}

/* ---------- Formulaires : élève ---------- */

function openStudentForm(sid) {
  const s = sid ? Store.student(sid) : null;
  const subj = s ? s.subjects : [];
  const custom = subj.filter(x => !SUBJECTS.includes(x));
  const d = Modal.open(`
    <form class="form">
      <h2>${s ? 'Modifier l’élève' : 'Nouvel élève'}</h2>
      <label class="field"><span>Nom de l’élève *</span>
        <input name="name" required maxlength="80" value="${esc(s?.name)}" placeholder="Prénom Nom"></label>
      <label class="field"><span>Classe *</span>
        <select name="level" required>
          ${LEVELS.map(l => `<option ${(s?.level || '') === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      <fieldset class="field"><legend>Matières suivies</legend>
        <div class="check-grid">
          ${SUBJECTS.map(x => `<label class="check"><input type="checkbox" name="subjects" value="${esc(x)}" ${subj.includes(x) ? 'checked' : ''}> ${esc(x)}</label>`).join('')}
        </div>
        <input name="custom" placeholder="Autres matières (séparées par des virgules)" value="${esc(custom.join(', '))}">
      </fieldset>
      <label class="field"><span>Contact (parents, téléphone…)</span>
        <input name="contact" maxlength="160" value="${esc(s?.contact)}"></label>
      <label class="field"><span>Notes perso <span class="muted">(non visibles par l’élève)</span></span>
        <textarea name="notes" rows="3">${esc(s?.notes)}</textarea></label>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">${s ? 'Enregistrer' : 'Créer l’élève'}</button>
      </div>
    </form>`);
  d.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = {
      name: f.get('name').trim(),
      level: f.get('level'),
      subjects: unique([...f.getAll('subjects'), ...String(f.get('custom')).split(',').map(x => x.trim())]),
      contact: f.get('contact').trim(),
      notes: f.get('notes').trim()
    };
    if (!data.name) return;
    if (s) {
      Object.assign(s, data);
      Store.save();
      Modal.close();
      rerender();
    } else {
      const ns = Store.addStudent(data);
      Modal.close();
      location.hash = `#/eleve/${ns.id}`;
    }
    toast('Élève enregistré ✓');
  };
}

/* ---------- Formulaires : semaine ---------- */

function openWeekForm(sid, wid) {
  const s = Store.student(sid);
  const w = wid ? Store.week(s, wid) : null;
  const latest = Store.latestWeek(s);
  const defStart = w ? w.start : (latest ? addDays(latest.start, 7) : mondayOf(todayISO()));
  const d = Modal.open(`
    <form class="form">
      <h2>${w ? 'Modifier la semaine' : 'Nouvelle semaine'} · ${esc(s.name)}</h2>
      <label class="field"><span>Début de la semaine *</span>
        <input type="date" name="start" required value="${defStart}"></label>
      <label class="field"><span>Thème <span class="muted">(optionnel)</span></span>
        <input name="title" maxlength="100" value="${esc(w?.title)}" placeholder="Ex : Révisions contrôle fractions"></label>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">${w ? 'Enregistrer' : 'Créer la semaine'}</button>
      </div>
    </form>`);
  d.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = { start: f.get('start'), title: f.get('title').trim() };
    if (w) {
      Object.assign(w, data);
      Store.sortWeeks(s);
      Store.save();
      Modal.close();
      rerender();
    } else {
      const nw = Store.addWeek(s, data);
      Modal.close();
      location.hash = `#/eleve/${s.id}/semaine/${nw.id}`;
    }
  };
}

function openNextWeekForm(sid, wid) {
  const s = Store.student(sid);
  const w = Store.week(s, wid);
  const r = w.results;
  const notions = w.items.filter(i => i.type === 'notion' && !r?.understood?.[i.id]);
  const exos = w.items.filter(i => i.type === 'exercice' && !r?.done?.[i.id]);
  const quizzes = w.items.filter(i => i.type === 'quiz' && !(r?.quiz?.[i.id]?.submitted && r.quiz[i.id].score === r.quiz[i.id].total));
  const opt = (name, list, label, checked) => list.length
    ? `<label class="check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}> ${label} <span class="muted">(${list.length})</span></label>
       <ul class="mini-list">${list.map(i => `<li>${esc(i.title)}</li>`).join('')}</ul>` : '';
  const any = notions.length + exos.length + quizzes.length;
  const d = Modal.open(`
    <form class="form">
      <h2>Semaine suivante · ${esc(s.name)}</h2>
      ${!r ? '<p class="notice">ℹ️ Aucun résultat importé pour cette semaine : tout est considéré comme non terminé.</p>' : ''}
      <label class="field"><span>Début de la semaine</span>
        <input type="date" name="start" required value="${addDays(w.start, 7)}"></label>
      ${any ? `<fieldset class="field"><legend>Reprendre dans la nouvelle semaine</legend>
        ${opt('notions', notions, 'Notions pas encore comprises', true)}
        ${opt('exos', exos, 'Exercices non faits', !!r)}
        ${opt('quizzes', quizzes, 'Quiz non réussis à 100 %', !!r)}
      </fieldset>` : '<p class="notice ok">🎉 Tout est acquis ! La nouvelle semaine sera vide.</p>'}
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">Créer la semaine</button>
      </div>
    </form>`);
  d.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const copy = it => ({ ...structuredClone(it), id: uid() });
    const items = [
      ...(f.get('notions') ? notions : []),
      ...(f.get('exos') ? exos : []),
      ...(f.get('quizzes') ? quizzes : [])
    ].map(copy);
    const nw = Store.addWeek(s, { start: f.get('start'), items });
    Modal.close();
    location.hash = `#/eleve/${s.id}/semaine/${nw.id}`;
    toast('Nouvelle semaine créée ✓');
  };
}

/* ---------- Formulaire : élément (notion / exercice / quiz) ---------- */

function newQuestion(type = 'qcm') {
  return {
    id: uid(), type, prompt: '',
    options: type === 'qcm' ? ['', ''] : type === 'vf' ? ['Vrai', 'Faux'] : [],
    answer: type === 'texte' ? '' : 0,
    explanation: ''
  };
}

function openItemForm(sid, wid, type, iid) {
  const s = Store.student(sid);
  const w = Store.week(s, wid);
  const existing = iid ? w.items.find(i => i.id === iid) : null;
  type = existing ? existing.type : type;
  const draft = existing ? structuredClone(existing) : {
    id: uid(), type, subject: s.subjects[0] || '', title: '', content: '',
    link: '', correction: '', showCorrection: true,
    questions: type === 'quiz' ? [newQuestion('qcm')] : undefined
  };
  const subjects = unique([draft.subject, ...s.subjects, ...SUBJECTS]);
  const contentLabel = { notion: 'Explication / rappel de cours', exercice: 'Énoncé', quiz: 'Consigne (optionnel)' }[type];
  const contentPh = {
    notion: 'Ex : Pour additionner deux fractions, on les met d’abord au même dénominateur…',
    exercice: 'Ex : Calcule 3/4 + 1/6. Détaille les étapes.',
    quiz: 'Ex : Réponds sans calculatrice !'
  }[type];

  const d = Modal.open(`
    <form class="form" novalidate>
      <h2>${TYPES[type].icon} ${existing ? 'Modifier' : 'Ajouter'} ${type === 'notion' ? 'une notion' : type === 'quiz' ? 'un quiz' : 'un exercice'}</h2>
      <div class="row">
        <label class="field"><span>Matière</span>
          <select name="subject">${subjects.map(x => `<option ${x === draft.subject ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="field grow"><span>Titre *</span>
          <input name="title" required maxlength="120" value="${esc(draft.title)}"></label>
      </div>
      <label class="field"><span>${contentLabel}</span>
        <textarea name="content" rows="${type === 'quiz' ? 2 : 5}" placeholder="${esc(contentPh)}">${esc(draft.content)}</textarea>
        <span class="hint">Astuce : **texte** pour mettre en gras. Les liens http… deviennent cliquables.</span></label>
      ${type === 'notion' ? `
        <label class="field"><span>Lien utile <span class="muted">(vidéo, fiche… optionnel)</span></span>
          <input name="link" type="url" value="${esc(draft.link)}" placeholder="https://"></label>` : ''}
      ${type === 'exercice' ? `
        <label class="field"><span>Correction <span class="muted">(optionnel)</span></span>
          <textarea name="correction" rows="4">${esc(draft.correction)}</textarea></label>
        <label class="check"><input type="checkbox" name="showCorrection" ${draft.showCorrection ? 'checked' : ''}> L’élève peut afficher la correction</label>` : ''}
      ${type === 'quiz' ? `
        <div class="q-list" id="q-list"></div>
        <div class="actions">
          <button type="button" class="btn small" data-q="add" data-qtype="qcm">＋ QCM</button>
          <button type="button" class="btn small" data-q="add" data-qtype="vf">＋ Vrai / Faux</button>
          <button type="button" class="btn small" data-q="add" data-qtype="texte">＋ Réponse courte</button>
        </div>` : ''}
      <p class="form-error" id="form-error" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">Enregistrer</button>
      </div>
    </form>`, { wide: type === 'quiz' });

  const form = d.querySelector('form');
  const qList = d.querySelector('#q-list');

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
          if (q.answer === oi) q.answer = 0;
          else if (q.answer > oi) q.answer--;
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

  form.onsubmit = e => {
    e.preventDefault();
    const f = new FormData(form);
    const err = msg => { const el = $('#form-error', d); el.textContent = msg; el.hidden = false; };
    const item = {
      ...draft,
      subject: f.get('subject'),
      title: String(f.get('title')).trim(),
      content: String(f.get('content')).trim()
    };
    if (!item.title) return err('Donne un titre.');
    if (type === 'notion') item.link = String(f.get('link') || '').trim();
    if (type === 'exercice') {
      item.correction = String(f.get('correction') || '').trim();
      item.showCorrection = !!f.get('showCorrection');
    }
    if (type === 'quiz') {
      item.questions = readQuestions(qList);
      if (!item.questions.length) return err('Ajoute au moins une question.');
      for (const [i, q] of item.questions.entries()) {
        const n = `Question ${i + 1} : `;
        if (!q.prompt) return err(n + 'écris la question.');
        if (q.type === 'qcm') {
          if (q.options.filter(Boolean).length < 2) return err(n + 'il faut au moins 2 choix remplis.');
          if (!q.options[q.answer]) return err(n + 'la bonne réponse cochée est vide.');
          // Retire les choix vides en conservant la bonne réponse
          const good = q.options[q.answer];
          q.options = q.options.filter(Boolean);
          q.answer = q.options.indexOf(good);
        }
        if (q.type === 'texte' && !q.answer) return err(n + 'indique la réponse attendue.');
      }
    }
    if (existing) Object.assign(existing, item);
    else w.items.push(item);
    Store.save();
    Modal.close();
    rerender();
    toast('Enregistré ✓');
  };
}

function questionEditor(q, i) {
  let body = '';
  if (q.type === 'qcm') {
    body = `
      <div class="opts">
        ${q.options.map((o, j) => `
          <div class="opt-row">
            <label class="radio" title="Bonne réponse"><input type="radio" name="ok-${q.id}" value="${j}" ${q.answer === j ? 'checked' : ''}></label>
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
        <label class="check"><input type="radio" name="ok-${q.id}" value="0" ${q.answer === 0 ? 'checked' : ''}> Vrai</label>
        <label class="check"><input type="radio" name="ok-${q.id}" value="1" ${q.answer === 1 ? 'checked' : ''}> Faux</label>
      </div>`;
  } else {
    body = `
      <label class="field"><span>Réponse attendue</span>
        <input class="q-answer" value="${esc(q.answer)}" placeholder="Ex : 12">
        <span class="hint">Plusieurs réponses acceptées ? Sépare-les par | (ex : 7|sept). Majuscules et accents ignorés.</span></label>`;
  }
  return `
    <div class="q-edit" data-qi="${i}" data-qid="${q.id}">
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
    const q = {
      id: el.dataset.qid,
      type,
      prompt: $('.q-prompt', el).value.trim(),
      explanation: $('.q-expl', el).value.trim(),
      options: [],
      answer: 0
    };
    const checked = $(`input[type=radio]:checked`, el);
    if (type === 'qcm') {
      q.options = $$('.q-opt', el).map(i => i.value.trim());
      q.answer = checked ? Number(checked.value) : 0;
    } else if (type === 'vf') {
      q.options = ['Vrai', 'Faux'];
      q.answer = checked ? Number(checked.value) : 0;
    } else {
      q.answer = $('.q-answer', el).value.trim();
    }
    return q;
  });
}

/* ---------- Partage / résultats / sauvegarde ---------- */

async function openShareWeek(sid, wid) {
  const s = Store.student(sid);
  const w = Store.week(s, wid);
  const link = await buildStudentLink(s, w);
  const subject = `${firstName(s.name)}, ton travail de la ${weekLabel(w).toLowerCase()}`;
  Modal.open(`
    <div class="form">
      <h2>📤 Lien pour ${esc(s.name)}</h2>
      <p>Envoie ce lien à ${esc(firstName(s.name))} (ou à ses parents). Il/elle y trouvera ses notions, exercices et quiz,
      et pourra te renvoyer ses résultats en un clic.</p>
      <textarea class="link-box" readonly rows="3" onclick="this.select()">${esc(link)}</textarea>
      <div class="actions wrap">${shareButtons(link, subject)}</div>
      <p class="hint">Le contenu est inclus dans le lien : si tu modifies la semaine, renvoie un nouveau lien.
      La progression déjà faite par l’élève est conservée.</p>
      <div class="form-actions">
        <a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">Ouvrir comme l’élève ↗</a>
        <button type="button" class="btn" data-action="close-modal">Fermer</button>
      </div>
    </div>`);
}

function openImportResults() {
  const d = Modal.open(`
    <form class="form">
      <h2>📥 Importer des résultats</h2>
      <p>Colle ici le lien de résultats que ton élève t’a envoyé.</p>
      <textarea name="code" rows="4" required placeholder="https://…#/r/…"></textarea>
      <p class="form-error" id="form-error" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Annuler</button>
        <button class="btn primary">Continuer</button>
      </div>
    </form>`);
  d.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const payload = extractPayload(new FormData(e.target).get('code'), 'r');
    if (!payload) {
      const el = $('#form-error', d);
      el.textContent = 'Ce n’est pas un lien de résultats valide.';
      el.hidden = false;
      return;
    }
    Modal.close();
    location.hash = '#/r/' + payload;
  };
}

async function viewImportResults(payload) {
  let data;
  try { data = await decodePayload(payload); }
  catch { return `<div class="empty card"><h2>Lien invalide</h2><p>Ce lien de résultats est incomplet ou abîmé. Demande à l’élève de le renvoyer.</p><a class="btn" href="#/">Retour</a></div>`; }

  const s = Store.student(data.sid);
  const w = Store.week(s, data.wid);
  if (!w) {
    return `<div class="empty card">
      <h2>Élève ou semaine introuvable</h2>
      <p>Ces résultats de <strong>${esc(data.name || 'l’élève')}</strong> concernent une semaine qui n’existe pas dans ce navigateur.</p>
      <p class="muted">Ouvre ce lien sur l’appareil (et le navigateur) où tu gères tes élèves, ou restaure ta sauvegarde ici.</p>
      <a class="btn" href="#/">Retour à mes élèves</a></div>`;
  }
  const p = computeProgress(w.items, data);
  const older = w.results && w.results.at > data.at;
  return `
    <div class="card narrow">
      <h1>📊 Résultats reçus</h1>
      <p><strong>${esc(s.name)}</strong> · ${esc(weekLabel(w))}</p>
      <p class="muted small">Envoyés le ${fmtDateTime(data.at)}</p>
      <div class="big-pct">${p.pct}%</div>
      ${progressBar(p)}
      <p>${p.done} / ${p.total} élément${p.total > 1 ? 's' : ''} terminé${p.done > 1 ? 's' : ''}</p>
      ${data.comment ? `<blockquote class="comment">💬 ${rich(data.comment)}</blockquote>` : ''}
      ${older ? '<p class="notice">⚠️ Tu as déjà des résultats plus récents pour cette semaine.</p>' : ''}
      <div class="form-actions">
        <a class="btn ghost" href="#/eleve/${s.id}/semaine/${w.id}">Annuler</a>
        <button class="btn primary" data-action="confirm-import" data-payload="${esc(payload)}">Enregistrer les résultats</button>
      </div>
    </div>`;
}

async function confirmImport(payload) {
  const data = await decodePayload(payload);
  const s = Store.student(data.sid);
  const w = Store.week(s, data.wid);
  if (!w) return;
  w.results = {
    done: data.done || {}, understood: data.understood || {}, quiz: data.quiz || {},
    comment: data.comment || '', at: data.at || Date.now()
  };
  Store.save();
  toast('Résultats enregistrés ✓');
  location.hash = `#/eleve/${s.id}/semaine/${w.id}`;
}

function openQuizAnswers(sid, wid, iid) {
  const s = Store.student(sid);
  const w = Store.week(s, wid);
  const it = w.items.find(i => i.id === iid);
  const r = w.results?.quiz?.[iid];
  if (!it || !r) return;
  Modal.open(`
    <div class="form">
      <h2>❓ ${esc(it.title)} — ${r.score}/${r.total}</h2>
      <ol class="answers">
        ${it.questions.map(q => {
          const val = r.answers?.[q.id];
          const ok = isCorrect(q, val);
          return `<li class="${ok ? 'ok' : 'ko'}">
            <p><strong>${rich(q.prompt)}</strong></p>
            <p>${ok ? '✅' : '❌'} Réponse : ${esc(answerText(q, val))}</p>
            ${ok ? '' : `<p class="muted">Attendu : ${esc(correctAnswerText(q))}</p>`}
          </li>`;
        }).join('')}
      </ol>
      <div class="form-actions"><button type="button" class="btn" data-action="close-modal">Fermer</button></div>
    </div>`, { wide: true });
}

function exportData() {
  downloadFile(`mayerbook-sauvegarde-${todayISO()}.json`, Store.exportJSON());
  toast('Sauvegarde téléchargée ✓');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (Store.students.length && !confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
    try {
      Store.importJSON(await file.text());
      toast('Sauvegarde restaurée ✓');
      location.hash = '#/';
      rerender();
    } catch {
      alert('Ce fichier n’est pas une sauvegarde Mayerbook valide.');
    }
  };
  input.click();
}
