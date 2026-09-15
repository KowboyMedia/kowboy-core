import { loadConfig } from '../config.js';
import { closeDb, db } from './db.js';
import { migrate } from './migrate.js';

const config = loadConfig();
db(config.databaseUrl);
const ran = await migrate();
console.log(
  ran.length === 0 ? 'migrations: nothing to apply' : `migrations applied: ${ran.join(', ')}`,
);
await closeDb();
