'use strict';

/* =========================================================
   Espace élève — pages simples :
   Accueil → Ma semaine (liste des étapes) → une page par étape
   + Mes progrès
   ========================================================= */

const S = {
  data: null,        // { student, weeks, items, subs }
  subs: {},          // par item_id
  solutions: {},     // corrigés reçus (après envoi)
  openQuiz: {},
  saveTimers: {}
};

async function loadStudentData() {
  S.data = await Api.studentOverview();
  S.subs = indexBy(S.data.subs, 'item_id');
}

const currentWeek = () => S.data.weeks.find(isCurrentWeek) || S.data.weeks[0];

/** Étapes d'une semaine dans l'ordre : notions, exercices, quiz. */
function weekSteps(wid) {
  const items = S.data.items.filter(i => i.week_id === wid);
  return TYPE_ORDER.flatMap(t => items.filter(i => i.type === t));
}

function correctedItems() {
  return S.data.items
    .filter(i => i.type !== 'notion' && S.subs[i.id]?.status === 'corrige')
    .sort((a, b) => String(S.subs[b.id].corrected_at).localeCompare(String(S.subs[a.id].corrected_at)));
}

/** Petit état lisible d'une étape (pour la liste). */
function stepStatus(it, sub) {
  if (it.type === 'notion') return sub?.understood ? ['Compris', 'ok'] : ['À lire', 'todo'];
  if (sub?.status === 'corrige') {
    if (it.type === 'quiz' && sub.total) return [`${sub.score}/${sub.total}`, sub.score === sub.total ? 'ok' : sub.score >= sub.total / 2 ? 'mid' : 'ko'];
    return [sub.grade ? `Corrigé · ${sub.grade}` : 'Corrigé', 'ok'];
  }
  if (sub?.status === 'envoye') return ['Envoyé', 'mid'];
  if (sub?.feedback) return ['À refaire', 'ko'];
  const started = sub && (sub.answer || sub.files?.length || Object.keys(sub.answers || {}).length);
  return started ? ['Commencé', 'todo'] : ['À faire', 'todo'];
}

/* ---------- Accueil ---------- */

async function viewStudentHome() {
  await loadStudentData();
  const { student } = S.data;
  const week = currentWeek();
  const seen = seenCorrections();
  const fresh = correctedItems().filter(i => !seen.includes(S.subs[i.id].id));
  const me = myMascot() || 'zap';

  let weekCard = '<div class="empty card">' + mascot(myMascot() || 'snooze', { mood: 'sleep', size: 96 }) + '<p>Ton prof n’a pas encore publié de travail. Reviens bientôt !</p></div>';
  if (week) {
    const steps = weekSteps(week.id);
    const p = progressOf(steps, S.subs);
    const next = steps.find(i => !isItemDone(i, S.subs[i.id]));
    weekCard = `
      <a class="card current-week has-mascot" href="#/semaine/${week.id}">
        <div class="card-mascot">${faceForProgress(p, 150, -14)}</div>
        <p class="muted small">${isCurrentWeek(week) ? 'Cette semaine' : 'Dernière semaine'}</p>
        <h2>${week.title ? esc(week.title) : 'Mon travail de la semaine'}</h2>
        <div class="hero-progress-label"><strong>${p.done} / ${p.total} étapes</strong><span>${p.pct} %</span></div>
        ${progressBar(p, { big: true })}
        ${next ? `<p class="next-step">Prochaine étape : <strong>${esc(next.title)}</strong></p>` : '<p class="cheer">Tout est fait, bravo !</p>'}
        <span class="cta">${!next ? 'Revoir' : p.done ? 'Continuer' : 'Commencer'}<span class="cta-arrow">${icon('arrow-right')}</span></span>
      </a>`;
  }

  return `
    <div class="hello">
      <button class="hello-mascot" data-action="pick-mascot" title="Changer de personnage">${mascot(me, { mood: me === 'snooze' ? 'calm' : 'happy', anim: 'wiggle', size: 84 })}</button>
      <div>
        <h1>Bonjour ${esc(firstName(student.name))} !</h1>
        ${gamiChips()}
      </div>
    </div>
    ${fresh.length ? `<a class="card notice-card" href="#/progres">${icon('mail-check')}
      <span><strong>${fresh.length === 1 ? 'Une nouvelle correction' : `${fresh.length} nouvelles corrections`}</strong><br><span class="muted small">Ton prof a corrigé ton travail</span></span>
      ${icon('chevron-right')}</a>` : ''}
    ${weekCard}`;
}

function seenCorrections() {
  try { return JSON.parse(localStorage.getItem('mayerbook:vu') || '[]'); } catch { return []; }
}
function markSeen(subIds) {
  try {
    const set = new Set([...seenCorrections(), ...subIds]);
    localStorage.setItem('mayerbook:vu', JSON.stringify([...set].slice(-500)));
  } catch { /* ignore */ }
}

/* ---------- Ma semaine : la liste des étapes ---------- */

async function viewStudentWeek(wid) {
  await loadStudentData();
  const week = S.data.weeks.find(w => w.id === wid);
  if (!week) return notFound();
  const steps = weekSteps(wid);
  const p = progressOf(steps, S.subs);
  const nextIdx = steps.findIndex(i => !isItemDone(i, S.subs[i.id]));

  return `
    <nav class="crumbs"><a href="#/">${icon('arrow-left')} Accueil</a></nav>
    <div class="week-head">
      <p class="muted small">${esc(weekLabel(week))}</p>
      <h1>${week.title ? esc(week.title) : 'Mon travail de la semaine'}</h1>
      <div class="hero-progress">${heroProgress(p)}</div>
    </div>
    ${week.message ? `<div class="card teacher-card">${mascotFace('happy', { size: 54, rotate: -8 })}<div><span class="muted small">Message de ton prof</span><div>${rich(week.message)}</div></div></div>` : ''}
    ${steps.length ? `<ol class="steps">${steps.map((it, i) => {
      const sub = S.subs[it.id];
      const done = isItemDone(it, sub);
      const [label, cls] = stepStatus(it, sub);
      return `<li><a class="step type-${it.type} ${done ? 'done' : ''} ${i === nextIdx ? 'next' : ''}" href="#/semaine/${wid}/${it.id}">
        <span class="step-num">${done ? icon('check') : i + 1}</span>
        <span class="step-body">
          <span class="step-type">${icon(TYPES[it.type].icon)} ${it.type === 'notion' ? 'Notion' : TYPES[it.type].label}${it.subject ? ' · ' + esc(it.subject) : ''}</span>
          <strong>${esc(it.title)}</strong>
        </span>
        <span class="status ${cls}">${label}</span>
      </a></li>`;
    }).join('')}</ol>`
    : '<div class="empty card">' + mascot(myMascot() || 'snooze', { mood: 'sleep', size: 96 }) + '<p>Rien à faire cette semaine, profites-en !</p></div>'}`;
}

function heroProgress(p) {
  return `<div class="hero-progress-label"><strong>Ma progression</strong><span>${p.done} / ${p.total}</span></div>${progressBar(p, { big: true })}
    ${p.total && p.done === p.total ? '<p class="cheer">Bravo, tu as tout terminé !</p>' : ''}`;
}

/* ---------- Une étape = une page ---------- */

async function viewStudentItem(wid, iid) {
  await loadStudentData();
  const week = S.data.weeks.find(w => w.id === wid);
  const steps = week ? weekSteps(wid) : [];
  const i = steps.findIndex(x => x.id === iid);
  if (i < 0) return notFound();
  const it = steps[i];
  const sub = S.subs[iid];
  if (it.type !== 'notion' && sub && sub.status !== 'brouillon') S.solutions[iid] = await Api.getSolution(iid);
  if (sub?.status === 'corrige') markSeen([sub.id]);
  const prev = steps[i - 1], next = steps[i + 1];
  return `
    <nav class="crumbs step-crumbs"><a href="#/semaine/${wid}">${icon('arrow-left')} Ma semaine</a><span class="muted small">Étape ${i + 1} sur ${steps.length}</span></nav>
    <div class="step-dots" aria-hidden="true">${steps.map((s, k) => `<span class="${k === i ? 'on' : ''} ${isItemDone(s, S.subs[s.id]) ? 'done' : ''}"></span>`).join('')}</div>
    <div class="slide-type type-${it.type}"><span class="type-chip">${icon(TYPES[it.type].icon)} ${TYPES[it.type].label}</span></div>
    ${studentItem(it)}
    <div class="step-nav">
      ${prev ? `<a class="btn big" href="#/semaine/${wid}/${prev.id}">${icon('chevron-left')} Précédent</a>` : '<span></span>'}
      ${next ? `<a class="btn primary big" href="#/semaine/${wid}/${next.id}">Suivant ${icon('chevron-right')}</a>`
        : `<a class="btn primary big" href="#/semaine/${wid}">${icon('check')} Terminer</a>`}
    </div>`;
}

/* ---------- Mes progrès ---------- */

async function viewStudentProgress() {
  await loadStudentData();
  const { weeks, items } = S.data;
  const exos = items.filter(i => i.type === 'exercice');
  const quizzes = items.filter(i => i.type === 'quiz');
  const exDone = exos.filter(i => isItemDone(i, S.subs[i.id])).length;
  const qGraded = quizzes.map(i => S.subs[i.id]).filter(x => x?.status === 'corrige' && x.total);
  const qAvg = qGraded.length ? Math.round(100 * qGraded.reduce((a, x) => a + x.score / x.total, 0) / qGraded.length) : null;
  const corrected = correctedItems();
  const seen = seenCorrections();

  const bySubject = {};
  for (const it of items) {
    const k = it.subject || 'Autre';
    const b = bySubject[k] ||= { total: 0, done: 0, qs: [] };
    b.total++;
    if (isItemDone(it, S.subs[it.id])) b.done++;
    const sub = S.subs[it.id];
    if (it.type === 'quiz' && sub?.status === 'corrige' && sub.total) b.qs.push(sub.score / sub.total);
  }

  if (!items.length) return `<h1>Mes progrès</h1><div class="empty card">${mascot(myMascot() || 'snooze', { mood: 'sleep', size: 96 })}<p>Tes progrès apparaîtront ici.</p></div>`;

  return `
    <h1>Mes progrès</h1>
    ${gamiChips()}
    <div class="stat-row">
      <div class="card stat"><span class="stat-num">${exDone}/${exos.length}</span><span class="muted small">exercices rendus</span></div>
      <div class="card stat"><span class="stat-num">${qAvg === null ? '—' : qAvg + ' %'}</span><span class="muted small">moyenne aux quiz</span></div>
    </div>

    ${corrected.length ? `
      <h2 class="section-title">${icon('mail-check')} Mes corrections</h2>
      <div class="list-card card">${corrected.map(i => {
        const s = S.subs[i.id];
        const isNew = !seen.includes(s.id);
        return `<a class="corr-link" href="#/semaine/${i.week_id}/${i.id}">${icon(TYPES[i.type].icon)}<span class="grow">${esc(i.title)}${isNew ? ' <span class="new-dot">Nouveau</span>' : ''}</span>
          ${s.grade ? `<span class="status ok">${esc(s.grade)}</span>` : i.type === 'quiz' ? `<span class="status ok">${s.score}/${s.total}</span>` : ''}${icon('chevron-right')}</a>`;
      }).join('')}</div>` : ''}

    <h2 class="section-title">${icon('trending-up')} Par matière</h2>
    <div class="card"><div class="subject-rows">${Object.entries(bySubject).map(([k, b]) => {
      const p = { pct: Math.round(100 * b.done / b.total) };
      const avg = b.qs.length ? Math.round(100 * b.qs.reduce((a, x) => a + x, 0) / b.qs.length) : null;
      return `<div class="subject-row">
        <div class="subject-row-head"><strong>${esc(k)}</strong>
          <span class="small muted">${b.done}/${b.total} fait${b.done > 1 ? 's' : ''}${avg === null ? '' : ` · quiz ${avg} %`}</span></div>
        ${progressBar(p, { big: true, color: subjectColor(k) })}</div>`;
    }).join('')}</div></div>

    <h2 class="section-title">${icon('calendar-days')} Mes semaines</h2>
    ${weeks.map(w => {
      const p = progressOf(weekSteps(w.id), S.subs);
      return `<a class="card week-row" href="#/semaine/${w.id}">
        <div class="week-row-main"><h3>${esc(weekLabel(w))}</h3>${w.title ? `<p class="muted">${esc(w.title)}</p>` : ''}</div>
        <div class="week-row-side"><span class="pct">${p.pct >= 100 ? icon('check') : ''}${p.pct} %</span>${progressBar(p)}</div></a>`;
    }).join('')}`;
}

/* ---------- Contenu d'une étape ---------- */

function statusBanner(it, sub) {
  if (!sub || sub.status === 'brouillon') {
    if (sub?.feedback) return `<div class="feedback-box warn"><strong>${icon('undo-2')} Ton prof te demande de refaire ce travail :</strong><div>${rich(sub.feedback)}</div></div>`;
    return '';
  }
  if (sub.status === 'envoye') {
    const sol = S.solutions[it.id] || {};
    return `<div class="sent-box">${icon('send')} Envoyé le ${fmtDateTime(sub.submitted_at)}. ` +
      (sol.model_answer ? 'Compare ta réponse avec la correction ci-dessous : ton prof va aussi corriger <strong>ta</strong> copie.'
        : '<strong>En attente de correction</strong> par ton prof.') + '</div>';
  }
  return '';
}

function correctionBlock(it, sub) {
  if (!sub || sub.status === 'brouillon') return '';
  const sol = S.solutions[it.id] || {};
  const corrected = sub.status === 'corrige';
  const hasFeedback = corrected && (sub.feedback || sub.grade || sub.feedback_files?.length);
  return `
    ${hasFeedback ? `<div class="feedback-box">
      <div class="feedback-head"><strong>${icon('circle-check')} Correction de ton prof</strong>${sub.grade ? `<span class="grade">${esc(sub.grade)}</span>` : ''}</div>
      ${sub.feedback ? `<div class="content">${rich(sub.feedback)}</div>` : ''}
      ${imagePreviews(sub.feedback_files)}${fileList(sub.feedback_files)}
    </div>` : ''}
    ${sol.model_answer ? `<details class="correction" ${corrected ? '' : 'open'}><summary>${icon('book-open')} Correction détaillée</summary><div class="content">${rich(sol.model_answer)}</div></details>` : ''}`;
}

function studentItem(it) {
  const sub = S.subs[it.id];
  if (it.type === 'notion') {
    const ok = !!sub?.understood;
    return `
      <article class="card s-item type-notion ${ok ? 'is-done' : ''}" id="item-${it.id}">
        <div class="item-card-top">${subjectTag(it.subject)}</div>
        <h3>${esc(it.title)}</h3>
        ${it.content ? `<div class="content">${rich(it.content)}</div>` : ''}
        ${fileList(it.attachments)}
        ${it.link ? `<p><a class="resource" href="${esc(it.link)}" target="_blank" rel="noopener">${icon('link')} Ressource pour revoir la notion</a></p>` : ''}
        <button class="toggle ${ok ? 'on' : ''}" data-action="st-understood" data-iid="${it.id}">${ok ? icon('check') + ' J’ai compris' : 'J’ai compris cette notion'}</button>
      </article>`;
  }
  if (it.type === 'exercice') return studentExercise(it, sub);
  return studentQuiz(it, sub);
}

function studentExercise(it, sub) {
  const draft = !sub || sub.status === 'brouillon';
  const mode = it.answer_mode || 'texte';
  const files = sub?.files || [];
  const badge = sub?.status === 'corrige' ? `<span class="status ok">Corrigé${sub.grade ? ' · ' + esc(sub.grade) : ''}</span>`
    : sub?.status === 'envoye' ? '<span class="status mid">Envoyé</span>' : '';
  return `
    <article class="card s-item type-exercice ${sub?.status === 'corrige' ? 'is-done' : ''}" id="item-${it.id}">
      <div class="item-card-top">${subjectTag(it.subject)}${badge}</div>
      <h3>${esc(it.title)}</h3>
      ${it.content ? `<div class="content">${rich(it.content)}</div>` : ''}
      ${imagePreviews(it.attachments)}${fileList(it.attachments)}
      ${statusBanner(it, sub)}
      <div class="answer-zone">
        <h4>Ma réponse</h4>
        ${mode !== 'fichier' ? (draft
          ? `<textarea class="answer-text" data-iid="${it.id}" rows="5" placeholder="Écris ta réponse ici…">${esc(sub?.answer || '')}</textarea>
             <span class="hint save-state" id="save-${it.id}">${sub?.answer ? 'Brouillon enregistré' : 'Ta réponse est enregistrée automatiquement.'}</span>`
          : (sub.answer ? `<div class="student-answer">${rich(sub.answer)}</div>` : '')) : ''}
        ${mode !== 'texte' ? `
          ${imagePreviews(files)}
          ${draft ? fileList(files, { removable: true, dataAttr: `data-iid="${it.id}"` }) : fileList(files)}
          ${draft ? `<label class="btn file-btn">${icon('camera')} Ajouter une photo / un fichier<input type="file" data-upload="answer" data-iid="${it.id}" accept="image/*,application/pdf" multiple hidden></label>` : ''}` : ''}
        ${draft ? `<button class="btn primary big block" data-action="st-submit" data-iid="${it.id}">${icon('send')} Envoyer à mon prof</button>
          <p class="hint">Une fois envoyé, tu ne pourras plus modifier ta réponse. ${it.share_model && it.instant_result
            ? 'Tu verras la correction juste après l’envoi.' : 'La correction apparaîtra ici.'}</p>` : ''}
      </div>
      ${correctionBlock(it, sub)}
    </article>`;
}

function studentQuiz(it, sub) {
  const draft = !sub || sub.status === 'brouillon';
  const qs = it.questions || [];
  const answers = sub?.answers || {};
  const started = S.openQuiz[it.id] || Object.keys(answers).length > 0 || !draft;
  const corrected = sub?.status === 'corrige';
  const sol = S.solutions[it.id] || {};
  const head = `
    <div class="item-card-top">${subjectTag(it.subject)}
      ${corrected ? `<span class="status ${sub.score === sub.total ? 'ok' : sub.score >= sub.total / 2 ? 'mid' : 'ko'}">${sub.score}/${sub.total}</span>`
        : sub?.status === 'envoye' ? '<span class="status mid">Envoyé</span>' : ''}</div>
    <h3>${esc(it.title)}</h3>
    ${it.content ? `<div class="content">${rich(it.content)}</div>` : ''}`;

  // Quiz à résultat immédiat : mode leçon, une question à la fois
  if (draft && it.instant_result) {
    const done = Object.keys(sub?.checked || {}).length;
    return `<article class="card s-item type-quiz" id="item-${it.id}">${head}
      ${statusBanner(it, sub)}
      <div class="lesson-launch">
        <div class="launch-meta"><span>${icon('circle-help')} ${plural(qs.length, 'question')}</span>
          <span>${icon('heart')} ${HEARTS} vies</span><span>${icon('zap')} jusqu’à ${qs.length * XP.quizRight + XP.quizPerfect} XP</span></div>
        ${done ? progressBar({ pct: Math.round(100 * done / Math.max(1, qs.length)) }) : ''}
        <button class="btn primary big block" data-action="lesson-open" data-iid="${it.id}">${done ? `Reprendre (${done}/${qs.length})` : 'Commencer le quiz'} ${icon('arrow-right')}</button>
        <p class="hint">Une question à la fois : tu sais tout de suite si c’est juste.</p>
      </div></article>`;
  }

  if (!started) {
    return `<article class="card s-item type-quiz" id="item-${it.id}">${head}
      <button class="btn primary" data-action="st-quiz-open" data-iid="${it.id}">Commencer le quiz (${plural(qs.length, 'question')})</button></article>`;
  }

  const questions = qs.map((q, i) => {
    const val = answers[q.id];
    const key = sol.answers?.[q.id];
    const ok = corrected && key && isCorrect(q, key.answer, val);
    let input;
    if (q.type === 'texte') {
      input = `<input class="quiz-text" data-iid="${it.id}" data-qid="${esc(q.id)}" value="${esc(val ?? '')}" ${draft ? '' : 'disabled'} placeholder="Ta réponse" autocomplete="off">`;
    } else {
      input = `<div class="choices ${q.type === 'vf' ? 'inline' : ''}">${q.options.map((o, j) => {
        const cls = corrected && key ? (String(j) === String(key.answer) ? 'right' : String(val) === String(j) ? 'wrong' : '') : '';
        return `<label class="choice ${cls} ${String(val) === String(j) ? 'picked' : ''}">
          <input type="radio" name="qa-${it.id}-${esc(q.id)}" value="${j}" data-iid="${it.id}" data-qid="${esc(q.id)}" ${String(val) === String(j) ? 'checked' : ''} ${draft ? '' : 'disabled'}>
          <span>${esc(o)}</span></label>`;
      }).join('')}</div>`;
    }
    return `
      <div class="quiz-q ${corrected && key ? (ok ? 'ok' : 'ko') : ''}">
        <p class="quiz-prompt"><span class="qnum">${i + 1}</span> ${rich(q.prompt)}</p>
        ${input}
        ${corrected && key ? `<p class="feedback">${ok ? icon('circle-check') + ' Bonne réponse !' : `${icon('circle-x')} La bonne réponse : <strong>${esc(expectedText(q, key.answer))}</strong>`}
          ${key.explanation ? `<br><span class="muted">${rich(key.explanation)}</span>` : ''}</p>` : ''}
      </div>`;
  }).join('');

  const footer = draft
    ? `<button class="btn primary big block" data-action="st-submit" data-iid="${it.id}">${icon('send')} Envoyer mes réponses</button>
       <p class="hint">${it.instant_result ? 'Tu verras ton score et la correction juste après l’envoi.' : 'Ton prof validera tes réponses avant que tu voies le résultat.'}</p>`
    : corrected
      ? `<div class="quiz-score ${sub.score === sub.total ? 'perfect' : ''}">
           ${myMascotForScore(sub.score / sub.total, 64)}<div>${sub.score === sub.total ? 'Parfait !' : sub.score >= sub.total / 2 ? 'Pas mal !' : 'Continue tes efforts !'}<br>Score : <strong>${sub.score} / ${sub.total}</strong></div></div>`
      : '';

  return `<article class="card s-item type-quiz ${corrected ? 'is-done' : ''}" id="item-${it.id}">${head}
    ${statusBanner(it, sub)}
    <div class="quiz">${questions}</div>
    <div class="quiz-footer">${footer}</div>
    ${corrected && (sub.feedback || sub.feedback_files?.length) ? correctionBlock(it, sub) : ''}
  </article>`;
}

/* ---------- Actions élève ---------- */

async function refreshStudentItem(iid) {
  const it = S.data.items.find(i => i.id === iid);
  if (S.subs[iid] && S.subs[iid].status !== 'brouillon' && it.type !== 'notion') S.solutions[iid] = await Api.getSolution(iid);
  const el = $('#item-' + iid);
  if (el) {
    el.outerHTML = studentItem(it);
    hydrateFiles($('#item-' + iid));
  }
  // progression
  const week = S.data.weeks.find(w => w.id === it.week_id);
  const items = S.data.items.filter(i => i.week_id === week.id);
  const p = progressOf(items, S.subs);
  const hp = $('.hero-progress');
  if (hp) hp.innerHTML = heroProgress(p);
  const dots = $('.step-dots');
  if (dots) weekSteps(week.id).forEach((s, k) => dots.children[k]?.classList.toggle('done', isItemDone(s, S.subs[s.id])));
}

async function studentSave(iid, patch, { redraw = true } = {}) {
  const sub = await Api.studentSave(iid, patch);
  S.subs[iid] = sub;
  if (redraw) await refreshStudentItem(iid);
  return sub;
}

function scheduleAnswerSave(iid, patch) {
  const st = $('#save-' + iid);
  if (st) st.textContent = 'Enregistrement…';
  clearTimeout(S.saveTimers[iid]);
  S.saveTimers[iid] = setTimeout(async () => {
    try {
      await studentSave(iid, patch(), { redraw: false });
      const el = $('#save-' + iid);
      if (el) el.textContent = 'Brouillon enregistré';
    } catch (e) { showError(e); }
  }, 700);
}

async function flushSave(iid) {
  if (S.saveTimers[iid]) {
    clearTimeout(S.saveTimers[iid]);
    delete S.saveTimers[iid];
    const ta = $(`.answer-text[data-iid="${iid}"]`);
    if (ta) await studentSave(iid, { answer: ta.value }, { redraw: false });
    const it = S.data.items.find(i => i.id === iid);
    if (it.type === 'quiz') await studentSave(iid, { answers: currentQuizAnswers(iid) }, { redraw: false });
  }
}

function currentQuizAnswers(iid) {
  const ans = { ...(S.subs[iid]?.answers || {}) };
  for (const inp of $$(`.quiz-text[data-iid="${iid}"]`)) ans[inp.dataset.qid] = inp.value;
  for (const r of $$(`input[type=radio][data-iid="${iid}"]:checked`)) ans[r.dataset.qid] = Number(r.value);
  return ans;
}

async function studentSubmit(iid, btn) {
  const it = S.data.items.find(i => i.id === iid);
  await flushSave(iid);
  const sub = S.subs[iid];
  if (it.type === 'exercice') {
    if (!sub?.answer?.trim() && !sub?.files?.length) return toast('Écris ta réponse ou ajoute une photo avant d’envoyer.');
    if (!confirm('Envoyer ta réponse à ton prof ? Tu ne pourras plus la modifier.')) return;
  } else {
    const answers = sub?.answers || {};
    const missing = (it.questions || []).filter(q => answers[q.id] === undefined || answers[q.id] === '').length;
    if (!confirm(missing ? `Il te reste ${plural(missing, 'question')} sans réponse. Envoyer quand même ?` : 'Envoyer tes réponses ? Tu ne pourras plus les modifier.')) return;
  }
  try {
    await busy(btn, 'Envoi…', async () => {
      S.subs[iid] = await Api.studentSubmit(iid);
    });
    await refreshStudentItem(iid);
    toast(S.subs[iid].status === 'corrige' || S.solutions[iid]?.model_answer ? 'Envoyé. Voici la correction !' : 'Envoyé à ton prof');
    $('#item-' + iid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { showError(e); }
}

async function studentUpload(input) {
  const iid = input.dataset.iid;
  const files = [...input.files];
  input.value = '';
  const label = input.closest('label');
  try {
    await busy(label, 'Envoi…', async () => {
      await flushSave(iid);
      const list = [...(S.subs[iid]?.files || [])];
      for (const f of files) list.push(await Api.uploadFile(S.data.student.id, 'eleve', f));
      await studentSave(iid, { files: list }, { redraw: false });
    });
    await refreshStudentItem(iid);
  } catch (e) { showError(e); }
}

async function studentRemoveFile(iid, index) {
  try { await flushSave(iid); } catch (e) { return showError(e); }
  const list = [...(S.subs[iid]?.files || [])];
  list.splice(index, 1);
  try { await studentSave(iid, { files: list }); } catch (e) { showError(e); }
}
