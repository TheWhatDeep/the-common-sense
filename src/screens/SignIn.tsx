import { useEffect, useRef, useState } from 'preact/hooks';
import { api, ApiError, type Me } from '../api';
import { PillarsMark } from '../icons';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        };
      };
    };
  }
}

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('gsi'));
    document.head.appendChild(s);
  });
}

export function SignIn(props: { onSignedIn: (me: Me) => void }) {
  const [config, setConfig] = useState<{ googleClientId: string; devLogin: boolean } | null>(null);
  const [state, setState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState('');
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .authConfig()
      .then(setConfig)
      .catch(() => {
        setState('error');
        setError("Can't reach the server. Check your connection.");
      });
  }, []);

  const finish = async (p: Promise<Me>) => {
    setState('submitting');
    setError('');
    try {
      props.onSignedIn(await p);
    } catch (e) {
      setState('error');
      setError(e instanceof ApiError ? e.message : 'Sign-in failed. Try again.');
    }
  };

  useEffect(() => {
    if (!config?.googleClientId || !slot.current) return;
    loadGoogleScript()
      .then(() => {
        window.google!.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: (r) => finish(api.signIn(r.credential)),
        });
        window.google!.accounts.id.renderButton(slot.current!, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 300,
        });
      })
      .catch(() => {
        setState('error');
        setError("Couldn't load Google sign-in. Check your connection.");
      });
  }, [config?.googleClientId]);

  const notConfigured = config && !config.googleClientId && !config.devLogin;

  return (
    <div class="screen">
      <div class="center">
        <div class="brand-mark">
          <PillarsMark />
        </div>
        <h1 class="h-xl">The Common Sense</h1>
        <p class="lede">Walk through a real situation with the four pillars. You make the call.</p>
        <div style={{ height: '8px' }} />
        {config?.googleClientId && <div class="gsi-slot" ref={slot} aria-busy={state === 'submitting'} />}
        {config?.devLogin && (
          <button
            class="btn btn-outline"
            style={{ maxWidth: '300px' }}
            disabled={state === 'submitting'}
            onClick={() => finish(api.devSignIn('dev@example.com', 'Dev User'))}
          >
            Dev sign-in (local only)
          </button>
        )}
        {state === 'submitting' && <p class="lede">Signing you in…</p>}
        {notConfigured && <div class="error-box">Sign-in isn't set up yet. Add GOOGLE_CLIENT_ID to the Cloudflare settings.</div>}
        {state === 'error' && <div class="error-box" role="alert">{error}</div>}
      </div>
    </div>
  );
}
