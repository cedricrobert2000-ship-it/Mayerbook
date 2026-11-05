'use strict';

/**
 * Partage sans serveur : le contenu de la semaine est compressé et placé
 * dans l'adresse du lien (après le #, donc jamais envoyé à un serveur).
 *   #/s/<données>  → page de l'élève
 *   #/r/<données>  → résultats renvoyés par l'élève au prof
 */

function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipeBytes(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

async function encodePayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream !== 'undefined') {
    return 'z' + b64urlEncode(await pipeBytes(bytes, new CompressionStream('deflate-raw')));
  }
  return 'j' + b64urlEncode(bytes);
}

async function decodePayload(str) {
  const flag = str[0];
  let bytes = b64urlDecode(str.slice(1));
  if (flag === 'z') {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Navigateur trop ancien pour ouvrir ce lien.');
    }
    bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
  } else if (flag !== 'j') {
    throw new Error('Lien invalide');
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function baseUrl() {
  return location.href.split('#')[0];
}

async function buildStudentLink(student, week) {
  const payload = {
    v: 1,
    sid: student.id,
    name: student.name,
    level: student.level,
    week: { id: week.id, start: week.start, title: week.title, message: week.message, items: week.items }
  };
  return baseUrl() + '#/s/' + await encodePayload(payload);
}

async function buildResultsLink(data) {
  return baseUrl() + '#/r/' + await encodePayload(data);
}

/** Accepte un lien complet ou seulement le code, renvoie le code. */
function extractPayload(text, kind) {
  const t = String(text || '').trim();
  const m = t.match(new RegExp('#/' + kind + '/([A-Za-z0-9_-]+)'));
  if (m) return m[1];
  return /^[zj][A-Za-z0-9_-]+$/.test(t) ? t : null;
}

function shareButtons(text, subject) {
  const enc = encodeURIComponent;
  return `
    <button type="button" class="btn primary" data-action="copy" data-text="${esc(text)}">📋 Copier le lien</button>
    ${navigator.share ? `<button type="button" class="btn" data-action="native-share" data-text="${esc(text)}" data-subject="${esc(subject)}">📤 Partager…</button>` : ''}
    <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${enc(subject + '\n' + text)}">💬 WhatsApp</a>
    <a class="btn" href="mailto:?subject=${enc(subject)}&body=${enc(text)}">✉️ E-mail</a>`;
}
