/**
 * Steps 1-5: the situation text, then one screen per pillar.
 * Answers live in this component while you move between steps (so Back keeps
 * them) and are saved to the server on every step change.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { CONFIG } from '../../shared/config';
import {
  BANK_VERSION,
  getBank,
  isAnswered,
  isFreeText,
  needsSafetyNotice,
  pillarComplete,
  PILLAR_NAMES,
  resumeStep,
  visibleQuestions,
  type Answers,
  type Question,
} from '../../shared/questionBank';
import { api, ApiError, type Situation } from '../api';
import { ConfirmDialog, Loading, SafetyNotice } from '../components';
import { BackIcon, CloseIcon, TrashIcon } from '../icons';
import { go, navigate } from '../router';

/** Hands a just-created situation to the next route without refetching it. */
export const situationCache = new Map<string, Situation>();

/** Where to resume a saved draft: the first step that still needs an answer. */
export function resumeStepFor(s: Pick<Situation, 'answers' | 'bankVersion'>): number {
  return resumeStep(s.answers, getBank(s.bankVersion));
}

function Header(props: { step: number; onBack: () => void; onClose: () => void; backIsClose: boolean }) {
  return (
    <header class="stepbar">
      <div class="stepbar-row">
        <button class="icon-btn" aria-label={props.backIsClose ? 'Close' : 'Back'} onClick={props.backIsClose ? props.onClose : props.onBack}>
          {props.backIsClose ? <CloseIcon /> : <BackIcon />}
        </button>
        <div class="stepbar-right">
          <span class="step-label">Step {props.step} of 5</span>
          {!props.backIsClose && (
            <button class="icon-btn" aria-label="Save and close" title="Save and close" onClick={props.onClose} style={{ marginRight: '-12px' }}>
              <CloseIcon />
            </button>
          )}
        </div>
      </div>
      <div class="progress" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span class={n <= props.step ? 'on' : ''} />
        ))}
      </div>
    </header>
  );
}

export function Interview(props: { id?: string; step: string }) {
  const [situation, setSituation] = useState<Situation | null>(() => (props.id ? (situationCache.get(props.id) ?? null) : null));
  const [loadError, setLoadError] = useState('');
  const [text, setText] = useState(situation?.text ?? '');
  const [answers, setAnswers] = useState<Answers>(situation?.answers ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const savedAnswers = useRef(JSON.stringify(situation?.answers ?? {}));

  useEffect(() => {
    if (!props.id || situation) return;
    api
      .getSituation(props.id)
      .then((s) => {
        if (s.status === 'analyzed') return navigate(`/s/${s.id}/read`, { replace: true });
        setSituation(s);
        setText(s.text);
        setAnswers(s.answers);
        savedAnswers.current = JSON.stringify(s.answers);
      })
      .catch((e) => setLoadError(e instanceof ApiError && e.status === 404 ? 'not_found' : 'error'));
  }, [props.id]);

  useEffect(() => {
    setError('');
    window.scrollTo(0, 0);
  }, [props.step]);

  if (loadError)
    return (
      <div class="screen">
        <div class="center">
          <h1 class="h-md">{loadError === 'not_found' ? 'Situation not found' : "Couldn't load this situation"}</h1>
          <button class="btn btn-primary" onClick={() => navigate('/', { replace: true })}>
            Back to home
          </button>
        </div>
      </div>
    );
  if (props.id && !situation) return <Loading />;

  const bank = getBank(situation?.bankVersion ?? 1);

  /** Persist answers if they changed. Returns false (and shows an error) on failure. */
  const persist = async (): Promise<boolean> => {
    if (!situation) return true;
    const snapshot = JSON.stringify(answers);
    if (snapshot === savedAnswers.current) return true;
    try {
      const s = await api.saveAnswers(situation.id, answers);
      savedAnswers.current = snapshot;
      setSituation(s);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Try again.');
      return false;
    }
  };

  const close = async () => {
    setSaving(true);
    try {
      if (!situation && text.trim() && text.length <= CONFIG.situationMaxChars) await api.createSituation(text.trim());
      else if (situation && props.step === '1' && text.trim() && text.trim() !== situation.text && text.length <= CONFIG.situationMaxChars)
        await api.updateText(situation.id, text.trim());
      else await persist();
    } catch {
      /* closing never blocks */
    }
    go('/');
  };

  // ---------- safety notice between Pillar 1 and Pillar 2 ----------
  if (props.step === 'safety' && situation)
    return (
      <SafetyNotice
        continueLabel="Continue to Pillar 2"
        onContinue={() => go(`/s/${situation.id}/3`)}
        onClose={() => go('/')} // answers were saved before this screen; the situation stays a draft
      />
    );

  // ---------- step 1: the situation ----------
  if (props.step === '1') {
    const trimmed = text.trim();
    const over = text.length > CONFIG.situationMaxChars;
    const canContinue = trimmed.length > 0 && !over && !saving;
    // Free-text situations (the current flow) go straight to the read; old ones continue to the pillar questions.
    const freeText = isFreeText(situation?.bankVersion ?? BANK_VERSION);
    const after = (id: string) => (freeText ? `/s/${id}/read` : `/s/${id}/2`);
    const next = async () => {
      setSaving(true);
      setError('');
      try {
        let s = situation;
        if (!s) {
          s = await api.createSituation(trimmed);
          situationCache.set(s.id, s);
          go(after(s.id), { replace: true });
          return;
        }
        if (trimmed !== s.text) {
          s = await api.updateText(s.id, trimmed);
          setSituation(s);
        }
        go(after(s.id));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not save. Try again.');
      } finally {
        setSaving(false);
      }
    };
    return (
      <div class="screen" key="step-1">
        {freeText ? (
          <header class="topbar" style={{ justifyContent: 'space-between', paddingRight: '12px' }}>
            <button class="icon-btn" aria-label="Close" onClick={close}>
              <CloseIcon />
            </button>
            {situation && (
              <button class="icon-btn" aria-label="Delete this situation" onClick={() => setConfirmDelete(true)}>
                <TrashIcon />
              </button>
            )}
          </header>
        ) : (
          <Header step={1} backIsClose onBack={close} onClose={close} />
        )}
        <main class="main" style={{ gap: '20px', paddingTop: freeText ? '12px' : '28px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label for="situation" class="h-md">
              What’s the situation?
            </label>
            <p class="lede">
              {freeText
                ? 'Describe it in your own words: what happened, who’s involved, and what you’re being asked to do or deciding. Mention any children, laws or rules involved.'
                : 'Describe it in your own words. The more specific, the better the read.'}
            </p>
          </div>
          <textarea
            id="situation"
            class={`situation-input${over ? ' over' : ''}`}
            value={text}
            placeholder="A coworker invited me to her wedding…"
            aria-describedby="situation-count"
            aria-invalid={over}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          />
          <span id="situation-count" class={`counter${over ? ' over' : ''}`}>
            {over ? `${text.length - CONFIG.situationMaxChars} over the limit · ` : ''}
            {text.length} / {CONFIG.situationMaxChars}
          </span>
          {error && <div class="error-box" role="alert">{error}</div>}
        </main>
        <footer class="footer">
          <button class="btn btn-primary" disabled={!canContinue} onClick={next}>
            {saving ? 'Saving…' : freeText ? 'Get the read' : 'Continue'}
          </button>
        </footer>
        {confirmDelete && situation && (
          <ConfirmDialog
            title="Delete this situation?"
            body="Your description is deleted for good. This can’t be undone."
            confirmLabel="Delete"
            busy={saving}
            onConfirm={async () => {
              setSaving(true);
              try {
                await api.deleteSituation(situation.id);
                situationCache.delete(situation.id);
                go('/');
              } catch (e) {
                setSaving(false);
                setConfirmDelete(false);
                setError(e instanceof ApiError ? e.message : 'Could not delete. Try again.');
              }
            }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </div>
    );
  }

  // ---------- steps 2-5: one pillar each ----------
  const step = Number(props.step);
  if (!situation || !(step >= 2 && step <= 5)) {
    navigate('/', { replace: true });
    return null;
  }
  const pillar = step - 1;
  const questions = visibleQuestions(answers, bank).filter((q) => q.pillar === pillar);
  const complete = pillarComplete(pillar, answers, bank);
  const isLast = pillar === 4;

  const setAnswer = (q: Question, value: string) =>
    setAnswers((prev) => {
      const next = { ...prev, [q.id]: { ...prev[q.id], value } };
      // Re-validate so branches that just closed drop their stale answers.
      const visible = new Set(visibleQuestions(next, bank).map((v) => v.id));
      for (const id of Object.keys(next)) if (!visible.has(id)) delete next[id];
      return next;
    });
  const setNote = (q: Question, note: string) =>
    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], value: prev[q.id]?.value ?? '', note } }));

  const back = async () => {
    await persist();
    go(`/s/${situation.id}/${step - 1}`);
  };

  const next = async () => {
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (!ok) return;
    if (pillar === 1 && needsSafetyNotice(answers, bank)) return go(`/s/${situation.id}/safety`);
    if (isLast) return go(`/s/${situation.id}/read`);
    go(`/s/${situation.id}/${step + 1}`);
  };

  const notesOver = questions.some((q) => (answers[q.id]?.note?.length ?? 0) > CONFIG.noteMaxChars || (q.kind === 'text' && (answers[q.id]?.value.length ?? 0) > CONFIG.noteMaxChars));

  return (
    <div class="screen" key={`step-${step}`}>
      <Header step={step} backIsClose={false} onBack={back} onClose={close} />
      <main class="main">
        <span class="chip">
          Pillar {pillar} · {PILLAR_NAMES[pillar]}
        </span>
        {questions.map((q) =>
          q.showWhen ? (
            <section class="followup" key={q.id}>
              <span class="eyebrow">Follow-up</span>
              <QuestionField q={q} answers={answers} onAnswer={setAnswer} onNote={setNote} small />
            </section>
          ) : (
            <QuestionField key={q.id} q={q} answers={answers} onAnswer={setAnswer} onNote={setNote} />
          ),
        )}
        {error && <div class="error-box" role="alert">{error}</div>}
      </main>
      <footer class="footer">
        <button class="btn btn-primary" disabled={!complete || saving || notesOver} onClick={next}>
          {saving ? 'Saving…' : isLast ? 'Get the read' : `Next: ${PILLAR_NAMES[pillar + 1]}`}
        </button>
      </footer>
    </div>
  );
}

function QuestionField(props: {
  q: Question;
  answers: Answers;
  onAnswer: (q: Question, value: string) => void;
  onNote: (q: Question, note: string) => void;
  small?: boolean;
}) {
  const { q } = props;
  const answer = props.answers[q.id];
  const [noteOpen, setNoteOpen] = useState(!!answer?.note);
  const legendClass = props.small ? '' : 'h-q';

  if (q.kind === 'text') {
    const value = answer?.value ?? '';
    return (
      <fieldset>
        <legend class={legendClass}>
          <label for={`q-${q.id}`}>{q.text}</label>
        </legend>
        {q.help && <p class="help">{q.help}</p>}
        <textarea
          id={`q-${q.id}`}
          class="text-answer"
          value={value}
          onInput={(e) => props.onAnswer(q, (e.target as HTMLTextAreaElement).value)}
        />
        <div class="note-meta">
          <span>{q.required ? '' : 'Optional'}</span>
          <span class={value.length > CONFIG.noteMaxChars ? 'over' : ''}>
            {value.length} / {CONFIG.noteMaxChars}
          </span>
        </div>
      </fieldset>
    );
  }

  const note = answer?.note ?? '';
  return (
    <fieldset>
      <legend class={legendClass}>{q.text}</legend>
      {q.help && <p class="help">{q.help}</p>}
      {q.options!.map((o) => {
        const selected = answer?.value === o.value;
        return (
          <label class={`option${selected ? ' selected' : ''}`} key={o.value}>
            <input type="radio" name={q.id} value={o.value} checked={selected} onChange={() => props.onAnswer(q, o.value)} />
            {o.label}
          </label>
        );
      })}
      {noteOpen ? (
        <>
          <textarea
            class="note-box"
            aria-label={`Note for: ${q.text}`}
            placeholder="Add a note (optional)"
            value={note}
            onInput={(e) => props.onNote(q, (e.target as HTMLTextAreaElement).value)}
          />
          <div class="note-meta">
            <span>Optional note</span>
            <span class={note.length > CONFIG.noteMaxChars ? 'over' : ''}>
              {note.length} / {CONFIG.noteMaxChars}
            </span>
          </div>
        </>
      ) : (
        isAnswered(q, answer) && (
          <button class="link-btn" type="button" onClick={() => setNoteOpen(true)}>
            + Add a note
          </button>
        )
      )}
    </fieldset>
  );
}
