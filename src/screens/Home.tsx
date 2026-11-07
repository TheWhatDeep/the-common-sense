import { useEffect, useState } from 'preact/hooks';
import type { Me } from '../api';
import { formatTime, initials } from '../components';
import { LogoutIcon, MenuIcon, PlusIcon, ProfileIcon, SettingsIcon } from '../icons';
import { navigate } from '../router';

export function Home(props: { me: Me; refreshMe: () => void; onSignOut: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { usage, user } = props.me;
  const limited = usage.remaining <= 0;

  useEffect(() => {
    props.refreshMe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div class="screen">
      <header class="topbar">
        <button class="icon-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </button>
        <span class="title">The Common Sense</span>
      </header>

      <main class="home-main">
        <button
          class="plus"
          aria-label="Start a new situation"
          disabled={limited}
          onClick={() => navigate('/new')}
        >
          <PlusIcon />
        </button>
        <div class="home-copy">
          <h1 class="h-xl">What’s the situation?</h1>
          {limited ? (
            <p class="limit-note" role="status">
              You’ve used today’s {usage.cap} reads. More at {formatTime(usage.resetsAt)}.
            </p>
          ) : (
            <p class="lede">Walk through it with the four pillars.</p>
          )}
        </div>
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
              <a class="nav-item" href="#/profile">
                <ProfileIcon />
                Profile
              </a>
              <a class="nav-item" href="#/settings">
                <SettingsIcon />
                Settings
              </a>
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
