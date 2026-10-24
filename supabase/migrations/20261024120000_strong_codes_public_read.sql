-- Lecture publique de la table strong_codes (page « Code Strong »)
alter table public.strong_codes enable row level security;

drop policy if exists "strong_codes_public_read" on public.strong_codes;
create policy "strong_codes_public_read"
  on public.strong_codes
  for select
  to anon, authenticated
  using (true);
