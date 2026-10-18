// What went wrong when the panel asked Core for something, in words for a person: what failed,
// whose fault it is and what to do (Patric, 2026-10-18). Core words what failed inside it (the
// engine's engine/panel/failure.ts); the panel words the rest from Core's answer code.
import { Refused } from './api';

/** Core's answer never came: this device is offline, or Core is restarting. */
const UNANSWERED =
  'Core didn’t answer. Check that this device is online. If it is, Core may be restarting after an update, which takes a minute or two; if this lasts, pass it on to Core’s developers.';

/** What the page showed is no longer in Core. */
export const GONE =
  'Core no longer has this: it was removed or changed meanwhile. Reload the page to see what is there now.';

/** What went wrong, from what Core answered, or from its answer not coming. */
export function failureWords(error: unknown): string {
  if (!(error instanceof Refused)) return UNANSWERED;
  if (error.said) return error.said;
  const code = String(error.status);
  if (error.status === 404) return GONE;
  if (error.status === 500) {
    return 'Core failed with an error of its own and could not say which. This is a fault in Core, not in a CRM or a login: try again in a minute, and if it fails again, pass it on to Core’s developers.';
  }
  if (error.status >= 502 && error.status <= 504) {
    return `Core isn’t answering right now (answer code ${code}), most often because it is restarting after an update. Try again in a minute or two; if this lasts, pass it on to Core’s developers.`;
  }
  const reason = error.reason ? ` and the reason “${error.reason}”` : '';
  return `Core refused this, with answer code ${code}${reason}. This is a fault in Core’s admin panel, not in a CRM or a login, so pass it on to Core’s developers.`;
}
