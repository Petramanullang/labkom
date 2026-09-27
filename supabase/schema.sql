-- LabKom Supabase schema
-- Jalankan untuk instalasi baru.

create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('admin', 'staff');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_status as enum ('pending', 'verified', 'rejected');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table if not exists public.sales_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 240),
  starts_at date not null,
  ends_at date,
  delivery_date date,
  note text check (note is null or char_length(note) <= 500),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_batches_period_check check (ends_at is null or ends_at >= starts_at)
);

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

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  client_ref uuid not null unique,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  whatsapp text not null check (whatsapp ~ '^[0-9+]{8,30}$'),
  pickup_type text check (pickup_type is null or pickup_type in ('campus', 'dorm')),
  pickup_address text not null,
  menu_summary text not null,
  quantity integer not null check (quantity > 0),
  total_amount numeric(12,2) not null check (total_amount > 0),
  payment_proof_path text,
  payment_proof_provider text not null default 'google_drive' check (payment_proof_provider in ('google_drive', 'supabase')),
  payment_proof_file_id text,
  payment_proof_url text,
  payment_proof_name text,
  payment_proof_size integer check (payment_proof_size is null or payment_proof_size between 1 and 5242880),
  status public.order_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  batch_id uuid references public.sales_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_verified_consistency_check check (
    (status = 'verified' and verified_at is not null and verified_by is not null)
    or
    (status <> 'verified')
  )
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id integer,
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  quantity integer not null check (quantity > 0),
  menu_item_id uuid references public.menu_items(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists menu_items_name_unique_idx on public.menu_items (lower(trim(name)));
create unique index if not exists sales_batches_name_unique_idx on public.sales_batches (lower(trim(name)));
create index if not exists menu_items_active_category_sort_idx on public.menu_items (is_active, category, sort_order, name);
create index if not exists sales_batches_period_idx on public.sales_batches (starts_at, ends_at);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_created_at_idx on public.orders (status, created_at desc);
create index if not exists orders_batch_status_created_idx on public.orders (batch_id, status, created_at desc);
create index if not exists orders_client_ref_idx on public.orders (client_ref);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_menu_item_id_idx on public.order_items (menu_item_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

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

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute procedure public.set_updated_at();

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute procedure public.set_updated_at();

drop trigger if exists sales_batches_set_updated_at on public.sales_batches;
create trigger sales_batches_set_updated_at
before update on public.sales_batches
for each row execute procedure public.set_updated_at();

drop trigger if exists orders_assign_batch on public.orders;
create trigger orders_assign_batch
before insert on public.orders
for each row execute procedure public.orders_assign_batch();

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.menu_items enable row level security;
alter table public.sales_batches enable row level security;

drop policy if exists "Admin reads profiles" on public.profiles;
create policy "Admin reads profiles" on public.profiles
for select to authenticated using (public.is_admin());

drop policy if exists "Admin reads orders" on public.orders;
create policy "Admin reads orders" on public.orders
for select to authenticated using (public.is_admin());

drop policy if exists "Admin updates orders" on public.orders;
create policy "Admin updates orders" on public.orders
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin deletes orders" on public.orders;
create policy "Admin deletes orders" on public.orders
for delete to authenticated using (public.is_admin());

drop policy if exists "Admin reads items" on public.order_items;
create policy "Admin reads items" on public.order_items
for select to authenticated using (public.is_admin());

drop policy if exists "Public reads active menu" on public.menu_items;
create policy "Public reads active menu" on public.menu_items
for select to anon, authenticated using (is_active);

drop policy if exists "Admin manages menu" on public.menu_items;
create policy "Admin manages menu" on public.menu_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public reads active sales batches" on public.sales_batches;
create policy "Public reads active sales batches" on public.sales_batches
for select to anon, authenticated using (is_active);

drop policy if exists "Admin manages sales batches" on public.sales_batches;
create policy "Admin manages sales batches" on public.sales_batches
for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

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

-- Buat user dari Authentication > Users, lalu jadikan admin:
-- insert into public.profiles(id, full_name, role)
-- values ('UUID_USER_ADMIN', 'Nama Admin', 'admin')
-- on conflict(id) do update set role = 'admin';
