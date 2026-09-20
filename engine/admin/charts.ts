// Figures and charts for the panel, drawn as inline SVG and plain HTML by template functions: no
// chart library, nothing loaded from outside, and every value is also readable without hovering,
// in a title, a label or the table under the chart. The colours are Tabler's own tokens: the four
// series colours (blue, orange, teal, purple) pass the colour-blindness and contrast checks of the
// data-visualisation method, and the status colours (green, yellow, red) mean good, waiting and
// bad, never a series.
import { escape } from './html.js';

/** Series colours, assigned in this fixed order and never cycled. */
const SERIES = ['#066fd1', '#f76707', '#0ca678', '#ae3ec9'] as const;
/** The status colour for a series that means failure; never a series colour. */
export const BAD = '#d63939';
const GRID = 'var(--tblr-border-color)';
const INK = 'var(--tblr-secondary)';

/** A series: its values per label, and a colour only when it is a status (red for what failed). */
export type Series = { label: string; values: number[]; colour?: string };

const fmt = new Intl.NumberFormat('sv-SE');
export const figure = (value: number): string => fmt.format(value);

/** 1, 2, 5, 10, 20, 50…: the smallest round number at or above `value`, never below 1. */
function nice(value: number): number {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}

/** A stat tile: a label, one big number, a line of context and an optional sparkline. */
export function tile(
  label: string,
  value: string,
  options: { context?: string; state?: 'ok' | 'bad' | 'warn'; spark?: number[] } = {},
): string {
  const colour =
    options.state === 'ok'
      ? ' text-green'
      : options.state === 'bad'
        ? ' text-red'
        : options.state === 'warn'
          ? ' text-yellow'
          : '';
  return (
    `<div class="card card-sm h-100"><div class="card-body">` +
    `<div class="subheader">${escape(label)}</div>` +
    `<div class="figure text-nowrap${colour}">${escape(value)}</div>` +
    (options.context
      ? `<div class="text-secondary small mt-1">${escape(options.context)}</div>`
      : '') +
    `${options.spark ? sparkline(options.spark) : ''}</div></div>`
  );
}

/** Tiles side by side, as many per row as the screen allows. */
export const tiles = (items: string[]): string =>
  `<div class="row row-cards mb-3">${items.map((item) => `<div class="col-6 col-md-4 col-xl-2">${item}</div>`).join('')}</div>`;

/** A small line of the last points, the last one marked; the numbers live in the tile's title. */
export function sparkline(values: number[]): string {
  const W = 120;
  const H = 36;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const points = values.map((v, i) => [i * step, H - 4 - (v / max) * (H - 8)] as const);
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = points.at(-1) ?? [0, H];
  const title = `Per hour, oldest first: ${values.map(figure).join(', ')}`;
  return (
    `<svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title>` +
    `<polygon points="0,${H} ${line} ${W},${H}" fill="${SERIES[0]}" opacity=".1"/>` +
    `<polyline points="${line}" fill="none" stroke="${SERIES[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
    `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="${SERIES[0]}" stroke="#fff" stroke-width="2"/></svg>`
  );
}

/** A segment with a rounded top and a square base; the base of a column is the axis or the segment below. */
function segment(
  x: number,
  y: number,
  w: number,
  h: number,
  colour: string,
  title: string,
): string {
  const r = Math.min(3, h / 2, w / 2);
  const path = `M${x},${y + h} V${y + r} q0,-${r} ${r},-${r} H${x + w - r} q${r},0 ${r},${r} V${y + h} Z`;
  return `<path d="${path}" fill="${colour}"><title>${escape(title)}</title></path>`;
}

/**
 * Stacked columns, one per label, one segment per series with a gap of surface between them; a
 * hairline grid with round ticks; a legend for two series or more, and the same numbers as a
 * table under the chart for whoever cannot use the picture.
 */
export function columns(labels: string[], series: Series[], caption: string): string {
  // Sized for half a page: the text keeps its size when the picture fills its card.
  const W = 560;
  const H = 230;
  const left = 44;
  const right = 8;
  const top = 10;
  const bottom = 26;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const max = nice(Math.max(...totals, 0));
  const y = (value: number): number => top + plotH - (value / max) * plotH;
  const slot = plotW / Math.max(1, labels.length);
  const barW = Math.min(24, slot * 0.66);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const grid = ticks
    .map(
      (t) =>
        `<line x1="${left}" x2="${W - right}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="${GRID}" stroke-width="1"/>` +
        `<text x="${left - 6}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end" font-size="11" fill="${INK}">${escape(figure(t))}</text>`,
    )
    .join('');
  const every = labels.length > 12 ? 3 : 1;
  const xLabels = labels
    .map((label, i) =>
      i % every === 0 || i === labels.length - 1
        ? `<text x="${(left + i * slot + slot / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${INK}">${escape(label)}</text>`
        : '',
    )
    .join('');
  const marks = labels
    .map((label, i) => {
      const x = left + i * slot + (slot - barW) / 2;
      let base = y(0);
      const parts = series
        .map((s, k) => {
          const v = s.values[i] ?? 0;
          if (v <= 0) return '';
          const h = Math.max(1, (v / max) * plotH);
          const gap = base < y(0) ? 2 : 0;
          const colour = s.colour ?? SERIES[k % SERIES.length] ?? '';
          const part = segment(
            x,
            base - h - gap,
            barW,
            h,
            colour,
            `${label}: ${s.label} ${figure(v)}`,
          );
          base = base - h - gap;
          return part;
        })
        .join('');
      const readout = `${label}\n${series.map((s) => `${s.label}: ${figure(s.values[i] ?? 0)}`).join('\n')}`;
      return `<g class="hit">${parts}<rect x="${(left + i * slot).toFixed(1)}" y="${top}" width="${slot.toFixed(1)}" height="${plotH}" fill="transparent"><title>${escape(readout)}</title></rect></g>`;
    })
    .join('');
  const empty = totals.every((t) => t === 0)
    ? `<text x="${left + plotW / 2}" y="${top + plotH / 2}" text-anchor="middle" font-size="12" fill="${INK}">Nothing in this period.</text>`
    : '';
  const legend =
    series.length > 1
      ? `<div class="chart-legend">${series.map((s, k) => `<span><span class="key" style="background:${s.colour ?? SERIES[k % SERIES.length]}"></span>${escape(s.label)}</span>`).join('')}</div>`
      : '';
  const table =
    `<details class="mt-2"><summary class="small">As a table</summary><div class="table-responsive"><table class="table table-sm table-vcenter tabular"><thead><tr><th></th>${series.map((s) => `<th>${escape(s.label)}</th>`).join('')}</tr></thead><tbody>` +
    labels
      .map(
        (label, i) =>
          `<tr><td>${escape(label)}</td>${series.map((s) => `<td>${figure(s.values[i] ?? 0)}</td>`).join('')}</tr>`,
      )
      .join('') +
    `</tbody></table></div></details>`;
  return (
    `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(caption)}"><title>${escape(caption)}</title>` +
    `${grid}<line x1="${left}" x2="${W - right}" y1="${y(0)}" y2="${y(0)}" stroke="${GRID}" stroke-width="1"/>${marks}${xLabels}${empty}</svg>${legend}${table}</div>`
  );
}

/** Horizontal bars for one measure: a label, a thin bar and the value at its tip. */
export function bars(rows: { label: string; value: number; note?: string }[]): string {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return rows
    .map(
      (row) =>
        `<div class="d-flex align-items-center mb-2"><div class="text-secondary small" style="width:7rem">${escape(row.label)}</div>` +
        `<div class="flex-fill"><div class="progress" style="height:.5rem"><div class="progress-bar" role="progressbar" style="width:${((row.value / max) * 100).toFixed(1)}%;background:${SERIES[0]}" aria-valuenow="${row.value}" aria-valuemin="0" aria-valuemax="${max}"></div></div></div>` +
        `<div class="ms-3 tabular" style="min-width:4rem">${escape(figure(row.value))}${row.note ? ` <span class="text-secondary small">${escape(row.note)}</span>` : ''}</div></div>`,
    )
    .join('');
}

/** A meter: how much of a whole, the fill in the state's colour on a lighter track of the same hue. */
export function meter(
  value: number,
  max: number,
  state: 'ok' | 'warn' | 'bad',
  label: string,
): string {
  const share = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const colour = state === 'ok' ? 'green' : state === 'warn' ? 'yellow' : 'red';
  return (
    `<div class="d-flex justify-content-between small mb-1"><span>${escape(label)}</span><span class="tabular">${escape(figure(value))} of ${escape(figure(max))}</span></div>` +
    `<div class="progress bg-${colour}-lt" style="height:.75rem"><div class="progress-bar bg-${colour}" role="progressbar" style="width:${share}%" aria-valuenow="${share}" aria-valuemin="0" aria-valuemax="100"><span class="visually-hidden">${share}%</span></div></div>`
  );
}
