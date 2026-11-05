'use strict';

/**
 * Données du prof, enregistrées dans le navigateur (localStorage).
 *
 * state = {
 *   version: 1,
 *   students: [{
 *     id, name, level, subjects: [], contact, notes, createdAt,
 *     weeks: [{
 *       id, start: 'AAAA-MM-JJ', title, message,
 *       items: [{ id, type: 'notion'|'exercice'|'quiz', subject, title, content,
 *                 link?, correction?, showCorrection?, questions? }],
 *       results?: { done: {}, understood: {}, quiz: {}, comment, at }
 *     }]
 *   }]
 * }
 */
const Store = {
  KEY: 'mayerbook:data:v1',
  state: { version: 1, students: [] },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (data && Array.isArray(data.students)) this.state = data;
    } catch { /* stockage indisponible : on reste en mémoire */ }
  },

  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.state));
    } catch {
      toast('⚠️ Impossible d’enregistrer dans ce navigateur. Pense à exporter une sauvegarde.');
    }
  },

  get students() { return this.state.students; },

  student(id) { return this.state.students.find(s => s.id === id) || null; },

  week(student, weekId) { return student ? student.weeks.find(w => w.id === weekId) || null : null; },

  addStudent(data) {
    const s = { id: uid(), createdAt: Date.now(), weeks: [], subjects: [], contact: '', notes: '', ...data };
    this.state.students.push(s);
    this.save();
    return s;
  },

  deleteStudent(id) {
    this.state.students = this.state.students.filter(s => s.id !== id);
    this.save();
  },

  addWeek(student, data) {
    const w = { id: uid(), title: '', message: '', items: [], ...data };
    student.weeks.push(w);
    this.sortWeeks(student);
    this.save();
    return w;
  },

  sortWeeks(student) {
    student.weeks.sort((a, b) => b.start.localeCompare(a.start));
  },

  latestWeek(student) {
    return student.weeks.slice().sort((a, b) => b.start.localeCompare(a.start))[0] || null;
  },

  exportJSON() {
    return JSON.stringify({ app: 'mayerbook', exportedAt: new Date().toISOString(), ...this.state }, null, 2);
  },

  importJSON(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.students)) throw new Error('Fichier invalide');
    this.state = { version: 1, students: data.students };
    this.save();
  }
};

/** Avancement d'une liste d'éléments selon des résultats (côté prof ou côté élève). */
function computeProgress(items, res) {
  let done = 0;
  const total = items.length;
  if (res) {
    for (const it of items) {
      if (it.type === 'notion' && res.understood?.[it.id]) done++;
      else if (it.type === 'exercice' && res.done?.[it.id]) done++;
      else if (it.type === 'quiz' && res.quiz?.[it.id]?.submitted) done++;
    }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Une réponse d'élève est-elle correcte ? */
function isCorrect(q, value) {
  if (value === undefined || value === null || value === '') return false;
  if (q.type === 'texte') {
    const v = normalizeAnswer(value);
    return String(q.answer || '').split('|').map(normalizeAnswer).filter(Boolean).includes(v);
  }
  return Number(value) === Number(q.answer);
}

function correctAnswerText(q) {
  if (q.type === 'texte') return String(q.answer || '').split('|')[0].trim();
  return q.options?.[q.answer] ?? '';
}

function answerText(q, value) {
  if (value === undefined || value === null || value === '') return '—';
  if (q.type === 'texte') return String(value);
  return q.options?.[Number(value)] ?? '—';
}
