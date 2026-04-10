-- ============================================================
-- UdNu Migration v2 — Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add guest contact fields to bookings
alter table bookings add column if not exists guest_first_name text check (char_length(guest_first_name) <= 100);
alter table bookings add column if not exists guest_last_name  text check (char_length(guest_last_name)  <= 100);
alter table bookings add column if not exists guest_email      text check (char_length(guest_email)      <= 200);
alter table bookings add column if not exists guest_address    text check (char_length(guest_address)    <= 300);
alter table bookings add column if not exists guest_phone      text check (char_length(guest_phone)      <= 50);

-- 2. Extend status to include 'pending'
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add  constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'cancelled'));

-- 3. New bookings start as pending
alter table bookings alter column status set default 'pending';

-- 4. Allow host to approve/reject (update to any status)
drop policy if exists "bookings_parties_update" on bookings;
create policy "bookings_parties_update" on bookings
  for update using (
    guest_id = auth.uid()
    or listing_id in (select id from listings where host_id = auth.uid())
  );

-- 5. Allow host to delete their own listing
drop policy if exists "listings_host_delete" on listings;
create policy "listings_host_delete" on listings
  for delete using (host_id = auth.uid());

-- Done!
