# The Common Sense

A mobile-first PWA that walks you through a real situation using the **Four Pillars of Respect**, then returns an AI-generated read. The app guides; you decide.

- Spec: [`docs/spec-v0.1.md`](docs/spec-v0.1.md)
- Framework: [`docs/four-pillars-of-respect.md`](docs/four-pillars-of-respect.md)

## Stack

| Piece | Choice |
| --- | --- |
| Frontend | Preact + Vite + TypeScript (about 15 KB of JS, gzipped) |
| Hosting + API | One Cloudflare Worker: serves the built app and runs `/api` |
| Database | Cloudflare D1 |
| AI | Gemini API (free tier), called only from Functions |
| Sign-in | Google sign-in (ID token verified server-side) |

## Project layout

```
shared/        Used by both browser and server
  config.ts      Daily cap, character limits, timeouts (one place to change each)
  questionBank.ts  The interview: questions, branching, validation (versioned)
  result.ts      AI output schema + strict validator
server/        Runs in the Cloudflare Worker
  api.ts         Every /api route
  gemini.ts      The only code that talks to Gemini (retry once on bad JSON)
  prompt.ts      System prompt: guardrails + the framework text
  google.ts      Google ID token verification
  dates.ts       Asia/Manila day boundaries for the daily cap
  worker.ts      Worker entry: /api/* → api.ts, everything else → the built app
migrations/    D1 schema
src/           The PWA (screens in src/screens)
public/        Manifest, service worker, icons, security headers
tests/         Unit + API tests (Vitest, in-memory SQLite stand-in for D1)
e2e/           Full browser run against wrangler + a mock Gemini
```

## Run it locally

```bash
npm install
```

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`: put in a Gemini key, or leave `DEV_LOGIN=true` and point `GEMINI_BASE_URL` at the mock (see below).

```bash
npm run db:migrate:local
```

```bash
npm run build && npm run worker:dev
```

Open http://localhost:8788. With `DEV_LOGIN=true` you get a "Dev sign-in" button, which only works on localhost.

To use the mock Gemini instead of the real one, run this in another terminal and set `GEMINI_BASE_URL=http://127.0.0.1:8790` in `.dev.vars`:

```bash
node -e "import('./e2e/mock-gemini.mjs').then(m => m.startMockGemini())"
```

## Tests

```bash
npm test
```

Runs 41 unit and API tests: branching, validation, ownership 404s, usage cap, retries, deletion, and Google token checks.

```bash
npm run build && npm run e2e
```

Runs the real Worker and D1 locally with a 390 px browser, walks every screen, and saves screenshots to `e2e/screens/`.

```bash
npm run build && npm run check:bundle
```

Scans the built client for the Gemini key or endpoint.

## Deploy to Cloudflare

Production is already wired up: `wrangler.toml` points at the `common-sense` D1 database, and its tables were created in the D1 console.

**From the dashboard (Workers Builds):** Workers & Pages → Create → Import a repository → `the-common-sense`.
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Then add the Gemini key under the Worker's **Settings → Variables and Secrets** as a **Secret** named `GEMINI_API_KEY`, and redeploy. Every push to `main` deploys again.

**From your computer:**

```bash
npx wrangler secret put GEMINI_API_KEY
```

```bash
npm run deploy
```

**Google sign-in:** create an OAuth client (Google Cloud Console → Google Auth Platform → Clients → Web application). Add the Worker's address (e.g. `https://the-common-sense.<your-subdomain>.workers.dev`) and `http://localhost:8788` as **Authorized JavaScript origins**, then put the Client ID in `GOOGLE_CLIENT_ID` in `wrangler.toml`. It is public, not a secret.

**Later schema changes:** the first schema was created by hand in the D1 console, so before the first `wrangler d1 migrations apply --remote`, record `0001_init.sql` as applied, or wrangler will try to create the tables again.

To change the Gemini model, edit `GEMINI_MODEL` in `wrangler.toml`. To change the daily cap or limits, edit `shared/config.ts`.

## Choices made where the spec left room

- **Workers instead of Pages:** the spec locked Pages + Pages Functions, but Cloudflare's dashboard no longer offers new Pages projects. One Worker with static assets does the same job on the same platform: same D1, same secret handling, same code.
- **Sign-in:** Google sign-in, as the spec recommended. `users` gains a `google_sub` column to identify the Google account.
- **Sessions:** the cookie holds a random token; the database stores only its SHA-256 hash, so a database leak can't be replayed as logins.
- **Editing the situation text:** going back to step 1 needs `PATCH /api/situations/:id`, which the spec's endpoint table didn't list.
- **Save button:** every situation and result is saved automatically, so **Save** confirms that and points to Profile.
- **Disclosure timing:** shown straight after the first sign-in, before Home.
- **History:** lives under Profile, per the spec; the sidebar matches the mockup.
- **Notes:** each choice question has an optional "+ Add a note" link (300 characters), shown once the question is answered.
- **Emergency number:** the Safety notice uses 911 (Philippines) plus "your local emergency number".
