import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVE_SET, frameworkText, type PillarSet } from '../shared/pillars';
import { buildSystemPrompt } from '../server/prompt';

const DOC = join(import.meta.dirname, '../docs/pillars-of-common-sense.md');

/** The human-readable framework doc, generated from the pillar set. */
export function renderDoc(set: PillarSet): string {
  const out: string[] = [`# ${set.title.replace(/^the /i, 'The ')}`, '', set.intro, '', `**The idea behind all four:** ${set.principle}`, ''];
  out.push('## At a glance', '', '| # | Pillar | In one line |', '| --- | --- | --- |');
  for (const p of set.pillars) out.push(`| ${p.n} | **${p.name}** | ${p.short} |`);
  for (const p of set.pillars) {
    out.push('', `## ${p.n}. ${p.name}`, '', `**Statement.** ${p.statement}`, '', `**What it means.** ${p.meaning}`, '', '**Where the lines are.**', '');
    for (const b of p.boundaries) out.push(`- ${b}`);
    if (p.example) out.push('', `**Example.** ${p.example}`);
    out.push('', '**Ask yourself.**', '');
    for (const a of p.ask) out.push(`- ${a}`);
  }
  out.push('', '## Key words', '', '| Term | Meaning |', '| --- | --- |');
  for (const [t, d] of set.definitions) out.push(`| ${t} | ${d} |`);
  out.push('', '## How the pillars work together', '', 'Each pillar checks the others. Remove one and the rest start to drift.', '');
  for (const t of set.together) out.push(`- **${t.lead}** ${t.text}`);
  out.push('', set.sharedExit, '', '## Scope', '', set.scope, '');
  return out.join('\n');
}

describe('pillar set', () => {
  it('has four numbered pillars with names, colors and statements', () => {
    expect(ACTIVE_SET.pillars.map((p) => p.n)).toEqual([1, 2, 3, 4]);
    for (const p of ACTIVE_SET.pillars) {
      expect(p.name).toBeTruthy();
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.statement.length).toBeGreaterThan(50);
    }
  });

  it('is what the AI is given', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain(frameworkText());
    for (const p of ACTIVE_SET.pillars) expect(prompt).toContain(p.name);
    expect(prompt).not.toMatch(/Pillars of Respect/i);
  });

  it('docs/pillars-of-common-sense.md matches the pillar set (run UPDATE_DOCS=1 npm test to regenerate)', () => {
    const doc = renderDoc(ACTIVE_SET);
    if (process.env.UPDATE_DOCS) writeFileSync(DOC, doc);
    expect(readFileSync(DOC, 'utf8')).toBe(doc);
  });
});
