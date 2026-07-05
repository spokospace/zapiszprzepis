# Voice Search Plan implementacji

## Przegląd

Dodajemy ikonę mikrofonu do taba "Wyszukaj przepis" w `AddRecipeForm`. Kliknięcie uruchamia Web Speech API — przeglądarka prosi o uprawnienia, rozpoznaje mowę po polsku, a rozpoznany tekst natychmiast wyzwala wyszukiwanie przez Exa. Zmiana dotyczy wyłącznie jednego komponentu klienckiego.

## Analiza stanu obecnego

`AddRecipeForm` (`src/app/components/add-recipe-form.tsx`) obsługuje dwa taby: `'search'` (Exa) i `'add'` (URL). Stan formularza: `SearchState = 'idle' | 'loading' | 'searching' | 'results' | 'error'`. Input w tabie search ma ikonę `Search` po lewej (absolutna pozycja, `pl-9`). Po prawej stronie inputa jest miejsce — brak ikon, brak paddingu. Import lucide-react: `Link, Search, X` — brak `Mic`.

Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) dostępne w Chrome i Safari, niedostępne w Firefox.

## Pożądany stan końcowy

User w tabie "Wyszukaj przepis" widzi ikonę mikrofonu w prawym rogu inputa. Kliknięcie: przeglądarka pyta o uprawnienia → po akceptacji rozpoznaje mowę → wyniki Exa pojawiają się automatycznie. Przy odmowie uprawnień lub błędzie STT — krótki czerwony komunikat. W Firefoksie ikona nie jest widoczna (graceful degradation).

### Kluczowe odkrycia

- `searchViaExa` można wywołać bezpośrednio z rozpoznanym tekstem — pomijamy `handleSubmit` i `FormData`, co upraszcza auto-submit.
- `Mic` to dostępna ikona w `lucide-react` (ta sama biblioteka co istniejące ikony).
- Input ma `pl-9` dla lewej ikony; `pr-9` wystarczy dla prawej ikony mikrofonu.
- `busy` guard (`searchState === 'loading' || 'searching'`) powinien objąć też `'recording'`.

## Czego NIE robimy

- Nie dodajemy podglądu rozpoznawanego tekstu w czasie rzeczywistym (`interimResults: false`).
- Nie dodajemy wake-word / ciągłego nasłuchiwania — jednorazowe naciśnięcie przycisku.
- Nie zmieniamy backendu, env vars, schematu ani `search-via-exa-action.ts`.
- Nie dodajemy animacji pulsowania / waveform — zwykła zmiana koloru ikony wystarczy.

## Podejście do implementacji

Dodajemy dwa nowe stany do `SearchState`, stałą `isSpeechSupported` i funkcję `startVoiceSearch`. Mikrofon jest absolutnie pozycjonowany w prawym rogu inputa. Na wynik STT wywołujemy `searchViaExa` bezpośrednio, pomijając formularz.

## Krytyczne szczegóły implementacji

- `window.SpeechRecognition` nie istnieje podczas SSR — sprawdzenie musi być wewnątrz `'use client'` komponentu, ale i tak w `useState` initializerze lub `useEffect`, żeby nie crashowało na serwerze. Bezpieczna forma: `typeof window !== 'undefined' && !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition)`.
- `recognition.lang = 'pl-PL'` — bez tego Chrome używa języka przeglądarki, który może być angielski.
- Import `Mic` z `lucide-react` i pierwsze użycie muszą być w jednym Edit (global rules: imports + first usage in one Edit).

---

## Faza 1: Mic button + voice recognition

### Przegląd

Rozszerzamy `AddRecipeForm` o przycisk mikrofonu i logikę Web Speech API. Wszystkie zmiany w jednym pliku.

### Wymagane zmiany

#### 1. `src/app/components/add-recipe-form.tsx`

**Plik**: `src/app/components/add-recipe-form.tsx`

**Cel**: Dodać ikonę mikrofonu do inputa search taba; po rozpoznaniu mowy bezpośrednio wywołać `searchViaExa` i zaktualizować stan formularza.

**Kontrakt**:

- `SearchState` rozszerzony o `'recording'` i `'mic_error'`.
- `isSpeechSupported: boolean` — computed via `typeof window !== 'undefined' && !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition)`. Determinuje czy przycisk mic się renderuje.
- `busy` constant obejmuje nowe stany: `searchState === 'loading' || searchState === 'searching' || searchState === 'recording'`.
- `startVoiceSearch()` — funkcja tworząca `SpeechRecognition` z `lang: 'pl-PL'`, `interimResults: false`, `maxAlternatives: 1`. Wywołuje `setSearchState('recording')` i `recognition.start()`. Handlery:
  - `onresult`: wyciąga `transcript = event.results[0][0].transcript`, wywołuje `setSearchState('searching')` + `searchViaExa(transcript)` (ten sam pattern co w `handleSubmit`), ustawia `setExaResults` i `setSearchState('results'/'error')`.
  - `onerror`: `setSearchState('mic_error')`.
  - `onend`: jeśli `searchState` nadal `'recording'`, reset do `'idle'`.
- Przycisk mic: `<button type="button">` z `<Mic>` icon, absolutna pozycja `right-3 top-1/2 -translate-y-1/2`, widoczny tylko gdy `isSpeechSupported && activeTab === 'search'`. Podczas `'recording'`: kolor `text-orange-500` (vs normalny `text-gray-400`). `onClick: startVoiceSearch`, `disabled: busy`.
- Input className: gdy `activeTab === 'search' && isSpeechSupported`, dodaj `pr-9` (obok istniejącego `pl-9`).
- Komunikat błędu mic: gdy `searchState === 'mic_error'`, renderuj `<p role="alert" className="mt-1.5 text-sm text-red-600">Brak dostępu do mikrofonu — wpisz ręcznie.</p>` — identyczny styl jak błąd Exa w linii 188–192.
- Import `Mic` from `lucide-react` w tym samym Edit co pierwsze użycie (per global rule).

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `pnpm typecheck` przechodzi — nowe stany i typy poprawnie wytypowane.
- `pnpm lint` przechodzi — `Mic` zaimportowany i użyty w tym samym Edit.

#### Weryfikacja ręczna

- Chrome / Edge: ikona Mic widoczna w tabie "Wyszukaj przepis", niewidoczna w "Dodaj przez link".
- Kliknięcie mic → przeglądarka prosi o uprawnienia → po "Zezwól" → nasłuchiwanie → wyniki Exa pojawiają się automatycznie.
- Odmowa uprawnień → czerwony komunikat "Brak dostępu do mikrofonu — wpisz ręcznie."
- Firefox: brak ikony mic (graceful degradation), wyszukiwanie tekstowe działa normalnie.
- Tab "Dodaj przez link" — URL flow bez regresji.
- Wyszukiwanie tekstowe (bez głosu) — bez regresji.

---

## Strategia testowania

### Testy ręczne

1. Chrome mobile (Android/iOS) — mic + Exa flow end-to-end.
2. Safari iOS — `webkitSpeechRecognition`, Exa flow end-to-end.
3. Firefox — brak przycisku mic; wyszukiwanie tekstowe działa.
4. Odmowa mikrofonu w Chrome — czerwony komunikat.
5. URL wklejony w "Dodaj przez link" — brak regresji.

## Uwagi dotyczące migracji

Brak — zmiana czysto addytywna, zero modyfikacji schematu lub serwera.

## Referencje

- Komponent: `src/app/components/add-recipe-form.tsx`
- Server action: `src/app/(authenticated)/recipes/search-via-exa-action.ts`

---

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany.

### Faza 1: Mic button + voice recognition

#### Automatyczne

- [x] 1.1 `pnpm typecheck` przechodzi
- [x] 1.2 `pnpm lint` przechodzi

#### Ręczne

- [ ] 1.3 Chrome: mic widoczny w search tabie, klik → Exa wyniki
- [ ] 1.4 Odmowa uprawnień → czerwony komunikat
- [ ] 1.5 Firefox: brak przycisku mic, wyszukiwanie tekstowe działa
- [ ] 1.6 Brak regresji w URL flow i wyszukiwaniu tekstowym
