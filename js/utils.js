'use strict';

/* ---------- Constantes ---------- */

const LEVELS = ['CM1', 'CM2', '6e', '5e', '4e', '3e', '2nde', '1re', 'Terminale'];

const SUBJECTS = [
  'Mathématiques', 'Français', 'Anglais', 'Espagnol', 'Allemand',
  'Physique-Chimie', 'SVT', 'Histoire-Géo', 'SES', 'Philosophie',
  'NSI', 'Méthodologie', 'Autre'
];

const SUBJECT_HUES = {
  'Mathématiques': 220, 'Français': 350, 'Anglais': 270, 'Espagnol': 25,
  'Allemand': 45, 'Physique-Chimie': 190, 'SVT': 140, 'Histoire-Géo': 30,
  'SES': 300, 'Philosophie': 250, 'NSI': 170, 'Méthodologie': 200, 'Autre': 0
};

const TYPES = {
  notion:   { label: 'Notion à revoir', plural: 'Notions à revoir', icon: 'lightbulb', un: 'une notion' },
  exercice: { label: 'Exercice',        plural: 'Exercices',        icon: 'pencil', un: 'un exercice' },
  quiz:     { label: 'Quiz',            plural: 'Quiz',             icon: 'circle-help', un: 'un quiz' }
};
const TYPE_ORDER = ['notion', 'exercice', 'quiz'];

const ANSWER_MODES = {
  texte: 'Réponse écrite',
  fichier: 'Photo / fichier',
  les_deux: 'Écrite et/ou photo'
};

/* ---------- Helpers DOM / texte ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/** Texte enrichi minimal : **gras**, liens cliquables, retours à la ligne. */
function rich(s) {
  return esc(s)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function truncate(s, n) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function plural(n, word, pluralWord) {
  return `${n} ${n > 1 ? (pluralWord || word + 's') : word}`;
}

function subjectHue(subject) {
  if (subject in SUBJECT_HUES) return SUBJECT_HUES[subject];
  let h = 0;
  for (const c of String(subject)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function subjectTag(subject) {
  if (!subject) return '';
  const key = { 'Mathématiques': 'maths', 'Français': 'francais', 'Philosophie': 'philo', 'SVT': 'svt' }[subject] || '';
  return `<span class="tag" data-s="${key}" style="--h:${subjectHue(subject)}">${esc(subject)}</span>`;
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

function avatar(name, size = '') {
  return `<span class="avatar ${size}" style="--h:${subjectHue(name)}">${esc(initials(name))}</span>`;
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 30);
}

function randomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Normalise une réponse libre (casse, accents, ponctuation) — identique au serveur. */
function normalizeAnswer(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:!?'"’«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- Quiz ---------- */

function isCorrect(q, keyAnswer, value) {
  if (value === undefined || value === null || value === '' || keyAnswer === undefined) return false;
  if (q.type === 'texte') {
    const v = normalizeAnswer(value);
    return String(keyAnswer || '').split('|').map(normalizeAnswer).filter(Boolean).includes(v);
  }
  return String(value) === String(keyAnswer);
}

function answerText(q, value) {
  if (value === undefined || value === null || value === '') return '—';
  if (q.type === 'texte') return String(value);
  return q.options?.[Number(value)] ?? '—';
}

function expectedText(q, keyAnswer) {
  if (q.type === 'texte') return String(keyAnswer || '').split('|')[0].trim();
  return q.options?.[Number(keyAnswer)] ?? '';
}

/* ---------- Progression ---------- */

function isItemDone(item, sub) {
  if (!sub) return false;
  if (item.type === 'notion') return !!sub.understood;
  return sub.status === 'envoye' || sub.status === 'corrige';
}

function progressOf(items, subsByItem) {
  const total = items.length;
  const done = items.filter(it => isItemDone(it, subsByItem[it.id])).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function indexBy(arr, key) {
  const o = {};
  for (const x of arr) o[x[key]] = x;
  return o;
}

function groupBy(arr, key) {
  const o = {};
  for (const x of arr) (o[x[key]] ||= []).push(x);
  return o;
}

/* ---------- Dates (AAAA-MM-JJ, heure locale) ---------- */

function toISO(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseISO(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function todayISO() { return toISO(new Date()); }
function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function mondayOf(iso) {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}
function fmtDay(iso, opts = { day: 'numeric', month: 'long' }) {
  return parseISO(iso).toLocaleDateString('fr-FR', opts);
}
function weekLabel(week) {
  return `Semaine du ${fmtDay(week.start_date)} au ${fmtDay(addDays(week.start_date, 6))}`;
}
function isCurrentWeek(week) {
  const t = todayISO();
  return week.start_date <= t && t <= addDays(week.start_date, 6);
}
function fmtDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ---------- Fichiers ---------- */

function fileIcon(f) {
  const t = f.type || '';
  if (t.startsWith('image/')) return icon('image');
  if (t === 'application/pdf') return icon('file-text');
  return icon('paperclip');
}
function fmtSize(n) {
  if (!n) return '';
  return n > 1e6 ? (n / 1e6).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1e3)) + ' Ko';
}

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Liste de fichiers ; les liens sont résolus après affichage (URL signées). */
function fileList(files, { removable = false, dataAttr = '' } = {}) {
  if (!files?.length) return '';
  return `<ul class="files">${files.map((f, i) => `
    <li>
      <a class="file" data-file-path="${esc(f.path)}" href="#" target="_blank" rel="noopener">
        <span>${fileIcon(f)}</span><span class="file-name">${esc(f.name)}</span><span class="muted tiny">${fmtSize(f.size)}</span>
      </a>
      ${removable ? `<button type="button" class="icon-btn danger" title="Retirer" data-action="remove-file" data-index="${i}" ${dataAttr}>${icon('x')}</button>` : ''}
    </li>`).join('')}</ul>`;
}

/** Aperçu des images d'une liste de fichiers. */
function imagePreviews(files) {
  const imgs = (files || []).filter(f => (f.type || '').startsWith('image/'));
  if (!imgs.length) return '';
  return `<div class="thumbs">${imgs.map(f => `<a data-file-path="${esc(f.path)}" href="#" target="_blank" rel="noopener"><img data-img-path="${esc(f.path)}" alt="${esc(f.name)}"></a>`).join('')}</div>`;
}

/** Remplit les href / src des fichiers affichés. */
async function hydrateFiles(root = document) {
  for (const a of $$('[data-file-path]', root)) {
    if (a.dataset.resolved) continue;
    a.dataset.resolved = '1';
    Api.fileUrl(a.dataset.filePath).then(url => { if (url) a.href = url; }).catch(() => {});
  }
  for (const img of $$('img[data-img-path]', root)) {
    if (img.dataset.resolved) continue;
    img.dataset.resolved = '1';
    Api.fileUrl(img.dataset.imgPath).then(url => { if (url) img.src = url; }).catch(() => {});
  }
}

/* ---------- UI : toast, modale, chargement ---------- */

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function showError(e) {
  console.error(e);
  toast(e?.message || 'Une erreur est survenue');
}

const Modal = {
  open(html, { wide = false, sheet = false } = {}) {
    const d = $('#modal');
    d.className = [wide ? 'wide' : '', sheet ? 'sheet' : ''].join(' ').trim();
    d.innerHTML = (sheet ? '<div class="sheet-handle" aria-hidden="true"></div>' : '') + html;
    if (!d.open) d.showModal();
    const first = d.querySelector('[autofocus], input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]), textarea, select');
    if (first) first.focus();
    hydrateFiles(d);
    return d;
  },
  close() {
    const d = $('#modal');
    if (d.open) d.close();
  }
};

/** Panneau qui monte du bas de l'écran. */
function openSheet(html, o = {}) { return Modal.open(html, { ...o, sheet: true }); }

/** Confirmation en bottom sheet (remplace confirm()). Renvoie une promesse true/false. */
function confirmSheet({ title, text = '', ok = 'Oui', cancel = 'Annuler', mood = 'wow' }) {
  return new Promise(resolve => {
    const d = openSheet(`
      <div class="sheet-center">
        ${mascot((typeof myMascot === 'function' && myMascot()) || 'zen', { mood, size: 96, anim: 'bob' })}
        <h2>${title}</h2>
        ${text ? `<p class="muted">${text}</p>` : ''}
        <div class="sheet-actions">
          <button class="btn big" data-sheet="no">${cancel}</button>
          <button class="btn primary big" data-sheet="ok" data-action="sheet-ok">${ok}</button>
        </div>
      </div>`);
    let done = false;
    const finish = v => { if (done) return; done = true; Modal.close(); resolve(v); };
    d.querySelector('[data-sheet=ok]').addEventListener('click', e => { e.stopPropagation(); finish(true); });
    d.querySelector('[data-sheet=no]').addEventListener('click', e => { e.stopPropagation(); finish(false); });
    d.addEventListener('close', () => finish(false), { once: true });
  });
}

// Glisser vers le bas pour fermer un bottom sheet
(() => {
  let y0 = null, d = null;
  document.addEventListener('touchstart', e => {
    d = e.target.closest('dialog.sheet');
    if (!d || d.scrollTop > 0 || e.target.closest('input, textarea, select')) { y0 = null; return; }
    y0 = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (y0 === null || !d) return;
    const dy = Math.max(0, e.touches[0].clientY - y0);
    d.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (y0 === null || !d) return;
    const dy = e.changedTouches[0].clientY - y0;
    d.style.transform = '';
    if (dy > 90) Modal.close();
    y0 = null;
  }, { passive: true });
})();

/** Désactive un bouton pendant une action asynchrone. */
async function busy(btn, label, fn) {
  const old = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${label}`; }
  try { return await fn(); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; } }
}

function progressBar(p, { small = false, big = false, color = '' } = {}) {
  return `<div class="progress ${small ? 'small' : ''} ${big ? 'big' : ''}" role="progressbar" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100">
    <div class="progress-fill ${p.pct >= 100 ? 'full' : ''}" style="width:${p.pct}%;${color ? `--fill:${color}` : ''}"></div>
  </div>`;
}

/** Couleur pastel d'une matière (mêmes couleurs que les étiquettes). */
function subjectColor(subject) {
  const known = { 'Mathématiques': 'var(--c-sky)', 'Français': 'var(--c-pink)', 'Philosophie': 'var(--c-lilac)', 'SVT': 'var(--c-lime)' };
  return known[subject] || `hsl(${subjectHue(subject)} 75% 78%)`;
}

function loadingHtml() {
  return '<div class="loading"><span class="spinner big"></span></div>';
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  toast('Copié');
}

function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
