// Polish vocative ("wołacz") for greetings — E01-S12. Pure: no I/O, so the
// home greeting (S04) and the first-login screen share one tested rule.
//
// A wrong vocative reads worse than none, so the rule is conservative: a
// dictionary of common first names, then two safe fallback suffix rules for
// feminine/diminutive names in -a, and null for everything else (the caller
// then greets with a plain "Dzień dobry!").

/** Common first names whose vocative is irregular or not covered by the -a rules. */
const DICTIONARY: Record<string, string> = {
  // Masculine — no safe suffix rule exists, so only listed names are inflected.
  adam: 'Adamie',
  adrian: 'Adrianie',
  aleksander: 'Aleksandrze',
  andrzej: 'Andrzeju',
  antoni: 'Antoni',
  arkadiusz: 'Arkadiuszu',
  artur: 'Arturze',
  bartek: 'Bartku',
  bartosz: 'Bartoszu',
  bogdan: 'Bogdanie',
  czesław: 'Czesławie',
  damian: 'Damianie',
  daniel: 'Danielu',
  dariusz: 'Dariuszu',
  dawid: 'Dawidzie',
  dominik: 'Dominiku',
  edward: 'Edwardzie',
  filip: 'Filipie',
  grzegorz: 'Grzegorzu',
  henryk: 'Henryku',
  hubert: 'Hubercie',
  igor: 'Igorze',
  jacek: 'Jacku',
  jakub: 'Jakubie',
  jan: 'Janie',
  janusz: 'Januszu',
  jarosław: 'Jarosławie',
  jerzy: 'Jerzy',
  józef: 'Józefie',
  kacper: 'Kacprze',
  kamil: 'Kamilu',
  karol: 'Karolu',
  kazimierz: 'Kazimierzu',
  konrad: 'Konradzie',
  krzysztof: 'Krzysztofie',
  leszek: 'Leszku',
  łukasz: 'Łukaszu',
  maciej: 'Macieju',
  marcin: 'Marcinie',
  marek: 'Marku',
  marian: 'Marianie',
  mariusz: 'Mariuszu',
  mateusz: 'Mateuszu',
  michał: 'Michale',
  mikołaj: 'Mikołaju',
  mirosław: 'Mirosławie',
  norbert: 'Norbercie',
  oskar: 'Oskarze',
  patryk: 'Patryku',
  paweł: 'Pawle',
  piotr: 'Piotrze',
  przemysław: 'Przemysławie',
  radosław: 'Radosławie',
  rafał: 'Rafale',
  robert: 'Robercie',
  roman: 'Romanie',
  ryszard: 'Ryszardzie',
  sebastian: 'Sebastianie',
  sławomir: 'Sławomirze',
  stanisław: 'Stanisławie',
  stefan: 'Stefanie',
  szymon: 'Szymonie',
  tadeusz: 'Tadeuszu',
  tomasz: 'Tomaszu',
  wiesław: 'Wiesławie',
  wiktor: 'Wiktorze',
  witold: 'Witoldzie',
  władysław: 'Władysławie',
  włodzimierz: 'Włodzimierzu',
  wojciech: 'Wojciechu',
  zbigniew: 'Zbigniewie',
  zdzisław: 'Zdzisławie',
  // Feminine / diminutive names where the -a → -o fallback would be wrong.
  ala: 'Alu',
  ela: 'Elu',
  hela: 'Helu',
  lola: 'Lolu',
  mela: 'Melu',
  nela: 'Nelu',
  ola: 'Olu',
  pola: 'Polu',
  tola: 'Tolu',
  ula: 'Ulu',
  // Feminine names that do not end in -a.
  beatrycze: 'Beatrycze',
  noemi: 'Noemi',
}

/** The account placeholder from S18 (`profile_display_name`), never a real name. */
const PLACEHOLDER_NAMES = new Set(['użytkownik', 'uzytkownik'])

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase('pl-PL') + word.slice(1)
}

/**
 * The vocative of a Polish first name, or null when it is not known with
 * confidence. Case-insensitive; the result is capitalised.
 *
 *   vocative('Ania')  → 'Aniu'      (-nia → -niu)
 *   vocative('Magda') → 'Magdo'     (-a → -o)
 *   vocative('Piotr') → 'Piotrze'   (dictionary)
 *   vocative('Xawery') → null
 */
export function vocative(firstName: string | null | undefined): string | null {
  if (typeof firstName !== 'string') return null
  const name = firstName.trim().toLocaleLowerCase('pl-PL')
  // Letters only (incl. Polish diacritics) — a name with digits, spaces or
  // punctuation is not something we can inflect safely.
  if (!/^[a-ząćęłńóśźż]{2,}$/.test(name)) return null
  if (PLACEHOLDER_NAMES.has(name)) return null

  const known = DICTIONARY[name]
  if (known) return known

  // Fallback rules for names in -a (backlog E01-S12): diminutives in
  // -sia/-cia/-zia take -iu (Kasia → Kasiu, Jadzia → Jadziu); -nia only in
  // short diminutives (Ania → Aniu, Hania → Haniu) — full names such as
  // Antonia/Stefania/Melania take -o. Short -la names are diminutives with -u
  // (Ola → Olu); those not in the dictionary are too uncertain → null. Any
  // other -a takes -o (Magda → Magdo, Agnieszka → Agnieszko, Kuba → Kubo).
  if (/(si|ci|zi)a$/.test(name) || (name.endsWith('nia') && name.length <= 5)) {
    return capitalize(name.slice(0, -1) + 'u')
  }
  if (name.endsWith('la') && name.length <= 4) return null
  if (name.endsWith('a')) return capitalize(name.slice(0, -1) + 'o')

  return null
}

/** The first word of a display name ("Ania K." → "Ania"). */
export function firstNameOf(displayName: string | null | undefined): string | null {
  if (typeof displayName !== 'string') return null
  const first = displayName.trim().split(/\s+/)[0]
  return first ? first : null
}

/**
 * The greeting for a signed-in user: "Dzień dobry, Aniu!" when the vocative is
 * known, otherwise a plain "Dzień dobry!" — never a guessed or raw name.
 */
export function greeting(displayName: string | null | undefined): string {
  const voc = vocative(firstNameOf(displayName))
  return voc ? `Dzień dobry, ${voc}!` : 'Dzień dobry!'
}
