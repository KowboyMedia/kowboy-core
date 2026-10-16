// The top bar (design B, images 05, 19, 44 and 45): the mark, the Inbox with its count, Brokerages
// and "New brokerage" on a desktop, the Inbox icon on a phone, and the account menu. Brokerages and
// "New brokerage" lead to screens of a later part and do nothing yet.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, type Me } from './api';
import { Brand } from './brand';
import { dateOf } from './time';
import { BuildingIcon, ChevronDownIcon, InboxIcon, LogoutIcon, PlusIcon } from './icons';

function AccountMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  const signOut = async () => {
    setFailed(false);
    try {
      await api.signOut();
      navigate('/sign-in', { state: { signedOut: true } });
    } catch {
      setFailed(true);
    }
  };

  return (
    <div ref={holder} style={{ position: 'relative' }}>
      <button
        type="button"
        className="k-account"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => setOpen(!open)}
      >
        <span className="k-avatar">{me.email.charAt(0).toUpperCase()}</span>
        <ChevronDownIcon className="k-chevron" size={16} />
      </button>
      {open && (
        <div className="k-menu" role="menu">
          <div className="k-menu-head">
            <div className="k-menu-caption">Signed in as</div>
            <div className="k-menu-email">{me.email}</div>
            <div className="k-menu-until">Signed in on this device until {dateOf(me.until)}</div>
          </div>
          <button
            type="button"
            role="menuitem"
            className="k-menu-item"
            onClick={() => void signOut()}
          >
            <LogoutIcon />
            Sign out of this device
          </button>
          {failed && (
            <p className="k-error" style={{ margin: '0 12px 12px' }}>
              Core didn’t answer. Try again in a moment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar({ me, count }: { me: Me; count: number }) {
  return (
    <header className="k-top">
      <div className="k-top-inner">
        <Brand instance={me.instance} />
        <nav className="k-tabs" aria-label="Pages">
          <a className="k-tab k-tab-active" href="/admin/" aria-current="page">
            <InboxIcon />
            Inbox
            {count > 0 && <span className="k-count">{count}</span>}
          </a>
          <span className="k-tab" aria-disabled="true">
            <BuildingIcon />
            Brokerages
          </span>
        </nav>
        <div className="k-top-end">
          <a className="k-phone-inbox" href="/admin/" aria-label={`Inbox, ${String(count)}`}>
            <InboxIcon size={24} strokeWidth={1.75} />
            {count > 0 && <span className="k-bubble">{count}</span>}
          </a>
          <button type="button" className="k-button k-button-primary k-new" aria-disabled="true">
            <PlusIcon />
            New brokerage
          </button>
          <AccountMenu me={me} />
        </div>
      </div>
    </header>
  );
}
