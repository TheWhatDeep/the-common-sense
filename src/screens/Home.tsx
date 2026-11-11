/**
 * The dashboard: a hero with the "What's the situation?" button, the four
 * pillars as tiles, then drafts, saved reads and recent reads.
 */
import { useEffect, useState } from 'preact/hooks';
import { api, type Me, type SituationSummary } from '../api';
import { formatTime, initials } from '../components';
import { ACTIVE_SET } from '../../shared/pillars';
import { BrandMark } from '../components';
import { LogoutIcon, MenuIcon, PillarsIcon, PlusIcon, ProfileIcon, SettingsIcon } from '../icons';
import { go } from '../router';
import { SituationCard } from '../SituationCard';

const RECENT_LIMIT = 5;
const DRAFT_LIMIT = 3;

export function Home(props: { me: Me; refreshMe: () => void; onSignOut: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState<SituationSummary[] | null>(null);
  const { usage, user } = props.me;
  const limited = usage.remaining <= 0;

  useEffect(() => {
    props.refreshMe();
    api
      .listSituations()
      .then((r) => setItems(r.situations))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const drafts = (items ?? []).filter((s) => s.status !== 'analyzed');
  const saved = (items ?? [])
    .filter((s) => s.saved)
    .sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
  const recent = (items ?? []).filter((s) => s.status === 'analyzed' && !s.saved).slice(0, RECENT_LIMIT);
  const hasHistory = drafts.length + saved.length + recent.length > 0;

  return (
    <div class="screen">
      <header class="topbar">
        <button class="icon-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </button>
        <span class="title brand">
          <BrandMark />
          The Common Sense
        </span>
      </header>

      <main class="home-body">
        <section class={`hero${hasHistory ? ' compact' : ''}`}>
          <span class="eyebrow">{ACTIVE_SET.title}</span>
          <h1>Think it through, the common-sense way.</h1>
          {!hasHistory && <p class="lede">Describe what’s going on. Get a clear read through four simple pillars. You make the call.</p>}
          <button class="cta" aria-label="Start a new situation" disabled={limited} onClick={() => go('/new')}>
            What’s the situation?
            <span class="cta-plus" aria-hidden="true">
              <PlusIcon />
            </span>
          </button>
          {limited && (
            <p class="limit-note" role="status">
              You’ve used today’s {usage.cap} reads. More at {formatTime(usage.resetsAt)}.
            </p>
          )}
        </section>

        <div class="pillar-grid stagger" aria-label="The pillars">
          {ACTIVE_SET.pillars.map((p, i) => (
            <button class="pillar-tile" key={p.n} style={{ '--pc': p.color, '--i': i }} onClick={() => go(`/pillars/${p.n}`)}>
              <i aria-hidden="true">{p.n}</i>
              <b>{p.name}</b>
              <small>{p.short}</small>
            </button>
          ))}
        </div>

        {hasHistory && (
          <div class="dash-sections stagger">
            {drafts.length > 0 && (
              <Section title="Pick up where you left off" i={0} items={drafts.slice(0, DRAFT_LIMIT)} more={drafts.length > DRAFT_LIMIT} />
            )}
            {saved.length > 0 && <Section title="Saved" i={1} items={saved} showBottomLine />}
            {recent.length > 0 && <Section title="Recent reads" i={2} items={recent} showBottomLine more />}
          </div>
        )}
        <div style={{ height: '24px' }} />
      </main>

      {menuOpen && (
        <>
          <button class="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <nav class="drawer" aria-label="Main menu">
            <div class="drawer-profile">
              <div class="avatar" aria-hidden="true">
                {initials(user.displayName, user.email)}
              </div>
              <div class="who">
                <b>{user.displayName || 'You'}</b>
                <span>{user.email}</span>
              </div>
            </div>
            <div class="nav">
              <button class="nav-item" onClick={() => go('/pillars')}>
                <PillarsIcon />
                Pillars
              </button>
              <button class="nav-item" onClick={() => go('/profile')}>
                <ProfileIcon />
                Profile
              </button>
              <button class="nav-item" onClick={() => go('/settings')}>
                <SettingsIcon />
                Settings
              </button>
            </div>
            <div style={{ flex: 1 }} />
            <button class="nav-item danger" onClick={props.onSignOut}>
              <LogoutIcon />
              Log out
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

function Section(props: { title: string; i: number; items: SituationSummary[]; showBottomLine?: boolean; more?: boolean }) {
  return (
    <section class="dash-section" style={{ '--i': props.i }}>
      <div class="section-row">
        <h2 class="section-label">{props.title}</h2>
        {props.more && (
          <button class="link-btn" onClick={() => go('/profile')}>
            See all
          </button>
        )}
      </div>
      <ul class="card-list">
        {props.items.map((s) => (
          <li key={s.id}>
            <SituationCard s={s} showBottomLine={props.showBottomLine} />
          </li>
        ))}
      </ul>
    </section>
  );
}
