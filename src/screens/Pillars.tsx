/**
 * The Pillars guide: what the pillars of common sense are, how they help, and
 * how to use them. All text comes from the active pillar set (shared/pillars.ts).
 * /pillars/:n opens with that pillar expanded.
 */
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { ACTIVE_SET } from '../../shared/pillars';
import { BrandMark } from '../components';
import { BackIcon, ChevronDownIcon } from '../icons';
import { go } from '../router';

function Block(props: { title: string; i: number; children: ComponentChildren }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', '--i': props.i }}>
      <h2 class="section-label">{props.title}</h2>
      {props.children}
    </section>
  );
}

const HOW_TO_USE: [string, string][] = [
  ['Describe the situation plainly.', 'What happened, who is involved, and what you’re being asked to do or deciding.'],
  ['Check for harm first.', 'Is anyone being hurt or aggressively berated? If so, get safe and step back before anything else.'],
  ['Check yourself.', 'Are you responding from a view you’ve thought through, or reacting? What would change your mind?'],
  ['Put any child first.', 'If a child is affected, their real wellbeing breaks the tie.'],
  ['Find whose decision it is.', 'Disagree through fair channels, never by attacking. If you can’t accept it, walk away lawfully.'],
  ['Decide.', 'Weigh what the pillars showed you. The call is yours.'],
];

export function Pillars(props: { open?: number }) {
  const set = ACTIVE_SET;

  useEffect(() => {
    if (!props.open) return;
    const el = document.getElementById(`pillar-${props.open}`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  }, [props.open]);

  return (
    <div class="screen">
      <header class="topbar">
        <button class="icon-btn" aria-label="Back" onClick={() => go('/')}>
          <BackIcon />
        </button>
        <span class="title">The pillars</span>
      </header>
      <main class="guide stagger">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', '--i': 0 }}>
          <BrandMark size={28} />
          <h1 class="h-lg">{set.title}</h1>
          <p>{set.intro}</p>
        </div>

        <Block title="The pillars" i={1}>
          {set.pillars.map((p) => (
            <details class="pillar-card" key={p.n} id={`pillar-${p.n}`} open={props.open === p.n} style={{ '--pc': p.color }}>
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
                <h4>Where the lines are</h4>
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

        <Block title="How they help" i={2}>
          <p>
            Hard situations pull in several directions at once: your beliefs, someone else’s rights, a child’s wellbeing, the rules of
            a place. The pillars give you a fixed order to think in, so you can see which of those is really at stake.
          </p>
          <p>They don’t make the decision for you. They make it clearer, and the call stays yours.</p>
        </Block>

        <Block title="How to use them" i={3}>
          <ol class="steps">
            {HOW_TO_USE.map(([lead, text]) => (
              <li>
                <span>
                  <b>{lead}</b> {text}
                </span>
              </li>
            ))}
          </ol>
          <button class="btn btn-primary" style={{ marginTop: '4px' }} onClick={() => go('/new')}>
            Think a situation through
          </button>
        </Block>

        <Block title="How they work together" i={4}>
          <p>Each pillar checks the others. Remove one and the rest start to drift.</p>
          <ul class="bullets">
            {set.together.map((t) => (
              <li>
                <b>{t.lead}</b> {t.text}
              </li>
            ))}
          </ul>
          <p>{set.sharedExit}</p>
        </Block>

        <Block title="Key words" i={5}>
          <dl class="defs" style={{ margin: 0 }}>
            {set.definitions.map(([term, def]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{def}</dd>
              </div>
            ))}
          </dl>
        </Block>

        <Block title="What the pillars are not" i={6}>
          <p>{set.scope}</p>
        </Block>
      </main>
    </div>
  );
}
