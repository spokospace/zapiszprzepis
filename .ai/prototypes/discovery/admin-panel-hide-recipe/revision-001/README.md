# Discovery prototype: a moderator hides a recipe

Revision 001, 2026-10-28. Previous revision: none.

- **Source (stands in for a product brief):** `.ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md`. No `product-brief.md` exists in this repository; the owner chose the spec as the source when asked. Its decisions were accepted at the Open Questions gate on 2026-10-28.
- **Flow simulated:** moderator hides a recipe, checks what other people see, and restores it. Chosen by the owner from four candidates in the spec.
- **Panel report:** none supplied. No `[SYNTHETIC]` suggestions are recorded.
- **What this is:** local HTML with fictitious data. It tests the sequence, labels and recovery paths of one flow. It is not research evidence, does not satisfy any Definition of Ready, and settles no product assumption below.

## Open it, reset it

Open `index.html` from disk in a browser; nothing is served or fetched. Everything lives in memory. "Zresetuj symulację" (inside the "Test state" disclosure at the bottom) restores the start state; reloading the page does the same.

## Actor, start, success

- **Actor:** a signed-in staff member with the `moderator` role (the header says so).
- **Start:** the recipe list in the panel (`#/recipes`), five fictitious recipes, one of them already hidden.
- **Success:** a recipe is hidden with an optional reason, the staff view shows the "Ukryty" banner, the person can see what a guest and an author or favoriter would see, and can undo or restore the change.

## Screens and states

| ID | Screen / state | Reached by |
|----|----------------|-----------|
| `screen-recipe-list` | List, search by title, filter all / visible / hidden, empty result | start; "Wróć do listy" |
| `screen-recipe-detail` | Recipe detail with a "Moderacja" block: reason field, "Ukryj przepis" or "Przywróć przepis" | a title in the list |
| detail: validation | Reason longer than 200 characters | "Ukryj przepis" with a long reason |
| detail: loading | "Ukrywanie…" for 400 ms | "Ukryj przepis" |
| detail: success | Message, "Ukryty" banner, "Cofnij" | after hiding |
| detail: failure | Error message, recipe still visible, retry works | "Test state" → simulate a write failure |
| `screen-viewer-preview` | What a guest, an author or favoriter, and staff see for this recipe | "Zobacz, jak ten przepis widzą inne osoby" |
| `screen-not-found` | Not-found screen: unknown fragment, or a page the moderator has no permission for | a bad URL fragment; "Test state" → open `/admin/users` |

**Excluded and labelled as such:** edit content, merge duplicates, category and tags, delete a recipe, the import queue, users, access codes, roles, audit, tokens and the MCP server. The detail screen says "Poza zakresem tego prototypu" and offers no control for them.

## Rules and decisions kept (source-backed)

IDs are the question numbers of the spec's gate; there are no other stable IDs.

- **Spec Q2 (accepted):** a moderator manages recipes and the import queue and is read-only on users. The navigation therefore shows only "Przepisy"; no "Użytkownicy" entry exists.
- **Spec Q6 (accepted):** a hidden recipe is gone for guests, only staff see it; its owner and the people who favorited it see a "recipe unavailable" row. Hiding also removes it from category lists, search, the sitemap and the Markdown version.
- **Spec "UI/UX":** the panel returns a plain 404 to someone without access and does not confirm that it exists; buttons for operations the person lacks are absent, not disabled; hiding is one click with an undo link; a hidden recipe shows to staff with a visible "Ukryty" banner.
- **Spec "Data Model, Phase 2":** `hidden_reason` is a nullable text column, which is why the reason field is optional.
- **Repository `CLAUDE.md`, rebuild rules:** WCAG 2.2 AA, 48 px touch targets, a visible 3 px focus outline, underlined links, 19 px body text on phones.
- **Spec non-goals respected:** no slug change, no MCP, no end-user data entry.

## Assumptions

Each one is a simulation choice, not a requirement. Confirmation of this prototype does not remove a tag.

- **[ASSUMPTION] A1: the hide reason is optional and limited to 200 characters.** Needed to show a validation state. The spec fixes the column as nullable text and says nothing about length. Check: decide the limit with the owner before the migration.
- **[ASSUMPTION] A2: a moderator may hide and restore.** The spec says a moderator manages recipes; the exact permission list (`recipes.hide`) is a seed to be written in Phase 1. Check: read the seed list in the Phase 1 migration review.
- **[ASSUMPTION] A3: a staff member without a permission sees the same 404 as a non-staff visitor.** The spec states it for non-staff only. Check: confirm in the Phase 1 step that builds the `/admin` layout.
- **[ASSUMPTION] A4: "Cofnij" stays until the person leaves the page.** The spec only says "an undo link". Check: decide whether it should time out.
- **[ASSUMPTION] A5: all wording around the spec's phrase "Przepis jest niedostępny"** (404 text, banner text, "Ukrył(a)", labels) is invented for the simulation.
- **[ASSUMPTION] A6: the list columns** are title, category, added by, date added, number of favorites, status. The spec names author, source and a hidden filter only.
- **[ASSUMPTION] A7: search is a title substring match** with an all / visible / hidden filter. The spec mentions a query and a hidden filter.
- **[ASSUMPTION] A8: the failure message and the way back** (the recipe stays visible, retry works). The spec requires that nothing is half-done, not the text.
- **[ASSUMPTION] A9: the author or favoriter row shows no title for a hidden recipe.** The spec does not say whether the title appears. Check: decide with the owner, since the title may itself be the problem content.
- **[ASSUMPTION] A10: the viewer switcher** ("Wyświetl jako") exists only to show the spec's three audiences in one place; the real panel has no such screen.

## Screen map and browser checklist

Run with Playwright 1.63.0 (Chromium) against `file://` for this revision, through the repository's existing runner. The walk script was throwaway and is not part of this revision; the checks below can be repeated by hand. Result column: all passed. Evidence is in `evidence/`; the accessibility tree of the start screen is `evidence/snapshot-list.txt`.

| ID | Action | Expected | Result | Evidence |
|----|--------|----------|--------|----------|
| C01 | Open the entry state | Heading "Przepisy", five rows | pass | `01-list.png` |
| C02 | Search "pierogi" | One row, count updates | pass | |
| C03 | Search with no match, then clear | Empty state, way out works | pass | `02-list-empty.png` |
| C04 | Filter "Ukryte" | Only the hidden fixture recipe | pass | |
| C05 | Open a recipe | Detail, focus on its heading | pass | `03-detail-visible.png` |
| C06 | Hide with 201 characters | Inline error, field invalid, still visible | pass | `04-validation-error.png` |
| C07 | Fix the reason, hide with Enter | Success message, banner, "Cofnij", focus on the message | pass | `05-detail-hidden.png` |
| C08 | Preview as guest, author, staff | 404 / "Przepis jest niedostępny" / badge | pass | `06-preview-guest-hidden.png` |
| C09 | Browser back and forward | Back to detail, forward to preview | pass | |
| C10 | "Przywróć przepis" | Message, banner gone | pass | |
| C11 | Hide, then "Cofnij" | Visible again, message | pass | |
| C12 | Simulated write failure, then retry | Error, still visible; retry works | pass | `07-write-failure.png` |
| C13 | List after hiding; filter "Widoczne" | Badge "Ukryty"; row drops out | pass | |
| C14 | Unknown fragment | Not-found screen, link back works | pass | `08-not-found.png` |
| C15 | `/admin/users` as moderator | Same not-found screen, no "Użytkownicy" in the navigation | pass | |
| C16 | Reset | Start state, status announced | pass | |
| C17 | Tab from the top | Skip link first, 3 px outline, then "Przepisy" | pass | |
| C18 | Touch targets, three screens | Every control at least 48 px tall | pass | |
| C19 | Phone width 375 px | No horizontal scroll, hide button visible | pass | `09-phone-detail.png`, `10-phone-list.png` |
| C21 | Tab through the detail screen | Seven stops, each with a 3 px outline: skip link, nav, back link, reason, hide, preview link, test state | pass | |
| C22 | Live region | Validation error, success, restore and reset announced | pass | |
| C20 | Whole walk | No non-file request, no page error | pass | |

Browser session closed cleanly.

**Not checked:** a real screen reader (the live region's text was read from the page, not heard); colour contrast with a tool (the palette is dark text on white and `#1d4ed8` links, estimated, not measured); browsers other than Chromium; 200 % zoom and text spacing; Windows high contrast.

## Static review

- No `http(s)` URL, `fetch`, storage, cookie, dynamic import, external script or stylesheet in `index.html`; all buttons are `type="button"`, there is no form, so nothing can submit.
- All records and names are fictitious (`*.example` domains, "Użytkownik testowy A").
- The simulated interface holds no research conclusions or persona coaching.
- Output stays inside this revision; the spec, the brief, application code and `.uxproof/` are untouched (`.uxproof/` does not exist here).
