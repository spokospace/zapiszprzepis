# Changelog

# 0.2.0 (2026-10-19)

<!-- First changelog entry: covers PRs merged into master from 2026-10-16 (#153) to 2026-10-19 (#314). Earlier history is in `git log`. -->

## Highlights
<!-- TODO: Highlights — auto-update-changelog leaves this blank for the human author to fill in. -->

## ✨ Features

### E01 — public, high-readability rebuild
- ✨ Identity profile: public display name and username (E01-S18). (#192) *(@spokospace)*
- ✨ Design tokens, accessibility primitives and the text-scale foundation (E01-S01). (#195) *(@spokospace)*
- ✨ Favorites with a labelled heart, a /ulubione page and return-after-login (E01-S06). (#200) *(@spokospace)*
- ✨ One recipe per link: global intake, ownership guards and collapse tooling (E01-S03a). (#223) *(@spokospace)*
- ✨ Global unique indexes for one-recipe-per-link (E01-S03a, phase 3). (#235) *(@spokospace)*
- ✨ Public /przepis/{slug} route with a 301 from /recipes, plus globally unique slugs (E01-S03b). (#239) *(@spokospace)*
- ✨ Recipe page rebuild (E01-S07). (#246) *(@spokospace)*
- ✨ Home page for guests and signed-in users (E01-S04). (#249) *(@spokospace)*
- ✨ Menu drawer with "Mine" and "All by category" (E01-S09). (#250) *(@spokospace)*
- ✨ Labelled heart on recipe cards and the fav= intent at login (E01-S06). (#260) *(@spokospace)*
- ✨ Category pages with AND-filtered tag chips and similar recipes (E01-S16). (#261) *(@spokospace)*
- ✨ Public profile at /u/{username} (E01-S14). (#259) *(@spokospace)*
- ✨ One search with results and an All / Mine / Favorites scope (E01-S05). (#262) *(@spokospace)*
- ✨ My profile / settings page at /settings (E01-S13). (#263) *(@spokospace)*
- ✨ Add a recipe on a dedicated /dodaj page (E01-S10). (#269) *(@spokospace)*
- ✨ Cooking mode: fullscreen with Wake Lock (E01-S08). (#274) *(@spokospace)*
- ✨ Fullscreen notifications page and a home-page banner (E01-S15). (#273) *(@spokospace)*
- ✨ Home page visuals per the design handoff, C1/A1 (E01-S20). (#283) *(@spokospace)*
- ✨ Settings: always-visible colour picker and accent preview, 2a (E01-S13b). (#284) *(@spokospace)*
- ✨ Mobile header and menu per the design handoff (E01-S19). (#286) *(@spokospace)*
- ✨ Recipe page fixes per the design handoff, C3 (E01-S07b). (#287) *(@spokospace)*
- ✨ Login 3a, first login 3b and code gate 3c per the design handoff (E01-S12b). (#285) *(@spokospace)*
- ✨ Gendered "Dodała/Dodał" wording in public texts (E01-S23). (#291) *(@spokospace)*
- ✨ Shared list card and favorites bar across search, category and profile (E01-S22). (#292) *(@spokospace)*
- ✨ Versions of the same dish on the recipe page, phase 1 (E01-S21) (fixes #296). (#301) *(@spokospace)*
- ✨ Recipe dish / variant_note columns for the dish backfill (E01-S21). (#300) *(@spokospace)*

### Recipes and cards
- ✨ Mark LLM-estimated times as estimates (fixes #142). (#166) *(@spokospace)*
- ✨ Labelled MENU drawer with Settings and Log out. (#170) *(@spokospace)*
- ✨ Fingerprint the author's text to catch reposts before the LLM. (#177) *(@spokospace)*
- ✨ Recover covers from SSL-broken hosts and strip tracking params. (#187) *(@spokospace)*
- ✨ Add pieczywo and syropy categories. (#189) *(@spokospace)*
- ✨ Pick the right cover for blogs with a bad og:image. (#190) *(@spokospace)*
- ✨ Split baked cakes into a ciasta category. (#198) *(@spokospace)*
- ✨ Generate an SEO meta description at save and backfill existing recipes. (#222) *(@spokospace)*
- ✨ Put the add-from-link tab first in the recipe form. (#224) *(@spokospace)*
- ✨ Recipe icon and ZapiszPrzepis wordmark logo in the navbar. (#276) *(@spokospace)*
- ✨ Terms, privacy policy and data deletion pages (draft template). (#277) *(@spokospace)*
- ✨ Servings on the recipe page: "Składniki · na N porcji". (#293) *(@spokospace)*
- ✨ Full-width phone photos, carousel rows and the heart on the card photo. (#309) *(@spokospace)*
- ✨ "Inne przepisy" as a carousel on phones. (#311) *(@spokospace)*
- ✨ Infinitive recipe steps, YouTube dedup and redirects for merged recipes. (#313) *(@spokospace)*
- ✨ Teach the extraction prompt the step editing rules. (#314) *(@spokospace)*

## 🔒 Security
- 🔒 Guests can read the home page and recipe pages (E01-S02). (#193) *(@spokospace)*
- 🔒 Fail-closed public recipe reads through guest-safe views (E01-S02). (#194) *(@spokospace)*
- 🔒 Add gate: access code, screen 3c (E01-S11). (#251) *(@spokospace)*
- 🔒 Google/Facebook login, one-time gender choice and vocative greeting (E01-S12). (#252) *(@spokospace)*
- 🔒 Dev-only QA sign-in route for agent verification. (#264) *(@spokospace)*
- 🔒 Allow only archived recipe photos through /_next/image (fixes #131). (#303) *(@spokospace)*
- 🔒 Judge only IP literals by address range in isPrivateUrl (fixes #136). (#304) *(@spokospace)*

## 🐛 Fixes
- 🐛 Read Facebook Page photo posts the video plugin refuses. (#154) *(@spokospace)*
- 🖼️ Skip photos inside ad, related-post and comment sections. (#155) *(@spokospace)*
- 🐛 Render recipes with malformed steps instead of crashing (fixes #135). (#156) *(@spokospace)*
- 🖼️ Drop button images and share/print sections from galleries. (#157) *(@spokospace)*
- 🖼️ Keep the cover when a refresh fails to re-archive it (fixes #133). (#158) *(@spokospace)*
- 🖼️ Keep the gallery when re-archiving its photos fails (fixes #159). (#160) *(@spokospace)*
- 🐛 Show a "couldn't check" bell when failed shares fail to load (fixes #137). (#161) *(@spokospace)*
- 🖼️ Drop gallery images that link to another page and video stills. (#162) *(@spokospace)*
- 🐛 Read Facebook Page posts through their /posts/ URL (fixes #163). (#164) *(@spokospace)*
- 🖼️ Archive covers through wsrv.nl when the host refuses Cloudflare. (#165) *(@spokospace)*
- 🐛 Map the LLM's category onto the enum and use JSON mode (fixes #134). (#167) *(@spokospace)*
- 🐛 Read recipes split over WordPress pages (fixes #168). (#169) *(@spokospace)*
- 🐛 Key Facebook links by their post permalink for dedup. (#171) *(@spokospace)*
- 🐛 Use the Blogger feed for custom-domain Blogger blogs. (#172) *(@spokospace)*
- 🐛 Catch Facebook share links and group-name aliases in dedup. (#173) *(@spokospace)*
- 🖼️ Never cut a gallery section that holds the post body. (#174) *(@spokospace)*
- 🐛 Link a reposted recipe to the saved one. (#175) *(@spokospace)*
- 🖼️ Keep Wix post photos and fetch them at full size. (#176) *(@spokospace)*
- 🐛 Label oven time "Pieczenie" instead of "Gotowanie". (#178) *(@spokospace)*
- 🐛 Recover failed Facebook and Blogger imports. (#179) *(@spokospace)*
- 🐛 Word Facebook video failures by what was actually seen. (#180) *(@spokospace)*
- 🐛 Skip feed section headings when reading a Facebook post message. (#181) *(@spokospace)*
- 🔧 Give normalize_url_strip_tracking a unique migration version. (#191) *(@spokospace)*
- 🔧 Give normalize_url a unique migration timestamp. (#197) *(@spokospace)*
- 🖼️ Reject self-link and decorative images when picking a cover or gallery. (#234) *(@spokospace)*
- 🐛 Post-merge review fixes for one-recipe-per-link (E01-S03a). (#236) *(@spokospace)*
- 🐛 Catch subset-ingredient duplicates and stop group og: covers. (#238) *(@spokospace)*
- 🐛 Read a Facebook group post's album (set=a) photo as its cover. (#240) *(@spokospace)*
- 🐛 Add root and global error boundaries. (#241) *(@spokospace)*
- 🐛 Reflow guard at 320 px / A++ across E01 screens. (#294) *(@spokospace)*
- 🐛 Catch near-simultaneous duplicates by ingredient set. (#306) *(@spokospace)*
- 🖼️ Drop shop logos from publisher offer boxes and dedupe LiipImagine renditions. (#310) *(@spokospace)*
- 🐛 Dish versions list each ingredient once and match its word forms. (#312) *(@spokospace)*

## 🛠️ Improvements
- 🛠️ Limit Exa recipe search to trusted recipe sites. (#182) *(@spokospace)*
- 🛠️ Keep ingredient-only YouTube recipes and detect the new Facebook Watch feed. (#183) *(@spokospace)*
- 🛠️ Name known Facebook authors in the recipe source label. (#184) *(@spokospace)*
- 🛠️ Store the source author at import and show it in the recipe label. (#185) *(@spokospace)*
- 🛠️ Never store a private person's full name as the source author. (#186) *(@spokospace)*
- 🛠️ Skeletons on navigation and progress on list filters (fixes #227, #228). (#242) *(@spokospace)*
- 🛠️ Desktop layouts, A8 and A9 (E01-S17). (#275) *(@spokospace)*
- 🛠️ Per-grid image sizes for two-column tile grids (fixes #253). (#302) *(@spokospace)*
- 🛠️ Stop loading unused Geist web fonts (fixes #233). (#305) *(@spokospace)*

## 📝 Specs & Documentation
- 📝 Configure the agent PR pipeline (open-mercato skills). (#153) *(@spokospace)*
- 📝 E01 rebuild epic: backlog slicing and the S02 spec. (#196) *(@spokospace)*
- 📝 E01-S03a spec: one recipe per link. (#199) *(@spokospace)*
- 📝 Spec for the /przepis slug and 301 (E01-S03b). (#221) *(@spokospace)*
- 📝 Record the E01 backlog tree as GitHub issues. (#237) *(@spokospace)*
- 📝 E01 screen specs: S09 menu drawer, S11 add gate, S07 recipe page, S04 home, S12 OAuth login. (#243, #244, #245, #247, #248) *(@spokospace)*
- 📝 E01 screen specs: S06 favorites, S13 settings, S05 search, S14 public profile, S16 category. (#254, #255, #256, #257, #258) *(@spokospace)*
- 📝 Document the QA sign-in accounts and workflow. (#265) *(@spokospace)*
- 📝 Add the E01 rebuild design handoff (1c + 1a navigation). (#266) *(@spokospace)*
- 📝 E01 screen specs: S10 /dodaj, S08 cooking mode, S15 notifications, S17 desktop layouts. (#267, #268, #270, #271) *(@spokospace)*
- 📝 Design-gap audit of shipped E01 screens against the final handoff. (#272) *(@spokospace)*
- 📝 E01-S21 spec: versions of the same dish. (#297) *(@spokospace)*
- 📝 One-account rule: review own PRs, merge on green tests. (#308) *(@spokospace)*

## 👥 Contributors

- @spokospace
