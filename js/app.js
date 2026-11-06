'use strict';

/* =========================================================
   Démarrage, connexion, navigation et actions
   ========================================================= */

let Session = null;
let lastPath = null;
let routeSeq = 0;

/* ---------- Connexion ---------- */

function viewLogin(tab = 'eleve') {
  const demo = Api.mode === 'demo';
  return `
    <div class="login">
      <div class="login-brand">
        <div class="login-crew">${mascotCrew()}</div>
        <h1 class="login-title"><img src="icons/logo.svg" alt="" width="52" height="52">Mayerbook</h1>
        <p class="muted">Le suivi de tes cours particuliers, semaine après semaine.</p>
      </div>

      ${demo ? `
        <div class="card demo-card">
          <strong>Mode démo</strong>
          <p class="small">Les données restent dans ce navigateur. Essaie les deux côtés :</p>
          <div class="actions">
            <button class="btn small" data-action="demo-login" data-who="prof">${icon('school')} Entrer comme prof</button>
            <button class="btn small" data-action="demo-login" data-who="lea">${icon('graduation-cap')} Entrer comme élève (Léa)</button>
          </div>
          <p class="tiny muted">Prof : prof@demo.fr / demo1234 · Élèves : lea / 1234, hugo / 1234</p>
        </div>` : ''}

      <div class="card login-card-box">
        <div class="seg tabs">
          <label><input type="radio" name="login-tab" value="eleve" ${tab === 'eleve' ? 'checked' : ''} data-action="login-tab"><span>${icon('graduation-cap')} Élève</span></label>
          <label><input type="radio" name="login-tab" value="prof" ${tab === 'prof' ? 'checked' : ''} data-action="login-tab"><span>${icon('school')} Prof</span></label>
        </div>
        ${tab === 'eleve' ? `
          <form class="form plain" id="login-student">
            <label class="field"><span>Identifiant</span>
              <input name="username" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ex : lea.martin"></label>
            <label class="field"><span>Code</span>
              <input name="code" required type="password" autocomplete="current-password" inputmode="text"></label>
            <p class="form-error" hidden></p>
            <button class="btn primary big block">Se connecter</button>
            <p class="hint center">Ton identifiant et ton code t’ont été donnés par ton prof.</p>
          </form>` : `
          <form class="form plain" id="login-tutor">
            <label class="field"><span>E-mail</span>
              <input name="email" type="email" required autocomplete="email"></label>
            <label class="field"><span>Mot de passe</span>
              <input name="password" type="password" required minlength="6" autocomplete="current-password"></label>
            <p class="form-error" hidden></p>
            <button class="btn primary big block" name="signin">Se connecter</button>
            <button type="button" class="btn ghost block" data-action="tutor-signup">Première utilisation ? Créer le compte prof</button>
          </form>`}
      </div>
    </div>`;
}

function bindLogin() {
  const fs = $('#login-student');
  if (fs) fs.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(fs);
    await doLogin(fs, () => Api.signInStudent(String(f.get('username')), String(f.get('code'))));
  };
  const ft = $('#login-tutor');
  if (ft) ft.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(ft);
    await doLogin(ft, () => Api.signInTutor(String(f.get('email')), String(f.get('password'))));
  };
}

async function doLogin(form, fn) {
  const err = $('.form-error', form);
  err.hidden = true;
  try {
    const s = await busy(form.querySelector('button.primary'), 'Connexion…', fn);
    if (s?.needsConfirmation) {
      err.textContent = 'Compte créé ! Clique sur le lien reçu par e-mail pour le confirmer, puis connecte-toi.';
      err.classList.add('ok'); err.hidden = false;
      return;
    }
    Session = s;
    location.hash = '#/';
    route(true);
  } catch (ex) {
    err.classList.remove('ok');
    err.textContent = ex.message;
    err.hidden = false;
  }
}

/* ---------- Barre du haut ---------- */

/* ---------- App installable (PWA) ---------- */

let installPrompt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installButton() {
  if (isStandalone() || (!installPrompt && !isIOS())) return '';
  return `<button class="btn small install-btn" data-action="install-app">${icon('download')} Installer l’app</button>`;
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; renderTopbar(); });
window.addEventListener('appinstalled', () => { installPrompt = null; renderTopbar(); toast('Mayerbook est installée'); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then(reg => reg.update())
      .catch(() => {});
  });
  // Nouvelle version installée : on recharge une fois pour l'afficher
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
}

/** Retire l'écran de chargement (au moins ~1 s pour voir l'animation). */
const splashStart = performance.now();
function hideSplash() {
  const el = document.getElementById('splash');
  if (!el || el.classList.contains('out')) return;
  const wait = Math.max(0, 1100 - (performance.now() - splashStart));
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, wait);
}

async function renderTopbar() {
  const nav = $('#topnav');
  const bottom = $('#bottomnav');
  const demo = Api.mode === 'demo' ? '<span class="pill">Démo</span>' : '';
  // Header épuré : logo à gauche, seulement l'installation et le mode démo à droite
  const me = Session?.role === 'student' ? myMascot() : null;
  const meBtn = Session?.role === 'student'
    ? `<button class="nav-user" data-action="pick-mascot" title="Changer de personnage">${me ? mascot(me, { mood: me === 'snooze' ? 'calm' : 'happy', anim: 'bob', size: 32 }) : icon('smile-plus')}<span>${esc(firstName(Session.student.name))}</span></button>`
    : '';
  // Plus d'en-tête : seulement l'installation (si possible) et le badge démo sur la connexion
  nav.innerHTML = installButton() + (Session ? '' : demo);
  nav.hidden = !nav.innerHTML;
  if (!Session) { bottom.innerHTML = ''; bottom.hidden = true; document.body.classList.remove('has-bottomnav'); return; }

  const path = location.hash.slice(1).split('?')[0] || '/';
  const item = (href, ico, label, active, extra = '') =>
    `<a href="${href}" class="bn-item ${active ? 'active' : ''}" aria-label="${label}" ${active ? 'aria-current="page"' : ''}>${ico}<span class="bn-label">${label}</span>${extra}</a>`;
  const logout = `<button class="bn-item" data-action="logout" aria-label="Déconnexion">${icon('log-out')}<span class="bn-label">Quitter</span></button>`;

  let html;
  if (Session.role === 'tutor') {
    let n = 0;
    try { n = (await Api.listToCorrect()).length; } catch { /* ignore */ }
    const onCorr = path.startsWith('/corrections') || path.startsWith('/copie');
    html = item('#/', icon('users'), 'Élèves', !onCorr)
      + item('#/corrections', icon('clipboard-pen-line'), 'À corriger', onCorr, n ? `<span class="bn-badge">${n}</span>` : '')
      + logout;
  } else {
    const weeks = S.data?.weeks || [];
    const current = weeks.find(isCurrentWeek) || weeks[0];
    const onWeek = path.startsWith('/semaine');
    const onProg = path.startsWith('/progres');
    html = item('#/', icon('house'), 'Accueil', !onWeek && !onProg)
      + (current ? item(`#/semaine/${current.id}`, icon('calendar-days'), 'Ma semaine', onWeek) : '')
      + item('#/progres', icon('trending-up'), 'Progrès', onProg)
      + logout;
  }
  bottom.innerHTML = html;
  bottom.hidden = false;
  document.body.classList.add('has-bottomnav');
}

/* ---------- Navigation ---------- */

/* ---------- Transitions entre les pages ---------- */

const PAGE_DEPTH = { '': 0, eleve: 1, corrections: 1, semaine: 2, copie: 3 };
function pageDepth(path) {
  const first = (path || '/').split('/').filter(Boolean)[0] || '';
  if (Session?.role === 'student') return first === 'semaine' ? (path.split('/').filter(Boolean).length > 2 ? 2 : 1) : 0;
  return PAGE_DEPTH[first] ?? 1;
}
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Remplace le contenu de la page avec une transition fluide (glissé + fondu). */
function swapPage(app, html, direction) {
  const apply = () => { app.innerHTML = html; hydrateFiles(app); };
  if (!direction || reduceMotion()) { apply(); return Promise.resolve(); }
  document.documentElement.dataset.nav = direction;
  if (document.startViewTransition) {
    const t = document.startViewTransition(() => { apply(); window.scrollTo(0, 0); });
    return t.finished.catch(() => {}).finally(() => { delete document.documentElement.dataset.nav; });
  }
  // Navigateurs sans View Transitions : simple animation d'entrée
  apply();
  app.classList.remove('page-in');
  void app.offsetWidth;
  app.classList.add('page-in');
  return Promise.resolve();
}

async function route(force = false) {
  const seq = ++routeSeq;
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const parts = path.split('/').filter(Boolean);
  const app = $('#app');

  if (!Session) {
    document.body.dataset.role = 'login';
    app.innerHTML = viewLogin();
    bindLogin();
    renderTopbar();
    hideSplash();
    return;
  }
  document.body.dataset.role = Session.role;
  const changed = path !== lastPath;
  const direction = changed && lastPath !== null
    ? (pageDepth(path) >= pageDepth(lastPath) ? (pageDepth(path) === pageDepth(lastPath) ? 'fade' : 'forward') : 'back')
    : null;
  let loader = null;
  if (changed || force) loader = setTimeout(() => { if (seq === routeSeq) app.innerHTML = loadingHtml(); }, 280);

  let html;
  try {
    if (Session.role === 'tutor') {
      if (parts[0] === 'eleve' && parts[1]) html = await viewTutorStudent(parts[1]);
      else if (parts[0] === 'semaine' && parts[1]) html = await viewTutorWeek(parts[1]);
      else if (parts[0] === 'corrections') html = await viewTutorCorrections();
      else if (parts[0] === 'copie' && parts[1]) html = await viewTutorCopy(parts[1]);
      else html = await viewTutorHome();
    } else {
      if (parts[0] === 'semaine' && parts[2]) html = await viewStudentItem(parts[1], parts[2]);
      else if (parts[0] === 'semaine' && parts[1]) html = await viewStudentWeek(parts[1]);
      else if (parts[0] === 'progres') html = await viewStudentProgress();
      else html = await viewStudentHome();
    }
  } catch (e) {
    console.error(e);
    html = `<div class="empty card">${mascot('ouch', { mood: 'ouch', anim: 'shake', size: 90 })}<h2>Oups</h2><p>${esc(e.message)}</p><a class="btn" href="#/">Retour à l’accueil</a></div>`;
  }
  clearTimeout(loader);
  if (seq !== routeSeq) return; // une autre navigation a eu lieu entre-temps

  lastPath = path;
  await swapPage(app, html, direction);
  // Première connexion de l'élève : il choisit son personnage
  if (Session.role === 'student' && !myMascot() && !$('#modal').open) openMascotPicker(true);
  renderTopbar();
  hideSplash();
  document.title = 'Mayerbook';

  if (changed) {
    if (!document.startViewTransition || !direction) window.scrollTo(0, 0);
    const item = new URLSearchParams(query || '').get('item');
    if (item) setTimeout(() => $('#item-' + item)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}

function rerender() {
  const y = window.scrollY;
  route().then(() => window.scrollTo(0, y));
}

/* ---------- Actions (clics) ---------- */

const Actions = {
  'close-modal': () => Modal.close(),
  'close-modal-go': (d, el) => { Modal.close(); location.hash = el.getAttribute('href'); },
  'copy': d => copyText(d.text),
  'pick-mascot': () => openMascotPicker(false),
  'install-app': async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => {});
      installPrompt = null;
      renderTopbar();
      return;
    }
    Modal.open(`
      <div class="form">
        <h2>${icon('download')} Installer Mayerbook</h2>
        <p>Sur iPhone et iPad, l’installation se fait depuis <strong>Safari</strong> :</p>
        <ol class="install-steps">
          <li>Touche le bouton <strong>Partager</strong> ${icon('share')} en bas de l’écran.</li>
          <li>Choisis <strong>Sur l’écran d’accueil</strong> ${icon('square-plus')}.</li>
          <li>Touche <strong>Ajouter</strong> : l’icône Mayerbook apparaît avec tes autres apps.</li>
        </ol>
        <p class="hint">Ouvre ensuite Mayerbook depuis cette icône : elle s’affiche en plein écran, sans barre de navigation.</p>
        <div class="form-actions"><button type="button" class="btn primary" data-action="close-modal">J’ai compris</button></div>
      </div>`);
  },

  // Connexion
  'login-tab': (d, el) => { $('#app').innerHTML = viewLogin(el.value); bindLogin(); },
  'demo-login': async d => {
    try {
      Session = d.who === 'prof' ? await Api.signInTutor('prof@demo.fr', 'demo1234') : await Api.signInStudent(d.who, '1234');
      location.hash = '#/'; route(true);
    } catch (e) { showError(e); }
  },
  'tutor-signup': async (d, el) => {
    const form = el.closest('form');
    const err = $('.form-error', form);
    if (!form.reportValidity()) return;
    const f = new FormData(form);
    try {
      const s = await busy(el, 'Création…', () => Api.signUpTutor(String(f.get('email')), String(f.get('password'))));
      if (s?.needsConfirmation) {
        err.textContent = 'Compte créé ! Clique sur le lien reçu par e-mail pour le confirmer, puis connecte-toi.';
        err.classList.add('ok'); err.hidden = false; return;
      }
      Session = s; location.hash = '#/'; route(true);
    } catch (ex) { err.classList.remove('ok'); err.textContent = ex.message; err.hidden = false; }
  },
  'logout': () => {
    const who = Session?.role === 'student' ? (myMascot() || 'meh') : 'meh';
    const name = Session?.role === 'student' ? firstName(Session.student.name) : '';
    openSheet(`
      <div class="form logout-confirm">
        ${mascot(who, { mood: 'sad', anim: 'pop', size: 96, label: 'Personnage triste' })}
        <h2>Tu pars déjà${name ? ', ' + esc(name) : ''} ?</h2>
        <p class="muted">Il faudra ressaisir ${Session?.role === 'student' ? 'ton code' : 'ton mot de passe'} pour revenir.</p>
        <div class="logout-actions">
          <button type="button" class="btn primary" data-action="close-modal" autofocus>Non, je reste</button>
          <button type="button" class="btn ghost danger" data-action="logout-confirm">${icon('log-out')} Me déconnecter</button>
        </div>
      </div>`);
  },
  'logout-confirm': async () => {
    Modal.close();
    await Api.signOut();
    Session = null; lastPath = null;
    location.hash = '#/'; route(true);
  },

  // Prof : élèves
  'filter-level': d => { T.levelFilter = d.level; rerender(); },
  'new-student': () => openStudentForm(),
  'edit-student': () => openStudentForm(T.student),
  'delete-student': async (d, el) => {
    const s = T.student;
    if (!confirm(`Supprimer ${s.name}, son compte et tout son travail ? C’est définitif.`)) return;
    try { await busy(el, 'Suppression…', () => Api.deleteStudent(s.id)); location.hash = '#/'; toast('Élève supprimé'); }
    catch (e) { showError(e); }
  },
  'reset-code': () => openResetCode(),
  'copy-login': d => copyText(loginInstructions(d.username, '')),

  // Prof : semaines
  'new-week': () => openWeekForm(null, T.student),
  'edit-week': () => openWeekForm(T.week.week, T.week.student),
  'delete-week': async () => {
    if (!confirm('Supprimer cette semaine et tout le travail associé ?')) return;
    try { await Api.deleteWeek(T.week.week.id); location.hash = `#/eleve/${T.week.student.id}`; }
    catch (e) { showError(e); }
  },
  'toggle-publish': async (d, el) => {
    const w = T.week.week;
    try {
      await busy(el, '…', () => Api.saveWeek({ ...w, published: !w.published }));
      toast(w.published ? 'Semaine masquée' : `Publiée : ${firstName(T.week.student.name)} la voit dans son espace`);
      rerender();
    } catch (e) { showError(e); }
  },
  'next-week': () => openNextWeekForm(),

  // Prof : éléments
  'add-item': d => openItemForm(d.type),
  'edit-item': d => openItemForm(null, d.iid),
  'delete-item': async d => {
    const it = T.week.items.find(i => i.id === d.iid);
    const sub = T.week.subs[d.iid];
    const warn = sub && sub.status !== 'brouillon' ? '\nAttention : l’élève a déjà envoyé une réponse, elle sera supprimée.' : '';
    if (!confirm(`Supprimer « ${it.title} » ?${warn}`)) return;
    try { await Api.deleteItem(d.iid); rerender(); } catch (e) { showError(e); }
  },
  'move-item': async d => {
    const items = T.week.items;
    const it = items.find(i => i.id === d.iid);
    const same = items.filter(i => i.type === it.type);
    const pos = same.indexOf(it);
    const other = same[pos + Number(d.dir)];
    if (!other) return;
    try {
      await Api.setPositions([{ id: it.id, position: other.position }, { id: other.id, position: it.position }]);
      rerender();
    } catch (e) { showError(e); }
  },

  // Prof : IA
  'open-ai': () => openAiDialog(),
  'ai-add': (d, el) => aiAddSelected(el),
  'ai-edit': d => aiEdit(Number(d.index)),
  'ai-correct': () => openCorrectionHelper(),
  'copy-prompt': () => copyText($('#ai-prompt').value),

  // Prof : correction
  'insert-model': () => {
    const ta = $('#correction-form textarea[name=feedback]');
    ta.value = (ta.value ? ta.value + '\n\n' : '') + T.copy.key.model_answer;
    ta.focus();
  },
  'return-copy': async (d, el) => {
    const fb = $('#correction-form textarea[name=feedback]').value.trim() || 'Relis ton travail, corrige-le et renvoie-le moi.';
    if (!confirm('Renvoyer ce travail à l’élève ? Il pourra modifier sa réponse et la renvoyer. Ton commentaire actuel lui sera affiché.')) return;
    try {
      await busy(el, '…', () => Api.returnToStudent(T.copy.sub.id, fb));
      toast('Renvoyé à l’élève');
      location.hash = `#/semaine/${T.copy.week.id}`;
    } catch (e) { showError(e); }
  },
  'remove-file': (d) => {
    if (d.list === 'feedback') { T.copy.feedbackFiles.splice(Number(d.index), 1); drawFeedbackFiles(); }
    else if (d.iid && Session?.role === 'student') studentRemoveFile(d.iid, Number(d.index));
  },

  // Élève
  'st-understood': async d => {
    try { await studentSave(d.iid, { understood: !S.subs[d.iid]?.understood }); } catch (e) { showError(e); }
  },
  'st-quiz-open': d => { S.openQuiz[d.iid] = true; refreshStudentItem(d.iid); },
  'st-submit': (d, el) => studentSubmit(d.iid, el),
  'sheet-correction': d => openCorrectionSheet(d.iid),
  'sheet-redo': d => openRedoSheet(d.iid)
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = Actions[el.dataset.action];
  if (!fn) return;
  if (el.type !== 'radio') e.preventDefault();
  fn(el.dataset, el);
});

// Liens vers fichiers pas encore résolus
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-file-path]');
  if (a && a.getAttribute('href') === '#') {
    e.preventDefault();
    Api.fileUrl(a.dataset.filePath).then(url => url && window.open(url, '_blank', 'noopener'));
  }
});

/* ---------- Saisie ---------- */

let messageTimer;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.field === 'week-message' && T.week) {
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
      Api.saveWeek({ ...T.week.week, message: t.value })
        .then(w => { T.week.week = w; toast('Message enregistré'); })
        .catch(showError);
    }, 800);
  } else if (t.classList.contains('answer-text')) {
    const iid = t.dataset.iid;
    scheduleAnswerSave(iid, () => ({ answer: $(`.answer-text[data-iid="${iid}"]`)?.value ?? '' }));
  } else if (t.classList.contains('quiz-text')) {
    const iid = t.dataset.iid;
    scheduleAnswerSave(iid, () => ({ answers: currentQuizAnswers(iid) }));
  }
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.type === 'radio' && t.name.startsWith('qa-')) {
    $$(`input[name="${t.name}"]`).forEach(r => r.closest('.choice')?.classList.toggle('picked', r.checked));
    const iid = t.dataset.iid;
    scheduleAnswerSave(iid, () => ({ answers: currentQuizAnswers(iid) }));
  } else if (t.dataset.upload === 'answer') {
    studentUpload(t);
  } else if (t.dataset.upload === 'feedback' && T.copy) {
    const files = [...t.files];
    t.value = '';
    try {
      await busy(t.closest('label'), 'Envoi…', async () => {
        for (const f of files) T.copy.feedbackFiles.push(await Api.uploadFile(T.copy.student.id, 'prof', f));
      });
      drawFeedbackFiles();
    } catch (ex) { showError(ex); }
  }
});

document.addEventListener('submit', e => {
  if (e.target.id === 'correction-form') {
    e.preventDefault();
    submitCorrection(e.target).catch(showError);
  }
});

$('#modal').addEventListener('click', e => { if (e.target === e.currentTarget) Modal.close(); });
window.addEventListener('hashchange', () => { Modal.close(); route(); });

/* ---------- Démarrage ---------- */

(async () => {
  try { Session = await Api.getSession(); } catch (e) { console.error(e); Session = null; }
  if (Session?.role === 'none') {
    await Api.signOut();
    Session = null;
  }
  route(true);
})();
