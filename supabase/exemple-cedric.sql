-- =========================================================
-- Mayerbook : élève d'exemple « Cédric »
-- Efface TOUT le travail de l'élève dont le nom ou l'identifiant
-- commence par « cedric » / « cédric », puis crée 2 semaines d'exemple
-- (notions, exercices, quiz, corrections). Son compte et son code ne changent pas.
-- À coller dans Supabase > SQL Editor puis « Run ». Peut être relancé.
-- =========================================================

alter table public.submissions add column if not exists checked jsonb not null default '{}';

do $$
declare
  sid uuid;
  n int;
  w0 uuid; w1 uuid;
  i uuid;
  this_monday date := date_trunc('week', current_date)::date;
begin
  select count(*), min(id::text)::uuid into n, sid from public.students
  where translate(lower(name), 'éèêë', 'eeee') like 'cedric%' or lower(username) like 'cedric%';
  if n = 0 then raise exception 'Aucun élève nommé Cédric trouvé.'; end if;
  if n > 1 then raise exception 'Plusieurs élèves « Cédric » trouvés : renomme-en un.'; end if;

  -- 1. On efface tout son travail (semaines -> éléments -> corrigés et réponses)
  delete from public.submissions where student_id = sid;
  delete from public.weeks where student_id = sid;

  update public.students set level = '3e', subjects = array['Mathématiques', 'Français', 'SVT'] where id = sid;

  -- =====================================================
  -- 2. Semaine dernière : terminée et corrigée
  -- =====================================================
  insert into public.weeks (student_id, start_date, title, message, published)
  values (sid, this_monday - 7, 'Fractions & puissances',
    'Super séance ! On révise les fractions et les puissances avant le brevet blanc.', true)
  returning id into w0;

  insert into public.items (week_id, position, type, subject, title, content)
  values (w0, 0, 'notion', 'Mathématiques', 'Les puissances de 10',
    E'10ⁿ = 1 suivi de **n zéros** : 10³ = 1 000\n10⁻ⁿ = 0,00…1 avec **n chiffres après la virgule** : 10⁻² = 0,01\n\nRègle d’or : 10ᵃ × 10ᵇ = 10ᵃ⁺ᵇ')
  returning id into i;
  insert into public.submissions (item_id, student_id, understood, updated_at)
  values (i, sid, true, now() - interval '8 days');

  insert into public.items (week_id, position, type, subject, title, content, answer_mode, share_model)
  values (w0, 1, 'exercice', 'Mathématiques', 'Calculs de fractions',
    E'Calcule et donne le résultat sous forme irréductible :\na) 2/3 + 1/6\nb) 3/4 − 1/8\nc) 5/6 × 3/10', 'les_deux', true)
  returning id into i;
  insert into public.item_keys (item_id, model_answer) values (i,
    E'a) 2/3 + 1/6 = 4/6 + 1/6 = **5/6**\nb) 3/4 − 1/8 = 6/8 − 1/8 = **5/8**\nc) 5/6 × 3/10 = 15/60 = **1/4**');
  insert into public.submissions (item_id, student_id, status, answer, submitted_at, corrected_at, grade, feedback, updated_at)
  values (i, sid, 'corrige', E'a) 5/6\nb) 2/4\nc) 1/4', now() - interval '6 days', now() - interval '5 days', '7/10',
    E'Très bien pour le a) et le c) ✅\n\nPour le b), attention : on écrit d’abord 3/4 = **6/8**, puis 6/8 − 1/8 = **5/8**. Tu as soustrait les dénominateurs : il ne faut jamais le faire.\n\n💡 Seuls les numérateurs s’additionnent ou se soustraient.',
    now() - interval '5 days');

  insert into public.items (week_id, position, type, subject, title, content, questions, instant_result)
  values (w0, 2, 'quiz', 'Mathématiques', 'Quiz puissances', 'Sans calculatrice !',
    '[{"id":"q1","type":"qcm","prompt":"10³ × 10² = ?","options":["10⁵","10⁶","100⁵"]},
      {"id":"q2","type":"vf","prompt":"10⁻² = 0,01","options":["Vrai","Faux"]},
      {"id":"q3","type":"texte","prompt":"Combien de zéros dans 10⁶ ?","options":[]},
      {"id":"q4","type":"qcm","prompt":"2⁴ = ?","options":["8","16","24"]}]', true)
  returning id into i;
  insert into public.item_keys (item_id, answers) values (i,
    '{"q1":{"answer":0,"explanation":"On additionne les exposants : 3 + 2 = 5."},
      "q2":{"answer":0,"explanation":"Deux chiffres après la virgule."},
      "q3":{"answer":"6|six","explanation":"10⁶ = 1 000 000."},
      "q4":{"answer":1,"explanation":"2 × 2 × 2 × 2 = 16."}}');
  insert into public.submissions (item_id, student_id, status, answers, checked, score, total, submitted_at, corrected_at, updated_at)
  values (i, sid, 'corrige', '{"q1":0,"q2":0,"q3":"6","q4":2}', '{"q1":true,"q2":true,"q3":true,"q4":true}',
    3, 4, now() - interval '7 days', now() - interval '7 days', now() - interval '7 days');

  -- =====================================================
  -- 3. Cette semaine : tout est à faire
  -- =====================================================
  insert into public.weeks (student_id, start_date, title, message, published)
  values (sid, this_monday, 'Équations, figures de style & ADN',
    E'Salut Cédric ! Cette semaine : les équations (on en a beaucoup parlé mardi), les figures de style pour le brevet, et un peu de SVT. Fais un quiz par jour, c’est le plus efficace 💪', true)
  returning id into w1;

  -- Notions
  insert into public.items (week_id, position, type, subject, title, content, link) values
  (w1, 0, 'notion', 'Mathématiques', 'Résoudre une équation du 1er degré',
    E'But : trouver la valeur de x.\n1. On regroupe les **x d’un côté** et les **nombres de l’autre**.\n2. On divise par le nombre devant x.\n\nEx : 3x + 4 = 19 → 3x = 15 → **x = 5**\n\nVérification : 3 × 5 + 4 = 19 ✅',
    'https://fr.khanacademy.org/math/college-troisieme'),
  (w1, 1, 'notion', 'Français', 'Comparaison et métaphore',
    E'**Comparaison** : rapproche deux éléments AVEC un outil de comparaison (comme, tel, pareil à, ressembler…).\nEx : Ses yeux brillent **comme** des étoiles.\n\n**Métaphore** : même rapprochement mais SANS outil.\nEx : Ses yeux sont des étoiles.', ''),
  (w1, 2, 'notion', 'SVT', 'ADN, gènes et chromosomes',
    E'Le **chromosome** est fait d’ADN enroulé.\nUn **gène** est un morceau d’ADN qui porte une information (ex : groupe sanguin).\nL’être humain a **46 chromosomes** (23 paires) dans chaque cellule.', '');

  -- Exercice de maths : correction type montrée juste après l'envoi
  insert into public.items (week_id, position, type, subject, title, content, answer_mode, share_model, instant_result)
  values (w1, 3, 'exercice', 'Mathématiques', 'Résoudre des équations',
    E'Résous les équations en détaillant chaque étape :\na) 2x + 7 = 15\nb) 5x − 3 = 2x + 9\nc) 4(x − 1) = 20\n\nTu peux écrire ta réponse ou envoyer une photo de ton brouillon.', 'les_deux', true, true)
  returning id into i;
  insert into public.item_keys (item_id, model_answer) values (i,
    E'a) 2x + 7 = 15 → 2x = 8 → **x = 4**\nb) 5x − 3 = 2x + 9 → 5x − 2x = 9 + 3 → 3x = 12 → **x = 4**\nc) 4(x − 1) = 20 → x − 1 = 5 → **x = 6**\n\n💡 Pense à vérifier en remplaçant x dans l’équation de départ.');

  -- Exercice de français : corrigé par le prof uniquement
  insert into public.items (week_id, position, type, subject, title, content, answer_mode, share_model)
  values (w1, 4, 'exercice', 'Français', 'Décris ta ville',
    E'En 5 à 8 lignes, décris ta ville la nuit.\nTu dois utiliser **au moins une comparaison** et **une métaphore**. Souligne-les (ou mets-les en **gras**).', 'texte', false)
  returning id into i;
  insert into public.item_keys (item_id, model_answer) values (i, '');

  -- Quiz
  insert into public.items (week_id, position, type, subject, title, content, questions, instant_result)
  values (w1, 5, 'quiz', 'Mathématiques', 'Quiz équations', 'Un brouillon peut t’aider !',
    '[{"id":"q1","type":"qcm","prompt":"Solution de x + 5 = 12 ?","options":["x = 17","x = 7","x = 5"]},
      {"id":"q2","type":"texte","prompt":"Résous 3x = 21. x = ?","options":[]},
      {"id":"q3","type":"vf","prompt":"x = 2 est solution de 4x − 1 = 7","options":["Vrai","Faux"]},
      {"id":"q4","type":"qcm","prompt":"Dans 2x + 6 = 10, que fait-on en premier ?","options":["On divise par 2","On enlève 6 des deux côtés","On ajoute 6"]},
      {"id":"q5","type":"texte","prompt":"Résous 5x − 4 = 3x + 8. x = ?","options":[]}]', true)
  returning id into i;
  insert into public.item_keys (item_id, answers) values (i,
    '{"q1":{"answer":1,"explanation":"12 − 5 = 7."},
      "q2":{"answer":"7|sept","explanation":"21 ÷ 3 = 7."},
      "q3":{"answer":0,"explanation":"4 × 2 − 1 = 7 ✅"},
      "q4":{"answer":1,"explanation":"On isole d’abord 2x : 2x = 4, puis x = 2."},
      "q5":{"answer":"6|six","explanation":"5x − 3x = 8 + 4 → 2x = 12 → x = 6."}}');

  insert into public.items (week_id, position, type, subject, title, content, questions, instant_result)
  values (w1, 6, 'quiz', 'Français', 'Quiz figures de style', '',
    '[{"id":"q1","type":"qcm","prompt":"« Il est fort comme un lion. » C’est…","options":["Une métaphore","Une comparaison","Une personnification"]},
      {"id":"q2","type":"qcm","prompt":"« Cet homme est un lion. » C’est…","options":["Une métaphore","Une comparaison","Une hyperbole"]},
      {"id":"q3","type":"vf","prompt":"Une métaphore utilise toujours le mot « comme ».","options":["Vrai","Faux"]},
      {"id":"q4","type":"texte","prompt":"Cite un outil de comparaison (autre que « comme »).","options":[]}]', true)
  returning id into i;
  insert into public.item_keys (item_id, answers) values (i,
    '{"q1":{"answer":1,"explanation":"Il y a l’outil « comme »."},
      "q2":{"answer":0,"explanation":"Pas d’outil de comparaison : c’est une métaphore."},
      "q3":{"answer":1,"explanation":"Justement non : la métaphore n’a pas d’outil de comparaison."},
      "q4":{"answer":"tel|telle|tels|telles|pareil a|pareil à|semblable a|semblable à|ressembler|ressemble|ainsi que|de meme que|de même que|tel que","explanation":"Par exemple : tel, pareil à, semblable à, ressembler…"}}');

  insert into public.items (week_id, position, type, subject, title, content, questions, instant_result)
  values (w1, 7, 'quiz', 'SVT', 'Quiz ADN', '',
    '[{"id":"q1","type":"texte","prompt":"Combien de chromosomes dans une cellule humaine ?","options":[]},
      {"id":"q2","type":"qcm","prompt":"Un gène est…","options":["Une cellule","Un morceau d’ADN","Un organe"]},
      {"id":"q3","type":"vf","prompt":"Les chromosomes sont rangés par paires.","options":["Vrai","Faux"]}]', true)
  returning id into i;
  insert into public.item_keys (item_id, answers) values (i,
    '{"q1":{"answer":"46|quarante-six|quarante six","explanation":"23 paires, soit 46 chromosomes."},
      "q2":{"answer":1,"explanation":"Un gène est une portion d’ADN qui porte une information."},
      "q3":{"answer":0,"explanation":"23 paires : une venant du père, une de la mère."}}');
end;
$$;
