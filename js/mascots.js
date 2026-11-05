'use strict';

/* =========================================================
   Personnages animés de Mayerbook
   7 personnages (zen, grr, zap, snooze, ouch, wow, meh) dessinés en SVG,
   11 expressions et plusieurs animations (CSS, voir « Personnages » dans style.css).

   mascot('zen', { mood: 'happy', size: 64, anim: 'bounce', label: 'Bravo !' })
   ========================================================= */

const INK = '#111';
const ST = `stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

/* Corps de chaque personnage + position du visage (x, yeux, écart, bouche, échelle) */
const MASCOTS = {
  zen: {
    body: '<circle cx="100" cy="100" r="82" fill="#A8E89A"/>',
    face: { x: 100, ey: 94, d: 28, my: 134, f: 1 },
    own: 'calm'
  },
  grr: {
    body: '<rect x="22" y="28" width="156" height="150" rx="42" fill="#FF9A5C"/>',
    face: { x: 100, ey: 106, d: 24, my: 146, f: 1 },
    own: 'angry'
  },
  zap: {
    body: '<polygon points="122,8 46,112 94,112 72,194 160,78 110,78 136,8" fill="#FFD84D" stroke="#FFD84D" stroke-width="14" stroke-linejoin="round"/>',
    face: { x: 102, ey: 94, d: 15, my: 118, f: 0.72 },
    own: 'happy'
  },
  snooze: {
    body: '<path d="M18 176 Q18 36 100 36 Q182 36 182 176 Z" fill="#9CC8F5" stroke="#9CC8F5" stroke-width="10" stroke-linejoin="round"/>',
    face: { x: 100, ey: 114, d: 28, my: 150, f: 1 },
    own: 'sleep'
  },
  ouch: {
    body: '<polygon points="100,30 176,170 24,170" fill="#FF7A6B" stroke="#FF7A6B" stroke-width="34" stroke-linejoin="round"/>',
    face: { x: 100, ey: 124, d: 24, my: 156, f: 0.85 },
    own: 'ouch'
  },
  wow: {
    body: '<circle cx="100" cy="104" r="80" fill="#D9B8F5"/><path d="M44 58 Q100 0 160 60" stroke="#B98BE6" stroke-width="12" stroke-linecap="round" fill="none"/>',
    face: { x: 100, ey: 96, d: 26, my: 146, f: 1 },
    own: 'wow'
  },
  meh: {
    body: '<ellipse cx="100" cy="106" rx="84" ry="74" fill="#F7A8D8"/>',
    face: { x: 100, ey: 94, d: 27, my: 146, f: 1 },
    own: 'sad'
  }
};

/* Expressions : yeux + bouche */
const MOODS = {
  happy:   ['arc', 'grin'],     // content
  calm:    ['closed', 'smile'], // serein
  proud:   ['closed', 'grin'],  // fier
  wink:    ['wink', 'smile'],   // clin d'œil
  wow:     ['big', 'O'],        // étonné
  sad:     ['up', 'frown'],     // triste
  angry:   ['angry', 'frown'],  // fâché
  ouch:    ['x', 'flat'],       // aïe
  sleep:   ['closed', 'o'],     // endormi
  meh:     ['dots', 'flat'],    // bof
  worried: ['big', 'wavy']      // inquiet
};
const OPEN_EYES = ['dots', 'big', 'up', 'angry'];

function mEyes(kind, { x, ey, d, f }) {
  const L = x - d, R = x + d, r = n => +(n * f).toFixed(1);
  const both = fn => fn(L, -1) + fn(R, 1);
  switch (kind) {
    case 'closed': return both(c => `<path d="M${c - r(12)} ${ey} Q${c} ${ey + r(13)} ${c + r(12)} ${ey}" ${ST}/>`);
    case 'arc':    return both(c => `<path d="M${c - r(10)} ${ey + r(4)} Q${c} ${ey - r(10)} ${c + r(10)} ${ey + r(4)}" ${ST}/>`);
    case 'dots':   return both(c => `<circle cx="${c}" cy="${ey + r(4)}" r="${r(7)}" fill="${INK}"/>`);
    case 'big':    return both(c => `<circle cx="${c}" cy="${ey}" r="${r(16)}" fill="#fff" stroke="${INK}" stroke-width="5"/><circle cx="${c}" cy="${ey}" r="${r(7)}" fill="${INK}"/>`);
    case 'up':     return both(c => `<circle cx="${c}" cy="${ey}" r="${r(16)}" fill="#fff" stroke="${INK}" stroke-width="5"/><circle cx="${c}" cy="${ey - r(5)}" r="${r(7)}" fill="${INK}"/>`);
    case 'x':      return both((c, s) => `<path d="M${c - s * r(10)} ${ey - r(11)} L${c + s * r(9)} ${ey} L${c - s * r(10)} ${ey + r(11)}" ${ST}/>`);
    case 'angry':  return both((c, s) => `<path d="M${c + s * r(14)} ${ey - r(22)} L${c - s * r(10)} ${ey - r(12)}" ${ST}/><circle cx="${c}" cy="${ey + r(4)}" r="${r(7)}" fill="${INK}"/>`);
    case 'wink':   return `<path d="M${L - r(10)} ${ey + r(4)} Q${L} ${ey - r(10)} ${L + r(10)} ${ey + r(4)}" ${ST}/><circle cx="${R}" cy="${ey + r(3)}" r="${r(7)}" fill="${INK}"/>`;
    default: return '';
  }
}

function mMouth(kind, { x, my, f }) {
  const r = n => +(n * f).toFixed(1);
  switch (kind) {
    case 'smile': return `<path d="M${x - r(22)} ${my - r(6)} Q${x} ${my + r(14)} ${x + r(22)} ${my - r(6)}" ${ST}/>`;
    case 'grin':  return `<path d="M${x - r(22)} ${my - r(8)} Q${x} ${my + r(26)} ${x + r(22)} ${my - r(8)} Z" fill="${INK}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M${x - r(9)} ${my + r(7)} Q${x} ${my + r(3)} ${x + r(9)} ${my + r(7)} Q${x} ${my + r(11)} ${x - r(9)} ${my + r(7)}Z" fill="#ff6f8f"/>`;
    case 'frown': return `<path d="M${x - r(20)} ${my + r(6)} Q${x} ${my - r(10)} ${x + r(20)} ${my + r(6)}" ${ST}/>`;
    case 'o':     return `<ellipse cx="${x}" cy="${my}" rx="${r(9)}" ry="${r(11)}" fill="${INK}"/>`;
    case 'O':     return `<ellipse cx="${x}" cy="${my}" rx="${r(14)}" ry="${r(18)}" fill="${INK}"/>`;
    case 'flat':  return `<path d="M${x - r(12)} ${my} L${x + r(12)} ${my}" ${ST}/>`;
    case 'wavy':  return `<path d="M${x - r(20)} ${my} Q${x - r(10)} ${my - r(8)} ${x} ${my} Q${x + r(10)} ${my + r(8)} ${x + r(20)} ${my}" ${ST}/>`;
    default: return '';
  }
}

let mascotSeq = 0;
/**
 * @param {string} name  zen | grr | zap | snooze | ouch | wow | meh
 * @param {object} o     mood, size (px), anim (bob|bounce|wiggle|shake|sleep|pop|peek|hop|none), label, cls
 */
function mascot(name, o = {}) {
  const m = MASCOTS[name] || MASCOTS.zen;
  const mood = o.mood && MOODS[o.mood] ? o.mood : m.own;
  const [eyes, mouth] = MOODS[mood];
  const anim = o.anim || (mood === 'sleep' ? 'sleep' : 'bob');
  const size = o.size || 56;
  const delay = ((mascotSeq++ * 0.37) % 2.4).toFixed(2);
  const blink = OPEN_EYES.includes(eyes) ? ' blink' : '';
  const zzz = mood === 'sleep'
    ? '<g class="m-zzz" aria-hidden="true"><text x="150" y="40">z</text><text x="170" y="18">z</text></g>' : '';
  const a11y = o.label ? `role="img" aria-label="${esc(o.label)}"` : 'aria-hidden="true"';
  return `<span class="mascot m-${anim} m-${name} ${o.cls || ''}" style="--s:${size}px;--d:${delay}s" ${a11y}>` +
    `<svg viewBox="-10 -14 220 220" focusable="false"><g class="m-all"><g class="m-body">${m.body}</g>` +
    `<g class="m-eyes${blink}">${mEyes(eyes, m.face)}</g><g class="m-mouth">${mMouth(mouth, m.face)}</g></g>${zzz}</svg></span>`;
}

/* Choix d'un personnage selon une réussite (0 → 1) */
function mascotForScore(ratio, size = 56) {
  if (ratio >= 1) return mascot('zap', { mood: 'happy', anim: 'bounce', size, label: 'Parfait !' });
  if (ratio >= 0.7) return mascot('zen', { mood: 'proud', anim: 'pop', size, label: 'Très bien' });
  if (ratio >= 0.5) return mascot('meh', { mood: 'wink', anim: 'pop', size, label: 'Pas mal' });
  return mascot('ouch', { mood: 'worried', anim: 'shake', size, label: 'Continue tes efforts' });
}

/* Personnage de la carte « Cette semaine » selon l'avancement */
function mascotForProgress(p, size = 120) {
  if (!p.total) return mascot('snooze', { mood: 'sleep', size });
  if (p.done === p.total) return mascot('zap', { mood: 'happy', anim: 'bounce', size, label: 'Tout est fait !' });
  if (p.done === 0) return mascot('snooze', { mood: 'sleep', size, label: 'Pas encore commencé' });
  return p.pct >= 50 ? mascot('zen', { mood: 'happy', size }) : mascot('wow', { mood: 'wink', size });
}

/* La bande de personnages de l'écran de connexion */
function mascotCrew() {
  const crew = [
    ['zen', 'happy', 'bob', 66], ['grr', 'angry', 'wiggle', 58], ['zap', 'happy', 'bounce', 70],
    ['snooze', 'sleep', 'sleep', 62], ['ouch', 'ouch', 'bob', 58], ['wow', 'wow', 'bob', 64], ['meh', 'wink', 'wiggle', 60]
  ];
  return crew.map(([n, mood, anim, s]) => mascot(n, { mood, anim, size: s })).join('');
}

/* Écran de chargement : trois personnages qui sautent */
function loadingHtml() {
  return `<div class="loading"><div class="m-loader">${mascot('zen', { mood: 'happy', anim: 'hop', size: 34 })}${mascot('zap', { mood: 'happy', anim: 'hop', size: 34, cls: 'h2' })}${mascot('wow', { mood: 'wow', anim: 'hop', size: 34, cls: 'h3' })}</div></div>`;
}

/* ---------- Visage seul (dans les cartes) ---------- */

const FACE = { x: 100, ey: 80, d: 36, my: 130, f: 1.35 };

/** Seulement les yeux et la bouche, à poser sur une carte colorée. */
function mascotFace(mood = 'happy', o = {}) {
  const [eyes, mouth] = MOODS[mood] || MOODS.happy;
  const blink = OPEN_EYES.includes(eyes) ? ' blink' : '';
  const delay = ((mascotSeq++ * 0.37) % 2.4).toFixed(2);
  const size = o.size || 150;
  return `<span class="m-face mascot m-${o.anim || 'bob'}" style="--s:${size}px;--fs:${size}px;--r:${o.rotate || 0}deg;--d:${delay}s" aria-hidden="true">` +
    `<svg viewBox="0 0 200 200" focusable="false"><g class="m-all"><g class="m-eyes${blink}">${mEyes(eyes, FACE)}</g>` +
    `<g class="m-mouth">${mMouth(mouth, FACE)}</g></g></svg></span>`;
}

function faceForProgress(p, size, rotate = 0) {
  if (!p.total || p.done === 0) return mascotFace('sleep', { size, rotate, anim: 'sleep' });
  if (p.done === p.total) return mascotFace('happy', { size, rotate, anim: 'bounce' });
  return mascotFace(p.pct >= 50 ? 'calm' : 'wink', { size, rotate });
}

function faceForScore(ratio, size, rotate = 0) {
  if (ratio >= 0.8) return mascotFace('proud', { size, rotate });
  if (ratio >= 0.5) return mascotFace('wink', { size, rotate });
  return mascotFace('worried', { size, rotate });
}

/* ---------- Personnage choisi par l'élève ---------- */

const MASCOT_INFO = {
  zen:    { name: 'Zen',    tagline: 'Toujours calme, rien ne le stresse' },
  zap:    { name: 'Zap',    tagline: 'Plein d’énergie, rapide comme l’éclair' },
  wow:    { name: 'Wow',    tagline: 'Curieux de tout, toujours épaté' },
  grr:    { name: 'Grr',    tagline: 'Râleur… mais avec un grand cœur' },
  snooze: { name: 'Snooze', tagline: 'Champion de la sieste' },
  meh:    { name: 'Meh',    tagline: 'Un peu timide, mais très attachant' },
  ouch:   { name: 'Ouch',   tagline: 'Un peu maladroit, jamais découragé' }
};

function myMascot() {
  const n = typeof Session !== 'undefined' && Session?.student?.mascot;
  return MASCOTS[n] ? n : null;
}

/** Personnage de l'élève qui réagit à un score (0 → 1). */
function myMascotForScore(ratio, size = 64) {
  const n = myMascot();
  if (!n) return mascotForScore(ratio, size);
  if (ratio >= 1) return mascot(n, { mood: 'happy', anim: 'bounce', size, label: 'Parfait !' });
  if (ratio >= 0.7) return mascot(n, { mood: 'proud', anim: 'pop', size, label: 'Très bien' });
  if (ratio >= 0.5) return mascot(n, { mood: 'wink', anim: 'pop', size, label: 'Pas mal' });
  return mascot(n, { mood: 'worried', anim: 'shake', size, label: 'Continue tes efforts' });
}

function openMascotPicker(first = false) {
  const current = myMascot();
  const d = Modal.open(`
    <form class="form" id="mascot-form">
      <h2>${first ? 'Choisis ton personnage' : 'Changer de personnage'}</h2>
      <p class="muted">${first ? 'Il t’accompagnera dans Mayerbook et réagira à ton travail.' : 'Tu peux en changer quand tu veux.'}</p>
      <div class="mascot-grid">
        ${Object.entries(MASCOT_INFO).map(([k, info]) => `
          <label class="mascot-choice">
            <input type="radio" name="mascot" value="${k}" ${k === (current || 'zen') ? 'checked' : ''}>
            <span class="mascot-card">
              ${mascot(k, { mood: k === 'snooze' ? 'sleep' : 'happy', anim: 'bob', size: 76 })}
              <strong>${info.name}</strong>
              <span class="small muted">${info.tagline}</span>
            </span>
          </label>`).join('')}
      </div>
      <p class="form-error" hidden></p>
      <div class="form-actions">
        ${first ? '' : '<button type="button" class="btn ghost" data-action="close-modal">Annuler</button>'}
        <button class="btn primary">${first ? 'C’est parti !' : 'Choisir'}</button>
      </div>
    </form>`, { wide: true });
  const form = $('#mascot-form', d);
  // Le personnage sélectionné saute de joie
  const refresh = () => $$('.mascot-choice', form).forEach(l => {
    const on = l.querySelector('input').checked;
    l.querySelector('.mascot').classList.toggle('m-bounce', on);
    l.querySelector('.mascot').classList.toggle('m-bob', !on);
  });
  form.addEventListener('change', refresh);
  refresh();
  form.onsubmit = async e => {
    e.preventDefault();
    const name = new FormData(form).get('mascot');
    try {
      await busy(form.querySelector('button.primary'), 'Enregistrement…', () => Api.setMascot(name));
      Session.student.mascot = name;
      Modal.close();
      rerender();
      toast(`${MASCOT_INFO[name].name} t’accompagne maintenant`);
    } catch (ex) { const el = $('.form-error', d); el.textContent = ex.message; el.hidden = false; }
  };
}
