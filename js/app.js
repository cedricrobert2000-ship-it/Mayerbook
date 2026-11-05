'use strict';

/* =========================================================
   Routeur et gestion des événements
   #/                         tableau de bord
   #/eleve/<id>               fiche élève
   #/eleve/<id>/semaine/<id>  édition d'une semaine
   #/apercu/<id>/<id>         aperçu côté élève (prof)
   #/s/<données>              page de l'élève (lien partagé)
   #/r/<données>              import des résultats (prof)
   ========================================================= */

let lastPath = null;

async function route() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  const studentMode = parts[0] === 's';
  document.body.classList.toggle('student-mode', studentMode);
  $('#topbar-tag').textContent = studentMode ? 'Mon travail de la semaine' : 'Espace prof';
  $('#brand').setAttribute('href', studentMode ? location.hash : '#/');

  let html;
  if (parts[0] === 's' && parts[1]) html = await StudentView.fromPayload(parts[1]);
  else if (parts[0] === 'apercu') html = StudentView.fromStore(parts[1], parts[2]);
  else if (parts[0] === 'r' && parts[1]) html = await viewImportResults(parts[1]);
  else if (parts[0] === 'eleve' && parts[2] === 'semaine') html = viewWeek(parts[1], parts[3]);
  else if (parts[0] === 'eleve') html = viewStudent(parts[1]);
  else html = viewDashboard();

  $('#app').innerHTML = html;
  const titleBits = { s: 'Mon travail', apercu: 'Aperçu', r: 'Résultats', eleve: 'Élève' };
  document.title = (titleBits[parts[0]] ? titleBits[parts[0]] + ' · ' : '') + 'Mayerbook';

  if (hash !== lastPath) window.scrollTo(0, 0);
  lastPath = hash;
}

/** Ré-affiche la page courante (après une modification). */
function rerender() {
  const y = window.scrollY;
  route().then(() => window.scrollTo(0, y));
}

function findItem(sid, wid, iid) {
  const w = Store.week(Store.student(sid), wid);
  return { w, idx: w ? w.items.findIndex(i => i.id === iid) : -1 };
}

const Actions = {
  'close-modal': () => Modal.close(),
  'copy': d => copyText(d.text),
  'native-share': d => navigator.share({ title: d.subject, text: d.subject, url: d.text }).catch(() => {}),

  // Tableau de bord
  'filter-level': d => { TutorUI.levelFilter = d.level; rerender(); },
  'new-student': () => openStudentForm(),
  'load-demo': () => { loadDemoData(); rerender(); toast('Exemple chargé ✓'); },
  'export-data': () => exportData(),
  'import-data': () => importData(),
  'import-results': () => openImportResults(),
  'confirm-import': d => confirmImport(d.payload),

  // Élève
  'edit-student': d => openStudentForm(d.sid),
  'delete-student': d => {
    const s = Store.student(d.sid);
    if (!confirm(`Supprimer ${s.name} et toutes ses semaines ? Cette action est définitive.`)) return;
    Store.deleteStudent(d.sid);
    location.hash = '#/';
    toast('Élève supprimé');
  },

  // Semaine
  'new-week': d => openWeekForm(d.sid),
  'edit-week': d => openWeekForm(d.sid, d.wid),
  'delete-week': d => {
    const s = Store.student(d.sid);
    if (!confirm('Supprimer cette semaine ?')) return;
    s.weeks = s.weeks.filter(w => w.id !== d.wid);
    Store.save();
    location.hash = `#/eleve/${s.id}`;
  },
  'next-week': d => openNextWeekForm(d.sid, d.wid),
  'share-week': d => openShareWeek(d.sid, d.wid),
  'preview-week': d => { location.hash = `#/apercu/${d.sid}/${d.wid}`; },
  'quiz-answers': d => openQuizAnswers(d.sid, d.wid, d.iid),

  // Éléments
  'add-item': d => openItemForm(d.sid, d.wid, d.type),
  'edit-item': d => openItemForm(d.sid, d.wid, null, d.iid),
  'delete-item': d => {
    const { w, idx } = findItem(d.sid, d.wid, d.iid);
    if (idx < 0 || !confirm(`Supprimer « ${w.items[idx].title} » ?`)) return;
    w.items.splice(idx, 1);
    Store.save();
    rerender();
  },
  'move-item': d => {
    const { w, idx } = findItem(d.sid, d.wid, d.iid);
    if (idx < 0) return;
    const type = w.items[idx].type;
    const same = w.items.map((it, i) => ({ it, i })).filter(x => x.it.type === type);
    const pos = same.findIndex(x => x.i === idx);
    const other = same[pos + Number(d.dir)];
    if (!other) return;
    [w.items[idx], w.items[other.i]] = [w.items[other.i], w.items[idx]];
    Store.save();
    rerender();
  },

  // Élève (page partagée)
  'st-understood': d => {
    const p = StudentView.prog;
    p.understood[d.iid] = !p.understood[d.iid];
    StudentView.saveProgress();
    StudentView.draw();
  },
  'st-done': d => {
    const p = StudentView.prog;
    p.done[d.iid] = !p.done[d.iid];
    StudentView.saveProgress();
    StudentView.draw();
  },
  'st-quiz-open': d => { StudentView.openQuiz[d.iid] = true; StudentView.draw(); },
  'st-quiz-submit': d => StudentView.submitQuiz(d.iid),
  'st-quiz-retry': d => StudentView.retryQuiz(d.iid),
  'st-send': () => StudentView.send()
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = Actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  fn(el.dataset, el);
});

// Champs enregistrés automatiquement
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.field === 'week-message') {
    const w = Store.week(Store.student(t.dataset.sid), t.dataset.wid);
    if (w) { w.message = t.value; Store.save(); }
  } else if (t.dataset.field === 'st-comment') {
    StudentView.prog.comment = t.value;
    StudentView.saveProgress();
  } else if (t.classList.contains('quiz-text')) {
    StudentView.setAnswer(t.dataset.iid, t.dataset.qid, t.value);
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.type === 'radio' && t.name.startsWith('qa-')) {
    StudentView.setAnswer(t.dataset.iid, t.dataset.qid, Number(t.value));
    $$(`input[name="${t.name}"]`).forEach(r => r.closest('.choice')?.classList.toggle('picked', r.checked));
  }
});

// Fermer la modale en cliquant à l'extérieur
$('#modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) Modal.close();
});

// Synchronise si les données changent dans un autre onglet
window.addEventListener('storage', e => {
  if (e.key === Store.KEY && !document.body.classList.contains('student-mode')) {
    Store.load();
    rerender();
  }
});

window.addEventListener('hashchange', () => { Modal.close(); route(); });

Store.load();
route();
