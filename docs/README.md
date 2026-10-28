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

## Deploying it

The site is the Cloudflare Pages project `zapiszprzepis-docs` on the account
that runs the app, served publicly at <https://zapiszprzepis-docs.pages.dev>.
Nothing builds it in the cloud: it is built on a machine that has the
Playwright Chromium, and the finished `dist/` is uploaded.

```bash
pnpm docs:deploy
```

That installs the docs' dependencies, builds, and runs
`wrangler pages deploy dist` as a production deployment of the `master`
branch. Run it from the repository root, in any shell, after merging anything
that changes the rendered folders.

**Which account and login it uses.** `docs/scripts/ship.mjs` sets both, so the
command needs no environment variables: the account that runs the app, and a
wrangler login kept in `~/.wrangler-zapiszprzepis`, so a wrangler signed in
to another account on the same machine is neither used nor replaced. The
script explains why each is needed, and either can be overridden from the
environment. Sign that login in once, or again when it expires:

```bash
pnpm docs:login
```

**Why not Pages' Git integration or GitHub Pages.** Both build in the cloud,
where there is no Chromium for the Mermaid diagrams, and GitHub Pages
publishes through GitHub Actions, which this account cannot run.

**`docs/wrangler.jsonc`.** Wrangler looks for a config file upwards from
where it runs. Without this one it finds the app's `../wrangler.jsonc` and
treats the docs as the app's Worker. Recent wrangler versions also try to hand
`pages` commands to Workers; the project is created once with
`wrangler pages project create --force`, and later commands go to Pages
directly.

**What is published.** The site is public, like the repository it renders: the
same text as on GitHub, easier to read. A scan of the rendered folders found no
keys or tokens, only the Supabase project hostname, which the app's browser
bundle exposes anyway. Internal plans, model costs and audit notes are among
the pages. Putting it behind Cloudflare Access later needs Zero Trust enabled
on the account and a self-hosted Access application for
`zapiszprzepis-docs.pages.dev` and `*.zapiszprzepis-docs.pages.dev`.
