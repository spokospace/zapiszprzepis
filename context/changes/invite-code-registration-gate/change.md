---
change_id: invite-code-registration-gate
title: Invite-code registration gate
status: implemented
created: 2026-07-04
updated: 2026-07-04
archived_at: null
---

## Notes

Roadmap S-07. New registration must require a valid invite code; without one, sign-up is rejected. Closes open registration on the public domain `zapiszprzepis.pl` — currently anyone can request a magic link and create an account.

User-requested directly (2026-07-04): "wprowadź zabezpieczenie przed nowymi rejestracjami — np. input z kodem do wpisania, aby móc się rejestrować."

Constraints: existing logged-in users (mama) must NOT be affected — the gate applies only to *new* sign-up, not to login of an existing session. Extends PRD §Access Control (which currently describes only passwordless magic-link); recommend adding FR-014 to the PRD (roadmap Open Question #5). Mechanism is open (Open Question in roadmap S-07): single env-configured code vs one-time codes table vs email allow-list — default to the simplest for 1–2 users, decide in /10x-plan.

Prereq: F-01 auth (magic-link, `requireUser`, signup action) — present on master.
