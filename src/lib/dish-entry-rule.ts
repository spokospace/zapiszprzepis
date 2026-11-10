// What counts as a dish of its own in a post that gives several (#759). The extraction
// prompt returns one entry per dish; a blog post that gives ONE recipe and then closes
// with a sentence on what to do with its leftovers ("z pozostałych buraków możecie
// przygotować sałatkę…") used to come back as two entries, so one link became two
// recipes, the second built from a single paragraph and wearing the first one's photo.

export const DISH_ENTRY_RULE = `A dish is an entry of its own only when the page gives it as a recipe: its own heading or title and its own ingredient list or method. A serving idea, a side suggestion or a use for the leftovers or by-products of the main recipe ("z pozostałych po odlaniu płynu buraków możecie przygotować sałatkę", "do tego pasuje sos czosnkowy", "z reszty ciasta zrobisz paluszki"), written as a sentence or a short paragraph with no ingredient list of its own, is NOT an entry: it stays in the main dish as part of its final "Opcjonalnie: " step. A page with one recipe returns exactly one entry. When unsure, return one entry.`
