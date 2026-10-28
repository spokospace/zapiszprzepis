# Docs site

A [Starlight](https://starlight.astro.build) site that renders the repository's
Markdown documentation in one place, with a sidebar and search. It copies
nothing: the content collection reads the files where they live.

| Sidebar group | Folder                 |
| ------------- | ---------------------- |
| Foundation    | `context/foundation/`  |
| Specs         | `.ai/specs/`           |
| Changes       | `context/changes/`     |

A new Markdown file in any of these folders appears on the next build, sorted
by file name within its group. A flow page written by the `om-document-flow`
skill into `context/foundation/` is picked up the same way.

The site is local only. Nothing deploys it.

## Run it

From the repository root:

```bash
pnpm docs:dev
```

That installs the site's own dependencies (first run only, then a no-op) and
starts the dev server at <http://localhost:4321>. To build the static site into
`docs/dist/` instead:

```bash
pnpm docs:build
```

`docs/` is its own package with its own lockfile. It is not part of the app.
`pnpm typecheck` and `pnpm lint` skip it, and `pnpm test` never looked here.
Inside `docs/`, `pnpm check` type-checks the site.

## How the files are read

Most of the docs have no `title` in their frontmatter, and Starlight requires
one. Nobody has to add one:

- `src/lib/repo-docs-loader.ts` wraps Astro's `glob()` loader once per folder
  above and derives the title. It takes frontmatter `title` if present, then
  the first `# ` heading, then a readable form of the file name. The leading
  `# ` heading is not printed twice.
- A frontmatter block that is not valid YAML, such as an unquoted
  `title: A: B`, does not stop the build. The file is read line by line and
  the build prints a warning naming it. Two change plans do this today.
- `src/lib/remark-repo-docs.ts` rewrites relative links. A link to another
  rendered doc goes to its page. A link to any other repository file, such as
  source code, goes to that file on GitHub.
- ```` ```mermaid ```` blocks are drawn at build time by `rehype-mermaid`,
  once for the light theme and once for the dark. A diagram with a syntax
  error shows its source and the parser's message instead. Two specs have one
  today; GitHub cannot draw them either.

"Edit page" opens the real file on GitHub.

### Mermaid needs Chromium

Build-time Mermaid runs in headless Chromium through Playwright. The site pins
`playwright` to the same version as the app's `@playwright/test`, so it reuses
the browser the e2e suite already installed and downloads nothing. If the two
versions drift apart, the build fails with a missing-browser error. Fix it by
bumping the pin here to match, or by running this command:

```bash
pnpm --dir docs exec playwright install chromium
```

The build-time route was picked over client-side Mermaid because it needs no
new download here. It also ships no Mermaid JavaScript to readers, and broken
diagrams show up at build time.

### Stale pages in dev

Astro caches rendered entries by file content. If you change a plugin under
`src/lib/` and a page does not update, clear the cache:

```bash
rm -rf docs/.astro docs/node_modules/.astro
```

## Deploying it: a decision for the owner

Nothing here is deployed, and nothing should be until the owner decides.

**What would be published.** The repository is public, so every file this site
renders can already be read on GitHub. A docs site makes the same text easier
to find and read. A scan of the rendered folders found no keys or tokens. It
did find the Supabase project hostname, which the app's browser bundle exposes
anyway, and internal plans, model costs and audit notes, which are fine to
publish only if you are comfortable with that. Reread `context/foundation/`
with that in mind before choosing public.

**Cloudflare Pages, Git integration.** Create a Pages project on this
repository with these settings:

| Setting                | Value                                  |
| ---------------------- | -------------------------------------- |
| Root directory         | `docs`                                 |
| Build command          | `pnpm install && pnpm build`           |
| Build output directory | `dist`                                 |
| Production branch      | `master`                               |

Pages clones the whole repository, so the loader can still read `../context`
and `../.ai/specs`. The catch is Chromium. The Pages build image does not have
Playwright's browser, and this has not been tested there. Pick one of these:

1. **Install it in the build.** Prefix the build command with
   `pnpm exec playwright install chromium &&`. This adds a full browser
   download to every build. Whether the image has Chromium's system libraries
   is untested.
2. **Draw diagrams in the browser on Pages only.** Switch `rehype-mermaid` to
   `strategy: 'pre-mermaid'` when `CF_PAGES` is set, and load Mermaid on the
   page. This needs no browser at build time but ships Mermaid to readers.
3. **Build here, upload the result.** Run `pnpm docs:build`, then
   `wrangler pages deploy docs/dist --project-name <name>`. This needs no CI
   and no browser in the cloud, but someone has to remember to run it.

Option 3 fits this repository best. GitHub Actions minutes are not available,
and the app already ships through local commands. Set `site` in
`astro.config.mjs` to the final URL so the sitemap and canonical links come out
right.

**Gating it with Cloudflare Access.** If the docs should stay private, put the
Pages project behind Access:

1. Pages project, **Settings**, **General**, **Enable access policy**. This
   protects preview deployments only.
2. To cover the `*.pages.dev` hostname too, open that Access application in
   **Zero Trust**, **Access controls**, **Applications**. Remove the `*`
   wildcard from its subdomain, then re-enable the preview policy. Cloudflare's
   "Known issues" page for Pages describes this step.
3. A custom domain needs its own self-hosted Access application, or the login
   page renders but does not let anyone in.
4. Use an allow policy for the owner's e-mail with one-time PIN login.

Without Access, the site is as public as the repository.
