# Usage analytics

First-party, cookieless, anonymous counters. Design and privacy reasoning:
[`.ai/specs/2026-10-30-first-party-usage-analytics.md`](../.ai/specs/2026-10-30-first-party-usage-analytics.md).

## What is collected

Only daily aggregates in `public.usage_counters(day, event, subject, count)`:

| `event` | `subject` |
| --- | --- |
| `recipe_view` | recipe slug |
| `category_view` | category key (the `recipe_category` value, e.g. `zupy`) |
| `timer_start`, `print`, `favorite_add` | recipe slug |

`day` is the Warsaw calendar day, computed in the database. No IP, user agent, user id or finer timestamp is stored. Numbers are
counts of views, **not unique visitors**. The browser posts events to `POST /api/e`, which calls `usage_count()` with the service role.
The table has RLS on and no policy; only `service_role` can touch it.

## Enabling

On since 2026-11-02, after the owner approved the privacy-policy wording (section 6). `NEXT_PUBLIC_USAGE_ANALYTICS=1` is a build-time
`NEXT_PUBLIC_` variable, so it lives in two places that must agree: the Worker's **build** variables (dashboard → Settings → Build →
Variables and secrets), which the browser beacon and the bundled server code read, and `vars` in `wrangler.jsonc`. To switch it off,
set both to `0`, let the `master` build run, then `pnpm smoke:prod`. Days before the switch stay empty.

## Where to look

- Admin panel: `/admin/statystyki` (staff permission `analytics.read`, admin role). Shows the last 7 and 30 days.
- SQL, below. Run it in the Supabase SQL editor or through the Management API (send the SQL as a UTF-8 file on stdin).

Replace `7` with `30` for the longer window. The window is `day >= today - (N - 1)` in Warsaw time.

### Top categories (with published recipe count)

```sql
select c.subject as category, c.views, coalesce(r.recipes, 0) as recipes
from (
  select subject, sum(count) as views
  from public.usage_counters
  where event = 'category_view'
    and day >= (now() at time zone 'Europe/Warsaw')::date - (7 - 1)
  group by subject
) c
left join (
  select category::text as subject, count(*) as recipes
  from public.public_recipes
  group by category
) r using (subject)
order by c.views desc, c.subject;
```

### Top recipes (joined to `recipes`)

```sql
select r.slug, r.title, sum(u.count) as views
from public.usage_counters u
join public.recipes r on r.slug = u.subject
where u.event = 'recipe_view'
  and u.day >= (now() at time zone 'Europe/Warsaw')::date - (7 - 1)
group by r.slug, r.title
order by views desc, r.slug
limit 20;
```

Slugs that no longer match a recipe (renamed, deleted) are the orphans:

```sql
select sum(u.count) as orphan_views
from public.usage_counters u
where u.event = 'recipe_view'
  and u.day >= (now() at time zone 'Europe/Warsaw')::date - (7 - 1)
  and not exists (select 1 from public.recipes r where r.slug = u.subject);
```

The admin page uses `public.public_recipes` instead of `recipes`, so hidden recipes count as orphans there.

### Feature use

```sql
select event, sum(count) as total
from public.usage_counters
where event in ('timer_start', 'print', 'favorite_add')
  and day >= (now() at time zone 'Europe/Warsaw')::date - (7 - 1)
group by event
order by event;
```

### Per day (is it collecting at all?)

```sql
select day, event, sum(count) as total
from public.usage_counters
group by day, event
order by day desc, event
limit 60;
```

## CPU measurement (spec step 5b)

_To be filled in by the owner after enabling the flag._

- Date and build measured:
- Worker CPU time per request before enabling (p50 / p99):
- Worker CPU time per request after enabling (p50 / p99):
- `/api/e` requests per day:
- Verdict (keep on / lower sampling / turn off):
