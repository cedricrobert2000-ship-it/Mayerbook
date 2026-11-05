'use strict';

/* =========================================================
   Accès aux données.
   - SupaApi : vraie version en ligne (Supabase).
   - DemoApi : mode démo, tout est enregistré dans ce navigateur.
   Les deux exposent exactement les mêmes méthodes.
   ========================================================= */

const STUDENT_EMAIL_DOMAIN = 'eleves.mayerbook.example.com';
const studentEmail = username => `${String(username).trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
const studentPassword = code => `mayerbook-${String(code).trim()}`;
const SUB_LIGHT_COLS = 'id,item_id,student_id,status,understood,score,total,submitted_at,corrected_at,updated_at';

/* ---------------------------------------------------------
   Version en ligne : Supabase
   --------------------------------------------------------- */

function createSupaApi(cfg) {
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  const check = ({ data, error }) => {
    if (error) throw new Error(translateError(error.message));
    return data;
  };

  function translateError(msg) {
    if (/Invalid login credentials/i.test(msg)) return 'Identifiant ou mot de passe incorrect.';
    if (/User already registered/i.test(msg)) return 'Un compte existe déjà avec cette adresse.';
    if (/Password should be at least/i.test(msg)) return 'Mot de passe trop court (6 caractères minimum).';
    if (/Email not confirmed/i.test(msg)) return 'Adresse e-mail non confirmée : clique sur le lien reçu par e-mail.';
    if (/Signups not allowed/i.test(msg)) return 'La création de compte est désactivée.';
    return msg;
  }

  async function callFn(name, body) {
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error) {
      if (error.name === 'FunctionsFetchError' || /Failed to send a request/i.test(error.message)) {
        throw new Error(`Le serveur ne répond pas : vérifie dans Supabase > Edge Functions que la fonction « ${name} » existe bien, ` +
          `avec exactement ce nom, et qu’elle est déployée (voir INSTALLATION.md, étape 3).`);
      }
      let msg = error.message;
      try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function myRole(user) {
    const tutor = check(await sb.from('tutors').select('id').eq('id', user.id).maybeSingle());
    if (tutor) return { role: 'tutor', userId: user.id, email: user.email };
    const student = check(await sb.from('students').select('*').eq('user_id', user.id).maybeSingle());
    if (student) return { role: 'student', userId: user.id, student };
    return { role: 'none', userId: user.id, email: user.email };
  }

  const mergePrivate = s => {
    const p = Array.isArray(s.student_private) ? s.student_private[0] : s.student_private;
    const { student_private, ...rest } = s;
    return { ...rest, contact: p?.contact || '', notes: p?.notes || '' };
  };

  return {
    mode: 'supabase',

    /* --- Connexion --- */
    async getSession() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      return myRole(data.session.user);
    },
    async signInTutor(email, password) {
      const data = check(await sb.auth.signInWithPassword({ email: email.trim(), password }));
      const s = await myRole(data.user);
      if (s.role === 'student') { await sb.auth.signOut(); throw new Error('Ce compte est un compte élève.'); }
      if (s.role === 'none') {
        const ok = check(await sb.rpc('claim_tutor'));
        if (!ok) { await sb.auth.signOut(); throw new Error('Ce compte n’a pas accès à l’espace prof.'); }
        return { role: 'tutor', userId: data.user.id, email: data.user.email };
      }
      return s;
    },
    async signUpTutor(email, password) {
      const data = check(await sb.auth.signUp({ email: email.trim(), password }));
      if (!data.session) return { needsConfirmation: true };
      const ok = check(await sb.rpc('claim_tutor'));
      if (!ok) { await sb.auth.signOut(); throw new Error('Un compte prof existe déjà pour cette application.'); }
      return { role: 'tutor', userId: data.user.id, email: data.user.email };
    },
    async signInStudent(username, code) {
      const data = check(await sb.auth.signInWithPassword({ email: studentEmail(username), password: studentPassword(code) }));
      const s = await myRole(data.user);
      if (s.role !== 'student') { await sb.auth.signOut(); throw new Error('Identifiant ou code incorrect.'); }
      return s;
    },
    async signOut() { await sb.auth.signOut(); },

    /* --- Prof : lecture --- */
    async tutorOverview() {
      const students = check(await sb.from('students').select('*, student_private(contact,notes)').order('name')).map(mergePrivate);
      const weeks = check(await sb.from('weeks').select('*').order('start_date', { ascending: false }));
      const items = check(await sb.from('items').select('id,week_id,type,title,subject').order('position'));
      const subs = check(await sb.from('submissions').select(SUB_LIGHT_COLS));
      return { students, weeks, items, subs };
    },
    async studentFull(studentId) {
      const s = check(await sb.from('students').select('*, student_private(contact,notes)').eq('id', studentId).maybeSingle());
      if (!s) return null;
      const weeks = check(await sb.from('weeks').select('*').eq('student_id', studentId).order('start_date', { ascending: false }));
      const ids = weeks.map(w => w.id);
      const items = ids.length ? check(await sb.from('items').select('id,week_id,type,title,subject,questions').in('week_id', ids).order('position')) : [];
      const subs = check(await sb.from('submissions').select(SUB_LIGHT_COLS).eq('student_id', studentId));
      return { student: mergePrivate(s), weeks, items, subs };
    },
    async weekFull(weekId) {
      const week = check(await sb.from('weeks').select('*').eq('id', weekId).maybeSingle());
      if (!week) return null;
      const student = mergePrivate(check(await sb.from('students').select('*, student_private(contact,notes)').eq('id', week.student_id).single()));
      const items = check(await sb.from('items').select('*').eq('week_id', weekId).order('position'));
      const ids = items.map(i => i.id);
      const keys = ids.length ? check(await sb.from('item_keys').select('*').in('item_id', ids)) : [];
      const subs = ids.length ? check(await sb.from('submissions').select('*').in('item_id', ids)) : [];
      return { week, student, items, keys: indexBy(keys, 'item_id'), subs: indexBy(subs, 'item_id') };
    },
    async listToCorrect() {
      const subs = check(await sb.from('submissions').select('*').eq('status', 'envoye').order('submitted_at'));
      if (!subs.length) return [];
      const items = check(await sb.from('items').select('id,week_id,type,title,subject').in('id', subs.map(s => s.item_id)));
      const students = check(await sb.from('students').select('id,name,level').in('id', unique(subs.map(s => s.student_id))));
      const I = indexBy(items, 'id'), S = indexBy(students, 'id');
      return subs.map(sub => ({ sub, item: I[sub.item_id], student: S[sub.student_id] })).filter(x => x.item && x.student);
    },
    async submissionFull(subId) {
      const sub = check(await sb.from('submissions').select('*').eq('id', subId).maybeSingle());
      if (!sub) return null;
      const item = check(await sb.from('items').select('*').eq('id', sub.item_id).single());
      const key = check(await sb.from('item_keys').select('*').eq('item_id', item.id).maybeSingle()) || { answers: {}, model_answer: '' };
      const week = check(await sb.from('weeks').select('*').eq('id', item.week_id).single());
      const student = check(await sb.from('students').select('*').eq('id', sub.student_id).single());
      return { sub, item, key, week, student };
    },

    /* --- Prof : élèves --- */
    async createStudent(data) {
      const r = await callFn('eleves', { action: 'create', ...data });
      return r.student;
    },
    async updateStudent(id, data) {
      check(await sb.from('students').update({ name: data.name, level: data.level, subjects: data.subjects }).eq('id', id));
      check(await sb.from('student_private').upsert({ student_id: id, contact: data.contact, notes: data.notes }));
    },
    async resetCode(id, code) { await callFn('eleves', { action: 'reset_code', student_id: id, code }); },
    async deleteStudent(id) { await callFn('eleves', { action: 'delete', student_id: id }); },

    /* --- Prof : semaines et éléments --- */
    async saveWeek(w) {
      const row = { student_id: w.student_id, start_date: w.start_date, title: w.title ?? '', message: w.message ?? '', published: !!w.published };
      if (w.id) return check(await sb.from('weeks').update(row).eq('id', w.id).select().single());
      return check(await sb.from('weeks').insert(row).select().single());
    },
    async deleteWeek(id) { check(await sb.from('weeks').delete().eq('id', id)); },
    async saveItem(item, key) {
      const row = {
        week_id: item.week_id, type: item.type, subject: item.subject || '', title: item.title,
        content: item.content || '', link: item.link || '', attachments: item.attachments || [],
        answer_mode: item.answer_mode || 'texte', questions: item.questions || [],
        instant_result: item.instant_result !== false, share_model: !!item.share_model
      };
      let saved;
      if (item.id) {
        saved = check(await sb.from('items').update(row).eq('id', item.id).select().single());
      } else {
        const last = check(await sb.from('items').select('position').eq('week_id', item.week_id).order('position', { ascending: false }).limit(1));
        row.position = (last[0]?.position ?? -1) + 1;
        saved = check(await sb.from('items').insert(row).select().single());
      }
      check(await sb.from('item_keys').upsert({ item_id: saved.id, answers: key?.answers || {}, model_answer: key?.model_answer || '' }));
      return saved;
    },
    async deleteItem(id) { check(await sb.from('items').delete().eq('id', id)); },
    async setPositions(list) {
      for (const { id, position } of list) check(await sb.from('items').update({ position }).eq('id', id));
    },

    /* --- Prof : corrections --- */
    async correct(subId, { feedback, grade, feedback_files }) {
      return check(await sb.from('submissions').update({
        feedback, grade, feedback_files: feedback_files || [], status: 'corrige',
        corrected_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq('id', subId).select().single());
    },
    async returnToStudent(subId, feedback) {
      return check(await sb.from('submissions').update({
        status: 'brouillon', feedback: feedback || '', submitted_at: null, corrected_at: null, score: null, total: null,
        updated_at: new Date().toISOString()
      }).eq('id', subId).select().single());
    },

    /* --- Fichiers --- */
    async uploadFile(studentId, kind, file) {
      const safe = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
      const path = `${studentId}/${kind}/${uid()}-${safe}`;
      check(await sb.storage.from('fichiers').upload(path, file, { contentType: file.type || 'application/octet-stream' }));
      return { path, name: file.name, type: file.type, size: file.size };
    },
    _urls: {},
    async fileUrl(path) {
      const c = this._urls[path];
      if (c && c.exp > Date.now()) return c.url;
      const { data, error } = await sb.storage.from('fichiers').createSignedUrl(path, 3600);
      if (error) return null;
      this._urls[path] = { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 };
      return data.signedUrl;
    },
    async removeFile(path) { await sb.storage.from('fichiers').remove([path]); },

    /* --- Élève --- */
    async studentOverview() {
      const { data } = await sb.auth.getUser();
      const student = check(await sb.from('students').select('*').eq('user_id', data.user.id).single());
      const weeks = check(await sb.from('weeks').select('*').eq('published', true).order('start_date', { ascending: false }));
      const ids = weeks.map(w => w.id);
      const items = ids.length ? check(await sb.from('items').select('*').in('week_id', ids).order('position')) : [];
      const subs = check(await sb.from('submissions').select('*').eq('student_id', student.id));
      return { student, weeks, items, subs };
    },
    async studentSave(itemId, patch) {
      return check(await sb.rpc('student_save', {
        p_item: itemId,
        p_answer: patch.answer ?? null,
        p_answers: patch.answers ?? null,
        p_files: patch.files ?? null,
        p_understood: patch.understood ?? null
      }));
    },
    async studentSubmit(itemId) { return check(await sb.rpc('student_submit', { p_item: itemId })); },
    async getSolution(itemId) { return check(await sb.rpc('get_solution', { p_item: itemId })) || {}; }
  };
}

/* ---------------------------------------------------------
   Mode démo : tout dans ce navigateur (localStorage)
   --------------------------------------------------------- */

function createDemoApi() {
  const KEY = 'mayerbook:demo:v2';
  const SESSION = 'mayerbook:demo:session';
  const clone = x => JSON.parse(JSON.stringify(x));
  const now = () => new Date().toISOString();
  let db;

  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
    if (!db || !Array.isArray(db.students)) {
      db = { tutors: [], students: [], accounts: {}, weeks: [], items: [], keys: {}, subs: [], files: {} };
      seedDemo(db);
      save();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { throw new Error('Mémoire du navigateur pleine (mode démo) : supprime des fichiers ou passe à la version en ligne.'); }
  }
  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION)); } catch { return null; }
  }
  function setSession(s) {
    try { s ? sessionStorage.setItem(SESSION, JSON.stringify(s)) : sessionStorage.removeItem(SESSION); } catch { /* ignore */ }
  }
  const pause = () => new Promise(r => setTimeout(r, 120));
  const tutorOnly = () => { if (session()?.role !== 'tutor') throw new Error('Réservé au prof'); };
  const me = () => {
    const s = session();
    if (s?.role !== 'student') throw new Error('Réservé à l’élève');
    return db.students.find(x => x.id === s.studentId);
  };
  const itemWeek = it => db.weeks.find(w => w.id === it.week_id);
  const visibleItem = (itemId) => {
    const st = me();
    const it = db.items.find(i => i.id === itemId);
    const w = it && itemWeek(it);
    if (!w || !w.published || w.student_id !== st.id) throw new Error('Accès refusé');
    return { st, it };
  };
  const subFor = (itemId, studentId) => {
    let s = db.subs.find(x => x.item_id === itemId && x.student_id === studentId);
    if (!s) {
      s = { id: uid(), item_id: itemId, student_id: studentId, status: 'brouillon', understood: false, answer: '', answers: {},
        files: [], score: null, total: null, feedback: '', grade: '', feedback_files: [], submitted_at: null, corrected_at: null, updated_at: now() };
      db.subs.push(s);
    }
    return s;
  };

  load();
  window.addEventListener('storage', e => { if (e.key === KEY) load(); });

  return {
    mode: 'demo',
    resetDemo() { localStorage.removeItem(KEY); setSession(null); load(); },

    async getSession() {
      load();
      const s = session();
      if (!s) return null;
      if (s.role === 'student') {
        const student = db.students.find(x => x.id === s.studentId);
        return student ? { role: 'student', userId: s.studentId, student: clone(student) } : null;
      }
      return { role: 'tutor', userId: s.userId, email: s.email };
    },
    async signInTutor(email, password) {
      await pause();
      const t = db.tutors.find(x => x.email === email.trim().toLowerCase());
      if (!t || t.password !== password) throw new Error('E-mail ou mot de passe incorrect.');
      setSession({ role: 'tutor', userId: t.id, email: t.email });
      return this.getSession();
    },
    async signUpTutor(email, password) {
      await pause();
      if (password.length < 6) throw new Error('Mot de passe trop court (6 caractères minimum).');
      if (db.tutors.length) throw new Error('Un compte prof existe déjà pour cette application.');
      const t = { id: uid(), email: email.trim().toLowerCase(), password };
      db.tutors.push(t); save();
      setSession({ role: 'tutor', userId: t.id, email: t.email });
      return this.getSession();
    },
    async signInStudent(username, code) {
      await pause();
      const a = db.accounts[String(username).trim().toLowerCase()];
      if (!a || a.code !== String(code).trim()) throw new Error('Identifiant ou code incorrect.');
      setSession({ role: 'student', studentId: a.studentId });
      return this.getSession();
    },
    async signOut() { setSession(null); },

    async tutorOverview() {
      tutorOnly(); load();
      return clone({ students: db.students, weeks: [...db.weeks].sort((a, b) => b.start_date.localeCompare(a.start_date)), items: db.items, subs: db.subs });
    },
    async studentFull(studentId) {
      tutorOnly(); load();
      const student = db.students.find(s => s.id === studentId);
      if (!student) return null;
      const weeks = db.weeks.filter(w => w.student_id === studentId).sort((a, b) => b.start_date.localeCompare(a.start_date));
      const wids = weeks.map(w => w.id);
      return clone({ student, weeks, items: db.items.filter(i => wids.includes(i.week_id)), subs: db.subs.filter(s => s.student_id === studentId) });
    },
    async weekFull(weekId) {
      tutorOnly(); load();
      const week = db.weeks.find(w => w.id === weekId);
      if (!week) return null;
      const items = db.items.filter(i => i.week_id === weekId).sort((a, b) => a.position - b.position);
      const ids = items.map(i => i.id);
      const keys = {}; ids.forEach(id => { if (db.keys[id]) keys[id] = db.keys[id]; });
      return clone({ week, student: db.students.find(s => s.id === week.student_id), items, keys,
        subs: indexBy(db.subs.filter(s => ids.includes(s.item_id)), 'item_id') });
    },
    async listToCorrect() {
      tutorOnly(); load();
      return clone(db.subs.filter(s => s.status === 'envoye')
        .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)))
        .map(sub => ({ sub, item: db.items.find(i => i.id === sub.item_id), student: db.students.find(s => s.id === sub.student_id) }))
        .filter(x => x.item && x.student));
    },
    async submissionFull(subId) {
      tutorOnly(); load();
      const sub = db.subs.find(s => s.id === subId);
      if (!sub) return null;
      const item = db.items.find(i => i.id === sub.item_id);
      return clone({ sub, item, key: db.keys[item.id] || { answers: {}, model_answer: '' }, week: itemWeek(item),
        student: db.students.find(s => s.id === sub.student_id) });
    },

    async createStudent(data) {
      tutorOnly(); await pause();
      const username = String(data.username || '').trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) throw new Error('Identifiant invalide : 3 à 30 caractères, lettres minuscules, chiffres, point ou tiret.');
      if (String(data.code || '').trim().length < 4) throw new Error('Le code doit faire au moins 4 caractères.');
      if (db.accounts[username]) throw new Error('Cet identifiant est déjà pris.');
      const s = { id: uid(), username, name: data.name, level: data.level, subjects: data.subjects || [],
        contact: data.contact || '', notes: data.notes || '', created_at: now() };
      db.students.push(s);
      db.accounts[username] = { code: String(data.code).trim(), studentId: s.id };
      save();
      return clone(s);
    },
    async updateStudent(id, data) {
      tutorOnly();
      const s = db.students.find(x => x.id === id);
      Object.assign(s, { name: data.name, level: data.level, subjects: data.subjects, contact: data.contact, notes: data.notes });
      save();
    },
    async resetCode(id, code) {
      tutorOnly();
      if (String(code).trim().length < 4) throw new Error('Le code doit faire au moins 4 caractères.');
      const s = db.students.find(x => x.id === id);
      db.accounts[s.username].code = String(code).trim();
      save();
    },
    async deleteStudent(id) {
      tutorOnly();
      const s = db.students.find(x => x.id === id);
      delete db.accounts[s.username];
      const wids = db.weeks.filter(w => w.student_id === id).map(w => w.id);
      const iids = db.items.filter(i => wids.includes(i.week_id)).map(i => i.id);
      db.students = db.students.filter(x => x.id !== id);
      db.weeks = db.weeks.filter(w => w.student_id !== id);
      db.items = db.items.filter(i => !iids.includes(i.id));
      iids.forEach(i => delete db.keys[i]);
      db.subs = db.subs.filter(x => x.student_id !== id);
      Object.keys(db.files).forEach(p => { if (p.startsWith(id + '/')) delete db.files[p]; });
      save();
    },

    async saveWeek(w) {
      tutorOnly();
      if (w.id) {
        const cur = db.weeks.find(x => x.id === w.id);
        Object.assign(cur, { start_date: w.start_date, title: w.title ?? '', message: w.message ?? '', published: !!w.published });
        save(); return clone(cur);
      }
      const nw = { id: uid(), student_id: w.student_id, start_date: w.start_date, title: w.title || '', message: w.message || '', published: !!w.published, created_at: now() };
      db.weeks.push(nw); save();
      return clone(nw);
    },
    async deleteWeek(id) {
      tutorOnly();
      const iids = db.items.filter(i => i.week_id === id).map(i => i.id);
      db.weeks = db.weeks.filter(w => w.id !== id);
      db.items = db.items.filter(i => i.week_id !== id);
      db.subs = db.subs.filter(s => !iids.includes(s.item_id));
      iids.forEach(i => delete db.keys[i]);
      save();
    },
    async saveItem(item, key) {
      tutorOnly();
      const row = {
        week_id: item.week_id, type: item.type, subject: item.subject || '', title: item.title,
        content: item.content || '', link: item.link || '', attachments: item.attachments || [],
        answer_mode: item.answer_mode || 'texte', questions: item.questions || [],
        instant_result: item.instant_result !== false, share_model: !!item.share_model
      };
      let saved = item.id && db.items.find(i => i.id === item.id);
      if (saved) Object.assign(saved, row);
      else {
        const pos = Math.max(-1, ...db.items.filter(i => i.week_id === item.week_id).map(i => i.position)) + 1;
        saved = { id: uid(), position: pos, created_at: now(), ...row };
        db.items.push(saved);
      }
      db.keys[saved.id] = { item_id: saved.id, answers: key?.answers || {}, model_answer: key?.model_answer || '' };
      save();
      return clone(saved);
    },
    async deleteItem(id) {
      tutorOnly();
      db.items = db.items.filter(i => i.id !== id);
      db.subs = db.subs.filter(s => s.item_id !== id);
      delete db.keys[id];
      save();
    },
    async setPositions(list) {
      tutorOnly();
      for (const { id, position } of list) { const it = db.items.find(i => i.id === id); if (it) it.position = position; }
      save();
    },

    async correct(subId, { feedback, grade, feedback_files }) {
      tutorOnly();
      const s = db.subs.find(x => x.id === subId);
      Object.assign(s, { feedback, grade, feedback_files: feedback_files || [], status: 'corrige', corrected_at: now(), updated_at: now() });
      save(); return clone(s);
    },
    async returnToStudent(subId, feedback) {
      tutorOnly();
      const s = db.subs.find(x => x.id === subId);
      Object.assign(s, { status: 'brouillon', feedback: feedback || '', submitted_at: null, corrected_at: null, score: null, total: null, updated_at: now() });
      save(); return clone(s);
    },

    async uploadFile(studentId, kind, file) {
      if (file.size > 1.5e6) throw new Error('Mode démo : fichiers limités à 1,5 Mo (pas de limite dans la version en ligne).');
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(file);
      });
      const path = `${studentId}/${kind}/${uid()}-${file.name}`;
      db.files[path] = data; save();
      return { path, name: file.name, type: file.type, size: file.size };
    },
    async fileUrl(path) { return db.files[path] || null; },
    async removeFile(path) { delete db.files[path]; save(); },


    async studentOverview() {
      load();
      const student = me();
      const weeks = db.weeks.filter(w => w.student_id === student.id && w.published).sort((a, b) => b.start_date.localeCompare(a.start_date));
      const wids = weeks.map(w => w.id);
      return clone({ student, weeks, items: db.items.filter(i => wids.includes(i.week_id)).sort((a, b) => a.position - b.position),
        subs: db.subs.filter(s => s.student_id === student.id) });
    },
    async studentSave(itemId, patch) {
      const { st } = visibleItem(itemId);
      const s = subFor(itemId, st.id);
      if (patch.understood !== undefined && patch.understood !== null) s.understood = patch.understood;
      const editing = ['answer', 'answers', 'files'].some(k => patch[k] !== undefined && patch[k] !== null);
      if (editing) {
        if (s.status !== 'brouillon') throw new Error('Déjà envoyé : tu ne peux plus modifier ta réponse.');
        if (patch.answer != null) s.answer = patch.answer;
        if (patch.answers != null) s.answers = patch.answers;
        if (patch.files != null) s.files = patch.files;
      }
      s.updated_at = now(); save();
      return clone(s);
    },
    async studentSubmit(itemId) {
      const { st, it } = visibleItem(itemId);
      const s = subFor(itemId, st.id);
      if (s.status !== 'brouillon') throw new Error('Déjà envoyé.');
      s.submitted_at = now();
      if (it.type === 'quiz') {
        const k = db.keys[it.id]?.answers || {};
        s.total = it.questions.length;
        s.score = it.questions.filter(q => isCorrect(q, k[q.id]?.answer, s.answers[q.id])).length;
        s.status = it.instant_result ? 'corrige' : 'envoye';
        if (it.instant_result) s.corrected_at = now();
      } else {
        s.status = 'envoye';
      }
      s.updated_at = now(); save();
      return clone(s);
    },
    async getSolution(itemId) {
      const { st, it } = visibleItem(itemId);
      const s = db.subs.find(x => x.item_id === itemId && x.student_id === st.id);
      if (!s || s.status !== 'corrige') return {};
      const k = db.keys[itemId] || {};
      const res = {};
      if (it.type === 'quiz') res.answers = clone(k.answers || {});
      if (it.share_model && k.model_answer) res.model_answer = k.model_answer;
      return res;
    }
  };
}

/* ---------- Choix de la version ---------- */

const Api = (() => {
  const cfg = window.MAYERBOOK_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) return createSupaApi(cfg);
  return createDemoApi();
})();
