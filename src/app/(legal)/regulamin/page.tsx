import type { Metadata } from 'next'
import Link from 'next/link'
import { DATA_DELETION_PATH, PRIVACY_POLICY_PATH } from '@/lib/routes'
import { Fill, LegalList, LegalPage, LegalSection, LEGAL_LINK } from '@/app/components/legal-page'

export const metadata: Metadata = {
  title: 'Regulamin — ZapiszPrzepis',
  description: 'Zasady korzystania z serwisu ZapiszPrzepis.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Regulamin">
      <LegalSection id="uslugodawca" title="1. Kto prowadzi serwis">
        <p>
          Serwis ZapiszPrzepis (zapiszprzepis.pl) prowadzi <Fill>imię i nazwisko lub nazwa firmy</Fill>,{' '}
          <Fill>adres</Fill>, <Fill>NIP / REGON, jeśli dotyczy</Fill>. Kontakt: <Fill>adres e-mail do kontaktu</Fill>.
        </p>
      </LegalSection>

      <LegalSection id="czym-jest" title="2. Czym jest serwis">
        <p>
          ZapiszPrzepis pomaga zapisywać przepisy znalezione w internecie: na blogach, w postach na Facebooku i w
          filmach na YouTube. Dodajesz link, a serwis odczytuje z tej strony przepis (składniki, kroki, czas
          przygotowania) i zapisuje go w uporządkowanej formie. Przepisy trafiają do wspólnego, publicznego katalogu.
        </p>
        <p>
          Każdy przepis ma tylko jedną kartę na dany link. Jeśli dodasz link, który ktoś dodał już wcześniej, przepis
          trafi do Twoich ulubionych.
        </p>
      </LegalSection>

      <LegalSection id="dostep" title="3. Kto co może">
        <LegalList>
          <li>
            <strong>Bez konta</strong> możesz przeglądać i wyszukiwać przepisy.
          </li>
          <li>
            <strong>Po zalogowaniu</strong> (przez Facebooka, Google lub e-mail) możesz zapisywać ulubione przepisy i
            korzystać z galerii. Nowe konto na sam adres e-mail zakłada się z kodem zaproszenia.
          </li>
          <li>
            <strong>Dodawanie przepisów</strong> wymaga pełnego dostępu, który odblokowuje kod dostępu otrzymany od
            nas. Jeden kod może mieć ograniczoną liczbę użyć i datę ważności.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="konto" title="4. Konto">
        <LegalList>
          <li>Konto jest osobiste. Nie udostępniaj innym dostępu do niego ani swojego kodu dostępu.</li>
          <li>
            Płeć wybierasz raz, przy pierwszym logowaniu, i potem nie można jej zmienić w serwisie. Jeśli wybierzesz
            źle, napisz do nas.
          </li>
          <li>
            Nazwa użytkownika w adresie Twojego profilu jest tworzona raz i się nie zmienia. Nazwę wyświetlaną i
            zdjęcie zmienisz w Ustawieniach.
          </li>
          <li>
            Konto możesz w każdej chwili usunąć —{' '}
            <Link href={DATA_DELETION_PATH} className={LEGAL_LINK}>
              zobacz, jak to zrobić
            </Link>
            .
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="tresci" title="5. Linki i treści, które dodajesz">
        <LegalList>
          <li>
            Odpowiadasz za linki, które dodajesz, i za zdjęcie profilowe oraz nazwę, którą ustawiasz. Dodawaj tylko
            linki do przepisów kulinarnych z publicznie dostępnych stron.
          </li>
          <li>
            Nie dodawaj treści niezgodnych z prawem, obraźliwych ani naruszających cudze prawa, w tym prywatność
            innych osób.
          </li>
          <li>
            Przepis odczytuje automat. Może się pomylić, np. w ilości składnika albo czasie pieczenia. Przed
            gotowaniem warto sprawdzić przepis w oryginale.
          </li>
          <li>Możemy usunąć przepis albo zablokować konto, które łamie ten regulamin.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="zrodla" title="6. Autorzy i źródła przepisów">
        <p>
          Przepisy należą do ich autorów. Przy każdym przepisie pokazujemy, skąd pochodzi (np. nazwę bloga albo
          kanału na YouTube), z linkiem do oryginału. Przepisy z YouTube pokazujemy razem z odtwarzaczem oryginalnego
          filmu.
        </p>
        <p>
          Jeśli jesteś autorem lub autorką przepisu i nie chcesz, żeby był w serwisie, albo uważasz, że przepis narusza
          Twoje prawa, napisz na <Fill>adres e-mail do kontaktu</Fill>, podając link do przepisu w naszym serwisie.
          Sprawdzimy zgłoszenie i w razie potrzeby usuniemy przepis.
        </p>
      </LegalSection>

      <LegalSection id="odpowiedzialnosc" title="7. Działanie serwisu">
        <p>
          Staramy się, żeby serwis działał bez przerw, ale nie możemy tego zagwarantować. Możemy zmieniać funkcje
          serwisu, a w uzasadnionych przypadkach przerwać jego działanie.
        </p>
      </LegalSection>

      <LegalSection id="dane" title="8. Dane osobowe">
        <p>
          Jakie dane zbieramy i jak je chronimy, opisuje{' '}
          <Link href={PRIVACY_POLICY_PATH} className={LEGAL_LINK}>
            polityka prywatności
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="kontakt" title="9. Kontakt, reklamacje i zmiany regulaminu">
        <LegalList>
          <li>
            Pytania i reklamacje wysyłaj na <Fill>adres e-mail do kontaktu</Fill>. Odpowiemy w ciągu{' '}
            <Fill>termin odpowiedzi, np. 14 dni</Fill>.
          </li>
          <li>
            O zmianie regulaminu poinformujemy na tej stronie, zmieniając datę na górze. <Fill>zasady powiadamiania o
            zmianach i prawo właściwe</Fill>
          </li>
        </LegalList>
      </LegalSection>
    </LegalPage>
  )
}
