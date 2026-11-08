import { useState } from 'preact/hooks';
import { api, ApiError } from '../api';
import { ConfirmDialog } from '../components';
import { BackIcon } from '../icons';
import { go } from '../router';
import { DisclosureText } from './Disclosure';

export function Settings(props: { onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.deleteAccount();
      props.onDeleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete your account.');
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <div class="screen">
      <header class="topbar">
        <button class="icon-btn" aria-label="Back" onClick={() => go('/')}>
          <BackIcon />
        </button>
        <span class="title">Settings</span>
      </header>
      <main class="main" style={{ paddingTop: '12px' }}>
        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 class="section-label">Your data</h2>
          <div class="card">
            <DisclosureText />
          </div>
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 class="section-label" style={{ margin: 0 }}>
            Account
          </h2>
          <p class="lede">Deleting your account removes every situation, answer and read you’ve saved. It can’t be undone.</p>
          {error && <div class="error-box" role="alert">{error}</div>}
          <button class="btn btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => setConfirm(true)}>
            Delete account
          </button>
        </section>
      </main>
      {confirm && (
        <ConfirmDialog
          title="Delete your account?"
          body="Everything you’ve saved here is deleted right away. This can’t be undone."
          confirmLabel="Delete my account"
          busy={busy}
          onConfirm={doDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
