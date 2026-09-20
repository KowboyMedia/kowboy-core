// A JSON viewer: a collapsible tree, read-only, with a copy of the whole document. Long lists
// and objects fold; a value is coloured by its type, never edited.
import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';
import { cn } from '@/lib/utils';

type Json = unknown;

const isObject = (value: Json): value is Record<string, Json> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function Leaf({ value }: { value: Json }) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === 'string') return <span className="text-ok break-all">"{value}"</span>;
  if (typeof value === 'number') return <span className="text-series-4">{String(value)}</span>;
  if (typeof value === 'boolean') return <span className="text-series-2">{String(value)}</span>;
  return <span>{String(value)}</span>;
}

function Node({
  name,
  value,
  depth,
  openDepth,
}: {
  name: string | null;
  value: Json;
  depth: number;
  openDepth: number;
}) {
  const [open, setOpen] = useState(depth < openDepth);
  const children = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : isObject(value)
      ? Object.entries(value)
      : null;
  const label = name === null ? null : <span className="text-foreground/80">{name}: </span>;
  if (!children) {
    return (
      <div className="pl-4 leading-6">
        {label}
        <Leaf value={value} />
      </div>
    );
  }
  const brackets = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return (
    <div className={cn(depth > 0 && 'pl-4')}>
      <button
        type="button"
        className="inline-flex items-center gap-1 leading-6 hover:text-primary"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDownIcon className="size-3.5" />
        ) : (
          <ChevronRightIcon className="size-3.5" />
        )}
        {label}
        <span className="text-muted-foreground">
          {brackets[0]}
          {!open && ` ${children.length} ${Array.isArray(value) ? 'items' : 'keys'} `}
          {!open && brackets[1]}
        </span>
      </button>
      {open && (
        <div className="border-l border-border/60 ml-1.5">
          {children.map(([key, child]) => (
            <Node key={key} name={key} value={child} depth={depth + 1} openDepth={openDepth} />
          ))}
          <div className="pl-4 leading-6 text-muted-foreground">{brackets[1]}</div>
        </div>
      )}
    </div>
  );
}

export function JsonView({
  value,
  openDepth = 2,
  title,
}: {
  value: Json;
  openDepth?: number;
  title?: string;
}) {
  const text = JSON.stringify(value, null, 2) ?? 'null';
  return (
    <div className="rounded-md border bg-muted/30" data-json={title}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span>
          {title ?? 'JSON'} · {text.length.toLocaleString('sv-SE')} characters
        </span>
        <CopyButton value={text} label="Copy JSON" />
      </div>
      <div className="max-h-[32rem] overflow-auto px-2 py-2 font-mono text-xs">
        {value === undefined ? (
          <span className="text-muted-foreground">nothing</span>
        ) : (
          <Node name={null} value={value} depth={0} openDepth={openDepth} />
        )}
      </div>
    </div>
  );
}
