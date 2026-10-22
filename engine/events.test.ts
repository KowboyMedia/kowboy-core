// The write lines from before the log kept no values (question 228) keep only the names of the
// fields they changed, and every other line stays as it was.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, type Harness } from '../acceptance/harness.js';
import { changedNames, logEvent, queryEvents, stripChangeValues } from './events.js';

let running: Harness;

beforeEach(async () => {
  running = await harness({ subscriber: false });
});

afterEach(async () => {
  await running.stop();
});

describe('the clean-up of the change log', () => {
  it('keeps only the names of the fields an older write line changed', async () => {
    const changed = { price: { from: 1, to: 2 }, 'display.heading': { from: 'Ett', to: 'Två' } };
    await logEvent({ type: 'entity.written', fields: { old_hash: 'a', new_hash: 'b', changed } });
    await logEvent({
      type: 'entity.written',
      fields: { old_hash: 'b', new_hash: 'c', changed: ['price'] },
    });
    await logEvent({ type: 'entity.written', fields: { old_hash: null, new_hash: 'a' } });
    await logEvent({ type: 'test.other', fields: { changed } });

    const done = await stripChangeValues();
    expect(done.lines).toBe(1);
    expect(done.bytesAfter).toBeLessThan(done.bytesBefore);

    const written = await queryEvents({ type: 'entity.written', limit: 10 });
    expect(written.map((line) => changedNames(line.fields).sort())).toEqual([
      ['display.heading', 'price'],
      ['price'],
      [],
    ]);
    expect(JSON.stringify(written.map((line) => line.fields))).not.toContain('Två');
    expect(written[2]?.fields).not.toHaveProperty('changed');
    expect((await queryEvents({ type: 'test.other', limit: 1 }))[0]?.fields['changed']).toEqual(
      changed,
    );
    // A second round reads only the lines written since, and finds nothing to do.
    expect((await stripChangeValues()).lines).toBe(0);
  });
});
