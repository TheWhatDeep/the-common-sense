import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { AlertIcon, CloseIcon } from './icons';

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

/**
 * Emergency information. Shown before Pillar 2 when physical violence is
 * reported, and before the result when the AI flags danger. It never traps
 * the user: the X closes it, and moving on is the main button. Calling is
 * offered, never forced.
 */
export function SafetyNotice(props: {
  continueLabel: string;
  onContinue: () => void;
  onClose: () => void;
  fromAnalysis?: boolean;
}) {
  return (
    <div class="screen">
      <header class="topbar" style={{ justifyContent: 'flex-end', paddingRight: '12px' }}>
        <button class="icon-btn" aria-label="Close" onClick={props.onClose}>
          <CloseIcon />
        </button>
      </header>
      <main class="main" style={{ paddingTop: '8px' }}>
        <div class="safety-icon">
          <AlertIcon />
        </div>
        <h1 class="h-md">Your safety comes first</h1>
        <p class="lede">
          {props.fromAnalysis
            ? 'What you described sounds like someone’s safety may be at risk.'
            : 'You said someone is being physically hurt.'}
        </p>
        <div class="card safety-card">
          <p>
            <b>If anyone is in danger right now, call emergency services.</b> In the Philippines, dial{' '}
            <a href="tel:911">
              <b>911</b>
            </a>
            . Elsewhere, call your local emergency number.
          </p>
          <p>Getting yourself and any children to a safe place is always lawful, and it is always the right first move.</p>
          <p>Once everyone is safe, a lawyer, a social worker or the police can help with what comes next.</p>
        </div>
        <p class="fineprint" style={{ textAlign: 'left' }}>
          If you’re safe right now, you can carry on.
        </p>
      </main>
      <footer class="footer safety-footer">
        <button class="btn btn-primary" onClick={props.onContinue}>
          {props.continueLabel}
        </button>
        <a class="btn btn-outline" href="tel:911" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          Call 911
        </a>
      </footer>
    </div>
  );
}

/** Shown at the top of a read the AI flagged for safety, after the notice. */
export function SafetyBanner() {
  return (
    <div class="safety-banner" role="note">
      <AlertIcon />
      <span>
        This read flagged a possible safety risk. If anyone is in danger, call <a href="tel:911">911</a> or your local emergency
        number.
      </span>
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
