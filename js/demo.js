'use strict';

/** Données d'exemple du mode démo. */
function seedDemo(db) {
  const monday = mondayOf(todayISO());
  const lastMonday = addDays(monday, -7);
  const ago = h => new Date(Date.now() - h * 3600e3).toISOString();

  db.tutors.push({ id: uid(), email: 'prof@demo.fr', password: 'demo1234' });

  const lea = { id: uid(), username: 'lea', name: 'Léa Martin', level: '4e', subjects: ['Mathématiques', 'Français'],
    contact: 'Maman : 06 00 00 00 00', notes: 'Manque parfois de confiance. Cours le mercredi 14h.', created_at: ago(400) };
  const hugo = { id: uid(), username: 'hugo', name: 'Hugo Bernard', level: 'CM2', subjects: ['Mathématiques', 'Français'],
    contact: '', notes: 'Tables de multiplication en priorité.', created_at: ago(300) };
  db.students.push(lea, hugo);
  db.accounts.lea = { code: '1234', studentId: lea.id };
  db.accounts.hugo = { code: '1234', studentId: hugo.id };

  const week = (student, start, title, message, published = true) => {
    const w = { id: uid(), student_id: student.id, start_date: start, title, message, published, created_at: ago(100) };
    db.weeks.push(w);
    return w;
  };
  let pos = 0;
  const item = (w, data, key = {}) => {
    const it = {
      id: uid(), week_id: w.id, position: pos++, subject: '', content: '', link: '', attachments: [],
      answer_mode: 'les_deux', questions: [], instant_result: true, share_model: false, created_at: ago(90), ...data
    };
    db.items.push(it);
    db.keys[it.id] = { item_id: it.id, answers: key.answers || {}, model_answer: key.model_answer || '' };
    return it;
  };
  const sub = (it, student, data) => {
    db.subs.push({
      id: uid(), item_id: it.id, student_id: student.id, status: 'brouillon', understood: false, answer: '', answers: {},
      files: [], score: null, total: null, feedback: '', grade: '', feedback_files: [], submitted_at: null,
      corrected_at: null, updated_at: ago(1), ...data
    });
  };

  // ----- Léa : semaine dernière (corrigée) -----
  const w0 = week(lea, lastMonday, 'Fractions', 'Révisions avant le contrôle de fractions.');
  const n0 = item(w0, { type: 'notion', subject: 'Mathématiques', title: 'Additionner deux fractions',
    content: 'On met les fractions **au même dénominateur**, puis on additionne les numérateurs.\nEx : 1/2 + 1/3 = 3/6 + 2/6 = 5/6' });
  const e0 = item(w0, { type: 'exercice', subject: 'Mathématiques', title: 'Calculs de fractions',
    content: 'Calcule et simplifie :\na) 2/3 + 1/6\nb) 3/4 − 1/8', share_model: true },
  { model_answer: 'a) 2/3 + 1/6 = 4/6 + 1/6 = **5/6**\nb) 3/4 − 1/8 = 6/8 − 1/8 = **5/8**' });
  sub(n0, lea, { understood: true });
  sub(e0, lea, { status: 'corrige', answer: 'a) 5/6\nb) 5/4', submitted_at: ago(130), corrected_at: ago(120), grade: '7/10',
    feedback: 'Très bien pour le a) ✅\n\nPour le b), attention : il faut d’abord écrire 3/4 = **6/8**, puis 6/8 − 1/8 = **5/8**. Tu as soustrait les dénominateurs, ce qu’il ne faut jamais faire.\n\n💡 Retiens : seuls les numérateurs s’additionnent ou se soustraient.' });

  // ----- Léa : cette semaine -----
  const w1 = week(lea, monday, 'Pythagore & participe passé', 'Bravo pour mercredi ! Cette semaine on consolide Pythagore avant le contrôle de vendredi. 💪');
  const n1 = item(w1, { type: 'notion', subject: 'Mathématiques', title: 'Le théorème de Pythagore',
    content: 'Dans un triangle **rectangle**, le carré de l’hypoténuse est égal à la somme des carrés des deux autres côtés :\nBC² = AB² + AC²\n\nL’hypoténuse est le côté **en face de l’angle droit** (le plus long).' });
  item(w1, { type: 'notion', subject: 'Français', title: 'Accord du participe passé avec avoir',
    content: 'Avec **avoir**, le participe passé s’accorde avec le COD **seulement s’il est placé avant** le verbe.\nEx : Les pommes que j’ai mangé**es**.' });
  const e1 = item(w1, { type: 'exercice', subject: 'Mathématiques', title: 'Calculer une hypoténuse',
    content: 'ABC est un triangle rectangle en A avec AB = 6 cm et AC = 8 cm.\nCalcule BC en détaillant.', answer_mode: 'les_deux', share_model: true },
  { model_answer: 'Le triangle est rectangle en A, donc d’après le théorème de Pythagore :\nBC² = AB² + AC² = 36 + 64 = 100\nBC = √100 = **10 cm**' });
  item(w1, { type: 'exercice', subject: 'Français', title: 'Accorde les participes passés',
    content: 'Recopie en accordant si nécessaire :\n1. Les lettres que j’ai (écrire)…\n2. J’ai (manger) les gâteaux.\n3. La chanson qu’elle a (chanter)…' },
  { model_answer: '1. écrites (COD « que » = les lettres, placé avant)\n2. mangé (COD après)\n3. chantée' });
  item(w1, { type: 'quiz', subject: 'Mathématiques', title: 'Quiz Pythagore', content: 'Sans calculatrice !',
    questions: [
      { id: 'q1', type: 'qcm', prompt: 'Dans un triangle rectangle, l’hypoténuse est…', options: ['Le plus petit côté', 'Le côté opposé à l’angle droit', 'N’importe quel côté'] },
      { id: 'q2', type: 'vf', prompt: 'Le théorème de Pythagore marche dans tous les triangles.', options: ['Vrai', 'Faux'] },
      { id: 'q3', type: 'texte', prompt: 'Combien vaut √49 ?', options: [] }
    ] },
  { answers: {
    q1: { answer: 1, explanation: 'C’est le côté en face de l’angle droit, toujours le plus long.' },
    q2: { answer: 1, explanation: 'Seulement dans les triangles rectangles !' },
    q3: { answer: '7|sept', explanation: '7 × 7 = 49' }
  } });
  sub(n1, lea, { understood: true });
  sub(e1, lea, { status: 'envoye', answer: 'BC² = 6² + 8² = 36 + 64 = 100\ndonc BC = 10 cm', submitted_at: ago(3) });

  // ----- Hugo -----
  const w2 = week(hugo, monday, 'Tables de 7 et 8', 'Un petit quiz par jour et tu vas devenir un champion des tables ! 🚀');
  item(w2, { type: 'notion', subject: 'Mathématiques', title: 'Tables de 7 et de 8', content: 'Astuce : 7 × 8 = 56 → « 5, 6, 7, 8 » !' });
  item(w2, { type: 'quiz', subject: 'Mathématiques', title: 'Défi tables', instant_result: true,
    questions: [
      { id: 'q1', type: 'texte', prompt: '7 × 8 = ?', options: [] },
      { id: 'q2', type: 'texte', prompt: '8 × 6 = ?', options: [] },
      { id: 'q3', type: 'qcm', prompt: '7 × 7 = ?', options: ['47', '49', '56'] }
    ] },
  { answers: { q1: { answer: '56', explanation: '5, 6, 7, 8 !' }, q2: { answer: '48', explanation: '' }, q3: { answer: 1, explanation: '' } } });
}
