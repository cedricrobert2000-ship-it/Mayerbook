'use strict';

/* =========================================================
   Personnages animés de Mayerbook
   7 personnages (zen, grr, zap, snooze, ouch, wow, meh) dessinés en SVG,
   11 expressions et plusieurs animations (CSS, voir « Personnages » dans style.css).

   mascot('zen', { mood: 'happy', size: 64, anim: 'bounce', label: 'Bravo !' })
   ========================================================= */

const INK = '#141216';
const ST = `stroke="${INK}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

/* Corps de chaque personnage (formes plates, couleurs vives),
   épaules / hanches pour les bras et jambes animés, position du visage. */
const MASCOTS = {
  zen: {   // œuf vert, serein
    color: '#4EE38A',
    body: c => `<ellipse cx="100" cy="94" rx="58" ry="72" fill="${c}"/>`,
    arms: [[46, 112], [154, 112]], hips: [82, 118], bottom: 160,
    face: { x: 100, ey: 84, d: 26, my: 120, f: 1.1 },
    own: 'calm'
  },
  grr: {   // hexagone rouge, râleur
    color: '#F2343F',
    body: c => `<polygon points="58,26 142,26 178,94 142,160 58,160 22,94" fill="${c}" stroke="${c}" stroke-width="14" stroke-linejoin="round"/>`,
    arms: [[30, 112], [170, 112]], hips: [76, 124], bottom: 164,
    face: { x: 100, ey: 84, d: 28, my: 126, f: 1.05 },
    own: 'angry'
  },
  zap: {   // étoile jaune, plein d'énergie
    color: '#FFD21F',
    body: c => `<polygon points="100,8 124,62 182,66 138,104 152,162 100,132 48,162 62,104 18,66 76,62" fill="${c}" stroke="${c}" stroke-width="16" stroke-linejoin="round"/>`,
    arms: [[40, 76], [160, 76]], hips: [86, 114], bottom: 140,
    face: { x: 100, ey: 84, d: 19, my: 110, f: 0.88 },
    own: 'happy'
  },
  snooze: { // nuage bleu, champion de la sieste
    color: '#40BFFA',
    body: c => `<g fill="${c}"><circle cx="72" cy="94" r="34"/><circle cx="114" cy="78" r="42"/><circle cx="150" cy="108" r="30"/><circle cx="48" cy="122" r="28"/><rect x="40" y="104" width="128" height="52" rx="26"/></g>`,
    arms: [[34, 132], [166, 132]], hips: [82, 122], bottom: 154,
    face: { x: 102, ey: 104, d: 26, my: 134, f: 1 },
    own: 'sleep'
  },
  ouch: {  // triangle corail, un peu maladroit
    color: '#FF5F6D',
    body: c => `<polygon points="100,22 178,152 22,152" fill="${c}" stroke="${c}" stroke-width="26" stroke-linejoin="round"/>`,
    arms: [[36, 128], [164, 128]], hips: [78, 122], bottom: 164,
    face: { x: 100, ey: 104, d: 21, my: 134, f: 0.92 },
    own: 'ouch'
  },
  wow: {   // rond violet à antenne, curieux
    color: '#8A3FF0',
    body: c => `<path d="M110 30 Q112 14 126 8" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="128" cy="6" r="9" fill="${c}"/><circle cx="100" cy="96" r="70" fill="${c}"/>`,
    arms: [[34, 118], [166, 118]], hips: [82, 118], bottom: 162,
    face: { x: 100, ey: 84, d: 29, my: 126, f: 1.12 },
    own: 'wow'
  },
  meh: {   // goutte turquoise, timide
    color: '#14D9CF',
    body: c => `<path d="M100 10 C114 34 158 78 158 116 A58 58 0 0 1 42 116 C42 78 86 34 100 10Z" fill="${c}"/>`,
    arms: [[46, 128], [154, 128]], hips: [84, 116], bottom: 170,
    face: { x: 100, ey: 108, d: 24, my: 140, f: 1 },
    own: 'sad'
  }
};

/* Bras levés pour la joie, baissés sinon */
const ARMS_UP = ['happy', 'proud', 'wow'];

function mLimbs(m, mood) {
  const c = m.color, up = ARMS_UP.includes(mood);
  const arm = ([x, y], s) => {
    const d = up ? `M${x} ${y} q${s * 14} -6 ${s * 20} -36` : `M${x} ${y} q${s * 16} 8 ${s * 16} 34`;
    const hx = x + s * (up ? 20 : 16), hy = y + (up ? -36 : 34);
    return `<g class="m-arm m-arm-${s < 0 ? 'l' : 'r'}" style="transform-origin:${x + 10}px ${y + 14}px">` +
      `<path d="${d}" stroke="${c}" stroke-width="8" stroke-linecap="round" fill="none"/><circle cx="${hx}" cy="${hy}" r="7.5" fill="${c}"/></g>`;
  };
  const leg = (x, s) => `<path class="m-leg m-leg-${s < 0 ? 'l' : 'r'}" d="M${x} ${m.bottom - 8} L${x} 194 L${x + s * 10} 194" stroke="${c}" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  return {
    back: leg(m.hips[0], -1) + leg(m.hips[1], 1),
    front: arm(m.arms[0], -1) + arm(m.arms[1], 1)
  };
}

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
    case 'big':    return both(c => `<circle cx="${c}" cy="${ey}" r="${r(17)}" fill="#fff"/><circle cx="${c + r(2)}" cy="${ey + r(1)}" r="${r(8)}" fill="${INK}"/>`);
    case 'up':     return both(c => `<circle cx="${c}" cy="${ey}" r="${r(17)}" fill="#fff"/><circle cx="${c}" cy="${ey - r(6)}" r="${r(8)}" fill="${INK}"/>`);
    case 'x':      return both((c, s) => `<path d="M${c - s * r(10)} ${ey - r(11)} L${c + s * r(9)} ${ey} L${c - s * r(10)} ${ey + r(11)}" ${ST}/>`);
    case 'angry':  return both((c, s) => `<circle cx="${c}" cy="${ey + r(2)}" r="${r(15)}" fill="#fff"/><circle cx="${c - s * r(3)}" cy="${ey + r(5)}" r="${r(7)}" fill="${INK}"/><path d="M${c + s * r(18)} ${ey - r(20)} L${c - s * r(14)} ${ey - r(8)}" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`);
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
  const limbs = mLimbs(m, mood);
  const anim = o.anim || (mood === 'sleep' ? 'sleep' : 'bob');
  const size = o.size || 56;
  const delay = ((mascotSeq++ * 0.37) % 2.4).toFixed(2);
  const blink = OPEN_EYES.includes(eyes) ? ' blink' : '';
  const zzz = mood === 'sleep'
    ? '<g class="m-zzz" aria-hidden="true"><text x="150" y="40">z</text><text x="170" y="18">z</text></g>' : '';
  const a11y = o.label ? `role="img" aria-label="${esc(o.label)}"` : 'aria-hidden="true"';
  return `<span class="mascot m-${anim} m-${name} ${o.cls || ''}" style="--s:${size}px;--d:${delay}s" ${a11y}>` +
    `<svg viewBox="-10 -14 220 220" focusable="false"><g class="m-all">${limbs.back}<g class="m-body">${m.body(m.color)}</g>${limbs.front}` +
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
  zap:    { name: 'Zap',    tagline: 'Une étoile pleine d’énergie' },
  wow:    { name: 'Wow',    tagline: 'Curieux de tout, toujours épaté' },
  grr:    { name: 'Grr',    tagline: 'Râleur… mais avec un grand cœur' },
  snooze: { name: 'Snooze', tagline: 'Un nuage champion de la sieste' },
  meh:    { name: 'Plouf',  tagline: 'Une goutte timide mais attachante' },
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
    </form>`, { wide: true, sheet: true });
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
