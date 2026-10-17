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
          Administratorem danych jest Szymon Berski, spoko.space (<Fill>pełna nazwa firmy z CEIDG</Fill>), <Fill>adres firmy</Fill>,{' '}
          NIP <Fill>NIP</Fill>.
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
            i podstawowe dane profilu, np. imię i nazwisko. Nie poznajemy Twojego hasła do Facebooka ani Google.
          </li>
          <li>
            <strong>Profil publiczny.</strong> Nazwa wyświetlana (domyślnie imię i pierwsza litera nazwiska z konta
            Facebook lub Google, a gdy jej nie ma: „Użytkownik”), nazwa użytkownika w adresie profilu (tworzona raz,
            z imienia, i potem się nie zmienia) oraz zdjęcie profilowe, jeśli je dodasz. Nazwę wyświetlaną i zdjęcie
            zmienisz w Ustawieniach.
          </li>
          <li>
            <strong>Dane prywatne.</strong> Imię, którego używamy w powitaniu, i płeć, którą wybierasz raz przy
            pierwszym logowaniu, żeby zwracać się do Ciebie w poprawnej formie.
          </li>
          <li>
            <strong>Twoja aktywność w serwisie.</strong> Przepisy, które dodajesz, i linki, które przesyłasz do
            zapisania (z tytułem lub tekstem, jeśli udostępniasz je z innej aplikacji), stan ich przetwarzania,
            Twoje ulubione przepisy oraz to, które powiadomienia już przeczytałeś lub przeczytałaś.
          </li>
          <li>
            <strong>Pełny dostęp.</strong> Informacja, że masz pełny dostęp (możliwość dodawania przepisów), jakim
            kodem go uzyskano oraz czas prób wpisania kodu. Próby zapisujemy, żeby nikt nie mógł zgadywać kodów.
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
            <strong>Publiczne są:</strong> przepisy w katalogu (z nazwą i linkiem do strony źródłowej), Twoja nazwa
            wyświetlana i zdjęcie profilowe przy przepisach, które dodajesz, oraz Twój profil pod adresem
            zapiszprzepis.pl/u/<em>nazwa-użytkownika</em> z listą tych przepisów.
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
            przepisów). Wysyła też e-maile z linkiem do logowania.
          </li>
          <li>
            <strong>Cloudflare</strong> — hosting serwisu (Cloudflare Workers) i codzienne kopie zapasowe przepisów
            (Cloudflare R2).
          </li>
          <li>
            <strong>Inngest</strong> — kolejka zadań, która w tle przetwarza dodany link (dostaje identyfikator
            zgłoszenia i link).
          </li>
          <li>
            <strong>Firecrawl</strong> — pobiera treść strony spod linku, który dodajesz.
          </li>
          <li>
            <strong>OpenAI</strong> — z pobranej treści strony odczytuje przepis (składniki, kroki, czas). Wysyłamy mu
            treść strony z przepisem, nie Twoje dane konta.
          </li>
          <li>
            <strong>Exa</strong> — wyszukiwarka przepisów w internecie, gdy szukasz przepisu, którego nie ma jeszcze
            w katalogu. Dostaje treść wpisanego zapytania.
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
          YouTube (opis i napisy), żeby odczytać przepis.
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
            zalogowany lub zalogowana. Bez niego logowanie nie działa.
          </li>
          <li>
            <strong>Pamięć przeglądarki</strong> — na Twoim urządzeniu zapamiętujemy wybraną wielkość tekstu, a do
            zamknięcia karty także odhaczone składniki i kroki oraz listę, z której otworzono przepis. Te dane nie
            trafiają na nasz serwer.
          </li>
          <li>
            <strong>Aplikacja na telefonie</strong> — serwis można zainstalować jak aplikację; przeglądarka trzyma
            wtedy kopię plików serwisu, żeby działał szybciej.
          </li>
        </LegalList>
        <p>Nie używamy cookie reklamowych ani narzędzi analitycznych.</p>
      </LegalSection>

      <LegalSection id="jak-dlugo" title="7. Jak długo przechowujemy dane">
        <LegalList>
          <li>Dane konta, profilu i aktywności — dopóki masz konto.</li>
          <li>
            Kopie zapasowe przepisów i historii dodawania linków robimy codziennie i trzymamy przez 90 dni. Po
            usunięciu konta Twoje dane mogą pozostać w tych kopiach najdłużej 90 dni.
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
