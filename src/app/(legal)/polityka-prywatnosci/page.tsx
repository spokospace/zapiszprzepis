import type { Metadata } from 'next'
import Link from 'next/link'
import { DATA_DELETION_PATH, TERMS_PATH } from '@/lib/routes'
import { LegalList, LegalPage, LegalSection, LEGAL_LINK } from '@/app/components/legal-page'

export const metadata: Metadata = {
  title: 'Polityka prywatności · Zapisz Przepis',
  description: 'Jakie dane zbiera Zapisz Przepis, po co, komu je przekazuje i jakie masz prawa.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Polityka prywatności">
      <p>
        Tu w prostych słowach wyjaśniamy, jakie dane zbiera serwis Zapisz Przepis (zapiszprzepis.pl), po co nam one są,
        gdzie je trzymamy i co możesz z nimi zrobić. Zbieramy tylko to, co serwisowi naprawdę jest potrzebne do
        działania.
      </p>

      <LegalSection id="administrator" title="1. Kto odpowiada za Twoje dane">
        <p>
          Administratorem danych jest SPOKO SPACE Szymon Berski, Bielsko-Biała,{' '}
          NIP 5472125993.
        </p>
        <p>
          Jeśli masz pytania o swoje dane, napisz na adres: <a href="mailto:kontakt@spoko.space" className={LEGAL_LINK}>kontakt@spoko.space</a>.
        </p>
      </LegalSection>

      <LegalSection id="jakie-dane" title="2. Jakie dane zbieramy">
        <p>Bez logowania możesz przeglądać i wyszukiwać przepisy. Nie zakładamy wtedy żadnego konta.</p>
        <p>Gdy się logujesz albo korzystasz z konta, przechowujemy:</p>
        <LegalList>
          <li>
            <strong>Dane logowania.</strong> Twój adres e-mail. Logujesz się przez Facebooka, Google albo e-mailem
            (linkiem wysłanym na skrzynkę lub hasłem). Kiedy wybierasz Facebooka lub Google, dostajemy od nich Twój
            adres e-mail i podstawowe dane profilu: imię i nazwisko, numer konta u nich oraz adres zdjęcia profilowego.
            Zapisujemy je razem z datą ostatniego logowania, ale używamy tylko imienia i nazwiska — jako nazwy, która
            się wyświetla. Zdjęcia z Facebooka ani Google nie pokazujemy. Twojego hasła do Facebooka ani Google nie
            znamy. Jeśli ustawisz hasło u nas, trzymamy je tylko w zaszyfrowanej postaci — nikt, łącznie z nami, nie
            widzi go wprost.
          </li>
          <li>
            <strong>Profil publiczny.</strong> Nazwa, która się wyświetla (domyślnie imię i pierwsza litera nazwiska
            z Facebooka lub Google, a gdy ich nie ma — „Użytkownik”), nazwa w adresie Twojego profilu (powstaje raz,
            z imienia, i już się nie zmienia), zdjęcie profilowe, jeśli je dodasz (a bez niego kolorowy znaczek
            z pierwszą literą nazwy), oraz data założenia konta. Nazwę i zdjęcie zmienisz w Ustawieniach.
          </li>
          <li>
            <strong>Dane prywatne.</strong> Imię do powitania, jeśli wpiszesz je w Ustawieniach (bez niego witamy Cię
            nazwą, która się wyświetla), oraz płeć, którą wybierasz raz przy pierwszym logowaniu — po to, żeby zwracać
            się do Ciebie w poprawnej formie (np. „dodałaś” albo „dodałeś”).
          </li>
          <li>
            <strong>Twoja aktywność w serwisie.</strong> Przepisy, które dodajesz, i linki, które przysyłasz do
            zapisania (wraz z tytułem lub tekstem, jeśli udostępniasz je z innej aplikacji), to, na jakim etapie jest
            ich przetwarzanie (w tym komunikat, gdy coś się nie uda), Twoje ulubione przepisy oraz to, które
            powiadomienia już przeczytałeś lub przeczytałaś.
          </li>
          <li>
            <strong>Pełny dostęp.</strong> To, że masz pełny dostęp (czyli możesz dodawać przepisy), kiedy i jakim
            kodem go uzyskano, a także godziny nieudanych prób wpisania kodu (bez tego, co wpisano). Te próby zapisujemy
            po to, żeby nikt nie zgadywał kodów; kasujemy je, gdy wpiszesz kod poprawnie.
          </li>
          <li>
            <strong>Dane techniczne.</strong> Tak jak każda strona internetowa — firmy, które utrzymują nasze serwery,
            mogą w swoich zapisach (logach) zachować Twój adres IP, rodzaj przeglądarki i godzinę zapytania.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="co-jest-publiczne" title="3. Co widzą inni">
        <LegalList>
          <li>
            <strong>Widoczne dla wszystkich:</strong> przepisy w katalogu (z nazwą źródła, autorem oryginału i linkiem
            do strony, z której pochodzą), Twoja nazwa przy przepisach, które dodajesz („Dodane przez …”), oraz Twój
            profil pod adresem zapiszprzepis.pl/u/<em>nazwa</em> — czyli nazwa, zdjęcie profilowe, data dołączenia
            i lista tych przepisów.
          </li>
          <li>
            <strong>Nigdy nie pokazujemy innym:</strong> Twojego adresu e-mail, ulubionych przepisów, imienia
            z powitania ani płci. Płeć służy tylko temu, jak serwis zwraca się do Ciebie.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="po-co" title="4. Po co nam Twoje dane">
        <p>Twoje dane wykorzystujemy tylko do prowadzenia serwisu:</p>
        <LegalList>
          <li>
            <strong>Żeby serwis działał</strong> — logowanie, zapisywanie i pokazywanie przepisów, ulubione,
            powiadomienia, powitanie po imieniu. Robimy to, bo zgadzasz się na to, akceptując{' '}
            <Link href={TERMS_PATH} className={LEGAL_LINK}>regulamin</Link> (w języku prawa to wykonanie umowy —
            art. 6 ust. 1 lit. b RODO).
          </li>
          <li>
            <strong>Żeby serwis był bezpieczny</strong> — ochrona przed nadużyciami (np. zgadywaniem kodów) i kopie
            zapasowe. To nasz uzasadniony interes — art. 6 ust. 1 lit. f RODO.
          </li>
        </LegalList>
        <p>Nie używamy Twoich danych do reklam i nikomu ich nie sprzedajemy.</p>
      </LegalSection>

      <LegalSection id="odbiorcy" title="5. Komu przekazujemy dane">
        <p>Serwis działa dzięki kilku zewnętrznym firmom. Każda dostaje tylko to, co jest jej potrzebne do jej zadania:</p>
        <LegalList>
          <li>
            <strong>Supabase</strong> — tu mieszka baza danych: Twoje konto, przepisy i pliki (zdjęcia profilowe oraz
            zdjęcia przepisów). Stąd wychodzą też e-maile z linkiem do logowania i do ustawienia hasła.
          </li>
          <li>
            <strong>Cloudflare</strong> — utrzymuje serwis w internecie i raz dziennie robi kopie zapasowe przepisów
            oraz historii dodawanych linków (wraz z numerem konta i tekstem, który dołączasz do linku).
          </li>
          <li>
            <strong>Inngest</strong> — usługa, która w tle zajmuje się dodanym linkiem (dostaje numer zgłoszenia,
            numer konta, sam link oraz tytuł i tekst, jeśli udostępniasz je razem z nim).
          </li>
          <li>
            <strong>Firecrawl</strong> — pobiera treść strony spod linku, który dodajesz.
          </li>
          <li>
            <strong>OpenAI</strong> — z pobranej treści strony odczytuje przepis (składniki, kroki, czas) i dobiera mu
            kategorię oraz tagi. Dostaje treść strony z przepisem, tytuł i tekst dołączone do linku oraz tytuły
            podobnych przepisów, które już dodałeś lub dodałaś. Nie przekazujemy mu danych Twojego konta.
          </li>
          <li>
            <strong>Exa</strong> — wyszukiwarka przepisów w internecie; działa, gdy osoba z pełnym dostępem szuka
            przepisu, którego nie ma jeszcze w katalogu. Dostaje tylko to, co wpiszesz w wyszukiwarkę.
          </li>
          <li>
            <strong>wsrv.nl</strong> — pośrednik, przez który pobieramy zdjęcie przepisu, gdy strona źródłowa nie
            pozwala pobrać go wprost.
          </li>
          <li>
            <strong>Facebook (Meta) i Google</strong> — gdy wybierasz logowanie przez nie.
          </li>
        </LegalList>
        <p>
          Przy dodawaniu przepisu nasz serwer zagląda też na publiczne strony spod linku — blogi, posty na Facebooku
          i filmy na YouTube (opis i napisy) — żeby odczytać przepis. Tym stronom przekazujemy tylko link, nigdy Twoje
          dane.
        </p>
        <p>
          <strong>Treści z innych stron.</strong> Przepis z filmu pokazujemy w odtwarzaczu YouTube (w wersji, która nie
          zostawia ciasteczek — z domeny youtube-nocookie.com). Niektóre zdjęcia przepisów wczytują się prosto ze
          strony źródłowej. W obu przypadkach Twoja przeglądarka łączy się z tymi serwisami, a one mogą zobaczyć m.in.
          Twój adres IP.
        </p>
        <p>
          Baza danych (Supabase) stoi w Irlandii, czyli w Unii Europejskiej. Część firm działa w USA (OpenAI, Exa,
          Firecrawl, Inngest) — dane trafiają do nich na podstawie standardowych klauzul umownych (SCC), czyli
          wzorcowej umowy zatwierdzonej przez Unię Europejską, która ma chronić Twoje dane także poza Europą.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="6. Pliki cookie i pamięć przeglądarki">
        <LegalList>
          <li>
            <strong>Ciasteczko logowania</strong> — po zalogowaniu zapisujemy na Twoim urządzeniu mały plik
            (ciasteczko), dzięki któremu zostajesz zalogowany lub zalogowana. Podczas logowania przez Facebooka lub
            Google dochodzi jeszcze jedno, krótkotrwałe ciasteczko dla bezpieczeństwa. Bez nich logowanie nie zadziała.
          </li>
          <li>
            <strong>Pamięć przeglądarki</strong> — na Twoim urządzeniu zapamiętujemy wybraną wielkość tekstu, a do
            czasu zamknięcia karty także odhaczone składniki i kroki oraz listę, z której otworzyłeś lub otworzyłaś
            przepis. Te dane zostają u Ciebie i nie trafiają na nasz serwer.
          </li>
          <li>
            <strong>Aplikacja na telefonie</strong> — przeglądarka trzyma kopię plików serwisu i ostatnio otwieranych
            stron, żeby działał szybciej i nawet bez zasięgu. Ta kopia zostaje na Twoim urządzeniu.
          </li>
        </LegalList>
        <p>Nie używamy ciasteczek reklamowych ani narzędzi, które śledzą ruch na stronie.</p>
      </LegalSection>

      <LegalSection id="jak-dlugo" title="7. Jak długo przechowujemy dane">
        <LegalList>
          <li>Dane konta, profilu i Twojej aktywności — tak długo, jak masz u nas konto.</li>
          <li>
            Kopie zapasowe przepisów i historii dodawanych linków robimy codziennie i trzymamy przez 90 dni. Po
            usunięciu konta Twoje dane mogą jeszcze przez najwyżej 90 dni zostać w tych kopiach.
          </li>
          <li>Zapisy techniczne (logi) — tak długo, jak trzymają je firmy utrzymujące nasze serwery.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="prawa" title="8. Twoje prawa">
        <p>Masz prawo:</p>
        <LegalList>
          <li>poprosić o kopię swoich danych i o to, żebyśmy wyjaśnili, jak je wykorzystujemy,</li>
          <li>poprawić swoje dane,</li>
          <li>
            usunąć swoje dane (zobacz{' '}
            <Link href={DATA_DELETION_PATH} className={LEGAL_LINK}>
              jak usunąć konto i dane
            </Link>
            ),
          </li>
          <li>ograniczyć to, co z nimi robimy,</li>
          <li>zabrać swoje dane do innego serwisu,</li>
          <li>nie zgodzić się na przetwarzanie oparte na naszym uzasadnionym interesie,</li>
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
          Gdy zmienimy sposób, w jaki przetwarzamy dane, zaktualizujemy tę stronę i datę na górze.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
