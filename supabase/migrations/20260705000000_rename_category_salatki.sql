alter type public.recipe_category rename value 'wegetarianskie' to 'salatki';
update public.recipes set category = 'salatki' where category = 'wegetarianskie';
