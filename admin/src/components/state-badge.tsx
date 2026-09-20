import { CheckIcon, CircleAlertIcon, ClockIcon, LoaderIcon, MinusIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { JobState } from '@/api/types';

/** Yes or no, as a badge with a mark, never colour alone. */
export function YesNo({
  value,
  yes = 'yes',
  no = 'no',
}: {
  value: boolean;
  yes?: string;
  no?: string;
}) {
  return value ? (
    <Badge variant="ok">
      <CheckIcon /> {yes}
    </Badge>
  ) : (
    <Badge variant="muted">
      <MinusIcon /> {no}
    </Badge>
  );
}

export function OkBad({ ok, detail }: { ok: boolean; detail?: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {ok ? (
        <Badge variant="ok">
          <CheckIcon /> ok
        </Badge>
      ) : (
        <Badge variant="bad">
          <XIcon /> failing
        </Badge>
      )}
      {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
    </span>
  );
}

const JOB: Record<
  JobState,
  { variant: 'ok' | 'bad' | 'warn' | 'info' | 'muted'; icon: typeof CheckIcon }
> = {
  queued: { variant: 'warn', icon: ClockIcon },
  running: { variant: 'info', icon: LoaderIcon },
  done: { variant: 'ok', icon: CheckIcon },
  failed: { variant: 'bad', icon: CircleAlertIcon },
  cancelled: { variant: 'muted', icon: MinusIcon },
};

export function JobBadge({ state }: { state: JobState }) {
  const { variant, icon: Icon } = JOB[state];
  return (
    <Badge variant={variant}>
      <Icon className={state === 'running' ? 'animate-spin' : undefined} /> {state}
    </Badge>
  );
}
