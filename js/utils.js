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
  notion:   { label: 'Notion à revoir', plural: 'Notions à revoir', icon: '💡' },
  exercice: { label: 'Exercice',        plural: 'Exercices',        icon: '✏️' },
  quiz:     { label: 'Quiz',            plural: 'Quiz',             icon: '❓' }
};
const TYPE_ORDER = ['notion', 'exercice', 'quiz'];

/* ---------- Helpers DOM / texte ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
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

function subjectHue(subject) {
  if (subject in SUBJECT_HUES) return SUBJECT_HUES[subject];
  let h = 0;
  for (const c of String(subject)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function subjectTag(subject) {
  if (!subject) return '';
  return `<span class="tag" style="--h:${subjectHue(subject)}">${esc(subject)}</span>`;
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

/** Normalise une réponse libre pour la comparer (casse, accents, ponctuation). */
function normalizeAnswer(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:!?'"’«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- Dates (format AAAA-MM-JJ, heure locale) ---------- */

function toISO(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
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
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  return toISO(d);
}
function fmtDay(iso, opts = { day: 'numeric', month: 'long' }) {
  return parseISO(iso).toLocaleDateString('fr-FR', opts);
}
function weekLabel(week) {
  return `Semaine du ${fmtDay(week.start)} au ${fmtDay(addDays(week.start, 6))}`;
}
function fmtDateTime(ts) {
  return new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ---------- UI : toast, modale, copie ---------- */

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const Modal = {
  open(html, { wide = false } = {}) {
    const d = $('#modal');
    d.className = wide ? 'wide' : '';
    d.innerHTML = html;
    if (!d.open) d.showModal();
    const first = d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea, select');
    if (first) first.focus();
    return d;
  },
  close() {
    const d = $('#modal');
    if (d.open) d.close();
  }
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  toast('Copié dans le presse-papiers ✓');
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

function progressBar(p, { small = false } = {}) {
  return `<div class="progress ${small ? 'small' : ''}" role="progressbar" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100">
    <div class="progress-fill" style="width:${p.pct}%"></div>
  </div>`;
}
