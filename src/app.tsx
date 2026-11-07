import { useEffect, useState } from 'preact/hooks';
import { api, ApiError, type Me } from './api';
import { Loading } from './components';
import { match, navigate, usePath } from './router';
import { Disclosure } from './screens/Disclosure';
import { Home } from './screens/Home';
import { Interview, resumeStep, situationCache } from './screens/Interview';
import { Profile } from './screens/Profile';
import { Read } from './screens/Read';
import { Settings } from './screens/Settings';
import { SignIn } from './screens/SignIn';

type Auth = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'error' } | { kind: 'signed-in'; me: Me };

export function App() {
  const [auth, setAuth] = useState<Auth>({ kind: 'loading' });
  const path = usePath();

  const loadMe = () =>
    api
      .me()
      .then((me) => setAuth({ kind: 'signed-in', me }))
      .catch((e) => setAuth(e instanceof ApiError && e.status === 401 ? { kind: 'signed-out' } : { kind: 'error' }));

  useEffect(() => {
    loadMe();
  }, []);

  const signOut = async () => {
    await api.signOut().catch(() => {});
    situationCache.clear();
    setAuth({ kind: 'signed-out' });
    navigate('/', { replace: true });
  };

  if (auth.kind === 'loading') return <Loading />;
  if (auth.kind === 'error')
    return (
      <div class="screen">
        <div class="center">
          <h1 class="h-md">Can’t reach the server</h1>
          <p class="lede">Check your connection and try again.</p>
          <button class="btn btn-primary" style={{ maxWidth: '260px' }} onClick={() => (setAuth({ kind: 'loading' }), loadMe())}>
            Try again
          </button>
        </div>
      </div>
    );
  if (auth.kind === 'signed-out')
    return <SignIn onSignedIn={(me) => (setAuth({ kind: 'signed-in', me }), navigate('/', { replace: true }))} />;

  const me = auth.me;
  // A new user sees the data notice before anything else, and can't skip it.
  if (!me.disclosureAccepted) return <Disclosure onAccepted={(m) => setAuth({ kind: 'signed-in', me: m })} onSignOut={signOut} />;

  let m: Record<string, string> | null;
  if (path === '/new') return <Interview key="new" step="1" />;
  if ((m = match('/s/:id/resume', path))) return <Resume id={m.id} />;
  if ((m = match('/s/:id/read', path))) return <Read key={m.id} id={m.id} onUsageChange={loadMe} />;
  if ((m = match('/s/:id/:step', path))) return <Interview key={m.id} id={m.id} step={m.step} />;
  if (path === '/profile') return <Profile me={me} />;
  if (path === '/settings')
    return <Settings onDeleted={() => (situationCache.clear(), setAuth({ kind: 'signed-out' }), navigate('/', { replace: true }))} />;
  if (path !== '/') navigate('/', { replace: true });
  return <Home me={me} refreshMe={loadMe} onSignOut={signOut} />;
}

/** Opens a saved draft at its first unanswered step. */
function Resume(props: { id: string }) {
  useEffect(() => {
    api
      .getSituation(props.id)
      .then((s) => {
        situationCache.set(s.id, s);
        navigate(`/s/${s.id}/${resumeStep(s)}`, { replace: true });
      })
      .catch(() => navigate('/profile', { replace: true }));
  }, [props.id]);
  return <Loading />;
}
