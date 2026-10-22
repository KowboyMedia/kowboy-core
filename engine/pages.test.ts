// A page put together from stored parts reads back as the text it stands for, its check sum
// included: gunzip refuses a body whose CRC-32 or length is wrong.
import { randomBytes } from 'node:crypto';
import { crc32, gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { combineCrc, gzipPage, itemHead, pagePart } from './pages.js';

describe('a page from parts', () => {
  it('puts two check sums together as one over both', () => {
    for (const [first, second] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [7, 1],
      [100, 65_536],
      [3, 1_000_003],
    ] as const) {
      const a = randomBytes(first);
      const b = randomBytes(second);
      expect(combineCrc(crc32(a), crc32(b), b.length)).toBe(crc32(Buffer.concat([a, b])));
    }
  });

  it('reads back as the page it stands for, large parts and small', () => {
    const big = JSON.stringify({ text: 'ä'.repeat(70_000) });
    const part = (remoteId: string, raw: string | null, data: string | null, deleted = false) =>
      pagePart({
        datatype: 'property',
        connection_id: 'c',
        remote_id: remoteId,
        office_id: null,
        deleted,
        schema_version: '1',
        content_hash: 'h',
        raw,
        data,
      });
    const pieces = [
      '{"items":[',
      itemHead(1, new Date('2026-10-22T10:00:00Z')),
      part('P1', '{"a": 1}', '{"heading":"Ett hem"}'),
      `,${itemHead(2, null)}`,
      part('P2', '{"b": 2}', null, true),
      `,${itemHead(3, null)}`,
      part('P3', big, big),
      `],"next_after":3,"has_more":false,"note":${JSON.stringify('x'.repeat(70_000))}}`,
    ];

    const page = JSON.parse(gunzipSync(gzipPage(pieces, 3)).toString()) as {
      items: Record<string, unknown>[];
    };

    const item = { datatype: 'property', connection_id: 'c', office_id: null };
    const rest = { schema_version: '1', content_hash: 'h' };
    expect(page.items).toEqual([
      {
        ...item,
        ...rest,
        seq: 1,
        remote_id: 'P1',
        deleted: false,
        remote_updated_at: '2026-10-22T10:00:00.000Z',
        raw: { a: 1 },
        data: { heading: 'Ett hem' },
      },
      {
        ...item,
        ...rest,
        seq: 2,
        remote_id: 'P2',
        deleted: true,
        remote_updated_at: null,
        raw: null,
        data: null,
      },
      {
        ...item,
        ...rest,
        seq: 3,
        remote_id: 'P3',
        deleted: false,
        remote_updated_at: null,
        raw: JSON.parse(big),
        data: JSON.parse(big),
      },
    ]);
  });
});
