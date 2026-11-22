-- Pannello admin: archivio delle opere (scheda tipo Wikipedia) e calendario delle pubblicazioni.
-- Usa private.is_team_member() già presente nel progetto (email in public.team_members).

create table if not exists public.artworks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default 'Senza titolo',
  artist        text,
  year          text,                       -- testo: "1503–1519", "c. 1889"
  technique     text,                       -- es. olio su tela
  dimensions    text,                       -- es. 77 × 53 cm
  location      text,                       -- museo / città
  movement      text,                       -- corrente artistica
  category      text not null default 'Arte',
  difficulty    text not null default 'medio' check (difficulty in ('facile','medio','difficile')),
  description   text not null default '',   -- testo lungo della scheda (Markdown semplice)
  wiki_url      text,
  tags          text[] not null default '{}',
  images        jsonb not null default '[]'::jsonb, -- foto vere: [{path, caption}], la prima è la principale
  package_path  text,                       -- cartella del pacchetto per l'app nel bucket artworks
  thumb_path    text,
  width         int,
  height        int,
  colors        int,
  zones         int,
  status        text not null default 'bozza' check (status in ('bozza','pronta','archiviata')),
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.publications (
  id          uuid primary key default gen_random_uuid(),
  artwork_id  uuid not null references public.artworks(id) on delete cascade,
  publish_at  timestamptz not null,
  featured    boolean not null default true,  -- diventa il "disegno del giorno" quando esce
  note        text,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists publications_publish_at_idx on public.publications (publish_at);
create index if not exists publications_artwork_idx on public.publications (artwork_id);

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists artworks_touch on public.artworks;
create trigger artworks_touch before update on public.artworks
  for each row execute function private.touch_updated_at();

alter table public.artworks enable row level security;
alter table public.publications enable row level security;
drop policy if exists artworks_team on public.artworks;
create policy artworks_team on public.artworks for all to authenticated
  using (private.is_team_member()) with check (private.is_team_member());
drop policy if exists publications_team on public.publications;
create policy publications_team on public.publications for all to authenticated
  using (private.is_team_member()) with check (private.is_team_member());

-- Catalogo per l'app: solo le opere già uscite (publish_at <= adesso) con un pacchetto.
-- Le uscite future non vengono mai mostrate; next_at dice all'app quando ricaricare.
create or replace function public.get_catalog() returns json
language sql stable security definer set search_path = '' as $$
  with uscite as (
    select distinct on (a.id) a.*, p.publish_at, p.featured
    from public.publications p join public.artworks a on a.id = p.artwork_id
    where p.publish_at <= now() and a.package_path is not null and a.status <> 'archiviata'
    order by a.id, p.publish_at desc
  )
  select json_build_object(
    'now', now(),
    'next_at', (select min(p.publish_at) from public.publications p
                join public.artworks a on a.id = p.artwork_id
                where p.publish_at > now() and a.package_path is not null and a.status <> 'archiviata'),
    'daily_id', (select u.id from uscite u where u.featured order by u.publish_at desc limit 1),
    'items', coalesce((select json_agg(json_build_object(
        'id', u.id, 'title', u.title, 'category', u.category, 'difficulty', u.difficulty,
        'artist', u.artist, 'year', u.year, 'description', u.description,
        'packagePath', u.package_path, 'thumbPath', u.thumb_path,
        'imagePath', u.images->0->>'path', 'publishedAt', u.publish_at
      ) order by u.publish_at desc) from uscite u), '[]'::json)
  );
$$;
revoke all on function public.get_catalog() from public;
grant execute on function public.get_catalog() to anon, authenticated;

-- Bucket pubblico per pacchetti e foto (lettura per URL senza login; scrittura solo team).
insert into storage.buckets (id, name, public) values ('artworks', 'artworks', true)
on conflict (id) do update set public = true;
drop policy if exists artworks_team_read on storage.objects;
create policy artworks_team_read on storage.objects for select to authenticated
  using (bucket_id = 'artworks' and private.is_team_member());
drop policy if exists artworks_team_insert on storage.objects;
create policy artworks_team_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'artworks' and private.is_team_member());
drop policy if exists artworks_team_update on storage.objects;
create policy artworks_team_update on storage.objects for update to authenticated
  using (bucket_id = 'artworks' and private.is_team_member());
drop policy if exists artworks_team_delete on storage.objects;
create policy artworks_team_delete on storage.objects for delete to authenticated
  using (bucket_id = 'artworks' and private.is_team_member());
