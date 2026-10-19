// Every page for a signed-in device: the top bar with the Inbox's count and the maintenance marker,
// the page, and the messages in the corner. A device that is signed out goes to the sign-in page.
// A page that sends the person to another one can leave a message for it to say in the corner.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api, signedOut, type Me } from './api';
import { failureWords } from './failure';
import { TopBar, type Tab } from './TopBar';
import { NoteProvider, useNote } from './ui';

const EVERY_MS = 30_000;
/** How soon the shell asks again who is signed in, when Core did not say. */
const AGAIN_MS = 10_000;

type ShellParts = {
  /** The Inbox page knows its own count and says it here, so the bar never waits for it. */
  setCount: (count: number) => void;
  /** A page that reads whether maintenance is on says it here, for the Flow tab's marker. */
  setMaintenance: (on: boolean) => void;
  /** Send this device to the sign-in page when Core says it is signed out; true if it did. */
  away: (error: unknown) => boolean;
  /** Who is signed in on this device. */
  me: Me | null;
};

const Parts = createContext<ShellParts>({
  setCount: () => undefined,
  setMaintenance: () => undefined,
  away: () => false,
  me: null,
});

export const useShell = (): ShellParts => useContext(Parts);

/**
 * What a page says on arrival, left by the page that sent the person there: a note, and a warning
 * that stays until it is closed.
 */
export type Arrival = { note?: string; warning?: string };

/** Says the message the last page left, once, and forgets it so a reload does not say it again. */
function ArrivalNote() {
  const location = useLocation();
  const navigate = useNavigate();
  const note = useNote();
  const left = (location.state as Arrival | null)?.note;
  const warning = (location.state as Arrival | null)?.warning;
  useEffect(() => {
    if (!left && !warning) return;
    if (left) note({ text: left });
    if (warning) note({ text: warning, icon: 'warn' });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [left, warning, note, navigate, location.pathname, location.search]);
  return null;
}

export function Shell({
  tab,
  ownCount = false,
  children,
}: {
  tab: Tab;
  /** The page reads the Inbox itself and gives the count. */
  ownCount?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  /** What went wrong when Core did not say who is signed in; asked again until it does. */
  const [failed, setFailed] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [maintenance, setMaintenance] = useState(false);

  const away = useCallback(
    (error: unknown) => {
      if (!signedOut(error)) return false;
      navigate('/sign-in', { replace: true });
      return true;
    },
    [navigate],
  );

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = () => {
      api.me().then(
        (who) => {
          if (stopped) return;
          setMe(who);
          setFailed(null);
        },
        (error: unknown) => {
          if (stopped || away(error)) return;
          setFailed(failureWords(error));
          timer = setTimeout(ask, AGAIN_MS);
        },
      );
    };
    ask();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [away]);

  useEffect(() => {
    if (ownCount) return;
    const read = () => {
      api.inbox().then((inbox) => {
        setCount(inbox.cards.length);
        setMaintenance(inbox.maintenance.on);
      }, away);
    };
    read();
    const timer = setInterval(read, EVERY_MS);
    return () => clearInterval(timer);
  }, [away, ownCount]);

  if (!me) {
    return failed ? (
      <main className="k-page">
        <p className="k-quiet" role="status">
          {failed} The page tries again by itself.
        </p>
      </main>
    ) : null;
  }
  return (
    <Parts.Provider value={{ setCount, setMaintenance, away, me }}>
      <NoteProvider>
        <TopBar me={me} count={count} maintenance={maintenance} tab={tab} />
        <ArrivalNote />
        {children}
      </NoteProvider>
    </Parts.Provider>
  );
}
