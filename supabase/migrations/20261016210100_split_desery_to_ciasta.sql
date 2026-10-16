-- Move baked cakes from "desery" to "ciasta". Classification is by judgement,
-- not a title pattern: many Polish layer cakes have proper names without the
-- word "ciasto"/"tort" (e.g. "Marysieńka", "Królewiec", "Słonecznikowiec"), so
-- a regex would mis-sort them. The move is expressed as "everything in desery
-- except the non-cake desserts" — ice cream, doughnuts (pączki), choux
-- (ptysie), tiramisu, creams, jellies, yeast pastries (drożdżówki, rogaliki),
-- waffles and no-bake candy — which are kept, listed by id. Single-environment
-- project (prod), so ids are stable.
update public.recipes
set category = 'ciasta'
where category = 'desery'
  and id not in (
    21, 24, 25, 34, 36, 54, 55, 56, 68, 79, 89, 102, 138, 158, 173, 183,
    187, 204, 213, 218, 265, 281, 316, 318, 398
  );
