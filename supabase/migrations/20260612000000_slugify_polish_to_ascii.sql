-- Backfill existing slugs that still contain Polish diacritics into the
-- ASCII-only form produced by src/lib/slugify.ts (ł→l, ą→a, ć→c, …).
-- Keep both SQL and TS slugifiers in sync if either changes.
update public.recipes
   set slug = translate(slug, 'ąćęłńóśźż', 'acelnoszz')
 where slug ~ '[ąćęłńóśźż]';
