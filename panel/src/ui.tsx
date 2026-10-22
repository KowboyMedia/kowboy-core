// The pieces design B repeats: a window, a message in the corner, a field that hides a secret with
// Show and Copy, a switch, a status badge and an icon button with its hint.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleCheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderIcon,
  PowerIcon,
  XIcon,
} from './icons';

// ---- Messages in the corner -------------------------------------------------------------------------

export type Note = {
  text: ReactNode;
  icon?: 'done' | 'warn' | 'off';
  /**
   * The note stays until it is closed, so its words can be read and passed on: every warning does,
   * unless it says otherwise.
   */
  stays?: boolean;
};

const staying = (note: Note): boolean => note.stays ?? note.icon === 'warn';

const Notes = createContext<(note: Note) => void>(() => undefined);

/** Say something in the corner for a few seconds: a change was made, or what it means. */
export const useNote = (): ((note: Note) => void) => useContext(Notes);

const NOTE_MS = 8_000;
/** The most notes the corner shows; past that, the oldest one that goes by itself goes first. */
const MOST_NOTES = 3;

export function NoteProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<(Note & { id: number })[]>([]);
  const next = useRef(0);
  const close = useCallback(
    (id: number) => setNotes((shown) => shown.filter((one) => one.id !== id)),
    [],
  );
  const show = useCallback(
    (note: Note) => {
      next.current += 1;
      const id = next.current;
      setNotes((shown) => {
        const kept = [...shown];
        while (kept.length >= MOST_NOTES) {
          const passing = kept.findIndex((one) => !staying(one));
          kept.splice(Math.max(passing, 0), 1);
        }
        return [...kept, { ...note, id }];
      });
      if (!staying(note)) setTimeout(() => close(id), NOTE_MS);
    },
    [close],
  );
  return (
    <Notes.Provider value={show}>
      {children}
      <div className="k-notes" role="status" aria-live="polite">
        {notes.map((note) => (
          <div key={note.id} className={`k-note k-note-${note.icon ?? 'done'}`}>
            {note.icon === 'warn' ? (
              <AlertTriangleIcon />
            ) : note.icon === 'off' ? (
              <PowerIcon />
            ) : (
              <CircleCheckIcon />
            )}
            <span>{note.text}</span>
            {staying(note) && (
              <button
                type="button"
                className="k-modal-close k-note-close"
                aria-label="Close"
                onClick={() => close(note.id)}
              >
                <XIcon size={18} strokeWidth={1.5} />
              </button>
            )}
          </div>
        ))}
      </div>
    </Notes.Provider>
  );
}

// ---- A window ---------------------------------------------------------------------------------------

export function Modal({
  title,
  tone,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode;
  /**
   * A red edge for a window that removes, stops or repairs something, orange for one that asks for
   * work, blue for one that changes how all of Core runs.
   */
  tone?: 'danger' | 'warn' | 'info';
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  return (
    <div
      className="k-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`k-modal${tone ? ` k-modal-${tone}` : ''}${wide ? ' k-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="k-modal-head">
          <h2>{title}</h2>
          <button type="button" className="k-modal-close" aria-label="Close" onClick={onClose}>
            <XIcon size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="k-modal-body">{children}</div>
        {footer && <div className="k-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Copy, and a field that hides a secret ----------------------------------------------------------

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The last four characters after eight dots: enough to tell two tokens apart, not to use one. */
export const masked = (secret: string): string => `••••••••${secret.slice(-4)}`;

export function CopyButton({
  text,
  primary = false,
  label = 'Copy',
  small = false,
}: {
  text: string;
  primary?: boolean;
  label?: string;
  small?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`k-field-button${primary ? ' k-field-button-primary' : ''}${small ? ' k-button k-button-quiet k-button-small' : ''}`}
      onClick={() => {
        void copy(text).then((done) => {
          if (!done) return;
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <CheckIcon size={small ? 14 : 18} /> : <CopyIcon size={small ? 14 : 18} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/** A value to paste somewhere else: shown in a box, a secret hidden until Show, with Copy. */
export function ValueField({
  value,
  secret = false,
  primaryCopy = false,
  wrap = false,
  shown,
}: {
  value: string;
  secret?: boolean;
  primaryCopy?: boolean;
  wrap?: boolean;
  /** How the value reads while hidden, when not the last four characters. */
  shown?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`k-value${wrap ? ' k-value-wrap' : ''}`}>
      <code>{!secret || visible ? value : (shown ?? masked(value))}</code>
      {secret && (
        <button type="button" className="k-field-button" onClick={() => setVisible(!visible)}>
          {visible ? <EyeOffIcon /> : <EyeIcon />}
          {visible ? 'Hide' : 'Show'}
        </button>
      )}
      <CopyButton text={value} primary={primaryCopy} />
    </div>
  );
}

// ---- A switch, a badge, an icon button ---------------------------------------------------------------------

export function Switch({
  on,
  label,
  onChange,
  disabled = false,
  strong = false,
}: {
  on: boolean;
  label: ReactNode;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  strong?: boolean;
}) {
  return (
    <label className={`k-switch${strong ? ' k-switch-strong' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="k-switch-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export type Tone = 'green' | 'orange' | 'blue' | 'grey' | 'red';

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`k-pill k-pill-${tone}`}>{children}</span>;
}

/**
 * A button that shows only its icon, with its words as a hint on hover and focus (the tenant
 * mockups, image 02): an entity's Edit and Delete. With `to`, it opens that page.
 */
export function IconButton({
  label,
  to,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  const className = `k-icon-button${danger ? ' k-icon-danger' : ''}`;
  if (to !== undefined) {
    return (
      <Link className={className} to={to} aria-label={label} data-hint={label}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      data-hint={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** What a page shows while its answer is on its way: a turning circle and what it waits for. */
export function Loading({ words }: { words: string }) {
  return (
    <p className="k-quiet k-loading" role="status">
      <LoaderIcon className="k-spin" size={16} />
      {words}
    </p>
  );
}
