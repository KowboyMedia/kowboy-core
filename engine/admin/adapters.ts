// An adapter's own panels, mounted under /admin/<provider>/ and rendered inside the shell. The
// engine hands the request through, with the form of a POST and the provider's connections, and
// shows back whatever HTML comes out; it never inspects it (the seam, AGENTS.md).
import { connectionsForProvider } from '../storage/connections.js';
import type { AdminAdapter, Panel } from './context.js';

export function adapterPanels(adapters: AdminAdapter[]): Panel[] {
  const panels: Panel[] = [];
  for (const { provider, admin } of adapters) {
    if (!admin) continue;
    for (const panel of admin.panels) {
      const suffix = panel.path ? `/${panel.path}` : '';
      const pattern = new RegExp(`^/admin/${provider}${suffix}$`);
      for (const method of ['GET', 'POST'] as const) {
        panels.push({
          method,
          pattern,
          handle: async (ctx) => {
            const result = await panel.handle({
              method: ctx.request.method,
              url: ctx.request.path + (ctx.request.query.size ? `?${ctx.request.query}` : ''),
              headers: ctx.request.headers,
              body: ctx.request.body,
              form: ctx.form,
              csrf: ctx.csrf,
              connections: () => connectionsForProvider(provider),
            });
            if ('redirect' in result) return ctx.redirect(result.redirect);
            return ctx.render(panel.title, result.html);
          },
        });
      }
    }
  }
  return panels;
}

/** The credentials form an adapter declares, for the connection page. */
export function credentialFields(adapters: AdminAdapter[], provider: string) {
  return adapters.find((adapter) => adapter.provider === provider)?.admin?.credentials ?? [];
}

export async function connectionStatus(
  adapters: AdminAdapter[],
  provider: string,
  connectionId: string,
): Promise<string> {
  const admin = adapters.find((adapter) => adapter.provider === provider)?.admin;
  if (!admin?.connectionStatus) return '';
  const connection = (await connectionsForProvider(provider)).find((c) => c.id === connectionId);
  return connection ? admin.connectionStatus(connection) : '';
}
