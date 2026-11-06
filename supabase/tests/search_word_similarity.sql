-- What search must and must not match (20261106120000_search_word_similarity.sql).
-- Reads nothing and writes nothing, so it is safe on production. Raises on the first failure.
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('pierogów', 'Pierogi ruskie', true),
      ('pieróg', 'Pierogi ruskie', true),
      ('szarlotki', 'Szarlotka', true),
      ('zupy', 'Zupa krem', true),
      ('twarogu', 'Twaróg półtłusty', true),
      ('kielbasa', 'Kiełbasa śląska', true),
      ('sernk', 'Sernik', true),
      ('ser', 'Seler naciowy', false),
      ('dyni', 'Ciasto z budyniem', false)
    ) as t(word, recipe, expected)
  loop
    if public.recipe_search_matches(
         array[public.recipe_search_fold(c.word)],
         public.recipe_search_fold(c.recipe)
       ) is distinct from c.expected then
      raise exception 'FAIL: „%” against „%” should be %', c.word, c.recipe, c.expected;
    end if;
  end loop;

  if public.recipe_search_rank(array['mak'], 'rogaliki z makiem')
     <= public.recipe_search_rank(array['mak'], 'placki z mąki') then
    raise exception 'FAIL: „mak” should rank poppy seed above „mąka”';
  end if;
end
$$;
