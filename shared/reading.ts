/**
 * How a situation is read (question bank v2: free text, no questions).
 *
 * The AI reads the user's description and works through a fixed procedure:
 *   1. answer each FACT check (yes / no / unclear, with evidence from the text),
 *   2. write a read per pillar, 3. list lawful options, 4. a bottom line.
 * The code then enforces the hard rules from the facts: which pillars apply,
 * which options are allowed, when the Safety notice shows, and that nothing
 * tells the user what they must do.
 */

export type FactAnswer = 'yes' | 'no' | 'unclear';

export const FACT_DEFS = [
  { key: 'physical_harm', pillar: 1, question: 'Is anyone being physically hurt, or threatened with it?' },
  { key: 'berating', pillar: 1, question: 'Is anyone yelling, insulting, or refusing to stop when asked?' },
  { key: 'others_way_of_life', pillar: 1, question: 'Is this about someone else’s beliefs, identity or way of life?' },
  { key: 'asked_to_act', pillar: 1, question: 'Is the user being asked to do something themselves that goes against their beliefs?' },
  { key: 'can_be_present', pillar: 1, question: 'Could the user be there or show support without doing it themselves?' },
  { key: 'thought_through', pillar: 2, question: 'Has the user thought this through calmly, rather than just reacting?' },
  { key: 'pressuring_others', pillar: 2, question: 'Is the user trying to get someone to believe or act the way they do?' },
  { key: 'child_affected', pillar: 3, question: 'Does this affect a child?' },
  { key: 'child_unsafe', pillar: 3, question: 'Is a child unsafe or not being cared for?' },
  { key: 'family_for_appearance', pillar: 3, question: 'Is a family being kept together mainly for appearances?' },
  { key: 'law_involved', pillar: 4, question: 'Is a law, court order or official rule involved?' },
  { key: 'others_decision', pillar: 4, question: 'Is this someone else’s decision to make (a court, school, church, or another person’s own life)?' },
  { key: 'can_accept', pillar: 4, question: 'Can the user accept that decision?' },
  { key: 'response_would_attack', pillar: 4, question: 'Would the user’s response involve threatening, harassing or forcing anyone?' },
] as const;

export type FactKey = (typeof FACT_DEFS)[number]['key'];
export const FACT_KEYS = FACT_DEFS.map((f) => f.key) as FactKey[];

/** How each fact reads on the result screen (second person). */
export const FACT_LABELS: Record<FactKey, string> = {
  physical_harm: 'Someone is being physically hurt or threatened',
  berating: 'Someone is yelling, insulting, or won’t stop',
  others_way_of_life: 'It’s about someone else’s beliefs or way of life',
  asked_to_act: 'You’re asked to do something against your beliefs',
  can_be_present: 'You could be there without doing it yourself',
  thought_through: 'You’ve thought this through calmly',
  pressuring_others: 'You’re pressing someone to believe or act like you',
  child_affected: 'A child is affected',
  child_unsafe: 'A child is unsafe or not cared for',
  family_for_appearance: 'A family is kept together for appearances',
  law_involved: 'A law, court order or official rule is involved',
  others_decision: 'It’s someone else’s decision to make',
  can_accept: 'You can accept their decision',
  response_would_attack: 'Your response would threaten, harass or force',
};

export interface Fact {
  key: FactKey;
  answer: FactAnswer;
  evidence: string;
}
export type Facts = Record<FactKey, Fact>;

export const OPTION_DEFS = [
  { kind: 'get_safe', label: 'Get to safety', fallback: 'You could get yourself and anyone at risk somewhere safe, and call emergency services if anyone is in danger.' },
  { kind: 'disengage', label: 'Disengage', fallback: 'You could step away from the aggression without retaliating (Pillar 1).' },
  { kind: 'attend_without_participating', label: 'Be present without taking part', fallback: 'You could attend or show support without doing it yourself; presence isn’t participation (Pillar 1).' },
  { kind: 'decline_respectfully', label: 'Decline respectfully', fallback: 'You could decline to do it yourself while respecting their right to their choice (Pillar 1).' },
  { kind: 'respect_their_choice', label: 'Respect their choice', fallback: 'You could leave their way of life to them; disagreement isn’t harm (Pillar 1).' },
  { kind: 'examine_first', label: 'Examine it first', fallback: 'You could take time to check whether this is a considered view or a reaction (Pillar 2).' },
  { kind: 'stop_pressuring', label: 'Ease off the pressure', fallback: 'You could share your view without pushing it on someone who doesn’t want it (Pillar 2).' },
  { kind: 'accept', label: 'Accept their decision', fallback: 'You could accept the decision as theirs to make, even while disagreeing (Pillar 4).' },
  { kind: 'raise_through_proper_channels', label: 'Raise it through proper channels', fallback: 'You could disagree through legitimate means: talking it through, a complaint, a vote, or the courts (Pillar 4).' },
  { kind: 'walk_away_lawfully', label: 'Walk away lawfully', fallback: 'You could put lawful distance between you and what you can’t accept (Pillars 1, 3, 4).' },
  { kind: 'seek_lawful_help', label: 'Get lawful help', fallback: 'A lawyer, a social worker or the proper authority could help with the legal side (Pillars 3, 4).' },
] as const;

export type OptionKind = (typeof OPTION_DEFS)[number]['kind'];
export const OPTION_KINDS = OPTION_DEFS.map((o) => o.kind) as OptionKind[];
export const OPTION_LABELS = Object.fromEntries(OPTION_DEFS.map((o) => [o.kind, o.label])) as Record<OptionKind, string>;

export interface ReadOption {
  kind: OptionKind;
  text: string;
}

const yes = (f: Facts, k: FactKey) => f[k].answer === 'yes';
const notNo = (f: Facts, k: FactKey) => f[k].answer !== 'no';

/** Which pillars apply, decided by the facts. Pillar 2 (the self-check) always applies. */
export function pillarApplies(f: Facts): Record<1 | 2 | 3 | 4, boolean> {
  return {
    1: yes(f, 'physical_harm') || yes(f, 'berating') || yes(f, 'others_way_of_life') || yes(f, 'asked_to_act'),
    2: true,
    3: yes(f, 'child_affected') || yes(f, 'child_unsafe') || yes(f, 'family_for_appearance'),
    4: yes(f, 'law_involved') || yes(f, 'others_decision') || yes(f, 'response_would_attack'),
  };
}

/** Options the facts leave open, in display priority order. */
export function allowedOptions(f: Facts): OptionKind[] {
  const out: OptionKind[] = [];
  if (yes(f, 'physical_harm') || (yes(f, 'child_unsafe') && notNo(f, 'physical_harm'))) out.push('get_safe');
  if (yes(f, 'berating')) out.push('disengage');
  if (yes(f, 'asked_to_act') && notNo(f, 'can_be_present')) out.push('attend_without_participating');
  if (yes(f, 'asked_to_act')) out.push('decline_respectfully');
  if (yes(f, 'others_way_of_life')) out.push('respect_their_choice');
  if (!yes(f, 'thought_through')) out.push('examine_first');
  if (yes(f, 'pressuring_others')) out.push('stop_pressuring');
  if (yes(f, 'others_decision')) out.push('accept');
  if (yes(f, 'others_decision') || yes(f, 'law_involved')) out.push('raise_through_proper_channels');
  // Can't accept the decision (or it's unclear whether they can), aggression, or an unsafe child.
  if ((yes(f, 'others_decision') && !yes(f, 'can_accept')) || yes(f, 'berating') || yes(f, 'child_unsafe'))
    out.push('walk_away_lawfully');
  if (yes(f, 'law_involved') || yes(f, 'child_unsafe')) out.push('seek_lawful_help');
  return out;
}

export const MAX_OPTIONS = 4;

/** Words that tell the user what to do. The reading must describe, never instruct. */
const DIRECTIVE = /\b(must|should|shouldn['’]t|need to|needs to|have to|has to|ought to)\b/i;
export function containsDirective(text: string): boolean {
  return DIRECTIVE.test(text);
}

const HANDS_BACK = /\b(your call|the call is yours|your decision|is yours|up to you|you decide|yours to make)\b/i;

// ---------- the model's output ----------

/** Gemini structured-output schema for a v2 reading. */
export const MODEL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    facts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING', enum: FACT_KEYS },
          answer: { type: 'STRING', enum: ['yes', 'no', 'unclear'] },
          evidence: { type: 'STRING' },
        },
        required: ['key', 'answer', 'evidence'],
        propertyOrdering: ['key', 'answer', 'evidence'],
      },
    },
    pillars: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { pillar: { type: 'INTEGER' }, read: { type: 'STRING' } },
        required: ['pillar', 'read'],
        propertyOrdering: ['pillar', 'read'],
      },
    },
    options: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { kind: { type: 'STRING', enum: OPTION_KINDS }, text: { type: 'STRING' } },
        required: ['kind', 'text'],
        propertyOrdering: ['kind', 'text'],
      },
    },
    unclear_note: { type: 'STRING' },
    bottom_line: { type: 'STRING' },
    safety_flag: { type: 'BOOLEAN' },
  },
  required: ['facts', 'pillars', 'options', 'unclear_note', 'bottom_line', 'safety_flag'],
  propertyOrdering: ['facts', 'pillars', 'options', 'unclear_note', 'bottom_line', 'safety_flag'],
} as const;

export interface Reading {
  version: 2;
  facts: Fact[];
  pillars: { pillar: 1 | 2 | 3 | 4; applies: boolean; read: string }[];
  options: ReadOption[];
  unclear_note: string;
  bottom_line: string;
  safety_flag: boolean;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Validates the model's JSON and applies the hard rules.
 * Returns null when the structure is unusable (the caller retries once).
 * `directive` is true when the wording tells the user what to do (also retried once).
 */
export function finalizeReading(raw: string): { reading: Reading; directive: boolean } | null {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;

  // Facts: unknown keys dropped; missing ones become "unclear". Too many missing = unusable.
  const facts = {} as Facts;
  const rawFacts = Array.isArray(d.facts) ? d.facts : [];
  for (const item of rawFacts) {
    const key = str((item as Record<string, unknown>)?.key) as FactKey;
    const answer = str((item as Record<string, unknown>)?.answer) as FactAnswer;
    if (!FACT_KEYS.includes(key) || !['yes', 'no', 'unclear'].includes(answer) || facts[key]) continue;
    facts[key] = { key, answer, evidence: str((item as Record<string, unknown>).evidence).slice(0, 200) };
  }
  if (Object.keys(facts).length < FACT_KEYS.length / 2) return null;
  for (const key of FACT_KEYS) facts[key] ??= { key, answer: 'unclear', evidence: '' };

  // Pillars: exactly 1-4, each once.
  if (!Array.isArray(d.pillars) || d.pillars.length !== 4) return null;
  const applies = pillarApplies(facts);
  const pillars: Reading['pillars'] = [];
  const seen = new Set<number>();
  for (const p of d.pillars) {
    const n = (p as Record<string, unknown>)?.pillar;
    const read = str((p as Record<string, unknown>)?.read);
    if ((n !== 1 && n !== 2 && n !== 3 && n !== 4) || seen.has(n) || !read) return null;
    seen.add(n);
    pillars.push({ pillar: n, applies: applies[n], read });
  }
  pillars.sort((a, b) => a.pillar - b.pillar);

  const bottomRaw = str(d.bottom_line);
  if (!bottomRaw) return null;
  const bottom_line = HANDS_BACK.test(bottomRaw) ? bottomRaw : `${bottomRaw.replace(/\s*$/, '')} The call is yours.`;

  // Options: only kinds the facts allow, each once, in priority order; fill from defaults if the model gave none.
  const allowed = allowedOptions(facts);
  const byKind = new Map<OptionKind, string>();
  for (const o of Array.isArray(d.options) ? d.options : []) {
    const kind = str((o as Record<string, unknown>)?.kind) as OptionKind;
    const text = str((o as Record<string, unknown>)?.text);
    if (allowed.includes(kind) && text && !byKind.has(kind)) byKind.set(kind, text);
  }
  let options: ReadOption[] = allowed.filter((k) => byKind.has(k)).map((kind) => ({ kind, text: byKind.get(kind)! }));
  if (options.length === 0)
    options = allowed.map((kind) => ({ kind, text: OPTION_DEFS.find((o) => o.kind === kind)!.fallback }));
  options = options.slice(0, MAX_OPTIONS);

  const safety_flag = d.safety_flag === true || facts.physical_harm.answer === 'yes';
  const unclear_note = str(d.unclear_note);

  const reading: Reading = {
    version: 2,
    facts: FACT_KEYS.map((k) => facts[k]),
    pillars,
    options,
    unclear_note,
    bottom_line,
    safety_flag,
  };
  const wording = [...pillars.map((p) => p.read), ...options.map((o) => o.text), unclear_note, bottomRaw].join(' ');
  return { reading, directive: containsDirective(wording) };
}
