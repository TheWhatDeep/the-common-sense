import { describe, expect, it } from 'vitest';
import { allowedOptions, containsDirective, FACT_KEYS, finalizeReading, pillarApplies, type FactAnswer, type Facts } from '../shared/reading';

function factsWith(answers: Partial<Record<string, FactAnswer>>): Facts {
  const f = {} as Facts;
  for (const key of FACT_KEYS) f[key] = { key, answer: answers[key] ?? 'no', evidence: '' };
  return f;
}

const pillars = [
  { pillar: 1, read: 'One.' },
  { pillar: 2, read: 'Two.' },
  { pillar: 3, read: 'Three.' },
  { pillar: 4, read: 'Four.' },
];

function model(over: Record<string, unknown> = {}, answers: Partial<Record<string, FactAnswer>> = {}) {
  return JSON.stringify({
    facts: FACT_KEYS.map((key) => ({ key, answer: answers[key] ?? 'no', evidence: '' })),
    pillars,
    options: [],
    unclear_note: '',
    bottom_line: 'It weighs both ways. The call is yours.',
    safety_flag: false,
    ...over,
  });
}

describe('which pillars apply', () => {
  it('Pillar 2 always applies; the others need a matching fact', () => {
    expect(pillarApplies(factsWith({}))).toEqual({ 1: false, 2: true, 3: false, 4: false });
  });

  it('custody case: a child and a court order turn on Pillars 3 and 4', () => {
    const f = factsWith({ child_affected: 'yes', child_unsafe: 'unclear', law_involved: 'yes', others_decision: 'yes', can_accept: 'no' });
    expect(pillarApplies(f)).toEqual({ 1: false, 2: true, 3: true, 4: true });
    const opts = allowedOptions(f);
    expect(opts).toEqual(expect.arrayContaining(['raise_through_proper_channels', 'walk_away_lawfully', 'seek_lawful_help']));
    expect(opts).not.toContain('get_safe'); // child safety is unclear, not yes
  });

  it('being asked to take part turns on Pillar 1 and the be-present option', () => {
    const f = factsWith({ asked_to_act: 'yes', can_be_present: 'yes', thought_through: 'yes' });
    expect(pillarApplies(f)[1]).toBe(true);
    expect(allowedOptions(f)).toEqual(['attend_without_participating', 'decline_respectfully']);
  });

  it('a user pressing their faith on someone gets the ease-off option', () => {
    expect(allowedOptions(factsWith({ pressuring_others: 'yes', thought_through: 'yes' }))).toContain('stop_pressuring');
  });
});

describe('finalizeReading', () => {
  it('sets "applies" from the facts, not from the model', () => {
    const r = finalizeReading(model({}, { child_affected: 'yes' }))!;
    expect(r.reading.pillars.map((p) => p.applies)).toEqual([false, true, true, false]);
  });

  it('physical harm in the facts always raises the safety flag', () => {
    expect(finalizeReading(model({ safety_flag: false }, { physical_harm: 'yes' }))!.reading.safety_flag).toBe(true);
  });

  it('drops options the facts do not allow and falls back to defaults if none are left', () => {
    const r = finalizeReading(model({ options: [{ kind: 'get_safe', text: 'You could leave.' }] }, { berating: 'yes', thought_through: 'yes' }))!;
    expect(r.reading.options.map((o) => o.kind)).toEqual(['disengage', 'walk_away_lawfully']);
    expect(r.reading.options[0].text).toMatch(/^You could/);
  });

  it('hands the decision back if the model forgot to', () => {
    expect(finalizeReading(model({ bottom_line: 'Going fits your framework.' }))!.reading.bottom_line).toBe(
      'Going fits your framework. The call is yours.',
    );
  });

  it('flags wording that tells the user what to do', () => {
    expect(finalizeReading(model({ bottom_line: 'You must go. The call is yours.' }))!.directive).toBe(true);
    expect(finalizeReading(model())!.directive).toBe(false);
    expect(containsDirective('You need to talk to her.')).toBe(true);
    expect(containsDirective('Under Pillar 4, the order sits in the court’s domain.')).toBe(false);
  });

  it('missing facts become "unclear"; too many missing is unusable', () => {
    const some = JSON.parse(model());
    some.facts = some.facts.slice(0, 10);
    const r = finalizeReading(JSON.stringify(some))!;
    expect(r.reading.facts.filter((f) => f.answer === 'unclear')).toHaveLength(4);
    some.facts = some.facts.slice(0, 3);
    expect(finalizeReading(JSON.stringify(some))).toBeNull();
  });

  it('rejects malformed structure', () => {
    expect(finalizeReading('not json')).toBeNull();
    expect(finalizeReading(model({ pillars: pillars.slice(0, 3) }))).toBeNull();
    expect(finalizeReading(model({ pillars: [...pillars.slice(0, 3), { pillar: 1, read: 'again' }] }))).toBeNull();
    expect(finalizeReading(model({ bottom_line: '' }))).toBeNull();
  });
});
