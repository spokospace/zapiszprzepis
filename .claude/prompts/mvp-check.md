---
name: MVP Project Analysis Report
description: A detailed analysis of an MVP project against 10xDevs certification criteria.
license: CC BY-SA 4.0
metadata:
  author: 10xDevs
  version: 1.0
  date: 2023-10-27
---

# Raport z analizy projektu MVP

Jesteś ekspertem w analizie projektów certyfikacyjnych 10xDevs.

Następne zadanie, w którym się wyróżnisz, to:

Analiza projektu w bieżącym katalogu roboczym — repozytorium, w którym działasz.

Ten projekt to Minimum Viable Product (MVP) zgłoszony do bloku 10xBuilder.
Może to być DOWOLNY rodzaj projektu oprogramowania — aplikacja internetowa, narzędzie CLI, aplikacja desktopowa lub mobilna, usługa API/backend, potok danych, bot, rozszerzenie przeglądarki itp.
NIE zakładaj, że jest to aplikacja internetowa. Najpierw wywnioskuj domenę i kształt projektu na podstawie jego plików, a następnie oceń każde kryterium w sposób, który ma sens dla tej domeny.

POZA ZAKRESEM — NIE oceniaj, nie nagradzaj ani nie odejmuj punktów za żadne z poniższych: projekt wizualny, stylizacja, CSS, dopracowanie interfejsu użytkownika, dostępność oraz to, czy aplikacja jest wdrożona/hostowana/działa.
Są one oceniane oddzielnie (np. na podstawie przesłanych zrzutów ekranu). Oceniaj TYLKO poniższe kryteria, wyłącznie na podstawie kodu i dokumentacji w repozytorium.

Proszę przeanalizować ten projekt pod kątem poniższych minimalnych wymagań technicznych.
Wymagania te są celowo skromne — celem jest potwierdzenie solidnych podstaw technicznych, a nie wymaganie dużej aplikacji. Dla każdego kryterium podaj:
- Jasny status ✅ (spełnione) lub ❌ (niespełnione)
- Krótkie wyjaśnienie, co zostało znalezione lub czego brakuje
- Dla spełnionych kryteriów, wskaż konkretne dowody (ścieżki plików, nazwy funkcji)
Każde ✅ opieraj na dowodach, które faktycznie zlokalizowałeś w repozytorium. Jeśli nie możesz znaleźć dowodów na dane kryterium, oznacz je ❌ zamiast zakładać, że istnieje — ale pamiętaj, że poprzeczka jest "minimalna", więc nie wymagaj więcej niż każde kryterium.

## Kryteria analizy:

1.  **Akcje CRUD**
    - Projekt musi umożliwiać użytkownikom tworzenie, odczytywanie, aktualizowanie i usuwanie jego podstawowych elementów
      (np. dodawanie, wyświetlanie, edytowanie i usuwanie zadań z listy zadań).
    - "Elementy" zależą od domeny: rekordy, pliki, encje, zasoby, dokumenty itp.
    - Szukaj operacji tam, gdzie występują dla tego typu projektu: trasy HTTP/API,
      polecenia CLI, metody usług/repozytoriów, wywołania baz danych (Supabase, Prisma, Drizzle,
      surowy SQL, ORM), operacje na plikach itp.
    - Wyraźnie określ, które z operacji Create / Read / Update / Delete znalazłeś, każdą z własnym
      dowodem. Oznacz to kryterium ✅ TYLKO, jeśli wszystkie cztery istnieją dla co najmniej jednego podstawowego
      typu elementu i działają na trwałych danych. Przejściowa edycja, która odbywa się tylko w interfejsie użytkownika
      przed pierwszym zapisaniem elementu, NIE liczy się jako Update.

2.  **Logika biznesowa**
    - Projekt musi zawierać co najmniej jedną funkcję, która implementuje rzeczywistą logikę wykraczającą poza
      zwykłe CRUD (np. automatyczne sugerowanie priorytetu zadania na podstawie jego nazwy,
      opisu i terminu).
    - Przykłady: obliczenia, punktacja, przepływy pracy, reguły walidacji, transformacje danych,
      planowanie, rekomendacje lub integracje przetwarzające dane.
    - Powinno to odzwierciedlać unikalną wartość, jaką projekt zapewnia.

3.  **Testy adresujące zdefiniowane ryzyko**
    - Projekt musi zawierać co najmniej jeden zestaw testów, który adresuje konkretne ryzyko.
    - Szukaj dokumentu planu testów (np. test-plan.md), który definiuje ryzyko(a), które testy
      mają pokrywać. Najpierw sprawdź katalog context/ (np.
      context/foundation/test-plan.md), a następnie .ai/ lub docs/.
    - Następnie potwierdź, że istnieje co najmniej jeden rzeczywisty test (*.test.*, *.spec.* lub katalog testowy)
      i znacząco sprawdza to ryzyko. Dowolny framework jest w porządku (Vitest, Jest,
      Playwright, pytest, Go test itp.).
    - W swoim wyjaśnieniu podaj konkretne ryzyko z planu testów ORAZ konkretny test,
      który je sprawdza. Oznacz ✅ tylko wtedy, gdy rzeczywisty test odpowiada zadeklarowanemu ryzyku. Jeśli testy
      istnieją, ale nie ma planu testów, lub żaden test nie odpowiada żadnemu zadeklarowanemu ryzyku, oznacz go ❌ i
      powiedz, czego brakuje (planu testów lub testu, który celuje w zdefiniowane ryzyko).

4.  **Uwierzytelnianie powiązane z użytkownikiem**
    - Dostęp do systemu powinien być powiązany z użytkownikiem, który loguje się i widzi zasoby
      przypisane do niego.
    - Szukaj uwierzytelniania (logowania) i zasobów, które są przypisane/posiadane przez użytkownika.
    - PROSTSZE lub bezrejestracyjne podejście jest akceptowalne, gdy domena projektu sprawia, że
      jest to rozsądna decyzja projektowa (np. lokalne narzędzie CLI dla jednego użytkownika, osobiste narzędzie desktopowe, API zabezpieczone kluczem/tokenem). W takim przypadku wyjaśnij, dlaczego wybrane podejście
      jest rozsądne dla tego projektu i oznacz je ✅, jeśli sensownie identyfikuje/przypisuje użytkownika.

5.  **Dokumentacja**
    - W przepływie pracy 10x projekt jest generowany z jego pisemnych podstaw, więc traktuj to
      jako kontekst upstream, na którym zbudowana jest aplikacja — a nie jako dodatek.
    - Najpierw sprawdź katalog context/ — podstawa 10x znajduje się w context/foundation/
      (np. prd.md, shape-notes.md, roadmap.md, test-plan.md, tech-stack.md). Jeśli jej tam nie ma,
      sprawdź .ai/ lub docs/, a następnie katalog główny projektu (README.md).
    - Oczekuj co najmniej pliku README wyjaśniającego, czym jest projekt, plus PRD (lub równoważny
      dokument kształtowania/wymagań), który opisuje problem, zakres i zamierzoną
      funkcjonalność z sensowną treścią — a nie z wypełniaczami.

## Oczekiwany format wyjścia:

Po analizie podaj:

1.  **Listę kontrolną** z wyraźnym ✅/❌ dla każdego z 5 kryteriów
2.  **Status projektu**: Oblicz procent (X/5 * 100)
3.  **Priorytetowe ulepszenia**: Dla każdego niespełnionego kryterium, podaj konkretne, możliwe do wykonania wskazówki
    dostosowane do typu i stosu tego projektu

Pamiętaj: są to MINIMALNE wymagania — kryteria 1-4 (CRUD, logika biznesowa, testy,
uwierzytelnianie) to oficjalne podstawy techniczne, a dokumentacja to pisemna
podstawa, na której zbudowany jest projekt. Spełnienie wszystkich pięciu kryteriów oznacza przekroczenie progu technicznego, ale NIE gwarantuje samo w sobie certyfikacji — oznacza to, że nie ma oczywistych luk. Bardziej
ambitne projekty mogą zdobyć specjalne wyróżnienie i zaproszenie na Demo Day; jeśli zauważysz, że projekt wyraźnie wykracza poza minimum, wspomnij o tym krótko.

Proszę rozpocząć analizę.