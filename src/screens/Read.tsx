/**
 * Analyzing → Result (or the Safety notice when the AI flags danger).
 * While Gemini works, its thought summaries stream into the waiting screen.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { PILLAR_NAMES, resumeStep } from '../../shared/questionBank';
import { analyzeStream, api, ApiError, type Situation } from '../api';
import { formatTime, Loading, SafetyBanner, SafetyNotice, Toast } from '../components';
import { CloseIcon, PillarsMark } from '../icons';
import { go, navigate } from '../router';

type State =
  | { kind: 'loading' }
  | { kind: 'analyzing' }
  | { kind: 'error'; code: string; message: string; resetsAt?: string }
  | { kind: 'done'; situation: Situation };

const RETRYABLE = ['timeout', 'busy', 'invalid_output', 'upstream_error', 'offline', 'error', 'server_error', 'connection_lost'];

export function Read(props: { id: string; onUsageChange: () => void }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [thoughts, setThoughts] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [safetyDismissed, setSafetyDismissed] = useState(false);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const run = async () => {
    try {
      setState({ kind: 'loading' });
      const s = await api.getSituation(props.id);
      if (s.status === 'analyzed' && s.result) return setState({ kind: 'done', situation: s });
      if (s.status !== 'answered') return navigate(`/s/${s.id}/${resumeStep(s.answers)}`, { replace: true });
      setThoughts('');
      setRetrying(false);
      setFallback(false);
      setState({ kind: 'analyzing' });
      const analyzed = await analyzeStream(s.id, {
        onThought: (t) => setThoughts((prev) => prev + t),
        onRetry: () => {
          setRetrying(true);
          setThoughts((prev) => prev + '\n\n');
        },
        onFallback: () => setFallback(true),
      });
      props.onUsageChange();
      // Fade the thinking view out, then bring the result in.
      setLeaving(true);
      await new Promise((r) => setTimeout(r, 260));
      setLeaving(false);
      setState({ kind: 'done', situation: analyzed });
    } catch (e) {
      setLeaving(false);
      if (e instanceof ApiError)
        setState({ kind: 'error', code: e.code, message: e.message, resetsAt: e.body.resetsAt as string | undefined });
      else setState({ kind: 'error', code: 'error', message: 'Something went wrong. Try again.' });
    }
  };

  useEffect(() => {
    run();
  }, [props.id]);

  if (state.kind === 'loading') return <Loading />;
  if (state.kind === 'analyzing') return <Thinking text={thoughts} retrying={retrying} fallback={fallback} leaving={leaving} />;

  if (state.kind === 'error') {
    const retryable = RETRYABLE.includes(state.code);
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
          {retryable && state.code !== 'connection_lost' && (
            <p class="fineprint">This attempt doesn’t count toward your daily reads.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '340px' }}>
            {retryable && (
              <button class="btn btn-primary" onClick={() => run()}>
                Try again
              </button>
            )}
            <button class={`btn ${retryable ? 'btn-outline' : 'btn-primary'}`} onClick={() => go('/')}>
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
    return (
      <SafetyNotice fromAnalysis continueLabel="See the read" onContinue={() => setSafetyDismissed(true)} onClose={() => go('/')} />
    );

  const toggleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.setSaved(s.id, !s.saved);
      setState({ kind: 'done', situation: updated });
      setToast(updated.saved ? 'Saved. It’s on your dashboard.' : 'Removed from Saved.');
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="screen">
      <header class="topbar" style={{ justifyContent: 'space-between', paddingRight: '20px' }}>
        <button class="icon-btn" aria-label="Close" onClick={() => go('/')}>
          <CloseIcon />
        </button>
        <button class="text-btn" onClick={() => go('/')}>
          Done
        </button>
      </header>
      <main class="main" style={{ paddingTop: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h1 class="h-lg">The read</h1>
          {r.safety_flag && <SafetyBanner />}
          <p class="quote">{s.text}</p>
        </div>
        <section class="reads" aria-labelledby="reads-title">
          <h2 id="reads-title" class="section-label">
            How the pillars see it
          </h2>
          {r.pillars.map((p, i) => (
            <div class={`read${p.applies ? '' : ' na'}`} key={p.pillar} style={{ '--i': i }}>
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
        <p class="fineprint result-fineprint">AI-generated guidance based on your answers. You make the decision.</p>
      </main>
      <footer class="footer result-actions" style={{ position: 'static', background: 'none' }}>
        <button class={`btn ${s.saved ? 'btn-outline' : 'btn-primary'}`} disabled={saving} aria-pressed={s.saved} onClick={toggleSave}>
          {s.saved ? 'Saved ✓' : 'Save'}
        </button>
        <button class={`btn ${s.saved ? 'btn-primary' : 'btn-outline'}`} onClick={() => go('/new')}>
          New situation
        </button>
      </footer>
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}

/** Turns Gemini's thought summaries (light markdown) into headings and paragraphs. */
function renderThoughts(text: string) {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.flatMap((block, i) => {
    const heading = /^\*\*(.+?)\*\*\s*\n?([\s\S]*)$/.exec(block);
    const clean = (t: string) => t.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim();
    if (heading) {
      const rest = clean(heading[2]);
      return [<h3 key={`h${i}`}>{clean(heading[1])}</h3>, ...(rest ? [<p key={`p${i}`}>{rest}</p>] : [])];
    }
    return [<p key={`p${i}`}>{clean(block)}</p>];
  });
}

function Thinking(props: { text: string; retrying: boolean; fallback: boolean; leaving: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setWaited(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [props.text, props.fallback]);

  const headline = props.fallback ? 'Switching to a faster model' : props.retrying ? 'Taking another pass' : 'Reading your situation';
  const waitingNote = props.fallback
    ? 'The main model was too slow to start, so a lighter one is writing your read. It doesn’t share its working notes.'
    : waited >= 10
      ? 'Still waiting for Gemini to start. It can be slow when Google’s free tier is busy.'
      : 'Getting started…';

  return (
    <div class={`screen${props.leaving ? ' fading-out' : ''}`}>
      <header class="topbar" style={{ justifyContent: 'flex-end', paddingRight: '12px' }}>
        <button class="icon-btn" aria-label="Close (the read keeps going and will be on your dashboard)" onClick={() => go('/')}>
          <CloseIcon />
        </button>
      </header>
      <div class="thinking-head">
        <div class="thinking-mark" aria-hidden="true">
          <PillarsMark />
        </div>
        <h1 class="h-md">
          {headline}
          <span class="dots" aria-hidden="true" />
        </h1>
        <p class="lede">Weighing it against each of the four pillars.</p>
      </div>
      <section class="thinking-panel" aria-live="polite" aria-label="How the AI is thinking">
        <span class="eyebrow">How the AI is thinking</span>
        <div class="thought-stream" ref={box}>
          {props.text && renderThoughts(props.text)}
          {(!props.text || props.fallback) && <p class="thought-wait">{waitingNote}</p>}
        </div>
        <p class="fineprint">These are the model’s working notes, not the final read. You can close this screen; the read will be on your dashboard.</p>
      </section>
      <div style={{ height: '24px' }} />
    </div>
  );
}
