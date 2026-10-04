/// <reference types="vite/client" />

/** Cloudflare Turnstile's script, loaded only when the site's config names it (question 138). */
interface Window {
  turnstile?: {
    render(
      container: HTMLElement,
      options: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
        appearance?: 'always' | 'execute' | 'interaction-only';
        size?: 'normal' | 'flexible' | 'compact';
      },
    ): string;
    reset(widgetId: string): void;
  };
}
