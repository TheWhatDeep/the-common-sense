// Acceptance check: the built client must not contain the Gemini key or call Gemini directly.
// Usage: GEMINI_API_KEY=... node scripts/check-bundle.mjs   (reads .dev.vars if the env var is unset)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let key = process.env.GEMINI_API_KEY;
if (!key && existsSync('.dev.vars')) key = /^GEMINI_API_KEY=(.*)$/m.exec(readFileSync('.dev.vars', 'utf8'))?.[1]?.trim();

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
};
walk('dist');

const banned = ['generativelanguage.googleapis.com', 'GEMINI_API_KEY', 'x-goog-api-key'];
if (key && key.length > 8) banned.push(key);

let failed = false;
for (const f of files) {
  const text = readFileSync(f, 'latin1');
  for (const b of banned)
    if (text.includes(b)) {
      console.error(`FAIL: ${f} contains ${b === key ? 'the Gemini API key' : JSON.stringify(b)}`);
      failed = true;
    }
}
if (failed) process.exit(1);
console.log(`OK: ${files.length} built files checked; no Gemini key or Gemini endpoint in the client bundle.`);
