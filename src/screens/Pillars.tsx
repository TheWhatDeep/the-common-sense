/**
 * The Pillars guide: what the Four Pillars of Respect are, how they help, and
 * how to use them. Content mirrors docs/four-pillars-of-respect.md.
 */
import type { ComponentChildren } from 'preact';
import { BackIcon, ChevronDownIcon } from '../icons';
import { go } from '../router';

interface PillarDoc {
  n: 1 | 2 | 3 | 4;
  name: string;
  short: string;
  statement: string;
  meaning: string;
  boundaries: string[];
  example?: string;
  ask: string[];
}

const PILLARS: PillarDoc[] = [
  {
    n: 1,
    name: 'Belief Plurality',
    short: 'Respect others’ beliefs. Don’t do what contradicts yours.',
    statement:
      'Everyone has the right to their own beliefs, identity, relationships and way of life, including the right to marry, as long as they don’t harm others. I respect those rights fully, and I don’t participate in what contradicts my own beliefs.',
    meaning:
      'Honest tolerance: full civic respect without claiming personal endorsement. Disagreement, criticism, or someone living differently never counts as harm. Only aggression does.',
    boundaries: [
      'Harm is interpersonal: physical violence, or aggressive berating that pushes into your space and won’t listen.',
      'When harm happens, the response is to disengage, not retaliate.',
      'Participation means personally doing what your beliefs forbid. Attending, celebrating and supporting someone else’s choice are not participation.',
      'The same test applies to you. Sharing your faith is fine; pushing it on someone who won’t listen is harm.',
    ],
    example:
      'A friend in a same-sex relationship invites you to their wedding. You can attend as a guest and support them. What you wouldn’t do is enter a same-sex marriage yourself.',
    ask: ['Is anyone causing harm here?', 'Am I being asked to participate, or just to be present?'],
  },
  {
    n: 2,
    name: 'Intellectual Autonomy',
    short: 'Examine your beliefs. Never force them on others.',
    statement:
      'Beliefs should be examined, not inherited blindly. My faith directs my conscience but doesn’t dictate my mind or body. I make decisions based on research, evidence, morality and weight, and I keep checking whether my beliefs still fit. I don’t force mine on others, and I don’t accept others forcing theirs on me.',
    meaning:
      'A belief you have examined is one you chose; a belief you never questioned is only a habit. This pillar is a self-check, and it keeps the other three from hardening into dogma.',
    boundaries: [
      'It is ongoing, not a one-time pass. The check keeps running.',
      'The test of real autonomy: the answer could have gone either way.',
      'It applies to everyone you influence. The freedom you value for yourself is the freedom you give others, including your own children.',
    ],
    ask: ['Have I actually examined this, or am I reacting?', 'What would change my mind?'],
  },
  {
    n: 3,
    name: 'Familial Realism',
    short: 'The family exists for the child.',
    statement:
      'The family unit is a vital support structure for raising children, giving them protection and a baseline of happiness. But the family exists for the child, not the other way around. A responsible parent is better than a dysfunctional family kept together for appearance. When a family becomes destructive, lawful separation to protect the children is the right choice.',
    meaning:
      'Value the family for its function (a safe, stable home for the child), not its form. Raising a child alone is very hard, which is why the family matters. That same experience is why a broken family shouldn’t be preserved at the child’s expense.',
    boundaries: [
      'Separation must be lawful. It does not have to be legally formalized; living apart is legal.',
      'Informal separation solves safety but leaves legal ties in place (custody, support, property, remarriage). Those need a lawyer, not the framework.',
      'When ideals collide, a real child’s wellbeing is the tiebreaker.',
    ],
    example:
      'A parent living in a home that has become harmful moves out with the children, without breaking any law, to give them a stable life.',
    ask: ['Does this affect a family or a child?', 'Is the family’s wellbeing at stake, or only its appearance?'],
  },
  {
    n: 4,
    name: 'Authority & Equality',
    short: 'Respect each domain. Disagree peacefully, or walk away.',
    statement:
      'Every group, whether a government, a church or a community, has authority within its own domain, and everyone must respect that authority even when they disagree with it. Disagreement is welcome through peaceful, legitimate means: argument, voting, petitioning and the courts. Attacking, coercing or degrading another group because it doesn’t conform to yours is wrong, whoever does it. No group gets special treatment.',
    meaning:
      'Respecting a law you disagree with is a matter of principle, not oppression. You can work to change it; you cannot attack the people or systems on the other side. Winning by destroying the other side isn’t winning, because you still have to live alongside them.',
    boundaries: [
      'It runs both ways. Whatever the law allows or forbids, every group respects it, including your own.',
      'Authority has a domain: the state over everyone in its borders, a church over its members and spaces, a person over their own choices.',
      'A fair loss is not an attack. Losing a vote or a court case through legitimate means calls for acceptance, not resentment.',
      'In shared spaces, the institution decides. Raise concerns through its proper channels; if you can’t accept the outcome, walk away.',
    ],
    example:
      'A school board makes a decision you disagree with. You raise it at the board’s meeting. If the board keeps its decision, you either accept it or move your child to another school.',
    ask: ['Whose domain is this?', 'Is this disagreement or an attack?', 'Can I accept it? If not, can I walk away lawfully?'],
  },
];

const DEFINITIONS: [string, string][] = [
  ['Harm', 'Physical violence, or aggressive berating that pushes into your space and won’t listen.'],
  ['Participation', 'Personally doing what your beliefs forbid. Attending or supporting doesn’t count.'],
  ['Autonomy', 'Holding a belief you have examined and could have rejected.'],
  ['Familial function', 'A safe, stable home for the child, as opposed to the family’s appearance.'],
  ['Lawful separation', 'Living apart without breaking any law. Formal legal separation is not required.'],
  ['Domain', 'The area a group has authority over: the state, its borders; a church, its members and spaces; a person, their own choices.'],
  ['Disagreement', 'Peaceful, legitimate efforts to change something: argument, voting, petitioning, courts.'],
  ['Attack', 'Harassment, vandalism, coercion, threats, or treating people as less than human.'],
  ['Special treatment', 'Getting more than others in the same position. Equal access, equal pay and an equal chance at a job are not special treatment.'],
  ['Walking away', 'Lawful distance from what you can’t accept: leaving the conversation, the institution or the situation.'],
];

function Block(props: { title: string; i: number; children: ComponentChildren }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', '--i': props.i }}>
      <h2 class="section-label">{props.title}</h2>
      {props.children}
    </section>
  );
}

export function Pillars() {
  return (
    <div class="screen">
      <header class="topbar">
        <button class="icon-btn" aria-label="Back" onClick={() => go('/')}>
          <BackIcon />
        </button>
        <span class="title">The Four Pillars</span>
      </header>
      <main class="guide stagger">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', '--i': 0 }}>
          <h1 class="h-lg">The Four Pillars of Respect</h1>
          <p>
            A personal code of conduct: <b>constrain yourself, respect others’ domains, disagree peacefully, and when you can’t accept
            something, walk away.</b> Each pillar applies that same idea to a different area: others’ beliefs, your own mind, the
            family, and society.
          </p>
        </div>

        <Block title="How they help" i={1}>
          <p>
            Hard situations pull in several directions at once: your beliefs, someone else’s rights, a child’s wellbeing, the rules of
            a place. The pillars give you a fixed order of questions, so you can see which of those is really at stake and respond
            without either giving up your convictions or running over someone else’s.
          </p>
          <p>They don’t make the decision for you. They make it clearer, and the call stays yours.</p>
        </Block>

        <Block title="How to use them" i={2}>
          <ol class="steps">
            <li>
              <span>
                <b>Describe the situation plainly.</b> What happened, who is involved, and what you’re being asked to do.
              </span>
            </li>
            <li>
              <span>
                <b>Check for harm first (Pillar 1).</b> Is anyone being hurt or aggressively berated? If so, disengage and get safe
                before anything else.
              </span>
            </li>
            <li>
              <span>
                <b>Check yourself (Pillar 2).</b> Are you responding from an examined belief, or reacting? What would change your mind?
              </span>
            </li>
            <li>
              <span>
                <b>Put any child first (Pillar 3).</b> If a child is affected, their real wellbeing breaks the tie.
              </span>
            </li>
            <li>
              <span>
                <b>Find the domain (Pillar 4).</b> Whose call is it? Disagree through legitimate channels, never by attacking. If you
                can’t accept it, walk away lawfully.
              </span>
            </li>
            <li>
              <span>
                <b>Decide.</b> Weigh what the pillars showed you. The call is yours.
              </span>
            </li>
          </ol>
          <button class="btn btn-primary" style={{ marginTop: '4px' }} onClick={() => go('/new')}>
            Walk through a situation
          </button>
        </Block>

        <Block title="The pillars" i={3}>
          {PILLARS.map((p) => (
            <details class="pillar-card" key={p.n}>
              <summary>
                <span class="num" aria-hidden="true">
                  {p.n}
                </span>
                <span>
                  <b>{p.name}</b>
                  <span class="sub">{p.short}</span>
                </span>
                <span class="chev">
                  <ChevronDownIcon />
                </span>
              </summary>
              <div class="pillar-body">
                <p class="statement">{p.statement}</p>
                <h4>What it means</h4>
                <p>{p.meaning}</p>
                <h4>Boundaries</h4>
                <ul>
                  {p.boundaries.map((b) => (
                    <li>{b}</li>
                  ))}
                </ul>
                {p.example && (
                  <>
                    <h4>Example</h4>
                    <p class="example">{p.example}</p>
                  </>
                )}
                <h4>Ask yourself</h4>
                <ul>
                  {p.ask.map((a) => (
                    <li>{a}</li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </Block>

        <Block title="How they work together" i={4}>
          <p>Each pillar checks the others. Remove one and the rest start to drift.</p>
          <ul class="bullets">
            <li>
              <span>
                <b>Pillar 2 keeps Pillar 1 honest.</b> Not participating comes from examined conviction, not reflex.
              </span>
            </li>
            <li>
              <span>
                <b>Pillar 1 keeps Pillar 4 humane.</b> Respecting authority never becomes contempt for people.
              </span>
            </li>
            <li>
              <span>
                <b>Pillar 3 is the tiebreaker.</b> When ideals collide, a real child’s wellbeing wins.
              </span>
            </li>
            <li>
              <span>
                <b>Pillar 4 keeps everything civil.</b> Even when you’re right, you pursue it without destroying the other side.
              </span>
            </li>
          </ul>
          <p>
            <b>Lawful distance is the shared exit.</b> Leaving a conversation (Pillar 1), separating to protect children (Pillar 3) and
            leaving an institution you can’t accept (Pillar 4) are the same move at different scales.
          </p>
        </Block>

        <Block title="Key words" i={5}>
          <dl class="defs" style={{ margin: 0 }}>
            {DEFINITIONS.map(([term, def]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{def}</dd>
              </div>
            ))}
          </dl>
        </Block>

        <Block title="What the pillars are not" i={6}>
          <p>
            They are a code for yourself, not a legal or political theory. They constrain what <i>you</i> do; they don’t say what laws
            should be, and they are never a loophole around the law. The middle ground is in method, not belief: hold firm convictions,
            keep examining them, put children’s wellbeing first, and never win by destroying the other side.
          </p>
        </Block>
      </main>
    </div>
  );
}
