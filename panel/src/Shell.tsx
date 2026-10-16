// Every page for a signed-in device: the top bar with the Inbox's count, the page, and the
// messages in the corner. A device that is signed out goes to the sign-in page.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api, signedOut, type Me } from './api';
import { TopBar, type Tab } from './TopBar';
import { NoteProvider } from './ui';

const EVERY_MS = 30_000;

type ShellParts = {
  /** The Inbox page knows its own count and says it here, so the bar never waits for it. */
  setCount: (count: number) => void;
  /** Send this device to the sign-in page when Core says it is signed out; true if it did. */
  away: (error: unknown) => boolean;
};

const Parts = createContext<ShellParts>({ setCount: () => undefined, away: () => false });

export const useShell = (): ShellParts => useContext(Parts);

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
  const [count, setCount] = useState(0);

  const away = useCallback(
    (error: unknown) => {
      if (!signedOut(error)) return false;
      navigate('/sign-in', { replace: true });
      return true;
    },
    [navigate],
  );

  useEffect(() => {
    api.me().then(setMe, away);
  }, [away]);

  useEffect(() => {
    if (ownCount) return;
    const read = () => {
      api.inbox().then((inbox) => setCount(inbox.cards.length), away);
    };
    read();
    const timer = setInterval(read, EVERY_MS);
    return () => clearInterval(timer);
  }, [away, ownCount]);

  if (!me) return null;
  return (
    <Parts.Provider value={{ setCount, away }}>
      <NoteProvider>
        <TopBar me={me} count={count} tab={tab} />
        {children}
      </NoteProvider>
    </Parts.Provider>
  );
}
