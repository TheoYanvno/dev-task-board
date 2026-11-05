// The calendar view's month grid: weeks of day keys (YYYY-MM-DD in local time) from Sunday,
// including the days from the months before and after that fill the first and last week.

export const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The weeks shown for a month (month is 0–11): an array of weeks, each 7 { key, day, inMonth }. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const last = new Date(year, month + 1, 0);
  const weeks = [];
  const d = new Date(start);
  while (d <= last || d.getDay() !== 0) {
    if (d.getDay() === 0) weeks.push([]);
    weeks[weeks.length - 1].push({ key: key(d), day: d.getDate(), inMonth: d.getMonth() === month });
    d.setDate(d.getDate() + 1);
  }
  return weeks;
}

export const monthLabel = (year, month) => new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export function shiftMonth(year, month, by) {
  const d = new Date(year, month + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Tasks grouped by due date, for the days of the grid. */
export function byDay(tasks) {
  const map = new Map();
  for (const t of tasks) if (t.due) map.set(t.due, [...(map.get(t.due) ?? []), t]);
  return map;
}
