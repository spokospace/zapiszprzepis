# Voice Search — Krótki plan

> Pełny plan: `context/changes/voice-search/plan.md`

## Co i dlaczego

Dodajemy ikonę mikrofonu do pola wyszukiwania przepisów. Użytkownicy (zwłaszcza starsi, obsługujący aplikację na mobile) mogą powiedzieć nazwę przepisu zamiast go wpisywać — rozpoznana fraza trafia do Exa i wyniki pojawiają się automatycznie.

## Punkt wyjścia

`AddRecipeForm` ma już tab "Wyszukaj przepis" z wyszukiwaniem przez Exa. Input ma ikonę Search po lewej — prawa strona jest wolna. `SpeechRecognition` (Web Speech API) dostępne w Chrome i Safari, nieobecne w Firefox.

## Pożądany stan końcowy

Użytkownik widzi ikonę mikrofonu w polu wyszukiwania. Jedno tapnięcie → przeglądarka prosi o mikrofon → rozpoznaje mowę po polsku → wyniki Exa pojawiają się bez dodatkowego kliknięcia. W Firefoksie ikona jest niewidoczna (graceful degradation).

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) |
|---------|-------|---------------------|
| Zachowanie po STT | Auto-submit | Jeden krok dla użytkownika, naturalne mobile UX |
| Pozycja mic | Wewnątrz inputa, prawa strona | Czysty, znany wzorzec (jak Google Search) |
| Obsługa błędów | Czerwony komunikat | Spójny z istniejącą obsługą błędów Exa |
| Nieobsługiwane przeglądarki | Ukryj przycisk | Graceful degradation, brak mylącego UI |

## Zakres

**W zakresie:** Mic button w search tabie, Web Speech API, auto-submit do Exa, błąd przy braku uprawnień, ukrycie w Firefoksie.

**Poza zakresem:** Interim results, wake-word, animacje waveform, zmiany backendu.

## Architektura / Podejście

Czysto kliencka zmiana w jednym pliku. `startVoiceSearch()` wywołuje `SpeechRecognition`, na wynik bezpośrednio wywołuje `searchViaExa(transcript)` (pomijając formularz). Dwa nowe stany: `'recording'` i `'mic_error'`.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|------|-------------|-----------------|
| 1. Mic button + voice recognition | Działający voice search w Chrome/Safari | SSR crash jeśli `window` sprawdzone poza guardem |

**Wymagania wstępne:** Brak (Web Speech API wbudowane w przeglądarkę, nie wymaga kluczy API).
**Szacowany nakład pracy:** ~1 sesja, ~30 linii kodu.

## Otwarte ryzyka i założenia

- Safari iOS wymaga `webkitSpeechRecognition` (prefix) — obsłużone przez `window.SpeechRecognition || window.webkitSpeechRecognition`.
- Rozpoznawanie jakości polskiego STT zależy od przeglądarki/systemu — brak kontroli po stronie aplikacji.

## Kryteria sukcesu (podsumowanie)

- Kliknięcie mic w Chrome → wyniki Exa bez ręcznego wpisywania.
- Odmowa mikrofonu → czytelny komunikat po polsku.
- Firefox / nieobsługiwane przeglądarki → brak przycisku mic, wyszukiwanie tekstowe bez regresji.
