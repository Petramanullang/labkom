-- ============================================================================
-- LabKom - migrasi 03
-- Menambahkan Harga Beli/HPP untuk perhitungan Estimasi Bersih.
-- Aman dijalankan berulang kali.
-- ============================================================================

alter table public.menu_items
add column if not exists cost_price numeric(12,2) not null default 0;

alter table public.menu_items drop constraint if exists menu_items_cost_price_check;
alter table public.menu_items
add constraint menu_items_cost_price_check check (cost_price >= 0);

alter table public.order_items
add column if not exists cost_price numeric(12,2) not null default 0;

alter table public.order_items drop constraint if exists order_items_cost_price_check;
alter table public.order_items
add constraint order_items_cost_price_check check (cost_price >= 0);

-- Isi HPP item lama dari menu saat ini bila HPP item masih 0.
-- Jalankan ulang bagian update ini setelah semua Harga Beli menu diisi bila ingin laporan order lama ikut terhitung.
update public.order_items oi
set cost_price = coalesce(mi.cost_price, 0)
from public.menu_items mi
where oi.menu_item_id = mi.id
  and coalesce(oi.cost_price, 0) = 0;
