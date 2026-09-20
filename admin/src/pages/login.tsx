// Log in: an address at an allowed domain gets a link by mail, or, while the mailbox is in
// maintenance, goes straight in. The answer is the same whatever the address, so the allowed
// list stays private.
import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageOf } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Answer = { sent: true; minutes: number } | { user: string; via: string };

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const client = useQueryClient();
  const [email, setEmail] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad: boolean } | null>(
    params.get('stale')
      ? { text: 'That link is no longer valid. Ask for a new one.', bad: true }
      : null,
  );
  const settings = useQuery({
    queryKey: ['login-mode'],
    queryFn: () => api<{ maintenanceLogin: boolean }>('/v1/admin/login-mode'),
    retry: false,
  });
  const maintenance = settings.data?.maintenanceLogin === true;
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const answer = await api<Answer>('/v1/admin/login', { body: { email, remember } });
      if ('user' in answer) {
        await client.invalidateQueries({ queryKey: ['session'] });
        navigate(from, { replace: true });
        return;
      }
      setNotice({
        text: `If that address may log in, a link is on its way. It works for ${answer.minutes} minutes.`,
        bad: false,
      });
    } catch (error) {
      setNotice({ text: messageOf(error), bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Core admin</CardTitle>
          <CardDescription>
            {maintenance
              ? 'Email login is paused for maintenance. Enter your work address; if it may log in, you go straight in.'
              : 'Enter your work address. If it may log in, a link arrives by mail and works for 15 minutes.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Your email address</Label>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={remember}
                onCheckedChange={(value) => setRemember(value === true)}
              />
              Remember this device for 30 days
            </label>
            {notice && (
              <p
                role={notice.bad ? 'alert' : 'status'}
                className={notice.bad ? 'text-sm text-bad' : 'text-sm text-ok'}
              >
                {notice.text}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {maintenance ? 'Log in' : 'Send me a link'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
