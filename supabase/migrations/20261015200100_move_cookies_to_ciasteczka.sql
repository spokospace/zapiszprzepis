-- Cookies were filed under "desery" (or wherever the extractor guessed) before
-- the category existed. Move the recipes whose title names a cookie. Muffins
-- and cakes ("babeczki", "ciasto") stay where they are.
update public.recipes
set category = 'ciasteczka'
where category <> 'ciasteczka'
  and title ~* '(ciasteczk|ciastka|herbatnik|pierniczk|makaronik|cookie)';
