-- Onyx Paper Trade — database schema
-- Run this in the Supabase SQL editor after creating a new project.

-- 1. Profiles table (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  balance numeric(14, 4) not null default 1000.00,
  created_at timestamptz default now()
);

-- Trigger: auto-create a profile row + seed $1000 balance when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Orders table — one row per paper fill.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null,
  market_name text,
  side text not null check (side in ('YES', 'NO')),
  quantity integer not null check (quantity > 0),
  fill_price numeric(8, 6) not null,
  total_cost numeric(14, 4) not null,
  created_at timestamptz default now()
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);

-- 3. Positions table — aggregated holdings (one row per user+symbol+side).
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null,
  market_name text,
  side text not null check (side in ('YES', 'NO')),
  quantity integer not null default 0,
  avg_price numeric(8, 6) not null,
  updated_at timestamptz default now(),
  unique (user_id, symbol, side)
);

create index if not exists positions_user_idx on public.positions (user_id);

-- 4. Row Level Security
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.positions enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "orders self read" on public.orders;
create policy "orders self read" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "orders self insert" on public.orders;
create policy "orders self insert" on public.orders
  for insert with check (auth.uid() = user_id);

drop policy if exists "positions self read" on public.positions;
create policy "positions self read" on public.positions
  for select using (auth.uid() = user_id);

drop policy if exists "positions self upsert" on public.positions;
create policy "positions self upsert" on public.positions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Atomic order placement RPC.
-- Wraps balance check, balance debit, order insert, and position upsert in a single transaction.
create or replace function public.place_paper_order(
  p_symbol text,
  p_market_name text,
  p_side text,
  p_quantity integer,
  p_fill_price numeric
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_total numeric;
  v_balance numeric;
  v_order_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_side not in ('YES', 'NO') then
    raise exception 'side must be YES or NO';
  end if;
  if p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;
  if p_fill_price <= 0 or p_fill_price >= 1 then
    raise exception 'fill_price out of range';
  end if;

  v_total := round(p_fill_price * p_quantity, 4);

  select balance into v_balance from public.profiles where id = v_user for update;
  if v_balance < v_total then
    raise exception 'insufficient balance' using errcode = 'P0001';
  end if;

  update public.profiles set balance = balance - v_total where id = v_user;

  insert into public.orders (user_id, symbol, market_name, side, quantity, fill_price, total_cost)
  values (v_user, p_symbol, p_market_name, p_side, p_quantity, p_fill_price, v_total)
  returning id into v_order_id;

  insert into public.positions (user_id, symbol, market_name, side, quantity, avg_price)
  values (v_user, p_symbol, p_market_name, p_side, p_quantity, p_fill_price)
  on conflict (user_id, symbol, side) do update
    set quantity = positions.quantity + excluded.quantity,
        avg_price = ((positions.avg_price * positions.quantity) + (excluded.avg_price * excluded.quantity))
                    / (positions.quantity + excluded.quantity),
        market_name = coalesce(excluded.market_name, positions.market_name),
        updated_at = now();

  return json_build_object('order_id', v_order_id, 'total_cost', v_total);
end;
$$;

grant execute on function public.place_paper_order(text, text, text, integer, numeric) to authenticated;
