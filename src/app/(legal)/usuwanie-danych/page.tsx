import type { Metadata } from 'next'
import Link from 'next/link'
import { PRIVACY_POLICY_PATH } from '@/lib/routes'
import { Fill, LegalList, LegalPage, LegalSection, LEGAL_LINK } from '@/app/components/legal-page'

export const metadata: Metadata = {
  title: 'Usuwanie danych — ZapiszPrzepis',
  description: 'Jak usunąć konto w ZapiszPrzepis i wszystkie swoje dane, także po logowaniu przez Facebooka lub Google.',
}

export default function DataDeletionPage() {
  return (
    <LegalPage title="Jak usunąć konto i swoje dane">
      <p>
        Ta strona opisuje, jak usunąć swoje dane z serwisu ZapiszPrzepis, także jeśli logujesz się przez Facebooka lub
        Google.
      </p>

      <LegalSection id="jak-poprosic" title="1. Jak poprosić o usunięcie konta">
        <p>
          W serwisie nie ma jeszcze przycisku do samodzielnego usunięcia konta. Usuwamy je na Twoją prośbę:
        </p>
        <ol className="flex list-decimal flex-col gap-2 pl-6">
          <li>
            Napisz na adres <Fill>adres e-mail do kontaktu</Fill> z tematem „Usunięcie konta”.
          </li>
          <li>
            Wyślij wiadomość z adresu e-mail, którego używasz do logowania (przy Facebooku lub Google: z adresu
            przypisanego do tego konta). Podaj też nazwę swojego profilu, jeśli ją znasz.
          </li>
          <li>Sprawdzimy, że konto należy do Ciebie, i usuniemy je.</li>
        </ol>
        <p>Zrobimy to najpóźniej w ciągu miesiąca od otrzymania prośby.</p>
      </LegalSection>

      <LegalSection id="co-usuwamy" title="2. Co usuwamy">
        <LegalList>
          <li>konto i dane logowania (adres e-mail),</li>
          <li>profil publiczny: nazwę wyświetlaną, nazwę użytkownika i zdjęcie profilowe,</li>
          <li>dane prywatne: imię z powitania i płeć,</li>
          <li>ulubione, historię dodawanych linków, powiadomienia i informację o pełnym dostępie,</li>
          <li>przepisy, które dodajesz, z wyjątkiem opisanym niżej.</li>
        </LegalList>
        <p>
          <strong>Przepisy, które inni mają w ulubionych.</strong> Jeśli przepis dodany przez Ciebie ktoś inny zapisał
          w ulubionych, nie znika z jego listy: przechodzi na osobę, która zapisała go najwcześniej, i od tej chwili
          jest przypisany do niej, a nie do Ciebie.
        </p>
        <p>
          <strong>Kopie zapasowe.</strong> Dane z historii dodawania przepisów mogą zostać w kopiach zapasowych
          najdłużej 90 dni. Potem kopie są kasowane automatycznie.
        </p>
      </LegalSection>

      <LegalSection id="sam" title="3. Co możesz zrobić sam lub sama, bez pisania do nas">
        <LegalList>
          <li>usunąć zdjęcie profilowe i zmienić nazwę wyświetlaną w Ustawieniach,</li>
          <li>usunąć przepis ze strony przepisu (jeśli nikt inny nie ma go w ulubionych),</li>
          <li>usunąć przepis z ulubionych, klikając serce.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="facebook" title="4. Logowanie przez Facebooka lub Google">
        <p>
          Możesz też odłączyć ZapiszPrzepis w ustawieniach konta Facebook (Ustawienia i prywatność → Ustawienia →
          Aplikacje i witryny) lub konta Google (Bezpieczeństwo → Połączenia z aplikacjami i usługami innych firm).
          Odłączenie zatrzymuje przekazywanie danych z Facebooka lub Google, ale nie usuwa danych zapisanych już w
          naszym serwisie — o to poproś tak, jak opisaliśmy wyżej.
        </p>
      </LegalSection>

      <p>
        Więcej o tym, jakie dane przechowujemy, przeczytasz w{' '}
        <Link href={PRIVACY_POLICY_PATH} className={LEGAL_LINK}>
          polityce prywatności
        </Link>
        .
      </p>
    </LegalPage>
  )
}
