-- ============================================================
-- UdNu Booking System — Run this in Supabase SQL Editor
-- ============================================================

-- 1. Enable required extension
create extension if not exists btree_gist;

-- 2. Listings table
create table if not exists listings (
  id             uuid primary key default gen_random_uuid(),
  host_id        uuid not null,
  title          text not null check (char_length(title) between 3 and 200),
  description    text check (char_length(description) <= 2000),
  city           text not null,
  address        text,
  price_per_night numeric(10,2) not null check (price_per_night > 0),
  max_guests     int not null default 2 check (max_guests between 1 and 20),
  amenities      text[] default '{}',
  image_url      text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- 3. Bookings table
create table if not exists bookings (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references listings(id) on delete restrict,
  guest_id     uuid not null,
  check_in     date not null,
  check_out    date not null,
  guests       int not null default 1 check (guests >= 1),
  status       text not null default 'confirmed'
                 check (status in ('confirmed', 'cancelled')),
  total_price  numeric(10,2) not null check (total_price >= 0),
  message      text check (char_length(message) <= 500),
  created_at   timestamptz not null default now(),
  constraint valid_dates check (check_out > check_in)
);

-- 4. THE CRITICAL CONSTRAINT — makes double-booking physically impossible
--    Even with 1000 concurrent requests, only one wins.
do $$ begin
  alter table bookings add constraint no_overlap
    exclude using gist (
      listing_id with =,
      daterange(check_in, check_out, '[)') with &&
    )
    where (status = 'confirmed');
exception when duplicate_object then null; end $$;

-- 5. Indexes for query performance
create index if not exists idx_bookings_listing_status on bookings(listing_id, status);
create index if not exists idx_bookings_guest       on bookings(guest_id);
create index if not exists idx_listings_host        on listings(host_id);
create index if not exists idx_listings_city_active on listings(city, active);

-- 6. Row Level Security
alter table listings enable row level security;
alter table bookings  enable row level security;

-- Drop existing policies to allow re-running this file
drop policy if exists "listings_public_select"  on listings;
drop policy if exists "listings_host_insert"    on listings;
drop policy if exists "listings_host_update"    on listings;
drop policy if exists "bookings_parties_select" on bookings;
drop policy if exists "bookings_guest_insert"   on bookings;
drop policy if exists "bookings_parties_update" on bookings;

-- LISTINGS: anyone can browse active listings, only host can write
create policy "listings_public_select" on listings
  for select using (active = true);

create policy "listings_host_insert" on listings
  for insert with check (host_id = auth.uid());

create policy "listings_host_update" on listings
  for update using (host_id = auth.uid());

-- BOOKINGS: only the guest and the host of the listing can see a booking
create policy "bookings_parties_select" on bookings
  for select using (
    guest_id = auth.uid()
    or listing_id in (select id from listings where host_id = auth.uid())
  );

create policy "bookings_guest_insert" on bookings
  for insert with check (guest_id = auth.uid());

-- Only the guest can cancel their own booking
create policy "bookings_parties_update" on bookings
  for update using (
    guest_id = auth.uid()
    or listing_id in (select id from listings where host_id = auth.uid())
  )
  with check (status = 'cancelled');

-- 7. Helper function — returns booked ranges without exposing guest info
--    security definer bypasses RLS so availability is always visible
create or replace function get_unavailable_dates(p_listing_id uuid)
returns table(check_in date, check_out date)
language sql security definer as $$
  select check_in, check_out
  from bookings
  where listing_id = p_listing_id
    and status = 'confirmed';
$$;

-- Done! Test with:
-- insert into listings (host_id, title, city, price_per_night) values (auth.uid(), 'Test', 'københavn', 500);
