import { useEffect, useState } from 'preact/hooks';
import { api, ApiError, type Me, type SituationSummary } from '../api';
import { ConfirmDialog, formatDate, initials } from '../components';
import { BackIcon, TrashIcon } from '../icons';
import { navigate } from '../router';

const STATUS_LABEL = { draft: 'Draft', answered: 'Ready for a read', analyzed: 'Read' } as const;

export function Profile(props: { me: Me }) {
  const { user } = props.me;
  const [items, setItems] = useState<SituationSummary[] | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<SituationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .listSituations()
      .then((r) => setItems(r.situations))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load your situations.'));
  }, []);

  const open = (s: SituationSummary) => {
    if (s.status === 'analyzed' || s.status === 'answered') navigate(`/s/${s.id}/read`);
    else navigate(`/s/${s.id}/resume`);
  };

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api.deleteSituation(confirm.id);
      setItems((list) => list?.filter((i) => i.id !== confirm.id) ?? null);
      setConfirm(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete.');
      setConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div class="screen">
      <header class="topbar">
        <button class="icon-btn" aria-label="Back" onClick={() => navigate('/')}>
          <BackIcon />
        </button>
        <span class="title">Profile</span>
      </header>
      <main class="main" style={{ paddingTop: '12px' }}>
        <div class="profile-head">
          <div class="avatar" aria-hidden="true">
            {initials(user.displayName, user.email)}
          </div>
          <div class="who">
            <b>{user.displayName || 'You'}</b>
            <span>{user.email}</span>
          </div>
        </div>

        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 class="section-label">Saved situations</h2>
          {error && <div class="error-box" role="alert">{error}</div>}
          {!items && !error && <div class="spinner" style={{ margin: '24px auto' }} />}
          {items && items.length === 0 && (
            <div class="empty">
              <p style={{ margin: 0 }}>No situations yet. Start one from the home screen.</p>
              <button class="btn btn-primary" style={{ maxWidth: '260px' }} onClick={() => navigate('/new')}>
                New situation
              </button>
            </div>
          )}
          {items && items.length > 0 && (
            <ul class="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((s) => (
                <li class="item" key={s.id}>
                  <button class="item-main" onClick={() => open(s)}>
                    <span class="item-text">{s.text}</span>
                    <span class="item-meta">
                      <span class={`badge ${s.status}`}>{STATUS_LABEL[s.status]}</span>
                      {formatDate(s.createdAt)}
                    </span>
                  </button>
                  <button class="icon-btn" aria-label="Delete situation" onClick={() => setConfirm(s)}>
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      {confirm && (
        <ConfirmDialog
          title="Delete this situation?"
          body="Its answers and its read are deleted too. This can’t be undone."
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={doDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
