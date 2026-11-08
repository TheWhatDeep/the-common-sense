import type { SituationSummary } from './api';
import { formatDate } from './components';
import { go } from './router';

const STATUS_LABEL = { draft: 'Draft', answered: 'Ready for a read', analyzed: 'Read' } as const;

/** Where tapping a situation goes: drafts resume, everything else opens its read. */
export function openSituation(s: SituationSummary) {
  if (s.status === 'draft') go(`/s/${s.id}/${s.step ?? 2}`);
  else go(`/s/${s.id}/read`);
}

export function SituationCard(props: { s: SituationSummary; showBottomLine?: boolean }) {
  const { s } = props;
  return (
    <button class="sit-card" onClick={() => openSituation(s)}>
      <span class="item-text">{s.text}</span>
      {props.showBottomLine && s.bottomLine && <span class="bl">{s.bottomLine}</span>}
      <span class="item-meta">
        {s.saved ? <span class="badge saved">Saved</span> : <span class={`badge ${s.status}`}>{STATUS_LABEL[s.status]}</span>}
        {s.status === 'draft' && s.step && (
          <span class="step-dots" aria-label={`Step ${s.step} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <i class={n < s.step! ? 'on' : ''} />
            ))}
          </span>
        )}
        {formatDate(s.updatedAt)}
      </span>
    </button>
  );
}
