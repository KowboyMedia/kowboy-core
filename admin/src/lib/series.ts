// What the day's chart counts, and the colour each gets. Shared by the chart and the figures under
// it, and kept apart from the chart so the charting library loads only with the chart.
export const SERIES = [
  { key: 'entity.written', label: 'Written', fill: 'var(--color-ring)' },
  { key: 'pull', label: 'Pulls', fill: 'var(--color-ok)' },
  { key: 'bell', label: 'Bells', fill: 'var(--color-warn)' },
  { key: 'site.applied', label: 'Applied', fill: 'var(--color-primary)' },
  { key: 'site.failed', label: 'Failed', fill: 'var(--color-danger)' },
];
