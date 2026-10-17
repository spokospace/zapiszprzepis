import path from 'path'

/** The dev QA accounts (docs/dev-qa-login.md): full access, and signed in without it. */
export const QA_ACCOUNTS = ['full', 'free'] as const
export type QaAccount = (typeof QA_ACCOUNTS)[number]

/** Saved session of a dev QA account, written by reflow.setup.ts. */
export const qaSessionFile = (as: QaAccount) => path.join(__dirname, `.auth/qa-${as}.json`)
