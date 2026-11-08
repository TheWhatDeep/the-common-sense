/**
 * The dashboard. With nothing saved yet it is exactly the mockup's Home
 * (big plus, "What's the situation?"). Once there is history it adds
 * Drafts, Saved and Recent reads below a smaller plus.
 */
import { useEffect, useState } from 'preact/hooks';
import { api, type Me, type SituationSummary } from '../api';
import { formatTime, initials } from '../components';
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

  const plus = (
    <button class="plus" aria-label="Start a new situation" disabled={limited} onClick={() => go('/new')}>
      <PlusIcon />
    </button>
  );
  const copy = (
    <div class="home-copy">
      <h1 class={hasHistory ? 'h-md' : 'h-xl'}>What’s the situation?</h1>
      {limited ? (
        <p class="limit-note" role="status">
          You’ve used today’s {usage.cap} reads. More at {formatTime(usage.resetsAt)}.
        </p>
      ) : (
        <p class="lede">Walk through it with the four pillars.</p>
      )}
    </div>
  );

  return (
    <div class="screen">
      <header class="topbar">
        <button class="icon-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </button>
        <span class="title">The Common Sense</span>
      </header>

      {!hasHistory ? (
        <main class="home-main">
          {plus}
          {copy}
        </main>
      ) : (
        <main style={{ flex: 1 }}>
          <div class="dash-hero">
            {plus}
            {copy}
          </div>
          <div class="dash-sections stagger">
            {drafts.length > 0 && (
              <Section title="Pick up where you left off" i={0} items={drafts.slice(0, DRAFT_LIMIT)} more={drafts.length > DRAFT_LIMIT} />
            )}
            {saved.length > 0 && <Section title="Saved" i={1} items={saved} showBottomLine />}
            {recent.length > 0 && <Section title="Recent reads" i={2} items={recent} showBottomLine more />}
          </div>
        </main>
      )}

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
