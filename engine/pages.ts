// A changes page put together from parts stored ready to send (question 227). A record's part is
// its item as the page carries it, all but `seq` and `remote_updated_at`, compressed once when the
// record is written. A page is then the parts in order with those two fields between them, never
// turned into text by the database nor compressed again by Core, which took most of a page's time
// (AC 27). Ahead of its deflate data a part keeps the CRC-32 and the length of what it holds, so
// the page's gzip check sum is put together from the parts' own.
import { constants, crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

/** How hard a part is compressed: once a write, and read by every site after. */
const PART_LEVEL = 6;
const HEAD = 8;
/**
 * A part smaller than this is unpacked and compressed again with the text around it: small
 * records compress well only together, as a page of them (AC 40), and cost little to compress.
 */
const SMALL_PART = 8 * 1024;
/** Text shorter than this goes in as it is: compressing it would make it longer. */
const SHORT_TEXT = 256;

/** What a record's part holds: its item but for `seq` and `remote_updated_at`, which follow the write. */
export type PartFields = {
  datatype: string;
  connection_id: string;
  remote_id: string;
  office_id: string | null;
  deleted: boolean;
  schema_version: string;
  content_hash: string;
  /** The JSON text of `raw` and `data`; a removed record's page entry carries no raw. */
  raw: string | null;
  data: string | null;
};

/** A record's part of a page, compressed, with its CRC-32 and length ahead. */
export function pagePart(fields: PartFields): Buffer {
  const small = JSON.stringify({
    datatype: fields.datatype,
    connection_id: fields.connection_id,
    remote_id: fields.remote_id,
    office_id: fields.office_id,
    deleted: fields.deleted,
    schema_version: fields.schema_version,
    content_hash: fields.content_hash,
  });
  const raw = fields.deleted ? null : fields.raw;
  const text = Buffer.from(
    `,${small.slice(1, -1)},"raw":${raw ?? 'null'},"data":${fields.data ?? 'null'}}`,
  );
  const head = Buffer.alloc(HEAD);
  head.writeUInt32LE(crc32(text), 0);
  head.writeUInt32LE(text.length, 4);
  // A sync flush ends the data on a whole byte with no last block, so another part can follow.
  const deflated = deflateRawSync(text, {
    level: PART_LEVEL,
    finishFlush: constants.Z_SYNC_FLUSH,
  });
  return Buffer.concat([head, deflated]);
}

/** The start of a record's item ahead of its part: the fields the write itself sets. */
export const itemHead = (seq: number, remoteUpdatedAt: Date | null): string =>
  `{"seq":${String(seq)},"remote_updated_at":${JSON.stringify(remoteUpdatedAt?.toISOString() ?? null)}`;

const POLYNOMIAL = 0xedb88320;

/** a(x) times b(x) modulo the CRC's polynomial, bits reflected (zlib's multmodp). */
function multiply(a: number, b: number): number {
  let product = 0;
  for (let bit = 0x80000000; bit !== 0; bit >>>= 1) {
    if ((a & bit) !== 0) {
      product ^= b;
      if ((a & (bit - 1)) === 0) break;
    }
    b = b & 1 ? (b >>> 1) ^ POLYNOMIAL : b >>> 1;
  }
  return product >>> 0;
}

/** x^(2^n) modulo the polynomial, for n from 0 to 31 (zlib's x2n_table). */
const POWERS: number[] = [];
for (let power = 0x40000000, n = 0; n < 32; n += 1) {
  POWERS.push(power);
  power = multiply(power, power);
}

/** The CRC-32 of A then B, from A's, B's and B's length (zlib's crc32_combine). */
export function combineCrc(first: number, second: number, secondLength: number): number {
  let shift = 0x80000000;
  for (let n = secondLength, k = 3; n > 0; n = Math.floor(n / 2), k += 1) {
    if (n % 2 === 1) shift = multiply(POWERS[k % 32] as number, shift);
  }
  return (multiply(shift, first) ^ second) >>> 0;
}

const GZIP_HEAD = Buffer.from([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0xff]);
/** An empty last block, fixed codes: the end of the deflate data. */
const LAST_BLOCK = Buffer.from([0x03, 0x00]);
const STORED_MAX = 0xffff;

/** Plain bytes as stored blocks, which need no compressing. */
function stored(text: Buffer): Buffer[] {
  const blocks: Buffer[] = [];
  for (let at = 0; at < text.length; at += STORED_MAX) {
    const block = text.subarray(at, at + STORED_MAX);
    const head = Buffer.alloc(5);
    head.writeUInt16LE(block.length, 1);
    head.writeUInt16LE(~block.length & 0xffff, 3);
    blocks.push(head, block);
  }
  return blocks;
}

/**
 * One gzip body from a page's pieces in order: a string is text, a Buffer a stored part. A large
 * part goes in as it was compressed; the text between, small parts unpacked into it, is compressed
 * at `level`, a run at a time.
 */
export function gzipPage(pieces: (string | Buffer)[], level: number): Buffer {
  const out: Buffer[] = [GZIP_HEAD];
  let crc = 0;
  let length = 0;
  let run: Buffer[] = [];
  const endRun = (): void => {
    const text = Buffer.concat(run);
    run = [];
    if (text.length === 0) return;
    if (text.length < SHORT_TEXT) out.push(...stored(text));
    else out.push(deflateRawSync(text, { level, finishFlush: constants.Z_SYNC_FLUSH }));
    crc = crc32(text, crc);
    length += text.length;
  };
  for (const piece of pieces) {
    if (typeof piece === 'string') {
      run.push(Buffer.from(piece));
      continue;
    }
    const partLength = piece.readUInt32LE(4);
    if (partLength < SMALL_PART) {
      run.push(inflateRawSync(piece.subarray(HEAD), { finishFlush: constants.Z_SYNC_FLUSH }));
      continue;
    }
    endRun();
    crc = combineCrc(crc, piece.readUInt32LE(0), partLength);
    length += partLength;
    out.push(piece.subarray(HEAD));
  }
  endRun();
  const tail = Buffer.alloc(8);
  tail.writeUInt32LE(crc, 0);
  tail.writeUInt32LE(length % 2 ** 32, 4);
  out.push(LAST_BLOCK, tail);
  return Buffer.concat(out);
}
