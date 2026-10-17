import type { Metadata } from 'next'
import Link from 'next/link'
import { DATA_DELETION_PATH, TERMS_PATH } from '@/lib/routes'
import { Fill, LegalList, LegalPage, LegalSection, LEGAL_LINK } from '@/app/components/legal-page'

export const metadata: Metadata = {
  title: 'Polityka prywatności — ZapiszPrzepis',
  description: 'Jakie dane zbiera ZapiszPrzepis, po co, komu je przekazuje i jakie masz prawa.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Polityka prywatności">
      <p>
        Tu opisujemy, jakie dane zbiera serwis ZapiszPrzepis (zapiszprzepis.pl), po co, gdzie są przechowywane i co
        możesz z nimi zrobić. Staramy się zbierać tylko to, czego serwis naprawdę potrzebuje do działania.
      </p>

      <LegalSection id="administrator" title="1. Kto odpowiada za Twoje dane">
        <p>
          Administratorem danych jest SPOKO SPACE Szymon Berski, Bielsko-Biała,{' '}
          NIP 5472125993.
        </p>
        <p>
          W sprawach danych osobowych pisz na adres: <a href="mailto:kontakt@spoko.space" className={LEGAL_LINK}>kontakt@spoko.space</a>.
        </p>
      </LegalSection>

      <LegalSection id="jakie-dane" title="2. Jakie dane zbieramy">
        <p>Bez logowania możesz przeglądać i wyszukiwać przepisy. Nie zakładamy wtedy żadnego konta.</p>
        <p>Gdy się logujesz albo korzystasz z konta, przechowujemy:</p>
        <LegalList>
          <li>
            <strong>Dane logowania.</strong> Adres e-mail. Logujesz się przez Facebooka, Google albo e-mailem (linkiem
            wysłanym na skrzynkę lub hasłem). Przy logowaniu przez Facebooka lub Google dostajemy od nich adres e-mail
            i podstawowe dane profilu (imię i nazwisko, identyfikator konta, adres zdjęcia profilowego); system
            logowania przechowuje je razem z datą ostatniego logowania. Z tych danych bierzemy tylko imię i nazwisko do
            nazwy wyświetlanej — zdjęcia z Facebooka ani Google nie pokazujemy. Nie poznajemy Twojego hasła do Facebooka
            ani Google. Jeśli ustawisz hasło w naszym serwisie, przechowujemy je wyłącznie w postaci zaszyfrowanej.
          </li>
          <li>
            <strong>Profil publiczny.</strong> Nazwa wyświetlana (domyślnie imię i pierwsza litera nazwiska z konta
            Facebook lub Google, a gdy jej nie ma: „Użytkownik”), nazwa użytkownika w adresie profilu (tworzona raz,
            z imienia, i potem się nie zmienia), zdjęcie profilowe, jeśli je dodasz (a bez niego kolor znaku z
            pierwszą literą nazwy) oraz datę założenia konta. Nazwę wyświetlaną i zdjęcie zmienisz w Ustawieniach.
          </li>
          <li>
            <strong>Dane prywatne.</strong> Imię do powitania, jeśli wpiszesz je w Ustawieniach (bez niego powitanie
            korzysta z nazwy wyświetlanej), oraz płeć, którą wybierasz raz przy pierwszym logowaniu, żeby zwracać się
            do Ciebie w poprawnej formie.
          </li>
          <li>
            <strong>Twoja aktywność w serwisie.</strong> Przepisy, które dodajesz, i linki, które przesyłasz do
            zapisania (z tytułem lub tekstem, jeśli udostępniasz je z innej aplikacji), stan ich przetwarzania (w tym
            ewentualny komunikat o błędzie),
            Twoje ulubione przepisy oraz to, które powiadomienia już przeczytałeś lub przeczytałaś.
          </li>
          <li>
            <strong>Pełny dostęp.</strong> Informacja, że masz pełny dostęp (możliwość dodawania przepisów), kiedy i
            jakim kodem go uzyskano oraz czas nieudanych prób wpisania kodu (bez wpisanego tekstu). Próby zapisujemy,
            żeby nikt nie mógł zgadywać kodów, i kasujemy je po poprawnym wpisaniu kodu.
          </li>
          <li>
            <strong>Dane techniczne.</strong> Jak każdy serwis internetowy, nasi dostawcy hostingu mogą przetwarzać w
            logach serwera adres IP, typ przeglądarki i czas zapytania.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="co-jest-publiczne" title="3. Co widzą inni">
        <LegalList>
          <li>
            <strong>Publiczne są:</strong> przepisy w katalogu (z nazwą źródła, autorem oryginału i linkiem do strony
            źródłowej), Twoja nazwa wyświetlana przy przepisach, które dodajesz („Dodane przez …”), oraz Twój profil
            pod adresem zapiszprzepis.pl/u/<em>nazwa-użytkownika</em>: nazwa wyświetlana, zdjęcie profilowe, data
            dołączenia i lista tych przepisów.
          </li>
          <li>
            <strong>Nigdy nie pokazujemy innym:</strong> Twojego adresu e-mail, Twoich ulubionych przepisów, imienia
            z powitania ani płci. Płeć służy tylko temu, jak serwis zwraca się do Ciebie.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="po-co" title="4. Po co przetwarzamy dane i na jakiej podstawie">
        <LegalList>
          <li>
            Prowadzenie konta i świadczenie usługi (logowanie, zapisywanie i pokazywanie przepisów, ulubione,
            powiadomienia, personalizacja powitania): art. 6 ust. 1 lit. b RODO, czyli wykonanie umowy, którą
            zawierasz, akceptując <Link href={TERMS_PATH} className={LEGAL_LINK}>regulamin</Link>.
          </li>
          <li>
            Bezpieczeństwo serwisu, ochrona przed nadużyciami (np. zgadywaniem kodów) i kopie zapasowe: art. 6 ust. 1
            lit. f RODO, czyli nasz prawnie uzasadniony interes.
          </li>
        </LegalList>
        <p>Nie używamy Twoich danych do reklam i ich nie sprzedajemy.</p>
      </LegalSection>

      <LegalSection id="odbiorcy" title="5. Komu powierzamy dane">
        <p>Serwis działa dzięki zewnętrznym dostawcom. Każdy dostaje tylko to, czego potrzebuje do swojego zadania:</p>
        <LegalList>
          <li>
            <strong>Supabase</strong> — baza danych, logowanie i przechowywanie plików (zdjęcia profilowe i zdjęcia
            przepisów). Wysyła też e-maile z linkiem do logowania i do ustawienia hasła.{' '}
            <Fill>czy e-maile idą przez serwer pocztowy Supabase, czy przez własnego dostawcę SMTP — jeśli własnego,
            dopisz go</Fill>
          </li>
          <li>
            <strong>Cloudflare</strong> — hosting serwisu (Cloudflare Workers) i codzienne kopie zapasowe przepisów
            oraz historii dodawania linków (Cloudflare R2), razem z identyfikatorem konta i tekstem udostępnionym z
            linkiem.
          </li>
          <li>
            <strong>Inngest</strong> — kolejka zadań, która w tle przetwarza dodany link (dostaje identyfikator
            zgłoszenia, identyfikator konta, link oraz tytuł i tekst, jeśli udostępniasz je razem z linkiem).
          </li>
          <li>
            <strong>Firecrawl</strong> — pobiera treść strony spod linku, który dodajesz.
          </li>
          <li>
            <strong>OpenAI</strong> — z pobranej treści strony odczytuje przepis (składniki, kroki, czas) i dobiera mu
            kategorię i tagi. Wysyłamy mu treść strony z przepisem, tytuł i tekst udostępnione razem z linkiem oraz
            tytuły podobnych przepisów, które już dodałeś lub dodałaś. Nie wysyłamy Twoich danych konta.
          </li>
          <li>
            <strong>Exa</strong> — wyszukiwarka przepisów w internecie, gdy osoba z pełnym dostępem szuka przepisu,
            którego nie ma jeszcze w katalogu. Dostaje tylko treść wpisanego zapytania.
          </li>
          <li>
            <strong>wsrv.nl</strong> — pośrednik, przez który pobieramy zdjęcie przepisu, gdy strona źródłowa nie
            pozwala pobrać go bezpośrednio.
          </li>
          <li>
            <strong>Facebook (Meta) i Google</strong> — gdy wybierasz logowanie przez nie.
          </li>
        </LegalList>
        <p>
          Przy dodawaniu przepisu serwer pobiera też publiczne strony spod linku: blogi, posty na Facebooku i filmy na
          YouTube (opis i napisy), żeby odczytać przepis. Tym serwisom przekazujemy tylko link, nie Twoje dane.
        </p>
        <p>
          <strong>Treści z innych stron.</strong> Przepis z filmu pokazuje odtwarzacz YouTube (z domeny
          youtube-nocookie.com). Niektóre zdjęcia przepisów wczytują się prosto ze strony źródłowej. W obu
          przypadkach Twoja przeglądarka łączy się z tymi serwisami, które mogą zobaczyć m.in. Twój adres IP.
        </p>
        <p>
          Część dostawców (m.in. OpenAI, Exa, Firecrawl, Inngest) działa w Stanach Zjednoczonych, więc dane mogą być
          przekazywane poza Europejski Obszar Gospodarczy na podstawie mechanizmów z RODO, np. standardowych klauzul
          umownych. <Fill>potwierdź podstawę transferu u każdego dostawcy i region bazy Supabase</Fill>
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="6. Pliki cookie i pamięć przeglądarki">
        <LegalList>
          <li>
            <strong>Cookie sesji</strong> — po zalogowaniu zapisujemy plik cookie, dzięki któremu pozostajesz
            zalogowany lub zalogowana. Na czas logowania przez Facebooka lub Google dochodzi krótkotrwały cookie
            zabezpieczający. Bez nich logowanie nie działa.
          </li>
          <li>
            <strong>Pamięć przeglądarki</strong> — na Twoim urządzeniu zapamiętujemy wybraną wielkość tekstu, a do
            zamknięcia karty także odhaczone składniki i kroki oraz listę, z której otworzono przepis. Te dane nie
            trafiają na nasz serwer.
          </li>
          <li>
            <strong>Aplikacja na telefonie</strong> — przeglądarka trzyma kopię plików serwisu i ostatnio otwartych
            stron, żeby działał szybciej i bez zasięgu. Ta kopia zostaje na Twoim urządzeniu.
          </li>
        </LegalList>
        <p>Nie używamy cookie reklamowych ani narzędzi analitycznych.</p>
      </LegalSection>

      <LegalSection id="jak-dlugo" title="7. Jak długo przechowujemy dane">
        <LegalList>
          <li>Dane konta, profilu i aktywności — dopóki masz konto.</li>
          <li>
            Kopie zapasowe przepisów i historii dodawania linków robimy codziennie i trzymamy przez 90 dni. Po
            usunięciu konta Twoje dane mogą pozostać w tych kopiach najdłużej 90 dni.{' '}
            <Fill>potwierdź, że reguła kasowania po 90 dniach jest włączona w Cloudflare R2</Fill>
          </li>
          <li>Logi techniczne — tak długo, jak przechowują je nasi dostawcy hostingu.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="prawa" title="8. Twoje prawa">
        <p>Masz prawo:</p>
        <LegalList>
          <li>dostać kopię swoich danych i informację, jak je przetwarzamy,</li>
          <li>poprawić swoje dane,</li>
          <li>
            usunąć swoje dane (zobacz{' '}
            <Link href={DATA_DELETION_PATH} className={LEGAL_LINK}>
              jak usunąć konto i dane
            </Link>
            ),
          </li>
          <li>ograniczyć przetwarzanie,</li>
          <li>przenieść dane do innego serwisu,</li>
          <li>sprzeciwić się przetwarzaniu opartemu na naszym uzasadnionym interesie,</li>
          <li>
            złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).
          </li>
        </LegalList>
        <p>
          Żeby skorzystać z tych praw, napisz na <a href="mailto:kontakt@spoko.space" className={LEGAL_LINK}>kontakt@spoko.space</a>. Odpowiemy najpóźniej w ciągu
          miesiąca.
        </p>
      </LegalSection>

      <LegalSection id="zmiany" title="9. Zmiany polityki">
        <p>
          Gdy zmienimy sposób przetwarzania danych, zaktualizujemy tę stronę i datę na górze.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
