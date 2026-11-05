'use strict';

/* =========================================================
   Espace élève : ouvert depuis le lien envoyé par le prof
   ========================================================= */

const StudentView = {
  data: null,      // { sid, name, level, week }
  prog: null,      // { done, understood, quiz, comment }
  preview: false,
  openQuiz: {},    // quiz dépliés (UI)

  key() {
    return (this.preview ? 'mayerbook:apercu:' : 'mayerbook:eleve:') + this.data.week.id;
  },

  loadProgress() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(this.key())); } catch { /* ignore */ }
    this.prog = { done: {}, understood: {}, quiz: {}, comment: '', ...(p || {}) };
  },

  saveProgress() {
    try { localStorage.setItem(this.key(), JSON.stringify(this.prog)); } catch { /* ignore */ }
  },

  async fromPayload(payload) {
    try {
      this.data = await decodePayload(payload);
      if (!this.data?.week) throw new Error();
    } catch {
      return `<div class="empty card"><div class="empty-icon">😕</div><h2>Lien invalide</h2>
        <p>Ce lien est incomplet. Demande à ton prof de te le renvoyer.</p></div>`;
    }
    this.preview = false;
    this.openQuiz = {};
    this.loadProgress();
    return this.html();
  },

  fromStore(sid, wid) {
    const s = Store.student(sid);
    const w = Store.week(s, wid);
    if (!w) return notFound();
    this.data = { sid: s.id, name: s.name, level: s.level, week: structuredClone(w) };
    this.preview = true;
    this.openQuiz = {};
    this.loadProgress();
    return this.html();
  },

  draw() {
    $('#app').innerHTML = this.html();
  },

  html() {
    const { name, level, week } = this.data;
    const items = week.items || [];
    const p = computeProgress(items, this.prog);
    const allDone = p.total > 0 && p.done === p.total;

    const sections = TYPE_ORDER.map(type => {
      const list = items.filter(i => i.type === type);
      if (!list.length) return '';
      return `
        <section class="item-section">
          <h2>${TYPES[type].icon} ${TYPES[type].plural}</h2>
          ${list.map(it => this[type](it)).join('')}
        </section>`;
    }).join('');

    return `
      ${this.preview ? `<div class="preview-bar">👁 Aperçu de ce que voit l’élève (tes essais ne sont pas envoyés).
        <a href="#/eleve/${this.data.sid}/semaine/${week.id}">← Retour à l’édition</a></div>` : ''}
      <div class="hero card">
        <p class="muted">${esc(weekLabel(week))} · ${esc(level)}</p>
        <h1>Bonjour ${esc(firstName(name))} 👋</h1>
        ${week.title ? `<p class="hero-theme">${esc(week.title)}</p>` : ''}
        ${week.message ? `<div class="teacher-msg"><span>Message de ton prof</span>${rich(week.message)}</div>` : ''}
        <div class="hero-progress">
          <div class="hero-progress-label"><strong>Ma progression</strong><span>${p.done} / ${p.total}</span></div>
          ${progressBar(p)}
          ${allDone ? '<p class="cheer">🎉 Bravo, tu as tout terminé ! Pense à envoyer tes résultats.</p>' : ''}
        </div>
      </div>

      ${sections || '<div class="empty card"><p>Rien à faire cette semaine… profites-en ! 😄</p></div>'}

      <div class="card send-card">
        <h2>📨 Envoyer mes résultats</h2>
        <label class="field"><span>Un message pour ton prof ? <span class="muted">(optionnel)</span></span>
          <textarea rows="2" data-field="st-comment" placeholder="Ex : J’ai eu du mal avec l’exercice 2…">${esc(this.prog.comment)}</textarea></label>
        <button class="btn primary big" data-action="st-send">Envoyer à mon prof</button>
        <p class="hint">Ta progression est enregistrée sur cet appareil : tu peux revenir plus tard avec le même lien.</p>
      </div>`;
  },

  notion(it) {
    const ok = !!this.prog.understood[it.id];
    return `
      <article class="card s-item type-notion ${ok ? 'is-done' : ''}">
        <div class="item-card-top">${subjectTag(it.subject)}</div>
        <h3>${esc(it.title)}</h3>
        ${it.content ? `<div class="content">${rich(it.content)}</div>` : ''}
        ${it.link ? `<p><a class="resource" href="${esc(it.link)}" target="_blank" rel="noopener">🔗 Ressource pour revoir la notion</a></p>` : ''}
        <button class="toggle ${ok ? 'on' : ''}" data-action="st-understood" data-iid="${it.id}">
          ${ok ? '✓ J’ai compris' : 'J’ai compris cette notion'}</button>
      </article>`;
  },

  exercice(it) {
    const ok = !!this.prog.done[it.id];
    const canSee = it.correction && it.showCorrection;
    return `
      <article class="card s-item type-exercice ${ok ? 'is-done' : ''}">
        <div class="item-card-top">${subjectTag(it.subject)}</div>
        <h3>${esc(it.title)}</h3>
        ${it.content ? `<div class="content">${rich(it.content)}</div>` : ''}
        ${canSee ? `<details class="correction"><summary>Voir la correction</summary><div class="content">${rich(it.correction)}</div></details>` : ''}
        <button class="toggle ${ok ? 'on' : ''}" data-action="st-done" data-iid="${it.id}">
          ${ok ? '✓ Exercice fait' : 'J’ai fait cet exercice'}</button>
      </article>`;
  },

  quiz(it) {
    const st = this.prog.quiz[it.id] || { answers: {} };
    const qs = it.questions || [];
    const open = this.openQuiz[it.id] || st.submitted || Object.keys(st.answers || {}).length > 0;
    const head = `
      <div class="item-card-top">${subjectTag(it.subject)}
        ${st.submitted ? `<span class="status ${st.score === st.total ? 'ok' : st.score >= st.total / 2 ? 'mid' : 'ko'}">${st.score}/${st.total}</span>` : ''}</div>
      <h3>${esc(it.title)}</h3>
      ${it.content ? `<div class="content">${rich(it.content)}</div>` : ''}`;

    if (!open) {
      return `<article class="card s-item type-quiz">${head}
        <button class="btn primary" data-action="st-quiz-open" data-iid="${it.id}">Commencer le quiz (${qs.length} question${qs.length > 1 ? 's' : ''})</button>
      </article>`;
    }

    const questions = qs.map((q, i) => {
      const val = st.answers?.[q.id];
      const sub = !!st.submitted;
      const ok = sub && isCorrect(q, val);
      let input;
      if (q.type === 'texte') {
        input = `<input class="quiz-text" data-iid="${it.id}" data-qid="${q.id}" value="${esc(val ?? '')}" ${sub ? 'disabled' : ''} placeholder="Ta réponse" autocomplete="off">`;
      } else {
        input = `<div class="choices ${q.type === 'vf' ? 'inline' : ''}">${q.options.map((o, j) => {
          const cls = sub ? (j === Number(q.answer) ? 'right' : Number(val) === j ? 'wrong' : '') : '';
          return `<label class="choice ${cls} ${String(val) === String(j) ? 'picked' : ''}">
            <input type="radio" name="qa-${it.id}-${q.id}" value="${j}" data-iid="${it.id}" data-qid="${q.id}" ${String(val) === String(j) ? 'checked' : ''} ${sub ? 'disabled' : ''}>
            <span>${esc(o)}</span></label>`;
        }).join('')}</div>`;
      }
      return `
        <div class="quiz-q ${sub ? (ok ? 'ok' : 'ko') : ''}">
          <p class="quiz-prompt"><span class="qnum">${i + 1}</span> ${rich(q.prompt)}</p>
          ${input}
          ${sub ? `<p class="feedback">${ok ? '✅ Bonne réponse !' : `❌ La bonne réponse : <strong>${esc(correctAnswerText(q))}</strong>`}
            ${q.explanation ? `<br><span class="muted">${rich(q.explanation)}</span>` : ''}</p>` : ''}
        </div>`;
    }).join('');

    const footer = st.submitted
      ? `<div class="quiz-score ${st.score === st.total ? 'perfect' : ''}">
           ${st.score === st.total ? '🏆 Parfait !' : st.score >= st.total / 2 ? '👍 Pas mal !' : '💪 Continue tes efforts !'}
           Score : <strong>${st.score} / ${st.total}</strong></div>
         <button class="btn" data-action="st-quiz-retry" data-iid="${it.id}">↻ Recommencer</button>`
      : `<button class="btn primary" data-action="st-quiz-submit" data-iid="${it.id}">Valider mes réponses</button>`;

    return `<article class="card s-item type-quiz ${st.submitted ? 'is-done' : ''}" id="quiz-${it.id}">${head}
      <div class="quiz">${questions}</div>
      <div class="quiz-footer">${footer}</div>
    </article>`;
  },

  item(iid) {
    return this.data.week.items.find(i => i.id === iid);
  },

  setAnswer(iid, qid, value) {
    const st = this.prog.quiz[iid] || (this.prog.quiz[iid] = { answers: {} });
    if (st.submitted) return;
    st.answers[qid] = value;
    this.saveProgress();
  },

  submitQuiz(iid) {
    const it = this.item(iid);
    const st = this.prog.quiz[iid] || (this.prog.quiz[iid] = { answers: {} });
    const qs = it.questions || [];
    const missing = qs.filter(q => st.answers[q.id] === undefined || st.answers[q.id] === '').length;
    if (missing && !confirm(`Il te reste ${missing} question${missing > 1 ? 's' : ''} sans réponse. Valider quand même ?`)) return;
    st.score = qs.filter(q => isCorrect(q, st.answers[q.id])).length;
    st.total = qs.length;
    st.submitted = true;
    st.at = Date.now();
    this.saveProgress();
    this.draw();
    $('#quiz-' + iid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  retryQuiz(iid) {
    this.prog.quiz[iid] = { answers: {} };
    this.openQuiz[iid] = true;
    this.saveProgress();
    this.draw();
  },

  async send() {
    if (this.preview) {
      toast('Ceci est un aperçu : rien n’est envoyé.');
      return;
    }
    const { sid, name, week } = this.data;
    const data = {
      v: 1, sid, wid: week.id, name,
      done: this.prog.done, understood: this.prog.understood,
      quiz: Object.fromEntries(Object.entries(this.prog.quiz)
        .filter(([, q]) => q.submitted)
        .map(([id, q]) => [id, { score: q.score, total: q.total, answers: q.answers, submitted: true }])),
      comment: this.prog.comment,
      at: Date.now()
    };
    const link = await buildResultsLink(data);
    const p = computeProgress(week.items, this.prog);
    const subject = `Résultats de ${firstName(name)} – ${weekLabel(week)}`;
    Modal.open(`
      <div class="form">
        <h2>📨 Envoie ce lien à ton prof</h2>
        <p>Tu as terminé <strong>${p.done} sur ${p.total}</strong>. Envoie ce lien à ton prof par message ou par e-mail :</p>
        <textarea class="link-box" readonly rows="3" onclick="this.select()">${esc(link)}</textarea>
        <div class="actions wrap">${shareButtons(link, subject)}</div>
        <p class="hint">Tu pourras renvoyer un nouveau lien plus tard si tu continues à travailler.</p>
        <div class="form-actions"><button type="button" class="btn" data-action="close-modal">Fermer</button></div>
      </div>`);
  }
};
