/**
 * The interviewer's question bank. Static and deterministic: the AI never
 * chooses questions, it only sees the finished answers.
 *
 * Bump BANK_VERSION whenever questions, options or branching change, and keep
 * old versions in BANKS so situations saved under them stay readable.
 */
import { CONFIG } from './config';

export interface Option {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  pillar: 1 | 2 | 3 | 4;
  text: string;
  /** Optional helper line under the question. */
  help?: string;
  kind: 'choice' | 'text';
  options?: Option[];
  required: boolean;
  /** Shown only when the parent question is visible and its answer is one of `in`. */
  showWhen?: { question: string; in: string[] };
}

const YES = { value: 'yes', label: 'Yes' };
const NO = { value: 'no', label: 'No' };
const NOT_SURE = { value: 'not_sure', label: 'Not sure' };

const BANK_V1: Question[] = [
  {
    id: 'p1.harm',
    pillar: 1,
    text: 'Is anyone causing harm here?',
    help: 'Harm means physical violence or aggressive berating.',
    kind: 'choice',
    options: [YES, NO, NOT_SURE],
    required: true,
  },
  {
    id: 'p1.violence',
    pillar: 1,
    text: 'Is it physical violence?',
    kind: 'choice',
    options: [YES, NO],
    required: true,
    showWhen: { question: 'p1.harm', in: ['yes'] },
  },
  {
    id: 'p1.participate',
    pillar: 1,
    text: 'Are you being asked to participate, or to be present?',
    kind: 'choice',
    options: [
      { value: 'participate', label: 'Participate — do it myself' },
      { value: 'present', label: 'Be present or show support' },
      NOT_SURE,
    ],
    required: true,
    showWhen: { question: 'p1.harm', in: ['no', 'not_sure'] },
  },
  {
    id: 'p2.examined',
    pillar: 2,
    text: 'Have you actually examined this, or are you reacting?',
    help: 'An examined belief is one you could have rejected.',
    kind: 'choice',
    options: [
      { value: 'examined', label: 'Examined' },
      { value: 'reacting', label: 'Reacting' },
      NOT_SURE,
    ],
    required: true,
  },
  {
    id: 'p2.change',
    pillar: 2,
    text: 'What would change your mind?',
    help: 'Optional. A sentence is enough.',
    kind: 'text',
    required: false,
  },
  {
    id: 'p3.family',
    pillar: 3,
    text: 'Does this affect a family or a child?',
    help: "The family exists for the child, not the other way around.",
    kind: 'choice',
    options: [YES, NO],
    required: true,
  },
  {
    id: 'p3.function',
    pillar: 3,
    text: "Is the family's wellbeing at stake, or only its appearance?",
    kind: 'choice',
    options: [
      { value: 'wellbeing', label: 'Wellbeing' },
      { value: 'appearance', label: 'Appearance' },
      { value: 'both', label: 'Both' },
    ],
    required: true,
    showWhen: { question: 'p3.family', in: ['yes'] },
  },
  {
    id: 'p4.domain',
    pillar: 4,
    text: 'Whose domain is this?',
    help: 'Every group has authority in its own domain, and a person over their own choices.',
    kind: 'choice',
    options: [
      { value: 'mine', label: 'Mine' },
      { value: 'theirs', label: 'Theirs' },
      { value: 'shared', label: 'Shared' },
      NOT_SURE,
    ],
    required: true,
  },
  {
    id: 'p4.method',
    pillar: 4,
    text: 'Is this disagreement or an attack?',
    kind: 'choice',
    options: [
      { value: 'disagreement', label: 'Disagreement' },
      { value: 'attack', label: 'Attack' },
      NOT_SURE,
    ],
    required: true,
  },
  {
    id: 'p4.accept',
    pillar: 4,
    text: 'Can you accept this?',
    kind: 'choice',
    options: [YES, NO, NOT_SURE],
    required: true,
    showWhen: { question: 'p4.domain', in: ['theirs', 'shared'] },
  },
  {
    id: 'p4.walkaway',
    pillar: 4,
    text: 'Can you walk away lawfully?',
    kind: 'choice',
    options: [YES, NO, NOT_SURE],
    required: true,
    showWhen: { question: 'p4.accept', in: ['no'] },
  },
];

export const BANK_VERSION = 1;
export const BANKS: Record<number, Question[]> = { 1: BANK_V1 };

export const PILLAR_NAMES: Record<number, string> = {
  1: 'Belief Plurality',
  2: 'Intellectual Autonomy',
  3: 'Familial Realism',
  4: 'Authority & Equality',
};

export interface AnswerInput {
  value: string;
  note?: string;
}
export type Answers = Record<string, AnswerInput>;

export function getBank(version: number): Question[] {
  const bank = BANKS[version];
  if (!bank) throw new Error(`Unknown question bank version ${version}`);
  return bank;
}

/** Questions visible for the current answers, in bank order. Hidden parents hide their children. */
export function visibleQuestions(answers: Answers, bank: Question[] = getBank(BANK_VERSION)): Question[] {
  const visible = new Set<string>();
  const out: Question[] = [];
  for (const q of bank) {
    if (q.showWhen) {
      const parentAnswer = answers[q.showWhen.question]?.value;
      if (!visible.has(q.showWhen.question) || !parentAnswer || !q.showWhen.in.includes(parentAnswer)) continue;
    }
    visible.add(q.id);
    out.push(q);
  }
  return out;
}

export function isAnswered(q: Question, a: AnswerInput | undefined): boolean {
  if (!a) return false;
  if (q.kind === 'text') return a.value.trim().length > 0;
  return !!q.options?.some((o) => o.value === a.value);
}

/** True when every visible required question for this pillar has a valid answer. */
export function pillarComplete(pillar: number, answers: Answers, bank?: Question[]): boolean {
  return visibleQuestions(answers, bank)
    .filter((q) => q.pillar === pillar && q.required)
    .every((q) => isAnswered(q, answers[q.id]));
}

export function interviewComplete(answers: Answers, bank?: Question[]): boolean {
  return [1, 2, 3, 4].every((p) => pillarComplete(p, answers, bank));
}

/** The Safety notice must appear before Pillar 2 when physical violence is reported. */
export function needsSafetyNotice(answers: Answers, bank?: Question[]): boolean {
  return visibleQuestions(answers, bank).some((q) => q.id === 'p1.violence') && answers['p1.violence']?.value === 'yes';
}

export type CleanResult = { ok: true; answers: Answers } | { ok: false; error: string };

/**
 * Validates answers against the bank and drops answers to questions that are
 * no longer visible (e.g. p1.violence after p1.harm changed to No).
 */
export function cleanAnswers(input: unknown, bank: Question[] = getBank(BANK_VERSION)): CleanResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'answers must be an object' };
  const byId = new Map(bank.map((q) => [q.id, q]));
  const parsed: Answers = {};
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    const q = byId.get(id);
    if (!q) return { ok: false, error: `unknown question ${id}` };
    if (!raw || typeof raw !== 'object') return { ok: false, error: `bad answer for ${id}` };
    const { value, note } = raw as { value?: unknown; note?: unknown };
    if (typeof value !== 'string') return { ok: false, error: `bad value for ${id}` };
    if (note !== undefined && note !== null && typeof note !== 'string') return { ok: false, error: `bad note for ${id}` };
    const trimmedNote = typeof note === 'string' ? note.trim() : '';
    if (trimmedNote.length > CONFIG.noteMaxChars) return { ok: false, error: `note for ${id} is over ${CONFIG.noteMaxChars} characters` };
    if (q.kind === 'choice' && !q.options!.some((o) => o.value === value)) return { ok: false, error: `invalid option for ${id}` };
    if (q.kind === 'text') {
      const v = value.trim();
      if (v.length > CONFIG.noteMaxChars) return { ok: false, error: `answer for ${id} is over ${CONFIG.noteMaxChars} characters` };
      if (!v && !trimmedNote) continue; // empty optional text answer: nothing to store
      parsed[id] = trimmedNote ? { value: v, note: trimmedNote } : { value: v };
      continue;
    }
    parsed[id] = trimmedNote ? { value, note: trimmedNote } : { value };
  }
  const visibleIds = new Set(visibleQuestions(parsed, bank).map((q) => q.id));
  const answers: Answers = {};
  for (const [id, a] of Object.entries(parsed)) if (visibleIds.has(id)) answers[id] = a;
  return { ok: true, answers };
}

export function optionLabel(q: Question, value: string): string {
  return q.kind === 'choice' ? (q.options!.find((o) => o.value === value)?.label ?? value) : value;
}
