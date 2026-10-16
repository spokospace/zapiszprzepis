-- Move existing recipes into the two new categories, and fix a few strays the
-- category audit found. Title-based like the cookies move
-- (20261015200100_move_cookies_to_ciasteczka): the project runs against one
-- environment (prod), so these touch the live rows directly.

-- Bread & rolls: chleb, bułki/bułeczki, kajzerki, langosze, pizza-style bread
-- sticks (paluchy). Exclude dishes that merely name bread without being bread
-- themselves ("Schab do chleba", "Chleb w jajku z żółtym serem").
update public.recipes
set category = 'pieczywo'
where category <> 'pieczywo'
  and title ~* '(chleb|bułk|bułeczk|kajzerk|langosz|paluch)'
  and title !~* '(w jajku|schab)';

-- Homemade syrups, tinctures and herbal remedies made for health — not
-- everyday drinks (lemoniada, herbata, soki, kompoty), which stay 'napoje'.
update public.recipes
set category = 'syropy'
where category <> 'syropy'
  and title ~* '(syrop|na zdrowie|gojnik|na odchudzanie|na zatoki)';

-- Strays the audit flagged: raw-veg salads (surówki/sałatki) filed under
-- "inne", and sweet semolina pancakes (racuchy) filed under "obiady".
update public.recipes
set category = 'salatki'
where category = 'inne'
  and title ~* '(surówk|sałatk)';

update public.recipes
set category = 'sniadania'
where category = 'obiady'
  and title ~* 'racuchy';
