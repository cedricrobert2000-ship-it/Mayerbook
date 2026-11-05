'use strict';

/** Élèves d'exemple pour découvrir l'application. */
function loadDemoData() {
  const monday = mondayOf(todayISO());

  Store.addStudent({
    name: 'Léa Martin',
    level: '4e',
    subjects: ['Mathématiques', 'Français'],
    contact: 'Maman : 06 00 00 00 00',
    notes: 'Bonne élève, manque parfois de confiance. Cours le mercredi 14h.',
    weeks: [{
      id: uid(),
      start: monday,
      title: 'Pythagore & participe passé',
      message: 'Bravo pour mercredi ! Cette semaine on consolide Pythagore avant le contrôle de vendredi. 💪',
      items: [
        {
          id: uid(), type: 'notion', subject: 'Mathématiques',
          title: 'Le théorème de Pythagore',
          content: 'Dans un triangle **rectangle**, le carré de l’hypoténuse est égal à la somme des carrés des deux autres côtés :\nBC² = AB² + AC²\n\nL’hypoténuse est le côté **en face de l’angle droit** (le plus long).',
          link: 'https://fr.wikipedia.org/wiki/Th%C3%A9or%C3%A8me_de_Pythagore'
        },
        {
          id: uid(), type: 'notion', subject: 'Français',
          title: 'Accord du participe passé avec avoir',
          content: 'Avec l’auxiliaire **avoir**, le participe passé s’accorde avec le COD **seulement s’il est placé avant** le verbe.\nEx : Les pommes que j’ai mangé**es**.'
        },
        {
          id: uid(), type: 'exercice', subject: 'Mathématiques',
          title: 'Calculer une hypoténuse',
          content: 'ABC est un triangle rectangle en A avec AB = 6 cm et AC = 8 cm.\nCalcule BC.',
          correction: 'BC² = AB² + AC² = 36 + 64 = 100\nDonc BC = √100 = **10 cm**.',
          showCorrection: true
        },
        {
          id: uid(), type: 'exercice', subject: 'Français',
          title: 'Livre p. 112, exercices 3 et 4',
          content: 'Fais les exercices 3 et 4 page 112 sur ton cahier. On les corrigera ensemble mercredi.',
          correction: '', showCorrection: false
        },
        {
          id: uid(), type: 'quiz', subject: 'Mathématiques',
          title: 'Quiz Pythagore',
          content: 'Réponds sans calculatrice !',
          questions: [
            { id: uid(), type: 'qcm', prompt: 'Dans un triangle rectangle, l’hypoténuse est…', options: ['Le plus petit côté', 'Le côté opposé à l’angle droit', 'N’importe quel côté'], answer: 1, explanation: 'C’est le côté en face de l’angle droit, et c’est toujours le plus long.' },
            { id: uid(), type: 'vf', prompt: 'Le théorème de Pythagore marche dans tous les triangles.', options: ['Vrai', 'Faux'], answer: 1, explanation: 'Seulement dans les triangles rectangles !' },
            { id: uid(), type: 'texte', prompt: 'Combien vaut √49 ?', options: [], answer: '7|sept', explanation: '7 × 7 = 49' }
          ]
        }
      ]
    }]
  });

  Store.addStudent({
    name: 'Hugo Bernard',
    level: 'CM2',
    subjects: ['Mathématiques', 'Français'],
    contact: '',
    notes: 'Travailler les tables de multiplication en priorité.',
    weeks: [{
      id: uid(),
      start: monday,
      title: 'Tables de 7 et 8',
      message: 'Un petit quiz par jour et tu vas devenir un champion des tables ! 🚀',
      items: [
        { id: uid(), type: 'notion', subject: 'Mathématiques', title: 'Tables de 7 et de 8', content: 'Astuce : 7 × 8 = 56 → « 5, 6, 7, 8 » !' },
        {
          id: uid(), type: 'quiz', subject: 'Mathématiques', title: 'Défi tables',
          content: '',
          questions: [
            { id: uid(), type: 'texte', prompt: '7 × 8 = ?', options: [], answer: '56', explanation: '5, 6, 7, 8 !' },
            { id: uid(), type: 'texte', prompt: '8 × 6 = ?', options: [], answer: '48', explanation: '' },
            { id: uid(), type: 'qcm', prompt: '7 × 7 = ?', options: ['47', '49', '56'], answer: 1, explanation: '' }
          ]
        }
      ]
    }]
  });
}
