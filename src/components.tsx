import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { AlertIcon } from './icons';

export function ConfirmDialog(props: {
  title: string;
  body: ComponentChildren;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onCancel]);
  return (
    <div class="dialog-wrap" onClick={(e) => e.target === e.currentTarget && props.onCancel()}>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title" class="h-q">{props.title}</h2>
        <p>{props.body}</p>
        <button class="btn btn-danger" disabled={props.busy} onClick={props.onConfirm}>
          {props.busy ? 'Deleting…' : props.confirmLabel}
        </button>
        <button class="btn btn-ghost" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Toast(props: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(props.onDone, 2600);
    return () => clearTimeout(t);
  }, [props.message]);
  return (
    <div class="toast" role="status">
      {props.message}
    </div>
  );
}

/** Emergency information. Shown before Pillar 2 when physical violence is reported, and instead of a result when the AI flags danger. */
export function SafetyNotice(props: { continueLabel: string; onContinue: () => void; fromAnalysis?: boolean }) {
  return (
    <div class="screen">
      <main class="main" style={{ paddingTop: '48px' }}>
        <div class="safety-icon">
          <AlertIcon />
        </div>
        <h1 class="h-md">Your safety comes first</h1>
        <p class="lede">
          {props.fromAnalysis
            ? 'What you described sounds like someone’s safety may be at risk. Before anything else:'
            : 'You said someone is being physically hurt. Before anything else:'}
        </p>
        <div class="card safety-card">
          <p>
            <b>If anyone is in danger right now, call emergency services.</b> In the Philippines, dial <b>911</b>. Elsewhere, call
            your local emergency number.
          </p>
          <p>Getting yourself and any children to a safe place is always lawful, and it is always the right first move.</p>
          <p>Once everyone is safe, a lawyer, a social worker or the police can help with what comes next.</p>
        </div>
      </main>
      <footer class="footer">
        <a class="btn btn-primary" href="tel:911">
          Call 911
        </a>
        <button class="btn btn-outline" onClick={props.onContinue}>
          {props.continueLabel}
        </button>
      </footer>
    </div>
  );
}

export function Loading(props: { label?: string }) {
  return (
    <div class="screen">
      <div class="center" aria-live="polite">
        <div class="spinner" />
        {props.label && <p class="lede">{props.label}</p>}
      </div>
    </div>
  );
}

export function initials(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0];
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
