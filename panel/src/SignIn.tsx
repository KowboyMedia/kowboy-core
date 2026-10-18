// Signing in (design B, images 01, 02, 04, 17, 18 and 46): ask for a link by email, check your
// email, and a link that no longer works. The link in the mail opens /admin/link#<token>, which
// this page hands to Core once; the token never reaches a server log or another site.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api, lastRequest, Refused, rememberRequest, type SignInFacts } from './api';
import { Brand } from './brand';
import { CircleCheckIcon, ClockIcon, MailIcon } from './icons';
import { failureWords } from './failure';

/** The settings the page words itself from, or what went wrong when Core didn't give them. */
function useFacts(): { facts: SignInFacts | null; failed: string | null } {
  const [facts, setFacts] = useState<SignInFacts | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    api.signInFacts().then(setFacts, (error: unknown) => setFailed(failureWords(error)));
  }, []);
  return { facts, failed };
}

function Gate({ instance, children }: { instance: string | null; children?: ReactNode }) {
  return (
    <main className="k-gate">
      <div className="k-gate-inner">
        <div className="k-gate-brand">
          <Brand instance={instance} large />
        </div>
        {children}
      </div>
    </main>
  );
}

type FormProps = {
  facts: SignInFacts;
  again?: boolean;
  initial?: { email: string; remember: boolean } | null;
  onSent: (email: string) => void;
};

function SignInForm({ facts, again = false, initial = null, onSent }: FormProps) {
  const [email, setEmail] = useState(initial?.email ?? '');
  const [remember, setRemember] = useState(initial?.remember ?? false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.askForLink(email.trim(), remember);
      rememberRequest(email.trim(), remember);
      onSent(email.trim());
    } catch (failure) {
      setError(
        failure instanceof Refused && failure.status === 400
          ? 'That doesn’t look like an email address.'
          : failureWords(failure),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="k-form" onSubmit={(event) => void submit(event)}>
      <label className="k-label" htmlFor="email">
        Email address
      </label>
      <input
        id="email"
        className="k-input"
        type="email"
        autoComplete="email"
        placeholder="you@kowboy.se"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label className="k-tick">
        <input
          className="form-check-input"
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        <span>
          Keep me signed in on this device for {facts.rememberDays} days (otherwise{' '}
          {facts.sessionDays})
        </span>
      </label>
      <button className="k-button k-button-primary k-submit" type="submit" disabled={sending}>
        <MailIcon />
        {again ? 'Email me a new link' : 'Email me a sign-in link'}
      </button>
      {error && (
        <p className="k-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function CheckEmail({
  email,
  facts,
  onAnother,
}: {
  email: string;
  facts: SignInFacts;
  onAnother: () => void;
}) {
  return (
    <section className="k-panel k-panel-centered">
      <div className="k-panel-icon">
        <MailIcon size={60} strokeWidth={1.2} />
      </div>
      <h1>Check your email</h1>
      <p className="k-panel-text">
        If <strong>{email}</strong> may sign in, a link is on its way.
      </p>
      <p className="k-panel-text">
        It works once, within {facts.linkMinutes} minutes, and signs in the device you open it on.
      </p>
      <button type="button" className="k-textlink" onClick={onAnother}>
        Use another address
      </button>
    </section>
  );
}

/** `/admin/sign-in`: ask for a link; after signing out, say so. */
export function SignInPage() {
  const { facts, failed } = useFacts();
  const location = useLocation();
  const navigate = useNavigate();
  const signedOut = (location.state as { signedOut?: boolean } | null)?.signedOut === true;
  const [sent, setSent] = useState<string | null>(null);

  // A device that is still signed in goes straight to the Inbox.
  useEffect(() => {
    api.me().then(
      () => navigate('/', { replace: true }),
      () => undefined,
    );
  }, [navigate]);

  if (!facts) {
    return <Gate instance={null}>{failed && <p className="k-under k-error">{failed}</p>}</Gate>;
  }
  if (sent) {
    return (
      <Gate instance={facts.instance}>
        <CheckEmail email={sent} facts={facts} onAnother={() => setSent(null)} />
      </Gate>
    );
  }
  return (
    <Gate instance={facts.instance}>
      {signedOut && (
        <div className="k-notice" role="status">
          <CircleCheckIcon />
          You’re signed out.
        </div>
      )}
      <section className="k-panel">
        <h1>Sign in</h1>
        <SignInForm facts={facts} onSent={setSent} />
      </section>
      <p className="k-under">No password: you get a link by email.</p>
    </Gate>
  );
}

/**
 * `/admin/link#<token>`: the link from the mail. The token is handed to Core once, then taken out
 * of the address; a link that is spent or too old shows "This link no longer works", with the
 * address and the tick this browser last asked with.
 */
export function LinkPage() {
  const { facts, failed } = useFacts();
  const navigate = useNavigate();
  const [state, setState] = useState<'opening' | 'dead' | 'unreachable'>('opening');
  /** What went wrong when Core didn't open the link. */
  const [failure, setFailure] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const opened = useRef(false);

  useEffect(() => {
    // A link opened in a tab that already shows this page arrives as a new #, not a new page.
    const take = (first: boolean) => {
      const token = window.location.hash.slice(1);
      if (!first && !token) return;
      window.history.replaceState(null, '', window.location.pathname);
      if (!token) {
        setState('dead');
        return;
      }
      setSent(null);
      setState('opening');
      api.openLink(token).then(
        () => navigate('/', { replace: true }),
        (error: unknown) => {
          if (error instanceof Refused && error.status === 410) {
            setState('dead');
            return;
          }
          setFailure(failureWords(error));
          setState('unreachable');
        },
      );
    };
    const again = () => take(false);
    if (!opened.current) {
      opened.current = true;
      take(true);
    }
    window.addEventListener('hashchange', again);
    return () => window.removeEventListener('hashchange', again);
  }, [navigate]);

  if (state === 'unreachable' || (failed && state === 'dead')) {
    return (
      <Gate instance={facts?.instance ?? null}>
        <p className="k-under k-error">
          {state === 'unreachable' ? `${failure} Then open the link in the mail again.` : failed}
        </p>
      </Gate>
    );
  }
  if (state === 'opening' || !facts) return <Gate instance={facts?.instance ?? null} />;
  if (sent) {
    return (
      <Gate instance={facts.instance}>
        <CheckEmail email={sent} facts={facts} onAnother={() => navigate('/sign-in')} />
      </Gate>
    );
  }
  return (
    <Gate instance={facts.instance}>
      <section className="k-panel">
        <div className="k-panel-icon k-panel-icon-wait">
          <ClockIcon size={60} strokeWidth={1.2} />
        </div>
        <h1>This link no longer works</h1>
        <p className="k-panel-text k-panel-centered">
          Sign-in links work once, within {facts.linkMinutes} minutes. Use the newest sign-in email,
          or get a new link:
        </p>
        <SignInForm facts={facts} again initial={lastRequest()} onSent={setSent} />
      </section>
    </Gate>
  );
}
