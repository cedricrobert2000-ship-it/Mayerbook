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
      <a class="card current-week" href="#/semaine/${current.id}">
        <p class="muted small">${isCurrentWeek(current) ? 'Cette semaine' : 'Dernière semaine'} · ${esc(weekLabel(current))}</p>
        <h2>${current.title ? esc(current.title) : 'Mon travail de la semaine'}</h2>
        ${current.message ? `<div class="teacher-msg"><span>Message de ton prof</span>${rich(current.message)}</div>` : ''}
        <div class="hero-progress-label"><strong>Ma progression</strong><span>${p.done} / ${p.total}</span></div>
        ${progressBar(p)}
        ${todo.length ? `<ul class="todo">${todo.slice(0, 5).map(i => `<li>${icon(TYPES[i.type].icon)} ${esc(i.title)}</li>`).join('')}${todo.length > 5 ? `<li class="muted">… et ${todo.length - 5} autre(s)</li>` : ''}</ul>`
          : '<p class="cheer">' + icon('party-popper') + ' Tout est fait cette semaine, bravo !</p>'}
        <span class="cta">${p.done ? 'Continuer' : 'Commencer'}<span class="cta-arrow">${icon('arrow-right')}</span></span>
      </a>`;
  }

  return `
    <div class="hero">
      <h1>Bonjour ${esc(firstName(student.name))} ${icon('hand', 'wave')}</h1>
      <p class="muted">${esc(student.level)} · ${(student.subjects || []).map(subjectTag).join(' ')}</p>
    </div>

    ${fresh.length ? `
      <div class="card new-corrections">
        <h3>${icon('mail-check')} ${fresh.length === 1 ? 'Nouvelle correction' : `${fresh.length} nouvelles corrections`}</h3>
        ${fresh.map(i => `<a class="corr-link" href="#/semaine/${i.week_id}?item=${i.id}">${icon(TYPES[i.type].icon)} ${esc(i.title)}
          ${S.subs[i.id].grade ? `<span class="status ok">${esc(S.subs[i.id].grade)}</span>` : i.type === 'quiz' ? `<span class="status ok">${S.subs[i.id].score}/${S.subs[i.id].total}</span>` : ''}</a>`).join('')}
      </div>` : ''}

    ${currentCard || '<div class="empty card"><div class="empty-icon">' + icon('inbox') + '</div><p>Ton prof n’a pas encore publié de travail. Reviens bientôt !</p></div>'}

    ${items.length ? `
      <h2 class="section-title">${icon('trending-up')} Mon suivi</h2>
      <div class="stat-row">
        <div class="card stat"><span class="stat-num">${exDone}/${exos.length}</span><span class="muted small">exercices rendus</span></div>
        <div class="card stat"><span class="stat-num">${qAvg === null ? '—' : qAvg + '%'}</span><span class="muted small">moyenne aux quiz</span></div>
        <div class="card stat"><span class="stat-num">${corrected.length}</span><span class="muted small">corrections reçues</span></div>
      </div>
      <div class="card">
        <h3>Par matière</h3>
        <div class="subject-rows">${Object.entries(bySubject).map(([k, b]) => {
          const p = { pct: Math.round(100 * b.done / b.total) };
          const avg = b.qs.length ? Math.round(100 * b.qs.reduce((a, x) => a + x, 0) / b.qs.length) : null;
          return `<div class="subject-row">${subjectTag(k)}<div class="grow">${progressBar(p, { small: true })}</div>
            <span class="small">${b.done}/${b.total}${avg === null ? '' : ` · quiz ${avg}%`}</span></div>`;
        }).join('')}</div>
      </div>` : ''}

    ${weeks.length > 1 ? `
      <h2 class="section-title">${icon('calendar-days')} Toutes mes semaines</h2>
      ${weeks.map(w => {
        const its = itemsBy[w.id] || [];
        const p = progressOf(its, S.subs);
        return `<a class="card week-row" href="#/semaine/${w.id}">
          <div class="week-row-main"><h3>${esc(weekLabel(w))}</h3>${w.title ? `<p class="muted">${esc(w.title)}</p>` : ''}</div>
          <div class="week-row-side"><span class="pct">${p.pct}%</span>${progressBar(p, { small: true })}</div></a>`;
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

  return studentWeekHtml(week, items);
}

function studentWeekHtml(week, items) {
  const p = progressOf(items, S.subs);
  const sections = TYPE_ORDER.map(type => {
    const list = items.filter(i => i.type === type);
    if (!list.length) return '';
    return `<section class="item-section"><h2>${icon(TYPES[type].icon)} ${TYPES[type].plural}</h2>
      ${list.map(it => studentItem(it)).join('')}</section>`;
  }).join('');
  return `
    <nav class="crumbs"><a href="#/">${icon('arrow-left')} Mon suivi</a></nav>
    <div class="hero card">
      <p class="muted">${esc(weekLabel(week))}</p>
      <h1>${week.title ? esc(week.title) : 'Mon travail de la semaine'}</h1>
      ${week.message ? `<div class="teacher-msg"><span>Message de ton prof</span>${rich(week.message)}</div>` : ''}
      <div class="hero-progress">
        <div class="hero-progress-label"><strong>Ma progression</strong><span>${p.done} / ${p.total}</span></div>
        ${progressBar(p)}
        ${p.total && p.done === p.total ? '<p class="cheer">' + icon('party-popper') + ' Bravo, tu as tout terminé !</p>' : ''}
      </div>
    </div>
    ${sections || '<div class="empty card"><p>Rien à faire cette semaine ' + icon('smile') + '</p></div>'}`;
}

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
           ${sub.score === sub.total ? icon('trophy') + ' Parfait !' : sub.score >= sub.total / 2 ? icon('thumbs-up') + ' Pas mal !' : icon('biceps-flexed') + ' Continue tes efforts !'}
           Score : <strong>${sub.score} / ${sub.total}</strong></div>`
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
  if (hp) hp.innerHTML = `<div class="hero-progress-label"><strong>Ma progression</strong><span>${p.done} / ${p.total}</span></div>${progressBar(p)}
    ${p.total && p.done === p.total ? '<p class="cheer">' + icon('party-popper') + ' Bravo, tu as tout terminé !</p>' : ''}`;
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
  const list = [...(S.subs[iid]?.files || [])];
  list.splice(index, 1);
  try { await studentSave(iid, { files: list }); } catch (e) { showError(e); }
}
