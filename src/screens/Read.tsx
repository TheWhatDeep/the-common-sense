/** Analyzing → Result (or the Safety notice when the AI flags danger). */
import { useEffect, useState } from 'preact/hooks';
import { PILLAR_NAMES } from '../../shared/questionBank';
import { api, ApiError, type Situation } from '../api';
import { formatTime, Loading, SafetyNotice, Toast } from '../components';
import { CloseIcon } from '../icons';
import { navigate } from '../router';
import { resumeStep } from './Interview';

type State =
  | { kind: 'loading' }
  | { kind: 'analyzing' }
  | { kind: 'error'; code: string; message: string; resetsAt?: string }
  | { kind: 'done'; situation: Situation };

export function Read(props: { id: string; onUsageChange: () => void }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [safetyDismissed, setSafetyDismissed] = useState(false);
  const [toast, setToast] = useState('');

  const run = async () => {
    try {
      const s = await api.getSituation(props.id);
      if (s.status === 'analyzed' && s.result) return setState({ kind: 'done', situation: s });
      if (s.status !== 'answered') return navigate(`/s/${s.id}/${resumeStep(s)}`, { replace: true });
      setState({ kind: 'analyzing' });
      const analyzed = await api.analyze(s.id);
      props.onUsageChange();
      setState({ kind: 'done', situation: analyzed });
    } catch (e) {
      if (e instanceof ApiError)
        setState({ kind: 'error', code: e.code, message: e.message, resetsAt: e.body.resetsAt as string | undefined });
      else setState({ kind: 'error', code: 'error', message: 'Something went wrong. Try again.' });
    }
  };

  useEffect(() => {
    run();
  }, [props.id]);

  if (state.kind === 'loading') return <Loading />;
  if (state.kind === 'analyzing') return <Loading label="Reading your situation through the four pillars…" />;

  if (state.kind === 'error') {
    const retryable = ['timeout', 'busy', 'invalid_output', 'upstream_error', 'offline', 'error', 'server_error'].includes(state.code);
    const title =
      state.code === 'daily_limit'
        ? 'That’s all for today'
        : state.code === 'blocked'
          ? 'This one can’t be read'
          : state.code === 'not_found'
            ? 'Situation not found'
            : 'The read didn’t come through';
    const message =
      state.code === 'daily_limit' && state.resetsAt
        ? `You’ve used today’s reads. Your situation is saved; come back after ${formatTime(state.resetsAt)}.`
        : state.message;
    return (
      <div class="screen">
        <div class="center">
          <h1 class="h-md">{title}</h1>
          <p class="lede" role="alert">
            {message}
          </p>
          {state.code !== 'daily_limit' && state.code !== 'not_found' && retryable && (
            <p class="fineprint">This attempt doesn’t count toward your daily reads.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '340px' }}>
            {retryable && (
              <button class="btn btn-primary" onClick={() => run()}>
                Try again
              </button>
            )}
            <button class={`btn ${retryable ? 'btn-outline' : 'btn-primary'}`} onClick={() => navigate('/')}>
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const s = state.situation;
  const r = s.result!;
  if (r.safety_flag && !safetyDismissed)
    return <SafetyNotice fromAnalysis continueLabel="Back to home" onContinue={() => (setSafetyDismissed(true), navigate('/'))} />;

  return (
    <div class="screen">
      <header class="topbar" style={{ justifyContent: 'space-between', paddingRight: '20px' }}>
        <button class="icon-btn" aria-label="Close" onClick={() => navigate('/')}>
          <CloseIcon />
        </button>
        <button class="text-btn" onClick={() => navigate('/')}>
          Done
        </button>
      </header>
      <main class="main" style={{ paddingTop: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h1 class="h-lg">The read</h1>
          <p class="quote">{s.text}</p>
        </div>
        <section class="reads" aria-labelledby="reads-title">
          <h2 id="reads-title" class="section-label">
            How the pillars see it
          </h2>
          {r.pillars.map((p) => (
            <div class={`read${p.applies ? '' : ' na'}`} key={p.pillar}>
              <span class="num" aria-hidden="true">
                {p.pillar}
              </span>
              <div class="read-body">
                <b>
                  {PILLAR_NAMES[p.pillar]}
                  {!p.applies && <span class="na-tag">Doesn’t apply</span>}
                </b>
                <span>{p.read}</span>
              </div>
            </div>
          ))}
        </section>
        <section class="bottom-line">
          <h2>Bottom line</h2>
          <p>{r.bottom_line}</p>
        </section>
        <p class="fineprint">AI-generated guidance based on your answers. You make the decision.</p>
      </main>
      <footer class="footer" style={{ position: 'static', background: 'none' }}>
        <button class="btn btn-primary" onClick={() => setToast('Saved. Find it any time under Profile.')}>
          Save
        </button>
        <button class="btn btn-outline" onClick={() => navigate('/new')}>
          New situation
        </button>
      </footer>
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
