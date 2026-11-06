'use strict';

/* =========================================================
   Mode leçon (plein écran, une question à la fois)
   - Quiz : « Vérifier » question par question, la réponse est alors
     verrouillée côté serveur (student_check), cœurs, XP, confettis.
   - Exercice : énoncé + réponse (texte / photo) puis envoi au prof.
   ========================================================= */

let L = null;           // leçon ouverte
const HEARTS = 3;
const XP = { quizRight: 10, quizPerfect: 20, quizSent: 5, exercice: 15, notion: 5 };

/* ---------- XP et série de jours ---------- */

function xpFor(it, sub) {
  if (!sub) return 0;
  if (it.type === 'notion') return sub.understood ? XP.notion : 0;
  if (it.type === 'exercice') return sub.status !== 'brouillon' ? XP.exercice : 0;
  if (sub.status === 'corrige' && sub.total) return sub.score * XP.quizRight + (sub.score === sub.total ? XP.quizPerfect : 0);
  if (sub.status === 'envoye') return (it.questions || []).length * XP.quizSent;
  return 0;
}

function studentXp() {
  return (S.data?.items || []).reduce((a, it) => a + xpFor(it, S.subs[it.id]), 0);
}

const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`; };

function markActiveToday() {
  try {
    const days = new Set(JSON.parse(localStorage.getItem('mayerbook:jours') || '[]'));
    days.add(dayKey(Date.now()));
    localStorage.setItem('mayerbook:jours', JSON.stringify([...days].slice(-400)));
  } catch { /* ignore */ }
}

/** Nombre de jours d'affilée avec du travail (aujourd'hui ou jusqu'à hier). */
function streakDays() {
  const days = new Set();
  try { JSON.parse(localStorage.getItem('mayerbook:jours') || '[]').forEach(d => days.add(d)); } catch { /* ignore */ }
  for (const s of S.data?.subs ? Object.values(S.subs) : []) {
    if (s.submitted_at) days.add(dayKey(s.submitted_at));
    if (s.updated_at && (s.understood || Object.keys(s.checked || {}).length)) days.add(dayKey(s.updated_at));
  }
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function gamiChips() {
  const streak = streakDays();
  return `<div class="gami">
    <span class="gami-chip streak ${streak ? 'on' : ''}" title="Jours d’affilée avec du travail">${icon('flame')} ${streak} ${streak > 1 ? 'jours' : 'jour'}</span>
    <span class="gami-chip xp" title="Points d’expérience">${icon('zap')} ${studentXp()} XP</span>
  </div>`;
}

/* ---------- Sons et vibrations ---------- */

const Sfx = {
  ctx: null,
  get muted() { try { return localStorage.getItem('mayerbook:muet') === '1'; } catch { return false; } },
  set muted(v) { try { localStorage.setItem('mayerbook:muet', v ? '1' : '0'); } catch { /* ignore */ } },
  tone(freq, start, dur, type = 'sine', gain = 0.18) {
    const c = this.ctx, t = c.currentTime + start;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  },
  play(kind) {
    const buzz = { ok: 25, ko: [40, 60, 40], done: [30, 40, 30, 40, 90] }[kind];
    if (buzz && !this.muted) navigator.vibrate?.(buzz);
    if (this.muted) return;
    try {
      this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (kind === 'ok') { this.tone(784, 0, 0.14, 'triangle'); this.tone(1175, 0.1, 0.28, 'triangle'); }
      if (kind === 'ko') { this.tone(233, 0, 0.16, 'sawtooth', 0.07); this.tone(175, 0.13, 0.3, 'sawtooth', 0.07); }
      if (kind === 'pick') this.tone(660, 0, 0.06, 'sine', 0.08);
      if (kind === 'done') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.11, i === 3 ? 0.5 : 0.16, 'triangle', 0.16));
    } catch { /* pas de son disponible */ }
  }
};

/* ---------- Confettis ---------- */

function confetti(root, amount = 140) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti';
  root.appendChild(cv);
  const ctx = cv.getContext('2d');
  const dpr = devicePixelRatio || 1;
  const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
  const colors = ['#604b9f', '#bdf5a1', '#ffad7e', '#d8bcff', '#ffb8e6', '#ffe680', '#a9d6ff'];
  const parts = Array.from({ length: amount }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
    vx: (Math.random() - 0.5) * 22 * dpr, vy: (-Math.random() * 18 - 6) * dpr,
    w: (6 + Math.random() * 8) * dpr, h: (8 + Math.random() * 10) * dpr,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[Math.floor(Math.random() * colors.length)]
  }));
  const t0 = performance.now();
  (function frame(t) {
    const life = (t - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.55 * dpr; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, life - 2.2));
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (life < 3.3) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

/* ---------- Ouverture / fermeture ---------- */

async function openLesson(iid) {
  const it = S.data.items.find(i => i.id === iid);
  if (!it || it.type === 'notion') return;
  const sub = S.subs[iid];
  if (sub && sub.status !== 'brouillon') return;
  L = { iid, it, kind: it.type, idx: 0, results: {}, sel: null, phase: 'answer', start: Date.now(), lost: false };

  if (it.type === 'quiz') {
    const qs = it.questions || [];
    // Questions déjà vérifiées (leçon reprise) : on récupère leur résultat
    const done = qs.filter(q => sub?.checked?.[q.id]);
    await Promise.all(done.map(async q => { L.results[q.id] = await Api.studentCheck(iid, q.id, sub.answers[q.id]); }));
    L.idx = qs.findIndex(q => !L.results[q.id]);
    if (L.idx < 0) { L.idx = qs.length; }
    L.sel = qs[L.idx] ? sub?.answers?.[qs[L.idx].id] ?? null : null;
  }

  document.documentElement.classList.add('lesson-open');
  const el = document.createElement('div');
  el.id = 'lesson';
  el.className = 'lesson';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', it.title);
  document.body.appendChild(el);
  el.addEventListener('input', e => {
    if (e.target.classList.contains('lesson-input')) { L.sel = e.target.value; updateCta(); }
    if (e.target.classList.contains('answer-text')) updateCta();
  });
  if (L.kind === 'quiz' && L.idx >= (it.questions || []).length) await finishQuiz();
  else lessonRender();
}

async function closeLesson() {
  if (!L) return;
  const iid = L.iid;
  if (L.kind === 'exercice') { try { await flushSave(iid); } catch (e) { showError(e); } }
  L = null;
  $('#lesson')?.remove();
  document.documentElement.classList.remove('lesson-open');
  await refreshStudentItem(iid);
}

/* ---------- Rendu ---------- */

function heartsLeft() {
  const wrong = Object.values(L.results).filter(r => r.checked && !r.correct).length;
  return Math.max(0, HEARTS - wrong);
}

function lessonRender() {
  const el = $('#lesson');
  if (!el || !L) return;
  const { it } = L;
  const qs = it.questions || [];
  const instant = it.instant_result;
  const pct = L.kind === 'quiz'
    ? Math.round(100 * Object.keys(L.results).length / Math.max(1, qs.length))
    : (L.phase === 'answer' ? 10 : 100);
  const muted = Sfx.muted;

  el.innerHTML = `
    <div class="lesson-inner">
      <header class="lesson-top">
        <button class="lesson-icon" data-action="lesson-close" aria-label="Fermer">${icon('x')}</button>
        <div class="lesson-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="lesson-bar-fill" style="width:${pct}%"></div></div>
        ${L.kind === 'quiz' && instant ? `<span class="hearts ${L.lost ? 'lost' : ''}" aria-label="${heartsLeft()} vies">${icon('heart')}<b>${heartsLeft()}</b></span>` : ''}
        <button class="lesson-icon" data-action="lesson-mute" aria-label="${muted ? 'Activer le son' : 'Couper le son'}" aria-pressed="${muted}">${icon(muted ? 'volume-x' : 'volume-2')}</button>
      </header>
      <main class="lesson-main">${L.phase === 'end' ? endHtml() : L.kind === 'quiz' ? questionHtml() : exerciseHtml()}</main>
      <footer class="lesson-foot ${L.phase === 'feedback' ? L.fb : ''}">${footHtml()}</footer>
    </div>`;
  L.lost = false;
  hydrateFiles(el);
  updateCta();
  const inp = $('.lesson-input', el);
  if (inp && L.phase === 'answer' && !('ontouchstart' in window)) inp.focus();
  if (L.phase === 'feedback') $('.lesson-cta', el)?.focus({ preventScroll: true });
}

function questionHtml() {
  const qs = L.it.questions;
  const q = qs[L.idx];
  const r = L.results[q.id];
  const locked = L.phase !== 'answer';
  const sel = L.sel;
  let input;
  if (q.type === 'texte') {
    const cls = r?.checked ? (r.correct ? 'right' : 'wrong') : '';
    input = `<input class="lesson-input ${cls}" value="${esc(sel ?? '')}" placeholder="Écris ta réponse" autocomplete="off" autocapitalize="off" spellcheck="false" ${locked ? 'disabled' : ''}>`;
  } else {
    input = `<div class="tiles ${q.type === 'vf' ? 'vf' : ''}">${q.options.map((o, j) => {
      let cls = String(sel) === String(j) ? 'picked' : '';
      if (r?.checked) {
        if (String(j) === String(r.answer)) cls = 'right';
        else if (String(sel) === String(j)) cls = 'wrong';
        else cls = 'dim';
      }
      return `<button class="tile ${cls}" data-action="lesson-pick" data-j="${j}" ${locked ? 'disabled' : ''} aria-pressed="${String(sel) === String(j)}">
        <span class="tile-key">${j + 1}</span><span class="tile-text">${esc(o)}</span></button>`;
    }).join('')}</div>`;
  }
  const mood = r?.checked ? (r.correct ? 'happy' : 'sad') : r ? 'calm' : 'wink';
  return `
    <p class="lesson-kicker">Question ${L.idx + 1} sur ${qs.length}${L.it.subject ? ' · ' + esc(L.it.subject) : ''}</p>
    <div class="lesson-prompt">
      <span class="lesson-mascot">${mascot(myMascot() || 'zap', { mood, size: 92, anim: r?.checked && r.correct ? 'bounce' : 'bob' })}</span>
      <div class="bubble">${rich(q.prompt)}</div>
    </div>
    ${input}`;
}

function exerciseHtml() {
  const { it } = L;
  const sub = S.subs[it.id];
  const mode = it.answer_mode || 'texte';
  const files = sub?.files || [];
  if (L.phase !== 'answer') {
    const sol = S.solutions[it.id] || {};
    return `
      <p class="lesson-kicker">Exercice${it.subject ? ' · ' + esc(it.subject) : ''}</p>
      <h2 class="lesson-title">${esc(it.title)}</h2>
      <div class="answer-zone"><h4>Ma réponse</h4>
        ${sub?.answer ? `<div class="student-answer">${rich(sub.answer)}</div>` : ''}${imagePreviews(files)}${fileList(files)}</div>
      ${sol.model_answer ? `<div class="lesson-solution"><h4>${icon('book-open')} Correction détaillée</h4><div class="content">${rich(sol.model_answer)}</div>
        <p class="hint">Compare avec ta réponse : ton prof va aussi corriger <strong>ta</strong> copie.</p></div>` : ''}`;
  }
  return `
    <p class="lesson-kicker">Exercice${it.subject ? ' · ' + esc(it.subject) : ''}</p>
    <div class="lesson-prompt">
      <span class="lesson-mascot">${mascot(myMascot() || 'zap', { mood: 'wink', size: 92 })}</span>
      <div class="bubble"><h2 class="lesson-title">${esc(it.title)}</h2>${it.content ? `<div class="content">${rich(it.content)}</div>` : ''}</div>
    </div>
    ${imagePreviews(it.attachments)}${fileList(it.attachments)}
    ${statusBanner(it, sub)}
    <div class="answer-zone">
      <h4>Ma réponse</h4>
      ${mode !== 'fichier' ? `<textarea class="answer-text" data-iid="${it.id}" rows="6" placeholder="Écris ta réponse ici…">${esc(sub?.answer || '')}</textarea>
        <span class="hint save-state" id="save-${it.id}">${sub?.answer ? 'Brouillon enregistré' : 'Ta réponse est enregistrée automatiquement.'}</span>` : ''}
      ${mode !== 'texte' ? `${imagePreviews(files)}${fileList(files, { removable: true, dataAttr: `data-iid="${it.id}"` })}
        <label class="btn file-btn">${icon('camera')} Ajouter une photo / un fichier<input type="file" data-upload="answer" data-iid="${it.id}" accept="image/*,application/pdf" multiple hidden></label>` : ''}
    </div>`;
}

function footHtml() {
  const { it } = L;
  if (L.phase === 'end') {
    return `<button class="btn primary big lesson-cta" data-action="lesson-close">Terminer</button>`;
  }
  if (L.kind === 'exercice') {
    if (L.phase === 'answer') {
      return `<p class="lesson-foot-hint">Une fois envoyé, tu ne pourras plus modifier ta réponse.</p>
        <button class="btn primary big lesson-cta" data-action="lesson-submit">${icon('send')} Envoyer à mon prof</button>`;
    }
    const sol = S.solutions[it.id] || {};
    return `<div class="lesson-fb">${mascot(myMascot() || 'zap', { mood: 'proud', size: 64, anim: 'bounce' })}
        <div><strong>Envoyé à ton prof !</strong><p>${sol.model_answer ? 'Voici la correction détaillée.' : 'Il va corriger ta copie.'} <span class="xp-pop">+${XP.exercice} XP</span></p></div></div>
      <button class="btn primary big lesson-cta" data-action="lesson-close">Continuer</button>`;
  }
  // Quiz
  const q = it.questions[L.idx];
  if (L.phase === 'answer') {
    return `<button class="btn primary big lesson-cta" data-action="lesson-check" disabled>${it.instant_result ? 'Vérifier' : 'Valider'}</button>`;
  }
  const r = L.results[q.id];
  const last = Object.keys(L.results).length >= it.questions.length;
  let fb;
  if (!r.checked) {
    fb = `${mascot(myMascot() || 'zap', { mood: 'calm', size: 64 })}<div><strong>Réponse enregistrée</strong><p>Ton prof te donnera le résultat.</p></div>`;
  } else if (r.correct) {
    const cheers = ['Bravo !', 'Excellent !', 'Super !', 'Génial !', 'Parfait !'];
    fb = `${mascot(myMascot() || 'zap', { mood: 'happy', size: 64, anim: 'bounce' })}<div><strong>${cheers[L.idx % cheers.length]}</strong>
      <p><span class="xp-pop">+${XP.quizRight} XP</span></p>${r.explanation ? `<p class="fb-expl">${rich(r.explanation)}</p>` : ''}</div>`;
  } else {
    fb = `${mascot(myMascot() || 'zap', { mood: 'sad', size: 64, anim: 'shake' })}<div><strong>Pas tout à fait…</strong>
      <p>La bonne réponse : <b>${esc(q.type === 'texte' ? expectedText(q, r.answer) || '—' : answerText(q, r.answer))}</b></p>
      ${r.explanation ? `<p class="fb-expl">${rich(r.explanation)}</p>` : ''}
      ${heartsLeft() === 0 ? '<p class="fb-expl">Plus de cœurs, mais continue : tu peux finir le quiz !</p>' : ''}</div>`;
  }
  return `<div class="lesson-fb">${fb}</div>
    <button class="btn primary big lesson-cta" data-action="lesson-next">${last ? 'Voir mon score' : 'Continuer'}</button>`;
}

function endHtml() {
  const { it } = L;
  const sub = S.subs[it.id];
  const secs = Math.round((Date.now() - L.start) / 1000);
  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const graded = sub?.status === 'corrige' && sub.total;
  const ratio = graded ? sub.score / sub.total : 1;
  const title = !graded ? 'Quiz envoyé !' : ratio === 1 ? 'Parfait !' : ratio >= 0.5 ? 'Bien joué !' : 'Quiz terminé !';
  const mood = !graded ? 'proud' : ratio === 1 ? 'proud' : ratio >= 0.5 ? 'happy' : 'meh';
  const streak = streakDays();
  return `
    <div class="lesson-end">
      ${mascot(myMascot() || 'zap', { mood, size: 150, anim: 'bounce' })}
      <h2 class="end-title">${title}</h2>
      ${graded ? '' : '<p class="muted">Ton prof validera tes réponses, tu verras ton score ensuite.</p>'}
      <div class="end-stats">
        <div class="end-stat xp"><span>XP gagnés</span><strong>${icon('zap')} +${xpFor(it, sub)}</strong></div>
        ${graded ? `<div class="end-stat score"><span>Score</span><strong>${icon('target')} ${sub.score}/${sub.total}</strong></div>` : ''}
        <div class="end-stat time"><span>Temps</span><strong>${icon('timer')} ${time}</strong></div>
      </div>
      ${streak ? `<p class="end-streak">${icon('flame')} Série : <strong>${streak} ${streak > 1 ? 'jours' : 'jour'}</strong> d’affilée</p>` : ''}
    </div>`;
}

function updateCta() {
  if (!L || L.phase !== 'answer') return;
  const btn = $('#lesson .lesson-cta');
  if (!btn) return;
  if (L.kind === 'quiz') btn.disabled = L.sel === null || L.sel === undefined || String(L.sel).trim() === '';
  else {
    const txt = $('#lesson .answer-text')?.value || '';
    btn.disabled = !txt.trim() && !(S.subs[L.iid]?.files || []).length;
  }
}

/* ---------- Actions ---------- */

function lessonPick(j) {
  if (!L || L.phase !== 'answer') return;
  L.sel = Number(j);
  Sfx.play('pick');
  $$('#lesson .tile').forEach(t => {
    const on = t.dataset.j === String(j);
    t.classList.toggle('picked', on);
    t.setAttribute('aria-pressed', on);
  });
  updateCta();
}

async function lessonCheck(btn) {
  if (!L || L.phase !== 'answer') return;
  const q = L.it.questions[L.idx];
  const value = q.type === 'texte' ? String(L.sel).trim() : Number(L.sel);
  if (value === '' || Number.isNaN(value)) return;
  try {
    await busy(btn, '…', async () => {
      const before = heartsLeft();
      const r = await Api.studentCheck(L.iid, q.id, value);
      L.results[q.id] = r;
      const sub = S.subs[L.iid] ||= { item_id: L.iid, status: 'brouillon', answers: {}, checked: {} };
      sub.answers = { ...(sub.answers || {}), [q.id]: value };
      sub.checked = { ...(sub.checked || {}), [q.id]: true };
      markActiveToday();
      L.phase = 'feedback';
      L.fb = !r.checked ? 'info' : r.correct ? 'ok' : 'ko';
      L.lost = heartsLeft() < before;
      Sfx.play(r.checked ? (r.correct ? 'ok' : 'ko') : 'pick');
    });
    lessonRender();
  } catch (e) { showError(e); }
}

async function lessonNext() {
  if (!L) return;
  const qs = L.it.questions;
  const next = qs.findIndex(q => !L.results[q.id]);
  if (next < 0) return finishQuiz();
  L.idx = next;
  L.sel = S.subs[L.iid]?.answers?.[qs[next].id] ?? null;
  L.phase = 'answer';
  lessonRender();
}

async function finishQuiz() {
  try {
    S.subs[L.iid] = await Api.studentSubmit(L.iid);
    S.solutions[L.iid] = await Api.getSolution(L.iid);
  } catch (e) { showError(e); }
  markActiveToday();
  L.phase = 'end';
  lessonRender();
  Sfx.play('done');
  const sub = S.subs[L.iid];
  confetti($('#lesson'), sub?.total && sub.score === sub.total ? 220 : 120);
}

async function lessonSubmitExercise(btn) {
  if (!L) return;
  try {
    await busy(btn, 'Envoi…', async () => {
      await flushSave(L.iid);
      const sub = S.subs[L.iid];
      if (!sub?.answer?.trim() && !sub?.files?.length) throw new Error('Écris ta réponse ou ajoute une photo avant d’envoyer.');
      S.subs[L.iid] = await Api.studentSubmit(L.iid);
      S.solutions[L.iid] = await Api.getSolution(L.iid);
    });
  } catch (e) { return showError(e); }
  markActiveToday();
  L.phase = 'feedback';
  L.fb = 'ok';
  lessonRender();
  Sfx.play('done');
  confetti($('#lesson'));
}

Object.assign(Actions, {
  'lesson-open': d => openLesson(d.iid).catch(showError),
  'lesson-close': () => closeLesson(),
  'lesson-mute': () => { Sfx.muted = !Sfx.muted; lessonRender(); },
  'lesson-pick': d => lessonPick(d.j),
  'lesson-check': (d, el) => lessonCheck(el),
  'lesson-next': () => lessonNext(),
  'lesson-submit': (d, el) => lessonSubmitExercise(el)
});

document.addEventListener('keydown', e => {
  if (!L || !$('#lesson')) return;
  const typing = e.target.closest('textarea');
  if (e.key === 'Escape') { e.preventDefault(); closeLesson(); return; }
  if (typing || e.target.closest('button')) return;
  if (L.phase === 'answer' && L.kind === 'quiz' && /^[1-9]$/.test(e.key) && !e.target.closest('input')) {
    const tile = $(`#lesson .tile[data-j="${Number(e.key) - 1}"]`);
    if (tile) lessonPick(tile.dataset.j);
  }
  if (e.key === 'Enter') {
    const cta = $('#lesson .lesson-cta');
    if (cta && !cta.disabled && L.kind === 'quiz') { e.preventDefault(); cta.click(); }
  }
});
