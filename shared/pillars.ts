/**
 * The pillar set: everything the app says about the pillars, in one place.
 * The Pillars page, the result screen, the AI prompt and the app copy all read
 * from here. A user-defined set later is another PillarSet.
 *
 * Human-readable copy: docs/pillars-of-common-sense.md (keep in sync).
 */

export type PillarNumber = 1 | 2 | 3 | 4;

export interface Pillar {
  n: PillarNumber;
  /** Everyday name, e.g. "Live and let live". */
  name: string;
  /** One line under the name. */
  short: string;
  /** Badge color (Clear & bright palette). */
  color: string;
  statement: string;
  meaning: string;
  boundaries: string[];
  example?: string;
  /** Questions to ask yourself (Pillars page). */
  ask: string[];
}

export interface PillarSet {
  id: string;
  /** e.g. "The four pillars of common sense". */
  title: string;
  /** One paragraph: what the set is for. */
  intro: string;
  /** The one idea behind every pillar. */
  principle: string;
  pillars: Pillar[];
  definitions: [term: string, meaning: string][];
  /** How the pillars check each other. */
  together: { lead: string; text: string }[];
  /** The shared exit across pillars. */
  sharedExit: string;
  /** What the set is not. */
  scope: string;
}

export const COMMON_SENSE: PillarSet = {
  id: 'common-sense',
  title: 'The four pillars of common sense',
  intro:
    'Common sense is just good judgment you can explain. Four simple pillars help you see what’s really at stake in a hard situation, so you can respond without giving up your convictions or running over anyone else’s. You make the call.',
  principle:
    'Hold yourself to a standard, respect other people’s right to run their own lives, disagree peacefully, and when you can’t accept something, walk away.',
  pillars: [
    {
      n: 1,
      name: 'Live and let live',
      short: 'Respect others’ choices; keep your own.',
      color: '#0e9f8e',
      statement:
        'Everyone has the right to their own beliefs, identity, relationships and way of life, including who they love and marry, as long as they don’t harm others. You respect those rights fully, and you’re free not to take part in what goes against your own beliefs.',
      meaning:
        'Honest tolerance: full respect for other people’s rights, without having to endorse their choices. Disagreement, criticism, or someone living differently never counts as harm. Only aggression does.',
      boundaries: [
        'Harm is between people: physical violence, or aggressive berating that pushes into your space and won’t listen.',
        'When harm happens, the response is to disengage, not retaliate.',
        'Taking part means personally doing what your beliefs forbid. Attending, celebrating and supporting someone else’s choice are not taking part.',
        'The same test applies to you. Sharing your views is fine; pushing them on someone who won’t listen is harm.',
      ],
      example:
        'A relative invites you to a ceremony from a tradition that isn’t yours. You can attend and be glad for them. Taking part in anything that goes against your own beliefs stays your choice.',
      ask: ['Is anyone causing harm here?', 'Am I being asked to take part, or just to be there?'],
    },
    {
      n: 2,
      name: 'Think for yourself',
      short: 'Examine what you believe.',
      color: '#6d4ae0',
      statement:
        'Examine what you believe instead of inheriting it blindly. Whatever guides your conscience, whether faith, values or upbringing, your mind is still yours to use. Decide on evidence, reasoning, conscience and what’s at stake, and keep checking whether your views still hold. Don’t force your views on others, and don’t let others force theirs on you.',
      meaning:
        'A belief you have examined is one you chose; a belief you never questioned is only a habit. This pillar is a self-check, and it keeps the other three from hardening into dogma.',
      boundaries: [
        'It is ongoing, not a one-time pass. The check keeps running.',
        'The test of real thinking for yourself: the answer could have gone either way.',
        'It applies to everyone you influence. The freedom you want for yourself is the freedom you give others, including your own children.',
      ],
      example:
        'You’ve always opposed something because your family did. Before you argue about it again, ask whether you’d still hold that view if you’d grown up somewhere else.',
      ask: ['Have I actually thought this through, or am I reacting?', 'What would change my mind?'],
    },
    {
      n: 3,
      name: 'Children come first',
      short: 'The family exists for the child.',
      color: '#f0645a',
      statement:
        'A family is a vital support for raising children, giving them protection and a baseline of happiness. But the family exists for the child, not the other way around. One responsible parent is better than a broken family kept together for appearances. When a home becomes harmful, lawful separation to protect the children is the right choice.',
      meaning:
        'Value the family for what it does (a safe, stable home for the child), not for how it looks. Raising a child alone is very hard, which is why the family matters. That same experience is why a broken family shouldn’t be preserved at the child’s expense.',
      boundaries: [
        'Separation must be lawful. It doesn’t have to be legally formalized; living apart is legal.',
        'Informal separation solves safety but leaves legal ties in place (custody, support, property, remarriage). Those need a lawyer, not the pillars.',
        'When ideals collide, a real child’s wellbeing is the tiebreaker.',
      ],
      example:
        'A parent in a home that has become harmful moves out with the children, without breaking any law, to give them a stable life.',
      ask: ['Does this affect a child?', 'Is the family’s wellbeing at stake, or only how it looks?'],
    },
    {
      n: 4,
      name: 'Disagree fairly',
      short: 'Respect the rules; change them fairly.',
      color: '#2f6fe4',
      statement:
        'Every group, whether a government, a school, a workplace or a community, has authority within its own area. Respect it even when you disagree, and push for change only through fair means: talking it through, voting, petitions, the courts. Attacking, coercing or degrading people because they aren’t like you is wrong, whoever does it. No group gets special treatment.',
      meaning:
        'Respecting a rule you disagree with is a matter of principle, not weakness. You can work to change it; you can’t attack the people or systems on the other side. Winning by destroying the other side isn’t winning, because you still have to live alongside them.',
      boundaries: [
        'It runs both ways. Whatever the law allows or forbids, every group respects it, including your own.',
        'Authority has limits: the state over everyone within its borders, an organization over its members and spaces, a person over their own choices.',
        'A fair loss is not an attack. Losing a vote or a court case through legitimate means calls for acceptance, not resentment.',
        'In shared spaces, the institution decides. Raise concerns through its proper channels; if you can’t accept the outcome, walk away.',
      ],
      example:
        'A school board makes a decision you disagree with. You raise it at the board’s meeting. If the board keeps its decision, you either accept it or move your child to another school.',
      ask: ['Whose decision is this to make?', 'Is this disagreement, or an attack?', 'Can I accept it? If not, can I walk away lawfully?'],
    },
  ],
  definitions: [
    ['Harm', 'Physical violence, or aggressive berating that pushes into your space and won’t listen.'],
    ['Taking part', 'Personally doing what your beliefs forbid. Attending or supporting doesn’t count.'],
    ['Thinking for yourself', 'Holding a belief you have examined and could have rejected.'],
    ['What a family is for', 'A safe, stable home for the child, as opposed to how the family looks.'],
    ['Lawful separation', 'Living apart without breaking any law. Formal legal separation is not required.'],
    ['Authority', 'The area a group has the say over: the state, its borders; an organization, its members and spaces; a person, their own choices.'],
    ['Disagreement', 'Peaceful, legitimate efforts to change something: talking, voting, petitioning, courts.'],
    ['Attack', 'Harassment, vandalism, coercion, threats, or treating people as less than human.'],
    ['Special treatment', 'Getting more than others in the same position. Equal access, equal pay and an equal chance at a job are not special treatment.'],
    ['Walking away', 'Lawful distance from what you can’t accept: leaving the conversation, the institution or the situation.'],
  ],
  together: [
    { lead: 'Think for yourself keeps Live and let live honest.', text: 'Saying no comes from conviction you’ve examined, not reflex.' },
    { lead: 'Live and let live keeps Disagree fairly humane.', text: 'Respecting the rules never becomes contempt for people.' },
    { lead: 'Children come first breaks ties.', text: 'When ideals collide, a real child’s wellbeing wins.' },
    { lead: 'Disagree fairly keeps everything civil.', text: 'Even when you’re right, you pursue it without destroying the other side.' },
  ],
  sharedExit:
    'Lawful distance is the shared exit. Leaving a conversation (pillar 1), separating to protect children (pillar 3) and leaving an institution you can’t accept (pillar 4) are the same move at different scales.',
  scope:
    'The pillars are a code for yourself, not a legal or political theory. They shape what you do; they don’t say what laws should be, and they are never a loophole around the law. The middle ground is in method, not belief: hold firm convictions, keep examining them, put children’s wellbeing first, and never win by destroying the other side.',
};

/** The set the app uses today. */
export const ACTIVE_SET = COMMON_SENSE;

export function pillarOf(n: number, set: PillarSet = ACTIVE_SET): Pillar {
  return set.pillars.find((p) => p.n === n)!;
}

/** The set as plain text for the AI's instructions. */
export function frameworkText(set: PillarSet = ACTIVE_SET): string {
  const pillars = set.pillars
    .map(
      (p) =>
        `PILLAR ${p.n}: ${p.name.toUpperCase()}\n${p.statement}\n- ${p.meaning}\n${p.boundaries.map((b) => `- ${b}`).join('\n')}`,
    )
    .join('\n\n');
  return `${set.title.toUpperCase()}
${set.principle}

${pillars}

KEY DEFINITIONS
${set.definitions.map(([t, d]) => `- ${t}: ${d}`).join('\n')}

HOW THE PILLARS WORK TOGETHER
${set.together.map((t) => `- ${t.lead} ${t.text}`).join('\n')}
- ${set.sharedExit}

SCOPE
${set.scope}`;
}
