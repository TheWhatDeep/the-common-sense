// End-to-end acceptance run: the real Worker + local D1 (via wrangler dev),
// a mock Gemini, and a 390 px Chromium. Screenshots land in e2e/screens/.
// Usage: npm run build && npm run e2e
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startMockGemini } from './mock-gemini.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 8788;
const BASE = `http://localhost:${PORT}`;
const FAKE_KEY = 'e2e-fake-gemini-key-0123456789';
const shots = 'e2e/screens';
mkdirSync(shots, { recursive: true });
const state = mkdtempSync(join(tmpdir(), 'tcs-e2e-'));
const env = { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' };

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
    console.log('  PASS', name);
  } catch (e) {
    results.push(['FAIL', name, e.message]);
    console.log('  FAIL', name, '\n      ', e.message.split('\n')[0]);
  }
}

console.log('Applying migrations to a fresh local D1…');
const mig = spawnSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'common-sense', '--local', '--persist-to', state], { env, encoding: 'utf8' });
if (mig.status !== 0) {
  console.error(mig.stdout, mig.stderr);
  process.exit(1);
}

const mock = await startMockGemini(8790);
const wrangler = spawn(
  'npx',
  [
    'wrangler', 'dev', '--port', String(PORT), '--persist-to', state,
    '--var', `GEMINI_API_KEY:${FAKE_KEY}`,
    '--var', 'DEV_LOGIN:true',
    '--var', 'GEMINI_BASE_URL:http://127.0.0.1:8790',
    '--var', 'GEMINI_MODEL:mock-flash',
  ],
  { env, stdio: ['ignore', 'pipe', 'pipe'] },
);
let log = '';
wrangler.stdout.on('data', (d) => (log += d));
wrangler.stderr.on('data', (d) => (log += d));

const cleanup = () => {
  wrangler.kill('SIGTERM');
  mock.server.close();
};
process.on('exit', cleanup);

for (let i = 0; ; i++) {
  try {
    const r = await fetch(`${BASE}/api/auth/config`);
    if (r.ok) break;
  } catch {}
  if (i > 120) {
    console.error('wrangler did not start:\n', log);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 500));
}
console.log('Worker dev server is up. Running flows…\n');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const nextBtn = () => page.locator('footer .btn-primary');
const pick = (label) => page.getByRole('radio', { name: label, exact: true }).check();
const pickIn = (question, label) => page.getByRole('group', { name: question }).getByRole('radio', { name: label, exact: true }).check();

/** API helper running inside the page so it carries the session cookie. */
const apiCall = (method, path, body) =>
  page.evaluate(
    async ([m, p, b]) => {
      const r = await fetch('/api' + p, {
        method: m,
        headers: b ? { 'content-type': 'application/json' } : {},
        body: b ? JSON.stringify(b) : undefined,
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    [method, path, body],
  );

let firstSituationId;

await check('sign-in screen renders', async () => {
  await page.goto(BASE + '/');
  await page.getByRole('button', { name: /Dev sign-in/ }).waitFor();
  await shot('00-sign-in');
});

await check('a new user cannot reach the Situation screen without accepting the disclosure', async () => {
  await page.getByRole('button', { name: /Dev sign-in/ }).click();
  await page.getByRole('heading', { name: 'Where your situations go' }).waitFor();
  await shot('01-disclosure');
  await page.goto(BASE + '/#/new');
  await page.getByRole('heading', { name: 'Where your situations go' }).waitFor();
  assert.equal(await page.locator('#situation').count(), 0);
  const r = await apiCall('POST', '/situations', { text: 'sneaky' });
  assert.equal(r.status, 403);
  await page.getByRole('button', { name: 'I understand' }).click();
  await page.locator('#situation').waitFor(); // accepted: now the Situation screen opens
});

await check('home and sidebar match the mockup layout', async () => {
  await page.goto(BASE + '/#/');
  await page.getByRole('button', { name: 'Start a new situation' }).waitFor();
  await shot('02-home');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Main menu' }).waitFor();
  assert.ok(await page.getByText('dev@example.com').isVisible());
  await page.waitForTimeout(400); // let the slide-in finish
  await shot('03-sidebar');
  await page.mouse.click(370, 420); // tap the dimmed strip to the right of the drawer
  await page.getByRole('navigation', { name: 'Main menu' }).waitFor({ state: 'detached' });
});

const WEDDING = 'A coworker invited me to her wedding. She’s marrying her partner, who is also a woman. I’m not sure whether I should go.';
const situationIdFromUrl = () => page.url().split('/s/')[1]?.split('/')[0];

await check('Get the read is disabled when empty and over 2,000 characters', async () => {
  await page.getByRole('button', { name: 'Start a new situation' }).click();
  const box = page.locator('#situation');
  await box.waitFor();
  assert.ok(await nextBtn().isDisabled(), 'disabled when empty');
  await box.fill('x'.repeat(2001));
  assert.ok(await nextBtn().isDisabled(), 'disabled when over limit');
  await shot('04b-situation-over-limit');
  await box.fill(WEDDING);
  assert.equal((await nextBtn().textContent()).trim(), 'Get the read');
  assert.ok(await nextBtn().isEnabled());
  await page.waitForTimeout(400);
  await shot('04-situation');
  await nextBtn().click();
});

await check('while waiting, the thinking screen streams the model’s thought summaries', async () => {
  await page.getByText('How the AI is thinking').waitFor({ timeout: 15_000 });
  firstSituationId = situationIdFromUrl();
  assert.ok(firstSituationId, 'went straight from the description to the read');
  await page.locator('.thought-stream h3', { hasText: 'Checking for harm' }).waitFor({ timeout: 15_000 });
  await shot('07b-thinking');
  await page.locator('.thought-stream h3', { hasText: 'Weighing participation' }).waitFor({ timeout: 15_000 });
});

await check('a result shows four reads, marks non-applicable pillars, lists options and hands the decision back', async () => {
  await page.getByRole('heading', { name: 'The read' }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500); // let the staggered entrance finish
  assert.equal(await page.locator('.read').count(), 4);
  assert.equal(await page.locator('.read.na').count(), 1, 'Pillar 3 does not apply (no child in the facts)');
  assert.equal(await page.locator('.option-list li').count(), 3);
  assert.ok(await page.getByText('Be present without taking part').isVisible());
  assert.match(await page.locator('.bottom-line p').textContent(), /your call/);
  assert.ok(await page.getByText('You make the decision.').first().isVisible());
  await shot('08-result');
  await page.getByText('How the AI read your situation').click();
  await page.locator('.how-read li').first().waitFor();
  assert.equal(await page.locator('.fact-chip.yes').count(), 6);
  await page.locator('.how-read').scrollIntoViewIfNeeded();
  await shot('08b-how-it-read');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Saved ✓' }).waitFor();
  const last = mock.calls.at(-1);
  assert.equal(last.key, FAKE_KEY, 'key sent server-side as a header');
  assert.ok(last.url.includes('/models/mock-flash:streamGenerateContent'), 'uses the streaming endpoint');
  assert.equal(last.config.thinkingConfig.includeThoughts, true);
  assert.ok(last.prompt.includes('<situation>') && !last.prompt.includes('<answers>'), 'free text only, no question answers');
});

await check('AI safety flag shows the Safety notice first; the user can see the read, or close', async () => {
  await page.goto(BASE + '/#/new');
  await page.locator('#situation').fill('DANGER: my brother said he would hurt me if I leave the house.');
  await nextBtn().click();
  await page.getByRole('heading', { name: 'Your safety comes first' }).waitFor({ timeout: 30_000 });
  assert.equal(await page.getByRole('link', { name: 'Call 911' }).getAttribute('href'), 'tel:911');
  assert.ok(await page.getByRole('button', { name: 'Close' }).isVisible(), 'the notice can be closed');
  await page.waitForTimeout(400);
  await shot('09-safety-notice');
  await page.getByRole('button', { name: 'See the read' }).click();
  await page.getByRole('heading', { name: 'The read' }).waitFor();
  assert.ok(await page.getByRole('note').isVisible(), 'safety banner on the read');
  await page.waitForTimeout(1500);
  await shot('09b-flagged-read');
  await page.reload();
  await page.getByRole('heading', { name: 'Your safety comes first' }).waitFor();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Start a new situation' }).waitFor();
});

await check('closing the situation screen keeps it, ready for a read', async () => {
  await page.goto(BASE + '/#/new');
  await page.locator('#situation').fill('My manager keeps changing my schedule without asking.');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Start a new situation' }).waitFor();
  const list = await apiCall('GET', '/situations');
  assert.equal(list.body.situations[0].status, 'answered');
});

await check('the dashboard shows situations waiting for a read and saved reads', async () => {
  await page.reload();
  await page.getByRole('heading', { name: 'Pick up where you left off' }).waitFor();
  await page.getByRole('heading', { name: 'Saved', exact: true }).waitFor();
  assert.ok(await page.locator('.sit-card', { hasText: 'A coworker invited me' }).isVisible());
  assert.ok(await page.locator('.sit-card .bl', { hasText: 'your call' }).first().isVisible());
  await page.waitForTimeout(700);
  await shot('11a-dashboard');
  await page.locator('.sit-card', { hasText: 'My manager keeps changing' }).click();
  await page.getByRole('heading', { name: 'The read' }).waitFor({ timeout: 30_000 }); // opens straight into the read
});

await check('the Pillars page explains the pillars and how to use them', async () => {
  await page.goto(BASE + '/#/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Pillars' }).click();
  await page.getByRole('heading', { name: 'The Four Pillars of Respect' }).waitFor();
  await page.getByRole('heading', { name: 'How to use them' }).waitFor();
  await page.locator('.pillar-card summary', { hasText: 'Familial Realism' }).click();
  await page.getByText('The family exists for the child, not the other way around.', { exact: false }).first().waitFor();
  await page.waitForTimeout(800);
  await shot('15-pillars');
});

await check('malformed Gemini output retries once, shows an error, and usage is unchanged', async () => {
  const before = (await apiCall('GET', '/me')).body.usage.used;
  const callsBefore = mock.calls.length;
  await page.goto(BASE + '/#/new');
  await page.locator('#situation').fill('MALFORMED test situation');
  await nextBtn().click();
  await page.getByRole('heading', { name: 'The read didn’t come through' }).waitFor({ timeout: 30_000 });
  assert.ok(await page.getByRole('button', { name: 'Try again' }).isVisible());
  await shot('10-analyze-error');
  assert.equal(mock.calls.length - callsBefore, 2, 'exactly one retry');
  assert.equal((await apiCall('GET', '/me')).body.usage.used, before);
});

await check('the sixth analysis in a day is refused and Home shows the reset time', async () => {
  let used = (await apiCall('GET', '/me')).body.usage.used;
  while (used < 5) {
    const s = (await apiCall('POST', '/situations', { text: `Filler ${used}` })).body;
    assert.equal((await apiCall('POST', `/situations/${s.id}/analyze`)).status, 200);
    used++;
  }
  const s = (await apiCall('POST', '/situations', { text: 'Sixth' })).body;
  const sixth = await apiCall('POST', `/situations/${s.id}/analyze`);
  assert.equal(sixth.status, 429);
  assert.ok(sixth.body.resetsAt);
  await page.goto(BASE + '/#/');
  await page.reload();
  await page.getByText(/You’ve used today’s 5 reads\. More at/).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Start a new situation' }).isDisabled());
  await shot('11-home-limit');
});

await check("user A requesting user B's situation gets 404", async () => {
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(BASE + '/');
  const r = await p2.evaluate(async (id) => {
    await fetch('/api/auth/dev-sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'b@example.com', name: 'User B' }),
    });
    await fetch('/api/me/disclosure', { method: 'POST' });
    return (await fetch('/api/situations/' + id)).status;
  }, firstSituationId);
  assert.equal(r, 404);
  await other.close();
});

await check('profile lists saved situations; deleting one removes its answers and result', async () => {
  await page.goto(BASE + '/#/profile');
  await page.getByRole('heading', { name: 'All situations' }).waitFor();
  await page.locator('.item').first().waitFor();
  await shot('12-profile');
  const count = await page.locator('.item').count();
  const target = page.locator('.item', { hasText: 'A coworker invited me' });
  await target.getByRole('button', { name: 'Delete situation' }).click();
  await page.getByRole('alertdialog').waitFor();
  await shot('13-delete-confirm');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.item').count(), count - 1);
  assert.equal((await apiCall('GET', `/situations/${firstSituationId}`)).status, 404);
});

await check('the Gemini key is absent from every API response the app made', async () => {
  const bodies = await Promise.all(['/auth/config', '/me', '/situations'].map((p) => apiCall('GET', p)));
  for (const b of bodies) assert.ok(!JSON.stringify(b).includes(FAKE_KEY));
});

await check('PWA: manifest, icons and service worker are served', async () => {
  const manifest = await (await fetch(BASE + '/manifest.webmanifest')).json();
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.equal((await fetch(BASE + icon.src)).status, 200, icon.src);
  assert.equal((await fetch(BASE + '/icons/apple-touch-icon.png')).status, 200);
  const reg = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return !!r.active;
  });
  assert.ok(reg, 'service worker active');
});

await check('settings shows the disclosure; deleting the account signs out', async () => {
  await page.goto(BASE + '/#/settings');
  await page.getByRole('heading', { name: 'Your data' }).waitFor();
  await shot('14-settings');
  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByRole('button', { name: /Dev sign-in/ }).waitFor();
  assert.equal((await apiCall('GET', '/me')).status, 401);
});

await browser.close();
cleanup();
const failed = results.filter((r) => r[0] === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshots in ${shots}/`);
process.exit(failed.length ? 1 : 0);
