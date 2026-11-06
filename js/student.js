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

async function viewStudentHome(wid = null) {
  await loadStudentData();
  const { student, weeks } = S.data;
  const week = (wid && weeks.find(w => w.id === wid)) || currentWeek();
  if (wid && !weeks.find(w => w.id === wid)) return notFound();
  const seen = seenCorrections();
  const fresh = correctedItems().filter(i => !seen.includes(S.subs[i.id].id));
  const me = myMascot() || 'zap';

  const head = `
    <div class="hello-row">
      <button class="hello-mascot" data-action="pick-mascot" aria-label="Changer de personnage">${mascot(me, { mood: 'happy', size: 64, anim: 'wiggle' })}</button>
      <h1 class="hello-title">Bonjour ${esc(firstName(student.name))} !</h1>
    </div>
    ${gamiHero()}
    ${fresh.length ? `<a class="card notice-card" href="#/progres">${icon('mail-check')}
      <span><strong>${fresh.length === 1 ? 'Une nouvelle correction' : `${fresh.length} nouvelles corrections`}</strong><br><span class="muted small">Ton prof a corrigé ton travail</span></span>
      ${icon('chevron-right')}</a>` : ''}`;

  if (!week) {
    return head + '<div class="empty card">' + mascot(myMascot() || 'snooze', { mood: 'sleep', size: 96 }) + '<p>Ton prof n’a pas encore publié de travail. Reviens bientôt !</p></div>';
  }

  const steps = weekSteps(week.id);
  const p = progressOf(steps, S.subs);
  const nextIdx = steps.findIndex(i => !isItemDone(i, S.subs[i.id]));
  const left = p.total - p.done;
  const when = isCurrentWeek(week) ? 'Cette semaine' : weekLabel(week);

  return `${head}
    <div class="week-stage">
      <div class="card current-week week-card">
        ${weeks.length > 1 ? `<button class="week-switch" data-action="pick-week">${icon('calendar-days')} ${esc(when)} ${icon('chevron-down')}</button>` : `<p class="muted small">${esc(when)}</p>`}
        <h2>${week.title ? esc(week.title) : 'Mon travail de la semaine'}</h2>
        <div class="hero-progress-label"><strong>${left ? (left === 1 ? 'Plus qu’une étape !' : `Plus que ${left} étapes !`) : 'Tout est fait, bravo !'}</strong><span>${p.done} / ${p.total}</span></div>
        ${progressBar(p, { big: true })}
        ${week.message ? `<div class="week-msg">${icon('message-circle')}<div>${rich(week.message)}</div></div>` : ''}
      </div>
    </div>
    ${steps.length ? weekPath(week.id, steps, nextIdx)
      : '<div class="empty card">' + mascot(myMascot() || 'snooze', { mood: 'sleep', size: 96 }) + '<p>Rien à faire cette semaine, profites-en !</p></div>'}`;
}

/** Choisir une autre semaine (bottom sheet). */
function openWeekPicker() {
  const cur = location.hash.match(/semaine\/([^/?]+)/)?.[1] || currentWeek()?.id;
  openSheet(`
    <div class="sheet-head"><div><h2>Mes semaines</h2></div></div>
    <div class="week-list">${S.data.weeks.map(w => {
      const p = progressOf(weekSteps(w.id), S.subs);
      return `<a class="week-pick ${w.id === cur ? 'on' : ''}" href="${w.id === currentWeek()?.id ? '#/' : `#/semaine/${w.id}`}" data-action="close-modal-link">
        <span class="grow"><strong>${isCurrentWeek(w) ? 'Cette semaine' : esc(weekLabel(w))}</strong>${w.title ? `<span class="small muted">${esc(w.title)}</span>` : ''}</span>
        <span class="wp-pct ${p.pct >= 100 ? 'full' : ''}">${p.pct >= 100 ? icon('check') : ''}${p.pct} %</span></a>`;
    }).join('')}</div>`);
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

async function viewStudentWeek(wid) { return viewStudentHome(wid); }

/* ---------- Le chemin de la semaine (façon jeu) ---------- */

const PATH_SECTIONS = {
  notion:   { title: 'Je révise',      icon: 'book-open' },
  exercice: { title: 'Je m’entraîne',  icon: 'pencil' },
  quiz:     { title: 'Je joue',        icon: 'zap' }
};

const CARD_CREW = ['zap', 'wow', 'snooze', 'grr', 'meh', 'ouch', 'zen'];

function weekPath(wid, steps, nextIdx) {
  const me = myMascot() || 'zen';
  let n = 0;   // ordre d'apparition (animation en cascade)
  let crew = 0;
  const sections = TYPE_ORDER.map(type => {
    const its = steps.filter(i => i.type === type);
    if (!its.length) return '';
    const isDone = it => isItemDone(it, S.subs[it.id]);
    // À faire d'abord (la prochaine étape en tête), le travail fait à la fin
    const ordered = [...its.filter(i => steps.indexOf(i) === nextIdx), ...its.filter(i => !isDone(i) && steps.indexOf(i) !== nextIdx), ...its.filter(isDone)];
    const done = its.filter(isDone).length;
    const left = its.length - done;
    const sec = PATH_SECTIONS[type];
    const cards = ordered.map(it => {
      const sub = S.subs[it.id];
      const dn = isDone(it);
      const isNext = steps.indexOf(it) === nextIdx;
      const [label, cls] = stepStatus(it, sub);
      const who = isNext ? me : CARD_CREW[crew++ % CARD_CREW.length];
      return `<a class="wk-card type-${it.type} ${dn ? 'done' : isNext ? 'next' : 'todo'}" href="#/semaine/${wid}/${it.id}" style="--i:${n++}">
        <span class="wk-top">
          <span class="wk-icon">${icon(dn ? 'check' : TYPES[it.type].icon)}</span>
          ${isNext ? '<span class="wk-now">À toi !</span>' : dn ? `<span class="node-status ${cls}">${label}</span>` : cls !== 'todo' || label !== 'À faire' ? `<span class="node-status ${cls}">${label}</span>` : ''}
        </span>
        <strong class="wk-title">${esc(it.title)}</strong>
        ${it.subject && !dn ? `<span class="wk-sub">${esc(it.subject)}</span>` : ''}
        ${dn ? '' : `<span class="wk-cta">${isNext ? `C’est parti ${icon('arrow-right')}` : `Ouvrir ${icon('arrow-right')}`}</span>
        <span class="wk-mascot">${mascot(who, { mood: isNext ? 'happy' : 'wink', size: isNext ? 96 : 80, anim: isNext ? 'wiggle' : 'bob' })}</span>`}
      </a>`;
    }).join('');
    return `
      <section class="wk-section type-${type}">
        <div class="wk-head ${left ? '' : 'complete'}">
          <span class="ph-icon">${icon(left ? sec.icon : 'check')}</span>
          <strong>${sec.title}</strong>
          ${left ? `<span class="wk-left">${left} à faire</span>` : `<span class="wk-left ok">${icon('check')} Fini</span>`}
        </div>
        <div class="wk-row ${its.length === 1 ? 'single' : ''}">${cards}</div>
      </section>`;
  }).join('');
  const allDone = nextIdx < 0;
  return `<div class="week-cards">${sections}
    ${allDone ? `<div class="card wk-done">${mascot(me, { mood: 'proud', size: 80, anim: 'bounce' })}<strong>Semaine terminée, bravo !</strong></div>` : ''}</div>`;
}

function heroProgress(p) {
  const left = p.total - p.done;
  return `<div class="hero-progress-label"><strong>${left ? (left === 1 ? 'Plus qu’une étape !' : `Plus que ${left} étapes !`) : 'Tout est fait !'}</strong><span>${p.done} / ${p.total}</span></div>${progressBar(p, { big: true })}
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
    <nav class="crumbs step-crumbs"><a href="${wid === currentWeek()?.id ? '#/' : `#/semaine/${wid}`}">${icon('arrow-left')} Ma semaine</a><span class="muted small">Étape ${i + 1} sur ${steps.length}</span></nav>
    <div class="step-dots" aria-hidden="true">${steps.map((s, k) => `<span class="${k === i ? 'on' : ''} ${isItemDone(s, S.subs[s.id]) ? 'done' : ''}"></span>`).join('')}</div>
    <div class="slide-type type-${it.type}"><span class="type-chip">${icon(TYPES[it.type].icon)} ${TYPES[it.type].label}</span></div>
    ${studentItem(it)}
    <div class="step-nav">
      ${prev ? `<a class="btn big" href="#/semaine/${wid}/${prev.id}">${icon('chevron-left')} Précédent</a>` : '<span></span>'}
      ${next ? `<a class="btn primary big" href="#/semaine/${wid}/${next.id}">Suivant ${icon('chevron-right')}</a>`
        : `<a class="btn primary big" href="${wid === currentWeek()?.id ? '#/' : `#/semaine/${wid}`}">${icon('check')} Terminer</a>`}
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

  if (!items.length) return `<h1>Mes progrès</h1><div class="empty card">${mascot(myMascot() || 'snooze', { mood: 'sleep', size: 96 })}<p>Tes progrès apparaîtront ici.</p></div>${themeSwitcher()}`;

  return `
    <h1>Mes progrès</h1>
    ${gamiHero()}
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
    }).join('')}
    ${themeSwitcher()}`;
}

/* ---------- Contenu d'une étape ---------- */

function statusBanner(it, sub) {
  if (!sub || sub.status === 'brouillon') {
    if (sub?.feedback) return `<button class="state-card ko" data-action="sheet-redo" data-iid="${it.id}">
      ${mascotFace('worried', { size: 46 })}<span><strong>Ton prof te demande de refaire</strong><span class="small">Voir son message</span></span>${icon('chevron-right')}</button>`;
    return '';
  }
  if (sub.status === 'envoye') {
    const sol = S.solutions[it.id] || {};
    return `<div class="state-row"><span class="state-pill">${icon('send')} Envoyé</span>
      ${sol.model_answer ? `<button class="btn primary small" data-action="sheet-correction" data-iid="${it.id}">${icon('book-open')} Voir la correction</button>`
        : '<span class="muted small">Ton prof va corriger</span>'}</div>`;
  }
  return '';
}

/** Carte compacte « Corrigé » : le détail s'ouvre dans un bottom sheet. */
function correctionBlock(it, sub) {
  if (!sub || sub.status !== 'corrige') return '';
  const ratio = it.type === 'quiz' && sub.total ? sub.score / sub.total : null;
  const mood = ratio === null ? 'happy' : ratio === 1 ? 'proud' : ratio >= .5 ? 'happy' : 'worried';
  return `<button class="corr-card" data-action="sheet-correction" data-iid="${it.id}">
    ${mascotFace(mood, { size: 54 })}
    <span class="grow"><strong>${it.type === 'quiz' ? (ratio === 1 ? 'Parfait !' : 'Quiz corrigé') : 'Corrigé !'}</strong><span class="small">Voir la correction</span></span>
    ${sub.grade ? `<span class="grade">${esc(sub.grade)}</span>` : it.type === 'quiz' && sub.total ? `<span class="grade">${sub.score}/${sub.total}</span>` : ''}
    ${icon('chevron-right')}</button>`;
}

/** Détail des réponses d'un quiz corrigé (dans le sheet). */
function quizReviewHtml(it, sub) {
  const sol = S.solutions[it.id] || {};
  return (it.questions || []).map((q, i) => {
    const key = sol.answers?.[q.id];
    if (!key) return '';
    const val = sub.answers?.[q.id];
    const ok = isCorrect(q, key.answer, val);
    return `<div class="review-q ${ok ? 'ok' : 'ko'}">
      <span class="review-icon">${icon(ok ? 'check' : 'x')}</span>
      <div><p class="review-prompt">${rich(q.prompt)}</p>
        ${ok ? `<p class="review-answer">${esc(answerText(q, val))}</p>`
          : `<p class="review-answer"><s>${esc(answerText(q, val))}</s> → <strong>${esc(expectedText(q, key.answer) || answerText(q, key.answer))}</strong></p>`}
        ${key.explanation ? `<p class="muted small">${rich(key.explanation)}</p>` : ''}</div></div>`;
  }).join('');
}

async function openCorrectionSheet(iid, { justSent = false } = {}) {
  const it = S.data.items.find(i => i.id === iid);
  const sub = S.subs[iid];
  if (!it || !sub) return;
  if (!S.solutions[iid]) S.solutions[iid] = await Api.getSolution(iid);
  const sol = S.solutions[iid] || {};
  const corrected = sub.status === 'corrige';
  const feedback = corrected && (sub.feedback || sub.feedback_files?.length);
  const ratio = it.type === 'quiz' && sub.total ? sub.score / sub.total : null;
  const d = openSheet(`
    <div class="sheet-head">
      ${mascot(myMascot() || 'zen', { mood: justSent ? 'proud' : ratio !== null && ratio < .5 ? 'worried' : 'happy', size: 72, anim: 'bounce' })}
      <div><h2>${justSent ? 'Envoyé !' : 'Correction'}</h2><p class="muted small">${esc(it.title)}</p></div>
      ${sub.grade ? `<span class="grade big">${esc(sub.grade)}</span>` : corrected && it.type === 'quiz' ? `<span class="grade big">${sub.score}/${sub.total}</span>` : ''}
    </div>
    ${feedback ? `<section class="sheet-section"><h3>${icon('message-circle')} Mot de ton prof</h3>
      ${sub.feedback ? `<div class="content">${rich(sub.feedback)}</div>` : ''}${imagePreviews(sub.feedback_files)}${fileList(sub.feedback_files)}</section>` : ''}
    ${it.type === 'quiz' && corrected ? `<section class="sheet-section"><h3>${icon('circle-check')} Mes réponses</h3>${quizReviewHtml(it, sub)}</section>` : ''}
    ${sol.model_answer ? `<section class="sheet-section"><h3>${icon('book-open')} Correction détaillée</h3><div class="content">${rich(sol.model_answer)}</div>
      ${!corrected ? '<p class="muted small">Compare avec ta réponse : ton prof va aussi corriger ta copie.</p>' : ''}</section>` : ''}
    ${!feedback && !sol.model_answer && !(it.type === 'quiz' && corrected) ? '<p class="muted">Ton prof va corriger ta copie.</p>' : ''}
    <button class="btn primary big block" data-action="close-modal">${justSent ? 'Super !' : 'Fermer'}</button>`);
  hydrateFiles(d);
}

function openRedoSheet(iid) {
  const sub = S.subs[iid];
  if (!sub?.feedback) return;
  openSheet(`
    <div class="sheet-head">${mascot(myMascot() || 'zen', { mood: 'worried', size: 72 })}
      <div><h2>À refaire</h2><p class="muted small">Le message de ton prof</p></div></div>
    <section class="sheet-section"><div class="content">${rich(sub.feedback)}</div></section>
    <button class="btn primary big block" data-action="close-modal">J’ai compris</button>`);
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
        ${draft ? '' : '<h4>Ma réponse</h4>'}
        ${mode !== 'fichier' ? (draft
          ? `<textarea class="answer-text" data-iid="${it.id}" rows="5" placeholder="Écris ta réponse ici…">${esc(sub?.answer || '')}</textarea>
             <span class="hint save-state" id="save-${it.id}">${sub?.answer ? 'Brouillon enregistré' : ''}</span>`
          : (sub.answer ? `<div class="student-answer">${rich(sub.answer)}</div>` : '')) : ''}
        ${mode !== 'texte' ? `
          ${imagePreviews(files)}
          ${draft ? fileList(files, { removable: true, dataAttr: `data-iid="${it.id}"` }) : fileList(files)}
          ${draft ? `<label class="btn file-btn">${icon('camera')} Photo<input type="file" data-upload="answer" data-iid="${it.id}" accept="image/*,application/pdf" multiple hidden></label>` : ''}` : ''}
        ${draft ? `<button class="btn primary big block" data-action="st-submit" data-iid="${it.id}">${icon('send')} Envoyer à mon prof</button>` : ''}
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

  if (!draft) {
    return `<article class="card s-item type-quiz ${corrected ? 'is-done' : ''}" id="item-${it.id}">${head}
      ${corrected ? `<div class="quiz-score ${sub.score === sub.total ? 'perfect' : ''}">
           ${myMascotForScore(sub.score / sub.total, 64)}<div>${sub.score === sub.total ? 'Parfait !' : sub.score >= sub.total / 2 ? 'Pas mal !' : 'Continue tes efforts !'}<br>Score : <strong>${sub.score} / ${sub.total}</strong></div></div>
         ${correctionBlock(it, sub)}` : statusBanner(it, sub)}
    </article>`;
  }

  const footer = draft
    ? `<button class="btn primary big block" data-action="st-submit" data-iid="${it.id}">${icon('send')} Envoyer mes réponses</button>`
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
    if (!sub?.answer?.trim() && !sub?.files?.length) return toast('Écris ta réponse ou ajoute une photo.');
    if (!await confirmSheet({ title: 'On envoie ?', text: 'Tu ne pourras plus modifier ta réponse.', ok: 'Envoyer', cancel: 'Pas encore', mood: 'wow' })) return;
  } else {
    const answers = sub?.answers || {};
    const missing = (it.questions || []).filter(q => answers[q.id] === undefined || answers[q.id] === '').length;
    if (!await confirmSheet({ title: missing ? `Il manque ${plural(missing, 'réponse')}` : 'On envoie ?', text: missing ? 'Envoyer quand même ?' : 'Tu ne pourras plus les modifier.', ok: 'Envoyer', cancel: 'Pas encore', mood: missing ? 'worried' : 'wow' })) return;
  }
  try {
    await busy(btn, 'Envoi…', async () => {
      S.subs[iid] = await Api.studentSubmit(iid);
    });
    await refreshStudentItem(iid);
    if (typeof markActiveToday === 'function') markActiveToday();
    if (S.subs[iid].status === 'corrige' || S.solutions[iid]?.model_answer) openCorrectionSheet(iid, { justSent: true });
    else toast('Envoyé à ton prof');
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
