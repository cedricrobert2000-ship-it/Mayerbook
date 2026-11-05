-- =====================================================================
--  Mayerbook — schéma de la base Supabase
--  À coller dans Supabase > SQL Editor > New query, puis « Run ».
--  Peut être relancé sans risque (idempotent).
-- =====================================================================

-- ---------- Tables ----------

create table if not exists public.tutors (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,
  username text not null unique,
  name text not null,
  level text not null,
  subjects text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Informations privées du prof (jamais lisibles par l'élève)
create table if not exists public.student_private (
  student_id uuid primary key references public.students (id) on delete cascade,
  contact text not null default '',
  notes text not null default ''
);

create table if not exists public.weeks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  start_date date not null,
  title text not null default '',
  message text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists weeks_student_idx on public.weeks (student_id, start_date desc);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks (id) on delete cascade,
  position int not null default 0,
  type text not null check (type in ('notion', 'exercice', 'quiz')),
  subject text not null default '',
  title text not null,
  content text not null default '',
  link text not null default '',
  attachments jsonb not null default '[]',
  answer_mode text not null default 'texte' check (answer_mode in ('texte', 'fichier', 'les_deux')),
  -- Questions du quiz SANS les réponses : [{id, type, prompt, options}]
  questions jsonb not null default '[]',
  instant_result boolean not null default true,
  share_model boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists items_week_idx on public.items (week_id, position);

-- Réponses et corrigés : réservés au prof
create table if not exists public.item_keys (
  item_id uuid primary key references public.items (id) on delete cascade,
  answers jsonb not null default '{}',      -- { questionId: { answer, explanation } }
  model_answer text not null default ''      -- correction type
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status text not null default 'brouillon' check (status in ('brouillon', 'envoye', 'corrige')),
  understood boolean not null default false,
  answer text not null default '',
  answers jsonb not null default '{}',
  files jsonb not null default '[]',
  score int,
  total int,
  feedback text not null default '',
  grade text not null default '',
  feedback_files jsonb not null default '[]',
  submitted_at timestamptz,
  corrected_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (item_id, student_id)
);
create index if not exists submissions_student_idx on public.submissions (student_id);
create index if not exists submissions_status_idx on public.submissions (status);

-- ---------- Fonctions d'aide (droits) ----------

create or replace function public.is_tutor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tutors where id = auth.uid());
$$;

create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid();
$$;

create or replace function public.owns_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students where id = sid and tutor_id = auth.uid());
$$;

create or replace function public.owns_student_text(sid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students where id::text = sid and tutor_id = auth.uid());
$$;

create or replace function public.week_student(wid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select student_id from public.weeks where id = wid;
$$;

create or replace function public.item_student(iid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select w.student_id from public.items i join public.weeks w on w.id = i.week_id where i.id = iid;
$$;

create or replace function public.week_visible_to_me(wid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.weeks w
    where w.id = wid and w.published and w.student_id = public.my_student_id()
  );
$$;

-- Normalise une réponse libre (casse, accents, ponctuation, espaces)
create or replace function public.norm_answer(t text) returns text
language sql immutable as $$
  select trim(regexp_replace(regexp_replace(
    translate(lower(coalesce(t, '')),
      'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy'),
    '[.,;:!?''"’«»()]', ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- ---------- Sécurité (RLS) ----------

alter table public.tutors enable row level security;
alter table public.students enable row level security;
alter table public.student_private enable row level security;
alter table public.weeks enable row level security;
alter table public.items enable row level security;
alter table public.item_keys enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "prof: soi" on public.tutors;
create policy "prof: soi" on public.tutors for select to authenticated using (id = auth.uid());

drop policy if exists "prof: ses élèves" on public.students;
create policy "prof: ses élèves" on public.students for all to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());
drop policy if exists "élève: sa fiche" on public.students;
create policy "élève: sa fiche" on public.students for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "prof: privé" on public.student_private;
create policy "prof: privé" on public.student_private for all to authenticated
  using (public.owns_student(student_id)) with check (public.owns_student(student_id));

drop policy if exists "prof: semaines" on public.weeks;
create policy "prof: semaines" on public.weeks for all to authenticated
  using (public.owns_student(student_id)) with check (public.owns_student(student_id));
drop policy if exists "élève: semaines publiées" on public.weeks;
create policy "élève: semaines publiées" on public.weeks for select to authenticated
  using (published and student_id = public.my_student_id());

drop policy if exists "prof: éléments" on public.items;
create policy "prof: éléments" on public.items for all to authenticated
  using (public.owns_student(public.week_student(week_id)))
  with check (public.owns_student(public.week_student(week_id)));
drop policy if exists "élève: éléments publiés" on public.items;
create policy "élève: éléments publiés" on public.items for select to authenticated
  using (public.week_visible_to_me(week_id));

drop policy if exists "prof: corrigés" on public.item_keys;
create policy "prof: corrigés" on public.item_keys for all to authenticated
  using (public.owns_student(public.item_student(item_id)))
  with check (public.owns_student(public.item_student(item_id)));

drop policy if exists "prof: copies" on public.submissions;
create policy "prof: copies" on public.submissions for all to authenticated
  using (public.owns_student(student_id)) with check (public.owns_student(student_id));
drop policy if exists "élève: ses copies" on public.submissions;
create policy "élève: ses copies" on public.submissions for select to authenticated
  using (student_id = public.my_student_id());
-- (l'élève n'écrit jamais directement : il passe par les fonctions ci-dessous)

-- ---------- Fonctions appelées par l'application ----------

-- Le tout premier compte créé devient le compte prof.
create or replace function public.claim_tutor() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.tutors where id = auth.uid()) then return true; end if;
  if exists (select 1 from public.students where user_id = auth.uid()) then return false; end if;
  if exists (select 1 from public.tutors) then return false; end if;
  insert into public.tutors (id) values (auth.uid());
  return true;
end;
$$;

-- Note un quiz à partir des réponses de l'élève.
create or replace function public.grade_quiz(p_item uuid, p_answers jsonb, out score int, out total int)
language plpgsql stable security definer set search_path = public as $$
declare
  q jsonb;
  k jsonb;
  v text;
  keys jsonb;
begin
  score := 0; total := 0;
  select coalesce(answers, '{}') into keys from public.item_keys where item_id = p_item;
  keys := coalesce(keys, '{}');
  for q in select jsonb_array_elements(questions) from public.items where id = p_item loop
    total := total + 1;
    k := keys -> (q ->> 'id');
    v := p_answers ->> (q ->> 'id');
    if k is null or v is null or v = '' then continue; end if;
    if q ->> 'type' = 'texte' then
      if exists (
        select 1 from unnest(string_to_array(k ->> 'answer', '|')) a
        where public.norm_answer(a) <> '' and public.norm_answer(a) = public.norm_answer(v)
      ) then score := score + 1; end if;
    elsif v = (k ->> 'answer') then
      score := score + 1;
    end if;
  end loop;
end;
$$;

-- Enregistre le brouillon de l'élève (ou « j'ai compris » pour une notion).
create or replace function public.student_save(
  p_item uuid,
  p_answer text default null,
  p_answers jsonb default null,
  p_files jsonb default null,
  p_understood boolean default null
) returns public.submissions
language plpgsql security definer set search_path = public as $$
declare
  sid uuid := public.my_student_id();
  it public.items;
  sub public.submissions;
begin
  select * into it from public.items where id = p_item;
  if sid is null or it.id is null or not public.week_visible_to_me(it.week_id) then
    raise exception 'Accès refusé';
  end if;

  insert into public.submissions (item_id, student_id) values (p_item, sid)
  on conflict (item_id, student_id) do nothing;
  select * into sub from public.submissions where item_id = p_item and student_id = sid for update;

  if p_understood is not null then
    sub.understood := p_understood;
  end if;
  if sub.status = 'brouillon' then
    if p_answer is not null then sub.answer := left(p_answer, 20000); end if;
    if p_answers is not null then sub.answers := p_answers; end if;
    if p_files is not null then sub.files := p_files; end if;
  elsif p_answer is not null or p_answers is not null or p_files is not null then
    raise exception 'Déjà envoyé : tu ne peux plus modifier ta réponse.';
  end if;

  update public.submissions set
    understood = sub.understood, answer = sub.answer, answers = sub.answers,
    files = sub.files, updated_at = now()
  where id = sub.id
  returning * into sub;
  return sub;
end;
$$;

-- L'élève envoie son travail au prof.
create or replace function public.student_submit(p_item uuid) returns public.submissions
language plpgsql security definer set search_path = public as $$
declare
  sid uuid := public.my_student_id();
  it public.items;
  sub public.submissions;
  g record;
begin
  select * into it from public.items where id = p_item;
  if sid is null or it.id is null or not public.week_visible_to_me(it.week_id) then
    raise exception 'Accès refusé';
  end if;
  if it.type = 'notion' then raise exception 'Rien à envoyer pour une notion'; end if;

  insert into public.submissions (item_id, student_id) values (p_item, sid)
  on conflict (item_id, student_id) do nothing;
  select * into sub from public.submissions where item_id = p_item and student_id = sid for update;
  if sub.status <> 'brouillon' then raise exception 'Déjà envoyé.'; end if;

  if it.type = 'quiz' then
    select * into g from public.grade_quiz(p_item, sub.answers);
    update public.submissions set
      score = g.score, total = g.total,
      status = case when it.instant_result then 'corrige' else 'envoye' end,
      submitted_at = now(),
      corrected_at = case when it.instant_result then now() else null end,
      updated_at = now()
    where id = sub.id returning * into sub;
  else
    update public.submissions set status = 'envoye', submitted_at = now(), updated_at = now()
    where id = sub.id returning * into sub;
  end if;
  return sub;
end;
$$;

-- Corrigé visible par l'élève seulement après envoi / correction.
create or replace function public.get_solution(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  sid uuid := public.my_student_id();
  it public.items;
  sub public.submissions;
  k public.item_keys;
  res jsonb := '{}';
begin
  select * into it from public.items where id = p_item;
  if sid is null or it.id is null or not public.week_visible_to_me(it.week_id) then
    raise exception 'Accès refusé';
  end if;
  select * into sub from public.submissions where item_id = p_item and student_id = sid;
  select * into k from public.item_keys where item_id = p_item;
  if sub.id is null or sub.status <> 'corrige' then return res; end if;
  if it.type = 'quiz' then res := res || jsonb_build_object('answers', coalesce(k.answers, '{}')); end if;
  if it.share_model and coalesce(k.model_answer, '') <> '' then
    res := res || jsonb_build_object('model_answer', k.model_answer);
  end if;
  return res;
end;
$$;

revoke execute on function public.claim_tutor() from anon;
revoke execute on function public.student_save(uuid, text, jsonb, jsonb, boolean) from anon;
revoke execute on function public.student_submit(uuid) from anon;
revoke execute on function public.get_solution(uuid) from anon;
-- Personne ne peut appeler la notation directement (sinon on pourrait deviner les réponses)
revoke execute on function public.grade_quiz(uuid, jsonb) from public, anon, authenticated;

-- ---------- Stockage des fichiers ----------
-- Chemins : <id élève>/prof/<fichier>  (sujets, corrections du prof)
--           <id élève>/eleve/<fichier> (copies de l'élève)

insert into storage.buckets (id, name, public)
values ('fichiers', 'fichiers', false)
on conflict (id) do nothing;

drop policy if exists "mayerbook prof fichiers" on storage.objects;
create policy "mayerbook prof fichiers" on storage.objects for all to authenticated
  using (bucket_id = 'fichiers' and public.owns_student_text((storage.foldername(name))[1]))
  with check (bucket_id = 'fichiers' and public.owns_student_text((storage.foldername(name))[1]));

drop policy if exists "mayerbook élève lit" on storage.objects;
create policy "mayerbook élève lit" on storage.objects for select to authenticated
  using (bucket_id = 'fichiers' and (storage.foldername(name))[1] = public.my_student_id()::text);

drop policy if exists "mayerbook élève dépose" on storage.objects;
create policy "mayerbook élève dépose" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fichiers'
    and (storage.foldername(name))[1] = public.my_student_id()::text
    and (storage.foldername(name))[2] = 'eleve'
  );
