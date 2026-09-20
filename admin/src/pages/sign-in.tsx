// Getting in: type the address, open the link that arrives (§3 H, Must). There is no password to
// share and nothing to phish out of anyone.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { requestSignIn, type SignInOutcome } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';

export function SignIn() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<SignInOutcome | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const send = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setFailed(null);
    try {
      setOutcome(await requestSignIn(email));
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kowboy Core</CardTitle>
          <CardDescription>
            The admin area. Type the address you work with and open the link that arrives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {params.get('again') && (
            <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 p-2 text-sm">
              That link had been used already, or it was too old. Ask for a new one.
            </p>
          )}
          <form onSubmit={(event) => void send(event)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="email">Your address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@kowboy.se"
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send me a link'}
            </Button>
          </form>
          {failed && <p className="mt-3 text-sm text-danger">{failed}</p>}
          {outcome && (
            <div className="mt-3 rounded-md border bg-muted p-3 text-sm">
              <p>{outcome.detail}</p>
              {outcome.link && (
                // Only where Core cannot send mail, which is a machine running it locally.
                <p className="mt-2 break-all">
                  <a className="underline" href={outcome.link} data-testid="sign-in-link">
                    {outcome.link}
                  </a>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
