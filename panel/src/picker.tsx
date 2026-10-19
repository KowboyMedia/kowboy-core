// A list to pick several from, as the filters of the Flow and of Records draw it (B2, images 02 to
// 05): the picked ones as chips in the box, every one in a menu with a tick, and on Records how
// many records each would keep and a line under the menu.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, ChevronDownIcon, XIcon } from './icons';

export type Option = {
  key: string;
  name: string;
  /** How many records it would keep, with the other filters as they are. */
  count?: number;
  /** A second word beside the name, such as an office's tenant. */
  detail?: string;
};

export function Picker({
  id,
  label,
  all,
  options,
  chosen,
  onChange,
  note,
  boxes = false,
}: {
  id: string;
  label: string;
  /** What an empty filter reads as: "All tenants". */
  all: string;
  options: Option[];
  chosen: string[];
  onChange: (chosen: string[]) => void;
  /** A line under the menu's options. */
  note?: ReactNode;
  /** Each option with a box to tick, as Records draws it; the Flow draws a tick alone. */
  boxes?: boolean;
}) {
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
  const picked = options.filter((option) => chosen.includes(option.key));
  const toggle = (key: string) =>
    onChange(chosen.includes(key) ? chosen.filter((one) => one !== key) : [...chosen, key]);
  return (
    <div className="k-field k-field-first" ref={holder}>
      <span className="k-label" id={`${id}-label`}>
        {label}
      </span>
      <div className="k-picker">
        <button
          type="button"
          className={`k-picker-box${open ? ' k-picker-open' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-label`}
          onClick={() => setOpen(!open)}
        >
          {picked.length === 0 && <span className="k-picker-all">{all}</span>}
          <ChevronDownIcon className="k-picker-chevron" size={16} />
        </button>
        {picked.length > 0 && (
          <span className="k-picker-chips">
            {picked.map((option) => (
              <span key={option.key} className="k-chip">
                {option.name}
                <button
                  type="button"
                  aria-label={`Remove ${option.name}`}
                  onClick={() => toggle(option.key)}
                >
                  <XIcon size={12} />
                </button>
              </span>
            ))}
          </span>
        )}
        {open && (
          <div className="k-menu k-picker-menu">
            <ul role="listbox" aria-multiselectable="true" aria-labelledby={`${id}-label`}>
              {options.map((option) => {
                const on = chosen.includes(option.key);
                return (
                  <li key={option.key} role="option" aria-selected={on}>
                    <button
                      type="button"
                      className="k-menu-item"
                      onClick={() => toggle(option.key)}
                    >
                      {boxes ? (
                        <span className={`k-tickbox${on ? ' k-tickbox-on' : ''}`}>
                          {on && <CheckIcon size={12} strokeWidth={3} />}
                        </span>
                      ) : (
                        <span className="k-picker-tick">{on && <CheckIcon size={14} />}</span>
                      )}
                      <span className="k-picker-name">
                        {option.name}
                        {option.detail && (
                          <span className="k-picker-detail"> · {option.detail}</span>
                        )}
                      </span>
                      {option.count !== undefined && (
                        <span className="k-picker-count">{option.count}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {note && <p className="k-picker-note">{note}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
