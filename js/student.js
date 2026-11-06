'use strict';

/* =========================================================
   Espace élève
   ========================================================= */

const S = {
  data: null,        // { student, weeks, items, subs }
  subs: {},          // par item_id
  solutions: {},     // corrigés reçus (après correction)
  openQuiz: {},
  saveTimers: {}
};

async function loadStudentData() {
  S.data = await Api.studentOverview();
  S.subs = indexBy(S.data.subs, 'item_id');
}

/* ---------- Accueil : mon suivi ---------- */

async function viewStudentHome() {
  await loadStudentData();
  const { student, weeks, items } = S.data;
  const itemsBy = groupBy(items, 'week_id');
  const current = weeks.find(isCurrentWeek) || weeks[0];

  const exos = items.filter(i => i.type === 'exercice');
  const quizzes = items.filter(i => i.type === 'quiz');
  const exDone = exos.filter(i => isItemDone(i, S.subs[i.id])).length;
  const qGraded = quizzes.map(i => S.subs[i.id]).filter(x => x?.status === 'corrige' && x.total);
  const qAvg = qGraded.length ? Math.round(100 * qGraded.reduce((a, x) => a + x.score / x.total, 0) / qGraded.length) : null;

  // Corrections reçues (les plus récentes d'abord)
  const corrected = items
    .filter(i => i.type !== 'notion' && S.subs[i.id]?.status === 'corrige')
    .sort((a, b) => String(S.subs[b.id].corrected_at).localeCompare(String(S.subs[a.id].corrected_at)));
  const seen = seenCorrections();
  const fresh = corrected.filter(i => !seen.includes(S.subs[i.id].id));

  // Par matière
  const bySubject = {};
  for (const it of items) {
    const k = it.subject || 'Autre';
    const b = bySubject[k] ||= { total: 0, done: 0, qs: [] };
    b.total++;
    if (isItemDone(it, S.subs[it.id])) b.done++;
    const sub = S.subs[it.id];
    if (it.type === 'quiz' && sub?.status === 'corrige' && sub.total) b.qs.push(sub.score / sub.total);
  }

  let currentCard = '';
  if (current) {
    const its = itemsBy[current.id] || [];
    const p = progressOf(its, S.subs);
    const todo = its.filter(i => !isItemDone(i, S.subs[i.id]));
    currentCard = `
      <a class="card current-week has-mascot" href="#/semaine/${current.id}">
        <div class="card-mascot">${faceForProgress(p, 176, -14)}</div>
        <p class="muted small">${isCurrentWeek(current) ? 'Cette semaine' : 'Dernière semaine'} · ${esc(weekLabel(current))}</p>
        <h2>${current.title ? esc(current.title) : 'Mon travail de la semaine'}</h2>
        ${current.message ? `<div class="teacher-msg"><span>Message de ton prof</span>${rich(current.message)}</div>` : ''}
        <div class="hero-progress-label"><strong>Ma progression</strong><span>${p.done} / ${p.total}</span></div>
        ${progressBar(p)}
        ${todo.length ? `<ul class="todo">${todo.slice(0, 5).map(i => `<li>${icon(TYPES[i.type].icon)} ${esc(i.title)}</li>`).join('')}${todo.length > 5 ? `<li class="muted">… et ${todo.length - 5} autre(s)</li>` : ''}</ul>`
          : '<p class="cheer">Tout est fait cette semaine, bravo !</p>'}
        <span class="cta">${p.done ? 'Continuer' : 'Commencer'}<span class="cta-arrow">${icon('arrow-right')}</span></span>
      </a>`;
  }

  return `
    <div class="hero">
      <h1>Bonjour ${esc(firstName(student.name))} <button class="mascot-btn" data-action="pick-mascot" title="Changer de personnage">${mascot(myMascot() || 'zap', { mood: myMascot() === 'snooze' ? 'calm' : 'happy', anim: 'wiggle', size: 48 })}</button></h1>
      <p class="muted">${esc(student.level)} · ${(student.subjects || []).map(subjectTag).join(' ')}</p>
      ${gamiChips()}
    </div>

    ${fresh.length ? `
      <div class="card new-corrections">
        <h3 class="nc-head"><span>${icon('mail-check')} ${fresh.length === 1 ? 'Nouvelle correction' : `${fresh.length} nouvelles corrections`}</span></h3>
        ${fresh.map(i => `<a class="corr-link" href="#/semaine/${i.week_id}?item=${i.id}">${icon(TYPES[i.type].icon)} ${esc(i.title)}
          ${S.subs[i.id].grade ? `<span class="status ok">${esc(S.subs[i.id].grade)}</span>` : i.type === 'quiz' ? `<span class="status ok">${S.subs[i.id].score}/${S.subs[i.id].total}</span>` : ''}</a>`).join('')}
      </div>` : ''}

    ${currentCard || '<div class="empty card">' + mascot(myMascot() || 'snooze', { mood: 'sleep', size: 96 }) + '<p>Ton prof n’a pas encore publié de travail. Reviens bientôt !</p></div>'}

    ${items.length ? `
      <h2 class="section-title">${icon('trending-up')} Mon suivi</h2>
      <div class="stat-row">
        <div class="card stat"><span class="stat-mascot">${mascotFace(exDone ? 'happy' : 'meh', { size: 84, rotate: 16 })}</span><span class="stat-num">${exDone}/${exos.length}</span><span class="muted small">exercices rendus</span></div>
        <div class="card stat"><span class="stat-mascot">${qAvg === null ? mascotFace('sleep', { size: 112, rotate: -12, anim: 'sleep' }) : faceForScore(qAvg / 100, 112, -12)}</span><span class="stat-num">${qAvg === null ? '—' : qAvg + '%'}</span><span class="muted small">moyenne aux quiz</span></div>
        <div class="card stat"><span class="stat-mascot">${mascotFace(corrected.length ? 'wow' : 'calm', { size: 98, rotate: 7 })}</span><span class="stat-num">${corrected.length}</span><span class="muted small">corrections reçues</span></div>
      </div>
      <div class="card">
        <h3>Par matière</h3>
        <div class="subject-rows">${Object.entries(bySubject).map(([k, b]) => {
          const p = { pct: Math.round(100 * b.done / b.total) };
          const avg = b.qs.length ? Math.round(100 * b.qs.reduce((a, x) => a + x, 0) / b.qs.length) : null;
          return `<div class="subject-row">
            <div class="subject-row-head"><strong>${esc(k)}</strong>
              <span class="small muted">${b.done}/${b.total} fait${b.done > 1 ? 's' : ''}${avg === null ? '' : ` · quiz ${avg} %`}</span></div>
            ${progressBar(p, { big: true, color: subjectColor(k) })}</div>`;
        }).join('')}</div>
      </div>` : ''}

    ${weeks.length > 1 ? `
      <h2 class="section-title">${icon('calendar-days')} Toutes mes semaines</h2>
      ${weeks.map(w => {
        const its = itemsBy[w.id] || [];
        const p = progressOf(its, S.subs);
        return `<a class="card week-row" href="#/semaine/${w.id}">
          <div class="week-row-main"><h3>${esc(weekLabel(w))}</h3>${w.title ? `<p class="muted">${esc(w.title)}</p>` : ''}</div>
          <div class="week-row-side"><span class="pct">${p.pct >= 100 ? icon('check') : ''}${p.pct} %</span>${progressBar(p)}</div></a>`;
      }).join('')}` : ''}`;
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

/* ---------- Semaine ---------- */

async function viewStudentWeek(wid) {
  await loadStudentData();
  const week = S.data.weeks.find(w => w.id === wid);
  if (!week) return notFound();
  const items = S.data.items.filter(i => i.week_id === wid);

  // Corrigés disponibles (seulement pour le travail déjà corrigé)
  await Promise.all(items
    .filter(i => i.type !== 'notion' && S.subs[i.id] && S.subs[i.id].status !== 'brouillon' && !S.solutions[i.id])
    .map(async i => { S.solutions[i.id] = await Api.getSolution(i.id); }));
  markSeen(items.filter(i => S.subs[i.id]?.status === 'corrige').map(i => S.subs[i.id].id));

  // Ordre des slides : notions, puis exercices, puis quiz
  const ordered = TYPE_ORDER.flatMap(t => items.filter(i => i.type === t));
  // Lien direct vers un élément (?item=…), sinon la première étape pas encore faite
  const wanted = new URLSearchParams(location.hash.split('?')[1] || '').get('item');
  let idx = ordered.findIndex(i => i.id === wanted);
  if (idx < 0) idx = S.slide?.[wid] ?? ordered.findIndex(i => !isItemDone(i, S.subs[i.id]));
  S.slide = { ...(S.slide || {}), [wid]: Math.max(0, Math.min(idx < 0 ? 0 : idx, ordered.length - 1)) };
  return studentWeekHtml(week, ordered);
}

function studentWeekHtml(week, items) {
  const p = progressOf(items, S.subs);
  const cur = S.slide?.[week.id] || 0;
  const slides = items.map((it, i) => `
    <div class="slide" data-i="${i}" ${i === cur ? '' : 'hidden'}>
      <div class="slide-type type-${it.type}"><span class="type-chip">${icon(TYPES[it.type].icon)} ${TYPES[it.type].label}</span>
        <span class="muted small">Étape ${i + 1} sur ${items.length}</span></div>
      ${studentItem(it)}
    </div>`).join('');
  return `
    <nav class="crumbs"><a href="#/">${icon('arrow-left')} Mon suivi</a></nav>
    <div class="hero card has-mascot compact">
      <div class="card-mascot">${faceForProgress(p, 150, 11)}</div>
      <p class="muted">${esc(weekLabel(week))}</p>
      <h1>${week.title ? esc(week.title) : 'Mon travail de la semaine'}</h1>
      ${week.message ? `<div class="teacher-msg"><span>Message de ton prof</span>${rich(week.message)}</div>` : ''}
      <div class="hero-progress">${heroProgress(p)}</div>
    </div>
    ${items.length ? `
      <section class="deck" data-week="${week.id}" aria-roledescription="carrousel" aria-label="Travail de la semaine">
        <div class="deck-dots" role="tablist">${deckDots(items, cur)}</div>
        <div class="deck-track">${slides}</div>
        <div class="deck-nav">
          <button class="btn" data-action="slide" data-dir="-1" ${cur === 0 ? 'disabled' : ''}>${icon('chevron-left')} Précédent</button>
          <span class="deck-count">${cur + 1} / ${items.length}</span>
          <button class="btn primary" data-action="slide" data-dir="1" ${cur === items.length - 1 ? 'disabled' : ''}>Suivant ${icon('chevron-right')}</button>
        </div>
      </section>`
      : '<div class="empty card">' + mascot(myMascot() || 'snooze', { mood: 'sleep', size: 96 }) + '<p>Rien à faire cette semaine, profites-en !</p></div>'}`;
}

function heroProgress(p) {
  return `<div class="hero-progress-label"><strong>Ma progression</strong><span>${p.done} / ${p.total}</span></div>${progressBar(p)}
    ${p.total && p.done === p.total ? '<p class="cheer">Bravo, tu as tout terminé !</p>' : ''}`;
}

function deckDots(items, cur) {
  return items.map((it, i) => `<button class="deck-dot type-${it.type} ${i === cur ? 'active' : ''} ${isItemDone(it, S.subs[it.id]) ? 'done' : ''}"
    role="tab" aria-selected="${i === cur}" aria-label="Étape ${i + 1} : ${esc(it.title)}" data-action="slide-to" data-i="${i}">${isItemDone(it, S.subs[it.id]) ? icon('check') : i + 1}</button>`).join('');
}

/** Affiche la slide n° i de la semaine en cours. */
function goSlide(i) {
  const deck = $('.deck');
  if (!deck) return;
  const slides = $$('.slide', deck);
  const n = slides.length;
  const prev = S.slide[deck.dataset.week] || 0;
  i = Math.max(0, Math.min(i, n - 1));
  if (i === prev && !slides[i].hidden) return;
  S.slide[deck.dataset.week] = i;
  slides.forEach((el, k) => {
    el.hidden = k !== i;
    el.classList.remove('from-left', 'from-right');
    if (k === i) el.classList.add(i > prev ? 'from-right' : 'from-left');
  });
  $$('.deck-dot', deck).forEach((d, k) => { d.classList.toggle('active', k === i); d.setAttribute('aria-selected', k === i); });
  $('.deck-count', deck).textContent = `${i + 1} / ${n}`;
  const [btnPrev, btnNext] = $$('.deck-nav .btn', deck);
  btnPrev.disabled = i === 0;
  btnNext.disabled = i === n - 1;
  const top = deck.getBoundingClientRect().top + window.scrollY - 80;
  if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
}

function refreshDeck() {
  const deck = $('.deck');
  if (!deck) return;
  const items = S.data.items.filter(i => i.week_id === deck.dataset.week);
  const ordered = TYPE_ORDER.flatMap(t => items.filter(i => i.type === t));
  $('.deck-dots', deck).innerHTML = deckDots(ordered, S.slide[deck.dataset.week] || 0);
}

// Balayage du doigt sur téléphone
(() => {
  let x0 = null, y0 = null;
  document.addEventListener('touchstart', e => {
    if (!e.target.closest('.deck-track') || e.target.closest('input, textarea, select')) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const deck = $('.deck');
      if (deck) goSlide((S.slide[deck.dataset.week] || 0) + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });
  // Flèches du clavier (hors saisie)
  document.addEventListener('keydown', e => {
    const deck = $('.deck');
    if (!deck || e.target.closest('input, textarea, select, [contenteditable]') || $('#modal').open || $('#lesson')) return;
    if (e.key === 'ArrowRight') goSlide((S.slide[deck.dataset.week] || 0) + 1);
    if (e.key === 'ArrowLeft') goSlide((S.slide[deck.dataset.week] || 0) - 1);
  });
})();

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
      ${draft ? `<div class="lesson-launch">
        <div class="launch-meta"><span>${icon('pencil')} ${mode === 'fichier' ? 'Réponse en photo' : mode === 'les_deux' ? 'Texte ou photo' : 'Réponse écrite'}</span>
          <span>${icon('zap')} ${XP.exercice} XP</span>${sub?.answer || files.length ? `<span>${icon('check')} Brouillon enregistré</span>` : ''}</div>
        <button class="btn primary big block" data-action="lesson-open" data-iid="${it.id}">${sub?.answer || files.length ? 'Continuer ma réponse' : 'Répondre'} ${icon('arrow-right')}</button>
        <p class="hint">${it.share_model && it.instant_result ? 'Tu verras la correction juste après l’envoi.' : 'Ton prof corrigera ta copie.'}</p>
      </div>` : `<div class="answer-zone">
        <h4>Ma réponse</h4>
        ${mode !== 'fichier' ? (draft
          ? `<textarea class="answer-text" data-iid="${it.id}" rows="5" placeholder="Écris ta réponse ici…">${esc(sub?.answer || '')}</textarea>
             <span class="hint save-state" id="save-${it.id}">${sub?.answer ? 'Brouillon enregistré' : 'Ta réponse est enregistrée automatiquement.'}</span>`
          : (sub.answer ? `<div class="student-answer">${rich(sub.answer)}</div>` : '')) : ''}
        ${mode !== 'texte' ? `
          ${imagePreviews(files)}
          ${draft ? fileList(files, { removable: true, dataAttr: `data-iid="${it.id}"` }) : fileList(files)}
          ` : ''}
      </div>`}
      ${correctionBlock(it, sub)}
    </article>`;
}

function studentQuiz(it, sub) {
  const draft = !sub || sub.status === 'brouillon';
  const qs = it.questions || [];
  const answers = sub?.answers || {};
  const corrected = sub?.status === 'corrige';
  const sol = S.solutions[it.id] || {};
  const head = `
    <div class="item-card-top">${subjectTag(it.subject)}
      ${corrected ? `<span class="status ${sub.score === sub.total ? 'ok' : sub.score >= sub.total / 2 ? 'mid' : 'ko'}">${sub.score}/${sub.total}</span>`
        : sub?.status === 'envoye' ? '<span class="status mid">Envoyé</span>' : ''}</div>
    <h3>${esc(it.title)}</h3>
    ${it.content ? `<div class="content">${rich(it.content)}</div>` : ''}`;

  if (draft) {
    const done = Object.keys(sub?.checked || {}).length;
    return `<article class="card s-item type-quiz" id="item-${it.id}">${head}
      ${statusBanner(it, sub)}
      <div class="lesson-launch">
        <div class="launch-meta"><span>${icon('circle-help')} ${plural(qs.length, 'question')}</span>
          ${it.instant_result ? `<span>${icon('heart')} ${HEARTS} vies</span><span>${icon('zap')} jusqu’à ${qs.length * XP.quizRight + XP.quizPerfect} XP</span>` : ''}</div>
        ${done ? progressBar({ pct: Math.round(100 * done / Math.max(1, qs.length)) }) : ''}
        <button class="btn primary big block" data-action="lesson-open" data-iid="${it.id}">${done ? `Reprendre (${done}/${qs.length})` : 'Commencer le quiz'} ${icon('arrow-right')}</button>
        <p class="hint">${it.instant_result ? 'Une question à la fois : tu sais tout de suite si c’est juste.' : 'Ton prof validera tes réponses avant que tu voies le résultat.'}</p>
      </div></article>`;
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
  refreshDeck();
  if (typeof L !== 'undefined' && L?.iid === iid && L.phase === 'answer' && L.kind === 'exercice') lessonRender();
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
