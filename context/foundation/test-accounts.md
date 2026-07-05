# Test accounts

Accounts created on the production Supabase database, intended for manual testing and documentation.

## test@zapiszprzepis.pl

| Field     | Value                     |
|-----------|---------------------------|
| E-mail    | test@zapiszprzepis.pl     |
| Password  | TestZapisz123!            |
| Status    | confirmed (`email_confirmed_at` set at creation) |
| Supabase user ID | 7551c3cb-5697-4f4f-890e-bcda0f88d6d4 |
| Created   | 2026-07-05                |

### Purpose

- Manual flow testing (login, adding recipes, voice search)
- Screenshots and recordings for documentation
- Regression checks after deploys

### Notes

- This account targets the **production** Supabase — recipes added during testing will appear in the real database.
- Before recordings or screenshots, clear the recipe list or use a dedicated set of test recipes.
