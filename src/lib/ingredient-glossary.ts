// A small curated glossary of ingredient and dish names a home cook in Poland may not
// know (#544): foreign cheeses, cured meats, sauces and pantry items that recipes saved
// from foreign sources keep untranslated. Curated in code rather than generated per
// recipe, so every explanation is reviewed and none is invented. Common, familiar names
// (feta, mozzarella, parmezan, salami, tofu) are left out on purpose.

export interface GlossaryEntry {
  /** The name as shown in „Co to jest {term}?”. */
  term: string
  /** One sentence in Polish: what it is. */
  explanation: string
  /** A common substitute available in Polish shops, when there is one. */
  substitute?: string
}

interface GlossaryRow extends GlossaryEntry {
  /**
   * Match patterns, lowercase and without diacritics (the text is folded the same way).
   * A trailing `*` adds the Polish case endings (`burrat*` matches „burrata”, „burraty”,
   * „burratą”); otherwise the pattern is a regex fragment matched as a whole word.
   */
  match: string[]
}

/** Polish noun endings after diacritic folding (ą → a, ę → e). */
const ENDINGS = '(?:a|y|e|i|u|o|om|ami|ach|em|ie|ow)?'

const GLOSSARY: GlossaryRow[] = [
  // Sery
  {
    term: 'manchego',
    match: ['manchego'],
    explanation: 'Twardy hiszpański ser z mleka owczego, o orzechowym, lekko pikantnym smaku.',
    substitute: 'parmezan lub dojrzała gouda',
  },
  {
    term: 'havarti',
    match: ['havarti'],
    explanation: 'Duński ser półtwardy, kremowy i łagodny, dobrze się topi.',
    substitute: 'gouda lub edam',
  },
  {
    term: 'burrata',
    match: ['burrat*', 'burracie'],
    explanation: 'Włoski świeży ser: kula z mozzarelli wypełniona śmietanką i strzępkami sera.',
    substitute: 'świeża mozzarella',
  },
  {
    term: 'pecorino',
    match: ['pecorino'],
    explanation: 'Włoski twardy ser z mleka owczego, słony i wyrazisty; najczęściej tarty.',
    substitute: 'parmezan',
  },
  {
    term: 'ricotta',
    match: ['ricott*', 'ricotcie'],
    explanation: 'Włoski delikatny ser z serwatki, miękki i lekko słodkawy.',
    substitute: 'twaróg zmielony ze śmietanką',
  },
  {
    term: 'mascarpone',
    match: ['mascarpon*'],
    explanation: 'Włoski bardzo tłusty serek śmietankowy, gęsty i gładki; podstawa tiramisu.',
    substitute: 'serek śmietankowy typu kremowego',
  },
  {
    term: 'halloumi',
    match: ['halloumi', 'hallumi'],
    explanation: 'Cypryjski ser z mleka owczego i koziego, słony; nie rozpływa się, więc można go grillować i smażyć.',
    substitute: 'ser do grillowania lub smażenia',
  },
  {
    term: 'gruyère',
    match: ['gruyere'],
    explanation: 'Szwajcarski twardy ser o orzechowym smaku, dobrze się topi; używany do zapiekanek i fondue.',
    substitute: 'ementaler',
  },
  {
    term: 'comté',
    match: ['comte'],
    explanation: 'Francuski twardy ser z mleka krowiego, orzechowy i lekko słodki.',
    substitute: 'ementaler lub gruyère',
  },
  {
    term: 'gorgonzola',
    match: ['gorgonzol*'],
    explanation: 'Włoski ser pleśniowy z niebieską pleśnią, kremowy i ostry w smaku.',
    substitute: 'inny ser z niebieską pleśnią',
  },
  {
    term: 'roquefort',
    match: ['roquefort*'],
    explanation: 'Francuski ser z mleka owczego z niebieską pleśnią, słony i bardzo wyrazisty.',
    substitute: 'inny ser z niebieską pleśnią',
  },
  {
    term: 'cheddar',
    match: ['cheddar*'],
    explanation: 'Angielski ser twardy o wyraźnym smaku, od łagodnego do ostrego, dobrze się topi.',
    substitute: 'dojrzała gouda',
  },
  {
    term: 'provolone',
    match: ['provolon*'],
    explanation: 'Włoski ser półtwardy z rodziny mozzarelli, łagodny albo pikantny, czasem wędzony.',
    substitute: 'mozzarella lub gouda',
  },
  {
    term: 'taleggio',
    match: ['taleggio'],
    explanation: 'Włoski ser miękki z mytą skórką, kremowy, o intensywnym zapachu i łagodnym smaku.',
    substitute: 'brie lub camembert',
  },
  {
    term: 'grana padano',
    match: ['grana padano'],
    explanation: 'Włoski twardy ser dojrzewający, bardzo podobny do parmezanu, trochę łagodniejszy.',
    substitute: 'parmezan',
  },
  {
    term: 'scamorza',
    match: ['scamorz*'],
    explanation: 'Włoski ser podobny do mozzarelli, ale suchszy, często wędzony.',
    substitute: 'wędzona mozzarella lub wędzony ser żółty',
  },
  {
    term: 'paneer',
    match: ['paneer*', 'panir*'],
    explanation: 'Indyjski świeży ser, zwarty i łagodny; nie topi się, więc kroi się go w kostkę i smaży.',
    substitute: 'ser do grillowania lub halloumi',
  },
  {
    term: 'labneh',
    match: ['labneh', 'labne'],
    explanation: 'Gęsty serek z odciśniętego jogurtu, popularny na Bliskim Wschodzie.',
    substitute: 'jogurt grecki odsączony przez gazę',
  },
  {
    term: 'queso fresco',
    match: ['queso fresco'],
    explanation: 'Meksykański świeży ser, biały, kruchy i lekko słony.',
    substitute: 'feta lub kruchy twaróg',
  },
  {
    term: 'monterey jack',
    match: ['monterey jack'],
    explanation: 'Amerykański ser półtwardy, łagodny i maślany, dobrze się topi.',
    substitute: 'gouda lub łagodny cheddar',
  },

  // Wędliny
  {
    term: 'prosciutto',
    match: ['prosciutt*'],
    explanation: 'Włoska szynka surowa, długo dojrzewająca, krojona w bardzo cienkie plastry.',
    substitute: 'szynka szwarcwaldzka lub inna szynka dojrzewająca',
  },
  {
    term: 'pancetta',
    match: ['pancett*', 'pancetcie'],
    explanation: 'Włoski surowy, dojrzewający boczek, solony i przyprawiony.',
    substitute: 'boczek wędzony lub surowy',
  },
  {
    term: 'guanciale',
    match: ['guancial*'],
    explanation: 'Włoskie dojrzewające podgardle wieprzowe, tłustsze niż boczek; klasyczny składnik carbonary.',
    substitute: 'boczek lub pancetta',
  },
  {
    term: 'chorizo',
    match: ['chorizo'],
    explanation: 'Hiszpańska kiełbasa wieprzowa z wędzoną papryką, czerwona i lekko pikantna.',
    substitute: 'pikantna kiełbasa z papryką',
  },
  {
    term: 'mortadela',
    match: ['mortadel*', 'mortadell*'],
    explanation: 'Włoska gruba wędlina z drobno mielonej wieprzowiny z kawałkami słoniny, czasem z pistacjami.',
  },
  {
    term: 'bresaola',
    match: ['bresaol*'],
    explanation: 'Włoska suszona, solona wołowina krojona w cienkie plastry.',
    substitute: 'polędwica wołowa suszona',
  },
  {
    term: 'coppa',
    match: ['coppa', 'coppy', 'coppe', 'capocollo'],
    explanation: 'Włoska dojrzewająca karkówka wieprzowa, krojona w cienkie plastry.',
    substitute: 'szynka dojrzewająca',
  },
  {
    term: 'speck',
    match: ['speck*'],
    explanation: 'Wędzona szynka z Tyrolu Południowego, przyprawiona jałowcem.',
    substitute: 'szynka wędzona',
  },
  {
    term: 'szynka serrano',
    match: ['jamon serrano', 'szynk[a-z]* serrano'],
    explanation: 'Hiszpańska szynka surowa, dojrzewająca, krojona w cienkie plastry.',
    substitute: 'prosciutto lub inna szynka dojrzewająca',
  },
  {
    term: 'nduja',
    match: ["'?nduj*"],
    explanation: 'Pikantna kalabryjska wędlina do smarowania, z wieprzowiny i papryczek chili.',
    substitute: 'chorizo zmiksowane z odrobiną oliwy',
  },
  {
    term: 'pastrami',
    match: ['pastrami'],
    explanation: 'Peklowana, przyprawiona i wędzona wołowina, krojona w plastry; znana z kanapek.',
    substitute: 'wędzona wołowina',
  },
  {
    term: 'lardo',
    match: ['lardo'],
    explanation: 'Włoska dojrzewająca słonina z ziołami, krojona w cienkie plastry.',
    substitute: 'słonina',
  },

  // Sosy, pasty, dania
  {
    term: 'guacamole',
    match: ['guacamole'],
    explanation: 'Meksykańska pasta z rozgniecionego awokado z limonką, cebulą i kolendrą.',
  },
  {
    term: 'pesto',
    match: ['pesto'],
    explanation: 'Włoski zielony sos z bazylii, orzeszków pinii, parmezanu, czosnku i oliwy, podawany na zimno.',
  },
  {
    term: 'aioli',
    match: ['aioli', 'ajoli'],
    explanation: 'Śródziemnomorski sos czosnkowy podobny do majonezu, z czosnku, oliwy i żółtka.',
    substitute: 'majonez z przeciśniętym czosnkiem',
  },
  {
    term: 'tzatziki',
    match: ['tzatziki', 'zaziki', 'caciki'],
    explanation: 'Grecki sos z gęstego jogurtu, startego ogórka, czosnku i oliwy.',
  },
  {
    term: 'salsa verde',
    match: ['salsa verde'],
    explanation: 'Zielony sos z ziół (zwykle natki pietruszki), kaparów, czosnku i oliwy; w kuchni meksykańskiej także z zielonych pomidorów.',
  },
  {
    term: 'pico de gallo',
    match: ['pico de gallo'],
    explanation: 'Meksykańska surówka z drobno pokrojonych pomidorów, cebuli, chili, kolendry i limonki.',
  },
  {
    term: 'harissa',
    match: ['hariss*', 'harys*'],
    explanation: 'Ostra pasta z papryczek chili z Afryki Północnej, z czosnkiem i przyprawami.',
    substitute: 'pasta chili z odrobiną kminu',
  },
  {
    term: 'sriracha',
    match: ['srirach*'],
    explanation: 'Ostry tajski sos z papryczek chili, czosnku, cukru i octu.',
    substitute: 'inny ostry sos chili',
  },
  {
    term: 'miso',
    match: ['miso'],
    explanation: 'Japońska słona pasta ze sfermentowanej soi, dodawana do zup i sosów.',
  },
  {
    term: 'gochujang',
    match: ['gochujang*', 'gochudżang*'],
    explanation: 'Koreańska pasta z papryczek chili, ryżu i soi; ostra, słodkawa i słona.',
    substitute: 'pasta chili z odrobiną miodu i sosu sojowego',
  },
  {
    term: 'chimichurri',
    match: ['chimichurri'],
    explanation: 'Argentyński sos z natki pietruszki, czosnku, oregano, octu i oliwy, podawany do mięsa.',
  },
  {
    term: 'romesco',
    match: ['romesco'],
    explanation: 'Kataloński sos z pieczonej papryki, migdałów lub orzechów, czosnku i oliwy.',
  },
  {
    term: 'beszamel',
    match: ['beszamel*', 'bechamel*', 'besamel*'],
    explanation: 'Gęsty biały sos z masła, mąki i mleka; używany do lasagne i zapiekanek.',
  },
  {
    term: 'sos holenderski',
    match: ['hollandaise', 'sos[a-z]* holendersk[a-z]*'],
    explanation: 'Ciepły, gęsty sos z żółtek i masła z sokiem z cytryny; podawany do jajek i szparagów.',
  },
  {
    term: 'tapenada',
    match: ['tapenad*'],
    explanation: 'Prowansalska pasta z oliwek, kaparów, anchois i oliwy.',
  },
  {
    term: 'baba ganusz',
    match: ['baba gh?anoush', 'baba ganusz', 'baba ghanouj'],
    explanation: 'Bliskowschodnia pasta z pieczonego bakłażana z pastą sezamową, czosnkiem i cytryną.',
  },
  {
    term: 'tahini',
    match: ['tahin*', 'tahina'],
    explanation: 'Pasta z mielonego sezamu, gęsta i lekko gorzkawa; składnik hummusu.',
  },
  {
    term: 'gremolata',
    match: ['gremolat*'],
    explanation: 'Włoska posypka z posiekanej natki pietruszki, skórki z cytryny i czosnku.',
  },
  {
    term: 'soffritto',
    match: ['soffritt*'],
    explanation: 'Włoska baza sosów i zup: drobno posiekana cebula, marchew i seler podsmażone na oliwie.',
  },
  {
    term: 'roux',
    match: ['roux'],
    explanation: 'Zasmażka z masła i mąki, którą zagęszcza się sosy i zupy.',
  },
  {
    term: 'hoisin',
    match: ['hoisin'],
    explanation: 'Chiński gęsty sos ze sfermentowanej soi, słodki i słony; podawany do kaczki.',
  },
  {
    term: 'sambal',
    match: ['sambal*'],
    explanation: 'Indonezyjska ostra pasta z siekanych papryczek chili.',
    substitute: 'pasta chili',
  },

  // Przyprawy i produkty spiżarniane
  {
    term: 'zaatar',
    match: ["za'?atar*"],
    explanation: 'Bliskowschodnia mieszanka przypraw: tymianek lub oregano, sumak i sezam.',
    substitute: 'suszony tymianek z sezamem',
  },
  {
    term: 'sumak',
    match: ['sumak*'],
    explanation: 'Zmielone czerwone owoce krzewu sumaka, o kwaśnym, cytrynowym smaku.',
    substitute: 'skórka i sok z cytryny',
  },
  {
    term: 'dukkah',
    match: ['dukk?ah?'],
    explanation: 'Egipska mieszanka prażonych orzechów, sezamu i przypraw, do maczania chleba w oliwie.',
  },
  {
    term: 'garam masala',
    match: ['garam masal*'],
    explanation: 'Indyjska mieszanka rozgrzewających przypraw: kmin, kolendra, kardamon, cynamon, goździki, pieprz.',
    substitute: 'curry z odrobiną cynamonu',
  },
  {
    term: 'ras el hanout',
    match: ['ras el hanout'],
    explanation: 'Marokańska mieszanka wielu przypraw, aromatyczna i lekko słodka.',
    substitute: 'curry z cynamonem i imbirem',
  },
  {
    term: 'mirin',
    match: ['mirin*'],
    explanation: 'Japońskie słodkie wino ryżowe do gotowania, o niskiej zawartości alkoholu.',
    substitute: 'białe wino lub ocet ryżowy z odrobiną cukru',
  },
  {
    term: 'tamari',
    match: ['tamari'],
    explanation: 'Japoński sos sojowy, ciemny i gęsty, zwykle bez pszenicy.',
    substitute: 'sos sojowy',
  },
  {
    term: 'ponzu',
    match: ['ponzu'],
    explanation: 'Japoński sos sojowy z sokiem cytrusów, kwaśny i słony.',
    substitute: 'sos sojowy z sokiem z cytryny',
  },
  {
    term: 'dashi',
    match: ['dashi'],
    explanation: 'Japoński bulion z wodorostów kombu i płatków suszonej ryby; baza zupy miso.',
    substitute: 'lekki bulion rybny lub warzywny',
  },
  {
    term: 'kecap manis',
    match: ['kecap manis'],
    explanation: 'Indonezyjski słodki, gęsty sos sojowy.',
    substitute: 'sos sojowy z cukrem trzcinowym',
  },
  {
    term: 'panko',
    match: ['panko'],
    explanation: 'Japońska bułka tarta z dużych, lekkich płatków; daje bardzo chrupką panierkę.',
    substitute: 'zwykła bułka tarta',
  },
  {
    term: 'ghee',
    match: ['ghee'],
    explanation: 'Masło klarowane, czyli oczyszczone z wody i białka; można na nim smażyć w wysokiej temperaturze.',
    substitute: 'masło klarowane ze sklepu',
  },
  {
    term: 'crème fraîche',
    match: ['creme fraiche'],
    explanation: 'Francuska gęsta, kwaśna śmietana o wysokiej zawartości tłuszczu; nie warzy się po podgrzaniu.',
    substitute: 'gęsta śmietana 30%',
  },
  {
    term: 'polenta',
    match: ['polent*'],
    explanation: 'Włoska kasza kukurydziana albo ugotowane z niej gęste danie.',
    substitute: 'kasza kukurydziana',
  },
  {
    term: 'orzo',
    match: ['orzo'],
    explanation: 'Włoski makaron w kształcie dużych ziaren ryżu.',
    substitute: 'ryż lub inny drobny makaron',
  },
  {
    term: 'gnocchi',
    match: ['gnocchi'],
    explanation: 'Włoskie kluseczki z ziemniaków i mąki, podobne do kopytek.',
    substitute: 'kopytka',
  },
  {
    term: 'tempeh',
    match: ['tempeh*'],
    explanation: 'Indonezyjski produkt z przefermentowanej soi, zwarty i orzechowy w smaku.',
    substitute: 'tofu wędzone',
  },
  {
    term: 'edamame',
    match: ['edamame'],
    explanation: 'Młode, zielone ziarna soi, zwykle gotowane w strąkach.',
    substitute: 'zielony groszek lub bób',
  },
  {
    term: 'pak choi',
    match: ['pak ?choi', 'bok ?choy'],
    explanation: 'Chińska kapusta o grubych białych łodygach i ciemnozielonych liściach.',
    substitute: 'kapusta pekińska',
  },
  {
    term: 'shiitake',
    match: ['shiitake'],
    explanation: 'Japońskie grzyby o mięsistym kapeluszu i wyrazistym, leśnym smaku.',
    substitute: 'pieczarki brązowe lub suszone grzyby leśne',
  },
  {
    term: 'chipotle',
    match: ['chipotle'],
    explanation: 'Meksykańskie wędzone i suszone papryczki jalapeño, ostre i dymne w smaku.',
    substitute: 'ostra papryka wędzona',
  },
  {
    term: 'wasabi',
    match: ['wasabi'],
    explanation: 'Japońska ostra zielona pasta, podobna w smaku do chrzanu.',
    substitute: 'chrzan',
  },
  {
    term: 'nori',
    match: ['nori'],
    explanation: 'Suszone wodorosty w cienkich arkuszach, używane do sushi.',
  },
]

/** Lowercase and drop diacritics, so „Crème Fraîche” and „burratą” match plain patterns. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
}

/** The pattern's regex source: `*` → Polish endings, spaces → any run of spaces or hyphens. */
function patternSource(pattern: string): string {
  const stem = fold(pattern)
  const body = stem.endsWith('*') ? `${stem.slice(0, -1)}${ENDINGS}` : stem
  return body.replace(/ /g, '[\\s-]+')
}

/** One regex per entry, as a whole word: no letter or digit right before or after. */
const MATCHERS = GLOSSARY.map(({ match, ...entry }) => ({
  entry,
  regex: new RegExp(`(?<![\\p{L}\\p{N}'])(?:${match.map(patternSource).join('|')})(?![\\p{L}\\p{N}])`, 'u'),
}))

/**
 * The glossary entries the given texts mention (title, ingredient names, steps), in the
 * order they first appear, each once. Texts without a glossary term give [].
 */
export function findGlossaryTerms(texts: (string | null | undefined)[]): GlossaryEntry[] {
  const text = fold(texts.filter(Boolean).join('\n'))
  if (!text) return []
  return MATCHERS.flatMap(({ entry, regex }) => {
    const found = regex.exec(text)
    return found ? [{ entry, at: found.index }] : []
  })
    .sort((a, b) => a.at - b.at)
    .map(({ entry }) => entry)
}

/** Every glossary entry (tests). */
export const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = MATCHERS.map(({ entry }) => entry)
