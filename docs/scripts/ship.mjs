// Builds the docs and uploads them to Cloudflare Pages, or (`login`) signs
// wrangler in for that. The account and wrangler's config folder are set
// here, not in the shell, so `pnpm docs:deploy` works the same from
// PowerShell, cmd and bash. Either can still be overridden from the
// environment. Run it through pnpm (`pnpm docs:deploy`, `pnpm docs:login`).
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

/** The Cloudflare account that also runs the app. */
const ACCOUNT_ID = '7a4ca0444df1850c59cc436a4ff3ea71';

const env = {
  ...process.env,
  // A wrangler login of its own, so a login to another account elsewhere on
  // this machine is neither used nor replaced.
  XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.wrangler-zapiszprzepis'),
  // Pages config files cannot pin an account, and wrangler otherwise reuses
  // the last one it cached under node_modules/.cache/wrangler.
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? ACCOUNT_ID,
};

/** Runs pnpm with `args`; returns its exit status. */
function pnpm(args) {
  // pnpm sets npm_execpath to its own entry point, so no shell is needed to
  // find the Windows .cmd shim.
  return spawnSync(process.execPath, [process.env.npm_execpath, ...args], { stdio: 'inherit', env }).status ?? 1;
}

function exitOnFailure(status, hint) {
  if (status === 0) return;
  if (hint) console.error(`\n${hint}`);
  process.exit(status);
}

if (!process.env.npm_execpath) exitOnFailure(1, 'Run this through pnpm: pnpm docs:deploy or pnpm docs:login.');

if (process.argv[2] === 'login') {
  exitOnFailure(pnpm(['exec', 'wrangler', 'login']));
} else {
  exitOnFailure(pnpm(['run', 'build']));
  exitOnFailure(
    pnpm(['exec', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', 'zapiszprzepis-docs', '--branch', 'master', '--commit-dirty=true']),
    `Upload failed. If wrangler is not signed in (its login for this site is in ${env.XDG_CONFIG_HOME}), run: pnpm docs:login`,
  );
}
