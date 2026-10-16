// The pieces design B repeats: a window, a message in the corner, a field that hides a secret with
// Show and Copy, a switch, a status badge and a "…" menu.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleCheckIcon,
  CopyIcon,
  DotsIcon,
  EyeIcon,
  EyeOffIcon,
  PowerIcon,
  XIcon,
} from './icons';

// ---- Messages in the corner -------------------------------------------------------------------------

export type Note = { text: ReactNode; icon?: 'done' | 'warn' | 'off' };

const Notes = createContext<(note: Note) => void>(() => undefined);

/** Say something in the corner for a few seconds: a change was made, or what it means. */
export const useNote = (): ((note: Note) => void) => useContext(Notes);

const NOTE_MS = 8_000;

export function NoteProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<(Note & { id: number })[]>([]);
  const next = useRef(0);
  const show = useCallback((note: Note) => {
    next.current += 1;
    const id = next.current;
    setNotes((shown) => [...shown.slice(-2), { ...note, id }]);
    setTimeout(() => setNotes((shown) => shown.filter((one) => one.id !== id)), NOTE_MS);
  }, []);
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
  /** A red edge for a window that removes or stops something, orange for one that asks for work. */
  tone?: 'danger' | 'warn';
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

// ---- A switch, a badge, a menu ---------------------------------------------------------------------

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

export type MenuItem = {
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  /** Its window belongs to a later part: shown as B draws it, and does nothing yet. */
  later?: boolean;
  /** A line above it. */
  apart?: boolean;
};

export function DotsMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div ref={holder} className="k-dots-holder">
      <button
        type="button"
        className="k-button k-button-quiet k-button-small k-dots"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen(!open)}
      >
        <DotsIcon size={16} />
      </button>
      {open && (
        <div className="k-menu k-menu-actions" role="menu">
          {items.map((item) => (
            <div key={item.label}>
              {item.apart && <div className="k-menu-line" />}
              <button
                type="button"
                role="menuitem"
                className={`k-menu-item${item.danger ? ' k-menu-danger' : ''}`}
                aria-disabled={item.later ? 'true' : undefined}
                onClick={() => {
                  if (item.later) return;
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The words of an error from Core, for a person: what went wrong and what to do. */
export const UNANSWERED = 'Core didn’t answer. Try again in a moment.';
