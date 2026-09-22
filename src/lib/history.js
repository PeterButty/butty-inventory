// Build history: what has actually been finished, and when.
//
// A voided build stays in the log with its parts put back. It is excluded
// from every total but still shown, because a log that quietly loses entries
// is not one anybody trusts.

export const EMPTY_HISTORY = { builds: [], fromDatabase: false };

export function buildsFor(history, machineId) {
  return history.builds.filter(b => b.machineId === machineId);
}

export function machinesBuilt(history, machineId) {
  return buildsFor(history, machineId)
    .filter(b => !b.voidedAt)
    .reduce((total, b) => total + b.qty, 0);
}

export function lastBuiltAt(history, machineId) {
  const live = buildsFor(history, machineId).filter(b => !b.voidedAt);
  return live.length ? live[0].builtAt : null;
}

// Totals for a window ending now, for the summary line.
export function builtSince(history, machineId, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return buildsFor(history, machineId)
    .filter(b => !b.voidedAt && new Date(b.builtAt).getTime() >= cutoff)
    .reduce((total, b) => total + b.qty, 0);
}

export function totalBuilt(history) {
  return history.builds.filter(b => !b.voidedAt).reduce((total, b) => total + b.qty, 0);
}

// "3 days ago", "just now" — a date is harder to read at a glance on a shop
// floor than how long back it was.
export function timeAgo(iso) {
  if (!iso) return null;
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const steps = [
    [60, 'just now', null],
    [3600, 'minute', 60],
    [86400, 'hour', 3600],
    [604800, 'day', 86400],
    [2629800, 'week', 604800],
    [31557600, 'month', 2629800],
    [Infinity, 'year', 31557600],
  ];
  for (const [limit, label, divisor] of steps) {
    if (seconds < limit) {
      if (!divisor) return label;
      const n = Math.floor(seconds / divisor);
      return `${n} ${label}${n === 1 ? '' : 's'} ago`;
    }
  }
  return null;
}

export function formatBuiltAt(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
