// The engine's constants, in a file with no imports, so anything may read them without a cycle.
export const VERSION = '0.1.0';

/**
 * Every start moves the item sequence this far ahead (strategy §7.2). A database restored to an
 * earlier point then never hands out a seq a subscriber has already seen: nothing is skipped, and
 * nothing below a subscriber's cursor is served except what is written after the restore.
 */
export const SEQUENCE_JUMP = 1_000_000_000;

/** Tombstones are hard-deleted after 90 days (AC 26). */
export const TOMBSTONE_RETENTION_DAYS = 90;

/** When this process started serving: what the panel's top bar shows as the running version's age. */
export const STARTED_AT = new Date().toISOString();
