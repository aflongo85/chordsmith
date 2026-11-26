-- Chordsmith: tabella delle idee sincronizzate.
-- Incolla tutto nel SQL Editor di Supabase ed esegui (Run).
-- Ogni utente vede e modifica solo le proprie righe (Row Level Security).

create table if not exists public.ideas (
  user_id     uuid    not null default auth.uid() references auth.users on delete cascade,
  id          text    not null,
  name        text    not null,
  progression text    not null default '',
  melody      text    not null default '',
  genre_id    text    not null default 'alt-rock',
  created_at  bigint  not null,
  updated_at  bigint  not null,
  deleted     boolean not null default false,
  primary key (user_id, id)
);

alter table public.ideas enable row level security;

-- solo gli utenti autenticati possono usare la tabella (sempre filtrati dalle regole sotto)
revoke all on public.ideas from anon;
grant select, insert, update, delete on public.ideas to authenticated;

drop policy if exists "ideas: leggo le mie" on public.ideas;
drop policy if exists "ideas: creo le mie" on public.ideas;
drop policy if exists "ideas: modifico le mie" on public.ideas;
drop policy if exists "ideas: cancello le mie" on public.ideas;

create policy "ideas: leggo le mie" on public.ideas
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ideas: creo le mie" on public.ideas
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ideas: modifico le mie" on public.ideas
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ideas: cancello le mie" on public.ideas
  for delete to authenticated using ((select auth.uid()) = user_id);
