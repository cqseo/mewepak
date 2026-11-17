-- One-time bootstrap for the Mewepak headless CMS.
-- Review the README before running this against a hosted project.

create extension if not exists pgcrypto;

create or replace function public.is_staff()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'editor'),
    false
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text not null default '',
  image_url text not null default '',
  menu_group text not null default 'pouch-formats'
    check (menu_group in ('pouch-formats', 'specialty-packaging')),
  menu_order integer not null default 0,
  show_in_menu boolean not null default true,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  seo_title text not null default '',
  seo_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  short_description text not null default '',
  description text not null default '',
  features text[] not null default '{}',
  material_options text[] not null default '{}',
  printing_options text[] not null default '{}',
  applications text[] not null default '{}',
  primary_image_url text not null default '',
  gallery_urls text[] not null default '{}',
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  seo_title text not null default '',
  seo_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  template_key text not null default 'page-default',
  summary text not null default '',
  sections jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  seo_title text not null default '',
  seo_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  body text not null default '',
  featured_image_url text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  seo_title text not null default '',
  seo_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_settings (
  id smallint primary key default 1 check (id = 1),
  working_days smallint[] not null default array[1,2,3,4,5]::smallint[],
  start_time time not null default '09:00',
  end_time time not null default '17:00',
  slot_minutes integer not null default 60 check (slot_minutes between 15 and 240),
  max_per_slot integer not null default 1 check (max_per_slot between 1 and 20),
  advance_days integer not null default 30 check (advance_days between 1 and 365),
  timezone text not null default 'America/Chicago',
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  booking_date date not null,
  slot_start time not null,
  slot_end time not null,
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  company text not null default '' check (char_length(company) <= 160),
  email text not null check (char_length(email) between 5 and 254),
  phone text not null check (char_length(phone) between 5 and 50),
  topic text not null default '' check (char_length(topic) <= 2000),
  meeting_type text not null check (meeting_type in ('video_call', 'factory_visit')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_date_status_start_idx
  on public.appointments (booking_date, status, slot_start);

create table if not exists public.model_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model_url text not null,
  poster_url text not null default '',
  product_id uuid references public.products(id) on delete set null,
  preview_settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  contact_name text not null,
  company text not null default '',
  email text not null,
  phone text not null default '',
  message text not null default '',
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'replied', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  public_url text not null,
  mime_type text not null default '',
  alt_text text not null default '',
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

insert into public.booking_settings (id)
values (1)
on conflict (id) do nothing;

-- Seed the product-category groups visible in the existing product mega menu.
insert into public.product_categories
  (name, slug, short_description, menu_group, menu_order, show_in_menu, status)
values
  ('Stand Up Pouch', 'stand-up-pouch', 'Stand up pouches combine an upright gusseted base, laminated exterior, and shelf-ready front panel for chocolates, confectionery, wellness products, tea, prepared foods, and other products.', 'pouch-formats', 10, true, 'published'),
  ('Flat Bottom Pouch', 'flat-bottom-pouch', 'Flat bottom pouches use a reinforced rectangular base and side gussets to create a stable box-style profile for coffee, snacks, nuts, seeds, grains, detergent powders, and other products.', 'pouch-formats', 20, true, 'published'),
  ('Retort Pouch', 'retort-pouch', 'High-temperature resistant pouches for sterilized food products with extended shelf life.', 'pouch-formats', 30, true, 'published'),
  ('Spout Pouch', 'spout-pouch', 'Convenient pouches with integrated spouts for liquid and semi-liquid products.', 'pouch-formats', 40, true, 'published'),
  ('Roll Stock Films', 'roll-stock-films', 'Roll stock films provide continuous printed flexible film for automated form-fill-seal and wrapping lines.', 'pouch-formats', 50, true, 'published'),
  ('Stand Up Pouch with Tap', 'stand-up-pouch-tap', 'Large format pouches with dispensing taps, ideal for bag-in-box applications.', 'pouch-formats', 60, true, 'published'),
  ('Bag In Box', 'bag-in-box', 'Inner bags designed for box packaging, perfect for beverages and liquid products.', 'pouch-formats', 70, true, 'published'),
  ('Pinch Bottom Pouches', 'pinch-bottom-pouches', 'Pinch bottom pouches feature a folded reinforced base, structured side gussets, and broad print panels for dry goods.', 'pouch-formats', 80, true, 'published'),
  ('polybag', 'polybag', 'Polybags use lightweight flexible film in clear or printed formats with heat-sealed or twist-tie closures.', 'pouch-formats', 90, true, 'published'),
  ('Quad Seal Bag', 'quad-seal-bag', 'Four-corner sealed bags offering maximum shelf impact and filling capacity.', 'specialty-packaging', 10, true, 'published'),
  ('Flat Pouch', 'flat-pouch', 'Simple three-side sealed pouches for sachets, samples, and lightweight products.', 'specialty-packaging', 20, true, 'published'),
  ('Shaped Pouch', 'shaped-pouch', 'Custom die-cut pouches in unique shapes for standout shelf presence.', 'specialty-packaging', 30, true, 'published')
on conflict (slug) do nothing;

-- Public pages can only read published showcase data. There is no public read
-- access to appointments, inquiries, drafts, or booking settings.
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.pages enable row level security;
alter table public.articles enable row level security;
alter table public.booking_settings enable row level security;
alter table public.appointments enable row level security;
alter table public.model_assets enable row level security;
alter table public.site_settings enable row level security;
alter table public.inquiries enable row level security;
alter table public.media_assets enable row level security;

drop policy if exists categories_public_read on public.product_categories;
create policy categories_public_read on public.product_categories
  for select to anon, authenticated using (status = 'published');
drop policy if exists categories_staff_all on public.product_categories;
create policy categories_staff_all on public.product_categories
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated using (status = 'published');
drop policy if exists products_staff_all on public.products;
create policy products_staff_all on public.products
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists pages_public_read on public.pages;
create policy pages_public_read on public.pages
  for select to anon, authenticated using (status = 'published');
drop policy if exists pages_staff_all on public.pages;
create policy pages_staff_all on public.pages
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles
  for select to anon, authenticated using (status = 'published');
drop policy if exists articles_staff_all on public.articles;
create policy articles_staff_all on public.articles
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists booking_settings_staff_all on public.booking_settings;
create policy booking_settings_staff_all on public.booking_settings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists appointments_staff_all on public.appointments;
create policy appointments_staff_all on public.appointments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists models_public_read on public.model_assets;
create policy models_public_read on public.model_assets
  for select to anon, authenticated using (status = 'published');
drop policy if exists models_staff_all on public.model_assets;
create policy models_staff_all on public.model_assets
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings
  for select to anon, authenticated using (is_public);
drop policy if exists settings_staff_all on public.site_settings;
create policy settings_staff_all on public.site_settings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists inquiries_staff_all on public.inquiries;
create policy inquiries_staff_all on public.inquiries
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists media_staff_all on public.media_assets;
create policy media_staff_all on public.media_assets
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select on public.product_categories, public.products, public.pages,
  public.articles, public.model_assets, public.site_settings to anon, authenticated;
grant select, insert, update, delete on public.product_categories, public.products,
  public.pages, public.articles, public.booking_settings, public.appointments,
  public.model_assets, public.site_settings, public.inquiries, public.media_assets
  to authenticated;
grant all on public.product_categories, public.products, public.pages, public.articles,
  public.booking_settings, public.appointments, public.model_assets, public.site_settings,
  public.inquiries, public.media_assets to service_role;

-- Atomic public booking insert. The Worker validates Turnstile before calling
-- this RPC; the advisory lock prevents two requests claiming the same last slot.
create or replace function public.create_booking(
  p_booking_date date,
  p_slot_start time,
  p_contact_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_topic text,
  p_meeting_type text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  cfg public.booking_settings%rowtype;
  v_today date;
  v_slot_end time;
  v_booked integer;
  v_id uuid;
begin
  select * into cfg from public.booking_settings where id = 1;
  if not found then
    raise exception using errcode = 'P0001', message = 'booking_not_configured';
  end if;

  if p_contact_name is null or char_length(trim(p_contact_name)) not between 2 and 120
     or p_email is null or char_length(trim(p_email)) not between 5 and 254
     or p_phone is null or char_length(trim(p_phone)) not between 5 and 50
     or p_company is null or char_length(p_company) > 160
     or p_topic is null or char_length(p_topic) > 2000
     or p_meeting_type not in ('video_call', 'factory_visit') then
    raise exception using errcode = '22023', message = 'invalid_booking_details';
  end if;

  v_today := (now() at time zone cfg.timezone)::date;
  if p_booking_date < v_today or p_booking_date > v_today + cfg.advance_days
     or not (extract(isodow from p_booking_date)::smallint = any(cfg.working_days)) then
    raise exception using errcode = 'P0001', message = 'date_unavailable';
  end if;

  v_slot_end := p_slot_start + make_interval(mins => cfg.slot_minutes);
  if p_slot_start < cfg.start_time or v_slot_end > cfg.end_time
     or mod(extract(epoch from (p_slot_start - cfg.start_time))::integer, cfg.slot_minutes * 60) <> 0 then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtext('mewepak-booking'), hashtext(p_booking_date::text || p_slot_start::text));

  select count(*) into v_booked
  from public.appointments
  where booking_date = p_booking_date
    and slot_start = p_slot_start
    and status in ('pending', 'confirmed');

  if v_booked >= cfg.max_per_slot then
    raise exception using errcode = 'P0001', message = 'slot_full';
  end if;

  insert into public.appointments (
    booking_date, slot_start, slot_end, contact_name, company, email, phone, topic, meeting_type
  ) values (
    p_booking_date, p_slot_start, v_slot_end, trim(p_contact_name), trim(p_company),
    lower(trim(p_email)), trim(p_phone), trim(p_topic), p_meeting_type
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_booking(date, time, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_booking(date, time, text, text, text, text, text, text) to service_role;

-- Publicly downloadable assets, admin-only uploads and changes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media', 'site-media', true, 104857600,
  array['image/jpeg','image/png','image/webp','image/avif','model/gltf-binary','application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_media_public_read on storage.objects;
create policy site_media_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'site-media');
drop policy if exists site_media_staff_insert on storage.objects;
create policy site_media_staff_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'site-media' and public.is_staff());
drop policy if exists site_media_staff_update on storage.objects;
create policy site_media_staff_update on storage.objects
  for update to authenticated using (bucket_id = 'site-media' and public.is_staff())
  with check (bucket_id = 'site-media' and public.is_staff());
drop policy if exists site_media_staff_delete on storage.objects;
create policy site_media_staff_delete on storage.objects
  for delete to authenticated using (bucket_id = 'site-media' and public.is_staff());
