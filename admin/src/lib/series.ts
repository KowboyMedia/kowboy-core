// What the day's chart counts, and the colour each gets. Shared by the chart and the figures under
// it, and kept apart from the chart so the charting library loads only with the chart.
export const SERIES = [
  { key: 'entity.written', label: 'Records saved', fill: 'var(--color-ring)' },
  { key: 'pull', label: 'Pages fetched by sites', fill: 'var(--color-ok)' },
  { key: 'bell', label: 'Sites told of changes', fill: 'var(--color-warn)' },
  { key: 'site.applied', label: 'Records the sites took', fill: 'var(--color-primary)' },
  { key: 'site.failed', label: 'Records the sites could not take', fill: 'var(--color-danger)' },
];
