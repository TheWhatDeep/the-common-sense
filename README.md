# The Common Sense

A mobile-first PWA that walks you through a real situation using the **Four Pillars of Respect**, then returns an AI-generated read. The app guides; you decide.

- Spec: [`docs/spec-v0.1.md`](docs/spec-v0.1.md)
- Framework: [`docs/four-pillars-of-respect.md`](docs/four-pillars-of-respect.md)

## Stack

| Piece | Choice |
| --- | --- |
| Frontend | Preact + Vite + TypeScript (about 15 KB of JS, gzipped) |
| Hosting + API | Cloudflare Pages + Pages Functions |
| Database | Cloudflare D1 |
| AI | Gemini API (free tier), called only from Functions |
| Sign-in | Google sign-in (ID token verified server-side) |

## Project layout

```
shared/        Used by both browser and server
  config.ts      Daily cap, character limits, timeouts (one place to change each)
  questionBank.ts  The interview: questions, branching, validation (versioned)
  result.ts      AI output schema + strict validator
server/        Runs in Pages Functions
  api.ts         Every /api route
  gemini.ts      The only code that talks to Gemini (retry once on bad JSON)
  prompt.ts      System prompt: guardrails + the framework text
  google.ts      Google ID token verification
  dates.ts       Asia/Manila day boundaries for the daily cap
functions/api/[[path]].ts   Hands /api/* to server/api.ts
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
npm run build && npm run pages:dev
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

Runs the real Functions and D1 locally with a 390 px browser, walks every screen, and saves screenshots to `e2e/screens/`.

```bash
npm run build && npm run check:bundle
```

Scans the built client for the Gemini key or endpoint.

## Deploy to Cloudflare

1. Create the database, and copy the printed `database_id` into `wrangler.toml`:

   ```bash
   npx wrangler d1 create common-sense
   ```

2. Apply the schema:

   ```bash
   npm run db:migrate:remote
   ```

3. Create a Google OAuth client (Google Cloud Console → APIs & Services → Credentials → OAuth client ID → Web application). Add your Pages URL (e.g. `https://the-common-sense.pages.dev`) and `http://localhost:8788` under **Authorized JavaScript origins**. Put the client ID in `GOOGLE_CLIENT_ID` in `wrangler.toml`. It is public, not a secret.

4. Add the Gemini key as a secret. It is never in the code or the client:

   ```bash
   npx wrangler pages secret put GEMINI_API_KEY
   ```

5. Deploy:

   ```bash
   npm run deploy
   ```

To change the Gemini model, edit `GEMINI_MODEL` in `wrangler.toml`. To change the daily cap or limits, edit `shared/config.ts`.

## Choices made where the spec left room

- **Sign-in:** Google sign-in, as the spec recommended. `users` gains a `google_sub` column to identify the Google account.
- **Sessions:** the cookie holds a random token; the database stores only its SHA-256 hash, so a database leak can't be replayed as logins.
- **Editing the situation text:** going back to step 1 needs `PATCH /api/situations/:id`, which the spec's endpoint table didn't list.
- **Save button:** every situation and result is saved automatically, so **Save** confirms that and points to Profile.
- **Disclosure timing:** shown straight after the first sign-in, before Home.
- **History:** lives under Profile, per the spec; the sidebar matches the mockup.
- **Notes:** each choice question has an optional "+ Add a note" link (300 characters), shown once the question is answered.
- **Emergency number:** the Safety notice uses 911 (Philippines) plus "your local emergency number".
