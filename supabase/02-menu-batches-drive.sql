-- ============================================================================
-- LabKom — migrasi 02
-- Jalankan setelah schema.sql, atau jalankan pada database lama untuk upgrade.
-- Aman dijalankan berulang kali.
-- ============================================================================

create extension if not exists pgcrypto;

-- Pastikan helper dari schema utama tersedia.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Jika database lama sempat membuat tabel public.batches, pakai tabel itu sebagai
-- public.sales_batches agar nama tabel sama dengan kode aplikasi.
do $$
begin
  if to_regclass('public.sales_batches') is null
     and to_regclass('public.batches') is not null then
    alter table public.batches rename to sales_batches;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1. MENU
-- ----------------------------------------------------------------------------
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  short_description text check (short_description is null or char_length(short_description) <= 240),
  price numeric(12,2) not null check (price >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  category text not null default 'Makanan Utama',
  tag text,
  image_path text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_items add column if not exists short_description text;
alter table public.menu_items add column if not exists cost_price numeric(12,2) not null default 0;
alter table public.menu_items add column if not exists category text not null default 'Makanan Utama';
alter table public.menu_items add column if not exists tag text;
alter table public.menu_items add column if not exists image_path text;
alter table public.menu_items add column if not exists image_url text;
alter table public.menu_items add column if not exists is_active boolean not null default true;
alter table public.menu_items add column if not exists sort_order integer not null default 0;
alter table public.menu_items add column if not exists updated_at timestamptz not null default now();

alter table public.menu_items drop constraint if exists menu_items_cost_price_check;
alter table public.menu_items add constraint menu_items_cost_price_check check (cost_price >= 0);

create unique index if not exists menu_items_name_unique_idx on public.menu_items (lower(trim(name)));
create index if not exists menu_items_active_category_sort_idx on public.menu_items (is_active, category, sort_order, name);

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute procedure public.set_updated_at();

alter table public.menu_items enable row level security;

drop policy if exists "Public reads active menu" on public.menu_items;
create policy "Public reads active menu" on public.menu_items
for select to anon, authenticated using (is_active);

drop policy if exists "Admin manages menu" on public.menu_items;
create policy "Admin manages menu" on public.menu_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. BUCKET FOTO MENU
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 2097152, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists "Public reads menu images" on storage.objects;
create policy "Public reads menu images" on storage.objects
for select to public using (bucket_id = 'menu-images');

drop policy if exists "Admin writes menu images" on storage.objects;
create policy "Admin writes menu images" on storage.objects
for insert to authenticated with check (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "Admin updates menu images" on storage.objects;
create policy "Admin updates menu images" on storage.objects
for update to authenticated using (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "Admin deletes menu images" on storage.objects;
create policy "Admin deletes menu images" on storage.objects
for delete to authenticated using (bucket_id = 'menu-images' and public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. SALES BATCHES
-- ----------------------------------------------------------------------------
create table if not exists public.sales_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text,
  starts_at date not null,
  ends_at date,
  delivery_date date,
  note text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales_batches add column if not exists description text;
alter table public.sales_batches add column if not exists ends_at date;
alter table public.sales_batches add column if not exists delivery_date date;
alter table public.sales_batches add column if not exists note text;
alter table public.sales_batches add column if not exists is_active boolean not null default false;
alter table public.sales_batches add column if not exists updated_at timestamptz not null default now();
alter table public.sales_batches alter column ends_at drop not null;

alter table public.sales_batches drop constraint if exists sales_batches_period_check;
alter table public.sales_batches add constraint sales_batches_period_check
check (ends_at is null or ends_at >= starts_at);

create unique index if not exists sales_batches_name_unique_idx on public.sales_batches (lower(trim(name)));
create index if not exists sales_batches_period_idx on public.sales_batches (starts_at, ends_at);

drop trigger if exists sales_batches_set_updated_at on public.sales_batches;
create trigger sales_batches_set_updated_at
before update on public.sales_batches
for each row execute procedure public.set_updated_at();

alter table public.sales_batches enable row level security;

drop policy if exists "Public reads active sales batches" on public.sales_batches;
create policy "Public reads active sales batches" on public.sales_batches
for select to anon, authenticated using (is_active);

drop policy if exists "Admin manages sales batches" on public.sales_batches;
create policy "Admin manages sales batches" on public.sales_batches
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. ORDERS: batch + metadata bukti bayar
-- ----------------------------------------------------------------------------
alter table public.orders add column if not exists batch_id uuid;
alter table public.orders add column if not exists payment_proof_provider text not null default 'google_drive';
alter table public.orders add column if not exists payment_proof_file_id text;
alter table public.orders add column if not exists payment_proof_url text;
alter table public.orders add column if not exists payment_proof_name text;
alter table public.orders add column if not exists payment_proof_size integer;

alter table public.orders drop constraint if exists orders_batch_id_fkey;
alter table public.orders add constraint orders_batch_id_fkey
foreign key (batch_id) references public.sales_batches(id) on delete set null;

alter table public.orders drop constraint if exists orders_pickup_type_check;
alter table public.orders add constraint orders_pickup_type_check
check (pickup_type is null or pickup_type in ('campus', 'dorm'));

alter table public.orders drop constraint if exists orders_payment_provider_check;
alter table public.orders add constraint orders_payment_provider_check
check (payment_proof_provider in ('google_drive', 'supabase'));

alter table public.orders drop constraint if exists orders_payment_size_check;
alter table public.orders add constraint orders_payment_size_check
check (payment_proof_size is null or payment_proof_size between 1 and 5242880);

alter table public.orders drop constraint if exists orders_verified_consistency_check;
alter table public.orders add constraint orders_verified_consistency_check
check (
  (status = 'verified' and verified_at is not null and verified_by is not null)
  or
  (status <> 'verified')
);

create index if not exists orders_batch_status_created_idx on public.orders (batch_id, status, created_at desc);
create index if not exists orders_client_ref_idx on public.orders (client_ref);

alter table public.order_items add column if not exists menu_item_id uuid;
alter table public.order_items add column if not exists cost_price numeric(12,2) not null default 0;
alter table public.order_items drop constraint if exists order_items_cost_price_check;
alter table public.order_items add constraint order_items_cost_price_check check (cost_price >= 0);
alter table public.order_items drop constraint if exists order_items_menu_item_id_fkey;
alter table public.order_items add constraint order_items_menu_item_id_fkey
foreign key (menu_item_id) references public.menu_items(id) on delete set null;
create index if not exists order_items_menu_item_id_idx on public.order_items (menu_item_id);

update public.order_items oi
set cost_price = coalesce(mi.cost_price, 0)
from public.menu_items mi
where oi.menu_item_id = mi.id
  and coalesce(oi.cost_price, 0) = 0;

-- ----------------------------------------------------------------------------
-- 5. PENENTU BATCH OTOMATIS
-- ----------------------------------------------------------------------------
create or replace function public.resolve_batch_id(ts timestamptz default now())
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from public.sales_batches b
  where b.is_active
    and (ts at time zone 'Asia/Jakarta')::date >= b.starts_at
    and (b.ends_at is null or (ts at time zone 'Asia/Jakarta')::date <= b.ends_at)
  order by b.starts_at desc, b.created_at desc
  limit 1;
$$;

create or replace function public.orders_assign_batch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.batch_id is null then
    new.batch_id := public.resolve_batch_id(coalesce(new.created_at, now()));
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_batch on public.orders;
create trigger orders_assign_batch
before insert on public.orders
for each row execute procedure public.orders_assign_batch();

-- ----------------------------------------------------------------------------
-- 6. SEED DATA
-- ----------------------------------------------------------------------------
insert into public.menu_items (name, short_description, price, cost_price, category, tag, image_url, sort_order)
select * from (values
  ('Paket Pempek + Es Kuwut', 'Pempek + Es Kuwut', 28000::numeric, 18000::numeric, 'Paket', 'Paling Hemat', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=700&q=85', 1),
  ('Pempek', 'Pempek Palembang dengan kuah cuko', 23000::numeric, 15000::numeric, 'Makanan Utama', null, 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?auto=format&fit=crop&w=700&q=85', 2),
  ('Es Kuwut', 'Minuman segar dengan jeruk & selasih', 7000::numeric, 4000::numeric, 'Minuman', null, 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=700&q=85', 3),
  ('Mie Goreng Spesial', 'Mie dengan topping telur dan sayuran', 13000::numeric, 8000::numeric, 'Makanan Utama', null, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=700&q=85', 4),
  ('Chicken Katsu', 'Ayam krispi dengan saus pilihan', 18000::numeric, 12000::numeric, 'Makanan Utama', null, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=700&q=85', 5),
  ('Pisang Coklat', 'Camilan manis, renyah di luar', 10000::numeric, 6000::numeric, 'Snack', null, 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=700&q=85', 6)
) as seed(name, short_description, price, cost_price, category, tag, image_url, sort_order)
where not exists (select 1 from public.menu_items);

insert into public.sales_batches (name, starts_at, ends_at, delivery_date, note, description, is_active)
select 'Batch 1 — ' || to_char(date_trunc('month', now() at time zone 'Asia/Jakarta'), 'Mon YYYY'),
       (date_trunc('month', now() at time zone 'Asia/Jakarta'))::date,
       (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month - 1 day')::date,
       (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month - 1 day')::date,
       'Batch contoh. Silakan ubah atau hapus dari dashboard.',
       'Batch contoh. Silakan ubah atau hapus dari dashboard.',
       false
where not exists (select 1 from public.sales_batches);
