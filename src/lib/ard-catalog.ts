/**
 * Agentic Resource Discovery (ARD) catalog, served at
 * `/.well-known/ai-catalog.json` and `/.well-known/ard.json` (#546).
 *
 * Two paths, one document: Lighthouse 13.5's `ard-schema` audit reads only
 * `ai-catalog.json` (ARD's predecessor name), while ARD v0.91 names `ard.json`.
 * Both must answer an anonymous request with JSON — the login redirect they got
 * before failed the audit as "Malformed JSON in manifest".
 *
 * Entries list only what the site really publishes for machines: `/llms.txt`.
 * There is no MCP server or public API to advertise.
 *
 * Spec: https://agenticresourcediscovery.org/spec/ (`ArdManifest`).
 */

interface ArdEntry {
  identifier: string
  displayName: string
  type: string
  url: string
  description: string
  tags: string[]
  representativeQueries: string[]
  trustManifest: { identity: string; identityType: 'https' }
}

interface ArdManifest {
  specVersion: '1.0'
  entries: ArdEntry[]
}

/** `identifier` pattern from the ARD JSON Schema (`EntryFields.identifier`). */
export const ARD_IDENTIFIER_PATTERN = /^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/

/** Builds the manifest for a site origin such as `https://zapiszprzepis.pl`. */
export function buildArdCatalog(site: string): ArdManifest {
  const { origin, hostname } = new URL(site)
  // The URN's domain segment and trustManifest.identity must name the same
  // publisher (ARD §4.5.1), so both come from the one origin.
  const trustManifest = { identity: origin, identityType: 'https' as const }

  return {
    // ARD v0.91 requires only `entries`, but the validator PageSpeed Insights
    // runs (Lighthouse 13.5) still fails a manifest without the root
    // `specVersion`; "1.0" is what its own valid fixture uses.
    specVersion: '1.0',
    entries: [
      {
        identifier: `urn:air:${hostname}:llms-txt`,
        displayName: 'Zapisz Przepis — llms.txt',
        type: 'text/markdown',
        url: `${origin}/llms.txt`,
        description:
          'Indeks katalogu przepisów kulinarnych po polsku dla modeli językowych: kategorie i przepisy, każdy z odnośnikiem do wersji Markdown.',
        tags: ['llms.txt', 'przepisy', 'kuchnia polska', 'gotowanie'],
        representativeQueries: [
          'Przepis na sernik krok po kroku',
          'Jakie są przepisy na szybki obiad?',
          'Lista składników na pierogi ruskie',
        ],
        trustManifest,
      },
    ],
  }
}

/** The response both well-known routes send. */
export function ardCatalogResponse(site: string): Response {
  return new Response(`${JSON.stringify(buildArdCatalog(site), null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate',
      // /.well-known/ skips the middleware that adds the security headers.
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
