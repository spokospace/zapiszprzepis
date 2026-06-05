#!/usr/bin/env bash
# One-shot migration: context/foundation/roadmap.md (v2, 2026-06-02)
#   -> GitHub Issues on spokospace/zapiszprzepis
#
# Creates 6 labels and 12 issues (3 Open Questions + 2 Foundations + 7 Slices).
# Issues are created in dependency order so cross-references use real numbers.
#
# Requires: gh CLI authenticated, run from repo root.
# Not idempotent - intended for a clean issue tracker.

set -euo pipefail

REPO_SLUG="spokospace/zapiszprzepis"
ROADMAP_REF="context/foundation/roadmap.md"

# Body files land in a tempdir that is cleaned on exit.
TMPDIR_BODY="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_BODY"' EXIT

# --- Phase 1: labels -------------------------------------------------------

echo "==> Creating labels"

create_label() {
  local name="$1" color="$2" desc="$3"
  if gh label create "$name" --color "$color" --description "$desc" --force >/dev/null 2>&1; then
    echo "    + $name"
  else
    echo "    ! failed to create label: $name" >&2
    return 1
  fi
}

create_label "roadmap:foundation" "1d76db" "Infra/platform prerequisite (F-XX)"
create_label "roadmap:slice"      "0e8a16" "End-to-end user-visible slice (S-XX)"
create_label "status:ready"       "c2e0c6" "Cleared to plan"
create_label "status:blocked"     "e99695" "Waiting on an Open Question or upstream issue"
create_label "guiding-star"       "fbca04" "Guiding-star slice (the single end-to-end validation cut)"
create_label "decision-needed"    "d4c5f9" "Open Question - must be resolved before a slice can start"

# --- Helpers ---------------------------------------------------------------

# write_body <filename> <<<'heredoc content'
write_body() {
  local filename="$1"; shift
  cat > "$TMPDIR_BODY/$filename"
}

# create_issue <body-file> <title> <label> [<label> ...]
# Echoes the created issue's number on stdout.
create_issue() {
  local body_file="$1" title="$2"; shift 2
  local label_args=()
  for lbl in "$@"; do label_args+=( --label "$lbl" ); done

  local url
  url="$(gh issue create \
    --repo "$REPO_SLUG" \
    --title "$title" \
    --body-file "$TMPDIR_BODY/$body_file" \
    "${label_args[@]}")"
  # gh prints the issue URL on the last line.
  local num="${url##*/}"
  echo "    + #$num  $title" >&2
  printf '%s' "$num"
}

# --- Phase 2a: Open Questions ---------------------------------------------

echo "==> Creating Open Question issues"

write_body oq1.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) §"Otwarte pytania", item #1

## Question
Can Playwright, yt-dlp, or the Facebook Graph API reliably extract audio + screenshot from Facebook Reels in MVP scope? Or will FB rate-limits / bot detection force a best-effort-only strategy?

## Owner
Author

## Resolution criteria
1-2 day feasibility spike **before** S-04 implementation starts. Output: a written decision on full-scraping vs best-effort fallback in the change folder for \`fb-reel-recipe-source\`.
EOF
OQ1="$(create_issue oq1.md \
  "[OQ-1] Decide: Facebook Reels scraping feasibility (Playwright / yt-dlp / FB Graph API)" \
  "decision-needed")"

write_body oq2.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) §"Otwarte pytania", item #2

## Question
Does the proposed 8-category fixed taxonomy (Obiady, Zupy, Desery, Śniadania, Przekąski, Wegetariańskie, Napoje, Inne) cover mom's typical recipe patterns? Are "Wypieki", "Sałatki", or "Słoiki/przetwory" missing?

## Owner
Author (conversation with mom)

## Resolution criteria
A short interview with mom. Output: confirmed taxonomy list pinned in PRD and used by the LLM classifier prompt in S-01..S-04 extractions.
EOF
OQ2="$(create_issue oq2.md \
  "[OQ-2] Confirm fixed category taxonomy with mom" \
  "decision-needed")"

write_body oq3.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) §"Otwarte pytania", item #3

## Question
What is the author-alert channel for permanently failed recipes? Email, Slack push, or manual review in the DB?

## Owner
Author

## Resolution criteria
Decision made during \`/10x-plan\` for \`error-ux-and-author-alerts\`. Default candidate: email (simplest); Slack gives faster push to phone.
EOF
OQ3="$(create_issue oq3.md \
  "[OQ-3] Pick author-alert channel for permanently failed recipes (email / Slack / DB review)" \
  "decision-needed")"

# --- Phase 2b: Foundations ------------------------------------------------

echo "==> Creating Foundation issues"

write_body f01.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) (v2, updated 2026-06-02)
> Change ID: \`async-job-runner\`

## Outcome
(foundation) A Trigger.dev project is created and linked to the repo; a single example task runs end-to-end - the Next.js server triggers a job, Trigger.dev executes it off the Worker request-path, and a callback returns the completion state.

## PRD references
FR-003 (ack < 1s + async 1-3 min processing), NFR "typical p95 ≤ 3 min".

## Prerequisites
None.

## Parallel with
- [F-02] PWA shell with Web Share Target

## Unknowns
- Does the Trigger.dev SDK run stably on the workerd runtime (Cloudflare Workers, not Node)? Owner: author. Blocks: no. Decision after \`/10x-research\`.
- Does the Trigger.dev webhook callback to the Worker have a stable URL + secret pattern for \`wrangler.jsonc\` env vars? Owner: author. Blocks: no. Standard pattern, to be confirmed.

## Risk
Trigger.dev is less familiar than native Cloudflare Queues, so the tooling learning curve is real; the choice is dictated by NFR (Cloudflare Workers + Queues without Durable Objects have their own execution-time limits; Trigger.dev gives the full 1-3 min). Trap: do not try to run the scraper in the Worker itself - the 30s HTTP timeout is brutal.

## Status
\`ready\`
EOF
F01="$(create_issue f01.md \
  "[F-01] Configure Trigger.dev for async background jobs (off Worker request-path)" \
  "roadmap:foundation" "status:ready")"

write_body f02.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) (v2, updated 2026-06-02)
> Change ID: \`pwa-shell-and-share-target\`

## Outcome
(foundation) PWA is installable on the Pixel 9 home screen (manifest + service worker + icons); the \`share_target\` field in the manifest points at a Next.js endpoint; when mom taps "Share" in any app, ZapiszPrzepis appears on the recipient list.

## PRD references
FR-002 (system "Share" gesture from any app), NFR "PWA installable + Web Share Target API on the two latest Chrome and Edge on Android", Guardrail "works on her Pixel 9".

## Prerequisites
None.

## Parallel with
- [F-01] Trigger.dev async job runner

## Unknowns
- Does \`next-pwa\` on Next.js 16 App Router stably generate the manifest + SW for Cloudflare Workers static asset serving? Owner: author. Blocks: no. Confirm in \`/10x-research\` or spike.
- Does the share_target POST from the Facebook app (vs Chrome) behave consistently? Owner: author. Blocks: no. Real test requires deployed PWA.

## Risk
Web Share Target API is only supported in Chrome/Edge on Android (not iOS Safari), but PRD \`target_scale.users: small\` + a specific device (Pixel 9 Android) makes the limitation acceptable. Trap: integrating \`next-pwa\` with Next.js 16 App Router + Cloudflare Workers static assets has known rough edges (service worker scope, manifest cache).

## Status
\`ready\`
EOF
F02="$(create_issue f02.md \
  "[F-02] Add PWA shell with Web Share Target manifest, installable on Pixel 9" \
  "roadmap:foundation" "status:ready")"

# --- Phase 2c: S-01 guiding star ------------------------------------------

echo "==> Creating S-01 (guiding star)"

write_body s01.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) (v2, updated 2026-06-02)
> Change ID: \`web-blog-recipe-source\`

## Outcome
Mom shares a cooking-blog URL via the system "Share -> ZapiszPrzepis" gesture, sees a "Saved - the recipe will appear shortly" confirmation in < 1s, and 1-3 minutes later (when she returns to the app) a new recipe card with a Polish title and thumbnail is on the list. Tapping it shows the full recipe: photo, ingredients as a bulleted list (UL), numbered steps, a normalized source label ("Blog: <domain>"), and an optional "Open original" button.

## PRD references
US-01, FR-002 (share intent), FR-003 (ack < 1s + async 1-3 min), FR-004 (web blog - one of four supported sources), FR-005 (EN->PL translation + US->metric conversion), FR-006 (durable copy with UL ingredients), FR-007 (list ordered by most recent - minimal version), FR-009 (single full recipe view - basic version).

## Prerequisites
- Blocked by #$F01 - [F-01] Trigger.dev async job runner
- Blocked by #$F02 - [F-02] PWA shell with Web Share Target

## Parallel with
- None (convergence point).

## Unknowns
- US->metric conversion precision (PRD Open Q#2): is the LLM accurate enough for ambiguous cases ("1 cup of flour" = 120-150g depending on flour), or do we need a \`convert-units\` library with explicit mapping? Owner: author. Blocks: no. Decision after first 10-20 EN tests; ship best-effort, refine.
- Do Firecrawl/Jina give sufficient quality for Polish cooking blogs (mixed HTML, lots of embedded media, sometimes heavy JS)? Owner: author. Blocks: no. Spike during \`/10x-plan\`.

## Risk
Concentrates the most risk - first end-to-end run of the full pipeline (share -> queue -> scraping -> LLM -> DB -> display). But blogs are the least risky source: Firecrawl/Jina are mature, most blogs serve clean HTML with og:image. Trap: blogs with heavy JS rendering (SPA-style) may need a Playwright fallback. Sequenced as the first source because it gives mom fast validation without FB scraping risk.

## Status
\`ready\`
EOF
S01="$(create_issue s01.md \
  "[S-01] Share blog URL → Polish recipe end-to-end (guiding star)" \
  "roadmap:slice" "status:ready" "guiding-star")"

# --- Phase 2d: ready slices that depend only on S-01 ----------------------

echo "==> Creating ready slices (S-02, S-03, S-06)"

write_body s02.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) (v2, updated 2026-06-02)
> Change ID: \`first-shared-recipe-fb-text\`

## Outcome
Mom shares a Facebook text post URL (typically cooking groups) and sees the recipe in the app exactly as for a web blog (same pipeline, different scraper at the front).

## PRD references
FR-004 (Facebook text posts as a supported source).

## Prerequisites
- Blocked by #$S01 - [S-01] guiding-star pipeline

## Parallel with
- [S-03], [S-04], [S-05], [S-06], [S-07]

## Unknowns
- Is \`og:description\` + inline HTML from FB posts enough for typical cooking groups, or is content often inside images (which need OCR)? Owner: author. Blocks: no. Spike after S-01 ships.
- Will FB rate-limit per IP block scraping quickly (Workers has no IP rotation)? Owner: author. Blocks: no. Best-effort fallback to og:image + title + URL with a note.

## Risk
FB text posts scrape more easily than Reels (content sits in og:description / inline HTML), but FB rate-limits are real; best-effort fallback: on partial extraction save og:image + title + URL and mark the recipe with an "incomplete extraction" note (per FR-004 best-effort and NFR "no request dies silently").

## Status
\`ready\`
EOF
S02="$(create_issue s02.md \
  "[S-02] Add Facebook text post as second source (reuse S-01 pipeline)" \
  "roadmap:slice" "status:ready")"

write_body s03.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) (v2, updated 2026-06-02)
> Change ID: \`youtube-recipe-source\`

## Outcome
Mom shares a YouTube URL (full video or Short) and sees a recipe with full content pulled from an audio transcript (Whisper).

## PRD references
FR-004 (YouTube + Shorts as a supported source).

## Prerequisites
- Blocked by #$S01 - [S-01] guiding-star pipeline

## Parallel with
- [S-02], [S-04], [S-05], [S-06], [S-07]

## Unknowns
- Whisper API quality on Polish YouTube cook accents - usually acceptable, but noisy input occasionally hurts LLM extraction. Owner: author. Blocks: no. Test on 10 PL + 10 EN videos after S-01 ships.
- Whisper API cost per minute of video vs NFR ≤ 10 PLN/month - ~50 recipes * avg 10 min audio * \$0.006/min ≈ \$3/month (~12 PLN, tight). Owner: author. Blocks: no. Mitigation: use yt-dlp only when a heuristic suggests "has ingredients/instructions"; or self-hosted whisper.cpp.

## Risk
yt-dlp is mature and reliable; main risk is transcription quality + cost. Trap: long videos (>30 min vlogs with the recipe at the end) need smart segmenting of the recipe portion, otherwise Whisper bill runs away.

## Status
\`ready\`
EOF
S03="$(create_issue s03.md \
  "[S-03] Add YouTube (video + Shorts) as source via yt-dlp + Whisper" \
  "roadmap:slice" "status:ready")"

write_body s06.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) (v2, updated 2026-06-02)
> Change ID: \`recipe-search\`

## Outcome
Mom types part of a title or an ingredient name in the search field on the recipe list and sees results filter immediately.

## PRD references
FR-013 (simple textual search by title and ingredient - ILIKE / pg_trgm).

## Prerequisites
- Blocked by #$S01 - [S-01] guiding-star pipeline

## Parallel with
- [S-02], [S-03], [S-04], [S-05], [S-07]

## Unknowns
None.

## Risk
Lowest technical risk - ILIKE is enough for ~100 recipes; \`pg_trgm\` (already installed in F-01's baseline) when LIKE proves too rigid (e.g. inflected forms "mąka" vs "mąki"). UX trap: searching by ingredient requires exploding the JSON-shaped ingredients field into rows (or a GIN index) - the schema-shape decision in S-01 directly affects ease of implementation here.

## Status
\`ready\`
EOF
S06="$(create_issue s06.md \
  "[S-06] Search recipes by title and ingredient (ILIKE / pg_trgm)" \
  "roadmap:slice" "status:ready")"

# --- Phase 2e: blocked slices --------------------------------------------

echo "==> Creating blocked slices (S-04, S-05, S-07)"

write_body s04.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) (v2, updated 2026-06-02)
> Change ID: \`fb-reel-recipe-source\`

## Outcome
Mom shares a Facebook Reels (or FB video) URL and sees a recipe - when Whisper audio extraction succeeds the content is full; in best-effort mode (FB rate-limit) the saved record is a screenshot + title + URL with a note "incomplete extraction".

## PRD references
FR-004 (FB Reels/Video as supported source, with Socratic best-effort strategy).

## Prerequisites
- Blocked by #$S01 - [S-01] guiding-star pipeline
- Blocked by #$OQ1 - [OQ-1] FB Reels scraping feasibility decision

## Parallel with
- [S-02], [S-03], [S-05], [S-06], [S-07]

## Unknowns
- Outcome of the FB Reels feasibility spike (OQ-1). Owner: author. Blocks: yes. Without this answer the slice cannot be planned - best-effort vs full-scraping changes the size of work materially.

## Risk
Highest among sources - FB aggressively blocks scrapers; it may turn out that the background agent needs to rotate IPs and user-agents, accept frequent failures, and lean almost entirely on og:image from the share_target callback (not on actual Reels content).

## Status
\`blocked\`
EOF
S04="$(create_issue s04.md \
  "[S-04] Add Facebook Reels as source (audio + screenshot, best-effort)" \
  "roadmap:slice" "status:blocked")"

write_body s05.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) (v2, updated 2026-06-02)
> Change ID: \`category-browse\`

## Outcome
Mom can open a category (Obiady / Zupy / Desery / Śniadania / Przekąski / Wegetariańskie / Napoje / Inne - or a different list once OQ-2 resolves) and see only the recipes in that category. The category was assigned automatically by the LLM during extraction in S-01..S-04.

## PRD references
FR-008 (browse by fixed taxonomy with categories assigned automatically by AI).

## Prerequisites
- Blocked by #$S01 - [S-01] guiding-star pipeline
- Blocked by #$OQ2 - [OQ-2] category taxonomy confirmation with mom

## Parallel with
- [S-02], [S-03], [S-04], [S-06], [S-07]

## Unknowns
- Outcome of the taxonomy conversation with mom (OQ-2). Owner: author. Blocks: yes. Shipping with the default 8-item list would force a refactor if mom adds categories later.

## Risk
Little technical risk (WHERE category = X); main product risk is LLM classification consistency - the same recipe shape may land in "Obiady" once and "Wegetariańskie" another time; the fixed taxonomy prompt (already in PRD) helps, but quality must be audited on the first ~20 recipes.

## Status
\`blocked\`
EOF
S05="$(create_issue s05.md \
  "[S-05] Browse recipes by fixed-taxonomy category" \
  "roadmap:slice" "status:blocked")"

write_body s07.md <<EOF
> Source: [\`$ROADMAP_REF\`](../blob/master/$ROADMAP_REF) (v2, updated 2026-06-02)
> Change ID: \`error-ux-and-author-alerts\`

## Outcome
When recipe extraction fails (unsupported source, video too long, FB blocked access), mom sees a readable message instead of a silent failure; a "Try again" button works up to 3 times then disappears, leaving only "Delete"; the author receives a notification (channel TBD per OQ-3) about the permanently failed recipe with URL and error message.

## PRD references
FR-012 (readable message + bounded retry max 3 + author notification), NFR "no shared request dies silently".

## Prerequisites
- Blocked by #$S01 - [S-01] guiding-star pipeline
- Blocked by #$OQ3 - [OQ-3] author-alert channel decision

## Parallel with
- [S-02], [S-03], [S-04], [S-05], [S-06]

## Unknowns
- Outcome of the alert-channel decision (OQ-3). Owner: author. Blocks: yes. Default candidate: email (simplest), but Slack gives instant push to the author's phone; decision per \`/10x-plan\`.

## Risk
Little technical risk (DB counter + transactional email/webhook). UX trap: the error message text must be understandable to mom (not "HTTP 429 Too Many Requests" but "Facebook temporarily blocked us - try again in a moment"). Sequenced after a stable pipeline from S-01, because only then do we know the real catalogue of failure modes.

## Status
\`blocked\`
EOF
S07="$(create_issue s07.md \
  "[S-07] Error UX with bounded retry (max 3) + author alert on permanent fail" \
  "roadmap:slice" "status:blocked")"

# --- Summary --------------------------------------------------------------

echo ""
echo "==> Done."
echo "    Open Questions: #$OQ1 #$OQ2 #$OQ3"
echo "    Foundations:    #$F01 #$F02"
echo "    Slices:         #$S01 #$S02 #$S03 #$S04 #$S05 #$S06 #$S07"
echo ""
echo "    Verify with:"
echo "      gh issue list --label roadmap:foundation   # expect 2"
echo "      gh issue list --label roadmap:slice        # expect 7"
echo "      gh issue list --label status:blocked       # expect 3"
echo "      gh issue list --label guiding-star         # expect 1"
echo "      gh issue list --label decision-needed      # expect 3"
