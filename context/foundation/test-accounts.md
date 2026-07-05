# Test accounts

Konta stworzone na produkcyjnej bazie Supabase, przeznaczone do testów manualnych i dokumentacji.

## test@zapiszprzepis.pl

| Pole     | Wartość                   |
|----------|---------------------------|
| E-mail   | test@zapiszprzepis.pl     |
| Hasło    | TestZapisz123!            |
| Status   | potwierdzony (email_confirmed_at ustawiony przy tworzeniu) |
| Supabase user ID | 7551c3cb-5697-4f4f-890e-bcda0f88d6d4 |
| Utworzone | 2026-07-05                |

### Przeznaczenie

- Testy manualne flows (logowanie, dodawanie przepisów, wyszukiwanie głosem)
- Screenshoty i nagrania do dokumentacji
- Weryfikacja regresji po deployach

### Uwagi

- Konto na **produkcyjnym** Supabase — przepisy dodane podczas testów będą widoczne w prawdziwej bazie.
- Przed nagraniami/screenami wyczyść listę przepisów lub użyj dedykowanego zestawu testowych przepisów.
