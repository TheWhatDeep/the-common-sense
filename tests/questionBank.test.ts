import { describe, expect, it } from 'vitest';
import {
  cleanAnswers,
  interviewComplete,
  needsSafetyNotice,
  pillarComplete,
  resumeStep,
  visibleQuestions,
} from '../shared/questionBank';

const ids = (a: Record<string, { value: string }>) => visibleQuestions(a).map((q) => q.id);

describe('interview branching', () => {
  it('shows only the always-on questions with no answers', () => {
    expect(ids({})).toEqual(['p1.harm', 'p2.examined', 'p2.change', 'p3.family', 'p4.domain', 'p4.method']);
  });

  it('p1.harm = Yes shows p1.violence, not p1.participate', () => {
    const v = ids({ 'p1.harm': { value: 'yes' } });
    expect(v).toContain('p1.violence');
    expect(v).not.toContain('p1.participate');
  });

  it('p1.harm = No or Not sure shows p1.participate', () => {
    for (const value of ['no', 'not_sure']) {
      const v = ids({ 'p1.harm': { value } });
      expect(v).toContain('p1.participate');
      expect(v).not.toContain('p1.violence');
    }
  });

  it('p3.family = No skips p3.function', () => {
    expect(ids({ 'p3.family': { value: 'no' } })).not.toContain('p3.function');
    expect(ids({ 'p3.family': { value: 'yes' } })).toContain('p3.function');
  });

  it('p4.accept appears for Theirs/Shared, and p4.accept = No shows p4.walkaway', () => {
    expect(ids({ 'p4.domain': { value: 'mine' } })).not.toContain('p4.accept');
    expect(ids({ 'p4.domain': { value: 'shared' }, 'p4.accept': { value: 'no' } })).toContain('p4.walkaway');
    expect(ids({ 'p4.domain': { value: 'theirs' }, 'p4.accept': { value: 'yes' } })).not.toContain('p4.walkaway');
  });

  it('hiding a parent hides its whole branch', () => {
    // p4.accept = No left over after the domain changed to Mine must not show p4.walkaway.
    expect(ids({ 'p4.domain': { value: 'mine' }, 'p4.accept': { value: 'no' } })).not.toContain('p4.walkaway');
  });

  it('physical violence triggers the Safety notice', () => {
    expect(needsSafetyNotice({ 'p1.harm': { value: 'yes' }, 'p1.violence': { value: 'yes' } })).toBe(true);
    expect(needsSafetyNotice({ 'p1.harm': { value: 'no' }, 'p1.violence': { value: 'yes' } })).toBe(false);
  });

  it('Next is blocked until each required question on the pillar is answered', () => {
    expect(pillarComplete(1, { 'p1.harm': { value: 'yes' } })).toBe(false);
    expect(pillarComplete(1, { 'p1.harm': { value: 'yes' }, 'p1.violence': { value: 'no' } })).toBe(true);
    // p2.change is optional free text
    expect(pillarComplete(2, { 'p2.examined': { value: 'reacting' } })).toBe(true);
  });

  it('knows when the whole interview is complete', () => {
    const a = {
      'p1.harm': { value: 'no' },
      'p1.participate': { value: 'present' },
      'p2.examined': { value: 'examined' },
      'p3.family': { value: 'no' },
      'p4.domain': { value: 'theirs' },
      'p4.method': { value: 'disagreement' },
    };
    expect(interviewComplete(a)).toBe(false); // p4.accept now visible
    expect(interviewComplete({ ...a, 'p4.accept': { value: 'yes' } })).toBe(true);
  });
});

describe('cleanAnswers', () => {
  it('rejects unknown questions and invalid options', () => {
    expect(cleanAnswers({ 'p9.nope': { value: 'yes' } }).ok).toBe(false);
    expect(cleanAnswers({ 'p1.harm': { value: 'maybe' } }).ok).toBe(false);
  });

  it('rejects notes over 300 characters', () => {
    expect(cleanAnswers({ 'p1.harm': { value: 'no', note: 'x'.repeat(301) } }).ok).toBe(false);
    expect(cleanAnswers({ 'p1.harm': { value: 'no', note: 'x'.repeat(300) } }).ok).toBe(true);
  });

  it('drops answers to questions that are no longer visible', () => {
    const r = cleanAnswers({ 'p1.harm': { value: 'no' }, 'p1.violence': { value: 'yes' } });
    expect(r.ok && r.answers).toEqual({ 'p1.harm': { value: 'no' } });
  });

  it('drops an empty optional text answer', () => {
    const r = cleanAnswers({ 'p2.change': { value: '   ' } });
    expect(r.ok && r.answers).toEqual({});
  });
});

describe('resumeStep', () => {
  it('points at the first unfinished pillar', () => {
    expect(resumeStep({})).toBe(2);
    expect(resumeStep({ 'p1.harm': { value: 'no' }, 'p1.participate': { value: 'present' } })).toBe(3);
  });
});
