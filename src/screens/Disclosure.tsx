import { useState } from 'preact/hooks';
import { api, ApiError, type Me } from '../api';

/** Plain-words data notice. Settings shows the same text. */
export function DisclosureText() {
  return (
    <>
      <p>
        When you ask for a read, the situation you describe is sent to <b>Google's Gemini API</b>.
      </p>
      <p>
        This app uses Gemini's <b>free tier</b>. On the free tier, <b>Google may use what you send to improve its products</b>, and
        people at Google may read it.
      </p>
      <p>Leave out names, addresses and anything you wouldn't want a stranger to read.</p>
      <p>Your situations stay in your account until you delete them. You can delete one, or your whole account, at any time.</p>
    </>
  );
}

export function Disclosure(props: { onAccepted: (me: Me) => void; onSignOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      props.onAccepted(await api.acceptDisclosure());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };
  return (
    <div class="screen">
      <main class="main" style={{ paddingTop: '40px' }}>
        <span class="chip">Before you start</span>
        <h1 class="h-md">Where your situations go</h1>
        <div class="card">
          <DisclosureText />
        </div>
        {error && <div class="error-box" role="alert">{error}</div>}
      </main>
      <footer class="footer">
        <button class="btn btn-primary" disabled={busy} onClick={accept}>
          {busy ? 'Saving…' : 'I understand'}
        </button>
        <button class="btn btn-ghost" onClick={props.onSignOut}>
          Sign out
        </button>
      </footer>
    </div>
  );
}
