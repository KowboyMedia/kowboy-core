// Tenant, connection and subscriber setup (SRS §10, Appendix C). Anything involving a secret goes
// through the engine so it is hashed or encrypted the same way the engine reads it back.
//
//   node dist/scripts/tenant.js add-tenant <display name>               prints the tenant's number and token once
//   node dist/scripts/tenant.js add-connection <id> <tenant number> <provider> [credentials] [office,office]
//   node dist/scripts/tenant.js add-subscriber <tenant number> <label> <bell url>   prints the bell secret once
import { loadConfig } from '../engine/config.js';
import { closeDb, db } from '../engine/storage/db.js';
import { migrate } from '../engine/storage/migrate.js';
import { newSecret as secret } from '../engine/storage/crypto.js';
import {
  addSubscriber,
  configureCredentials,
  createTenant,
  upsertConnection,
} from '../engine/storage/connections.js';

const [command, ...args] = process.argv.slice(2);
const config = loadConfig();
db(config.databaseUrl);
await migrate();
configureCredentials(config.credentialsKey);

switch (command) {
  case 'add-tenant': {
    const [displayName] = args;
    if (!displayName) throw new Error('usage: add-tenant <display name>');
    const token = secret();
    const id = await createTenant({ displayName, token });
    console.log(`tenant #${id} ${displayName} created. Token, shown once:\n${token}`);
    break;
  }
  case 'add-connection': {
    const [id, tenant, provider, credentials, offices] = args;
    const tenantId = Number(tenant);
    if (!id || !Number.isInteger(tenantId) || tenantId <= 0 || !provider) {
      throw new Error(
        'usage: add-connection <id> <tenant number> <provider> [credentials] [office,office]',
      );
    }
    await upsertConnection({
      id,
      tenantId,
      provider,
      credentials: credentials ?? null,
      licensedOffices: offices ? offices.split(',') : [],
    });
    console.log(`connection ${id} for tenant #${tenantId} via ${provider} saved`);
    break;
  }
  case 'add-subscriber': {
    const [tenant, label, bellUrl] = args;
    const tenantId = Number(tenant);
    if (!Number.isInteger(tenantId) || tenantId <= 0 || !label || !bellUrl)
      throw new Error('usage: add-subscriber <tenant number> <label> <bell url>');
    const bellSecret = secret();
    const id = await addSubscriber({ tenantId, label, bellUrl, bellSecret });
    console.log(`subscriber ${id} (${label}) added. Bell secret, shown once:\n${bellSecret}`);
    break;
  }
  default:
    console.error('commands: add-tenant, add-connection, add-subscriber');
    process.exit(1);
}
await closeDb();
