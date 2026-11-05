// The board's data and every rule about it, with no React: tasks, columns, moving and ordering,
// filtering and sorting, sprints and saving. The page only calls these functions.

export const COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const POINTS = [1, 2, 3, 5, 8, 13];
const COLUMN_IDS = new Set(COLUMNS.map((c) => c.id));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

let counter = 0;
export const newId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Tags: lower-case, letters/digits/dashes, no repeats, at most 6. */
export function cleanTags(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').split(',');
  const out = [];
  for (const raw of list) {
    const t = String(raw).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 6);
}

/**
 * Checks and tidies a task from the editor (or from an imported file). Returns { ok, task } or
 * { ok: false, error } with a message for the person.
 */
export function cleanTask(input, existing = {}) {
  const title = String(input.title ?? '').replace(/\s+/g, ' ').trim();
  if (!title) return { ok: false, error: 'Give the task a title.' };
  if (title.length > 120) return { ok: false, error: 'Keep the title under 120 characters.' };
  const due = input.due ? String(input.due) : '';
  if (due && !DATE.test(due)) return { ok: false, error: 'The due date must be a date.' };
  const points = input.points === '' || input.points == null ? null : Number(input.points);
  if (points !== null && !POINTS.includes(points)) return { ok: false, error: `Story points are ${POINTS.join(', ')}.` };
  const checklist = (Array.isArray(input.checklist) ? input.checklist : [])
    .map((c) => ({ text: String(c.text ?? '').trim().slice(0, 140), done: !!c.done })).filter((c) => c.text).slice(0, 30);
  return {
    ok: true,
    task: {
      id: existing.id ?? input.id ?? newId(),
      title,
      description: String(input.description ?? '').trim().slice(0, 4000),
      column: COLUMN_IDS.has(input.column) ? input.column : existing.column ?? 'backlog',
      priority: PRIORITIES.includes(input.priority) ? input.priority : 'medium',
      tags: cleanTags(input.tags),
      project: String(input.project ?? '').trim().slice(0, 40),
      sprint: String(input.sprint ?? '').trim().slice(0, 40),
      points,
      due,
      checklist,
      created: existing.created ?? input.created ?? new Date().toISOString(),
      order: Number.isFinite(input.order) ? input.order : existing.order ?? Date.now(),
    },
  };
}

/** Tasks in one column, in their order. */
export const inColumn = (tasks, column) => tasks.filter((t) => t.column === column).sort((a, b) => a.order - b.order);

/**
 * Moves a task to `column` at position `index` (0 = top) and renumbers that column's order, so
 * dragging within a column reorders it and dragging across columns places it exactly where dropped.
 */
export function move(tasks, id, column, index = Infinity) {
  const task = tasks.find((t) => t.id === id);
  if (!task || !COLUMN_IDS.has(column)) return tasks;
  const others = inColumn(tasks, column).filter((t) => t.id !== id);
  const at = Math.max(0, Math.min(index, others.length));
  others.splice(at, 0, { ...task, column });
  const order = new Map(others.map((t, i) => [t.id, (i + 1) * 1000]));
  return tasks.map((t) => (order.has(t.id) ? { ...(t.id === id ? { ...task, column } : t), order: order.get(t.id) } : t));
}

export function upsert(tasks, task) {
  return tasks.some((t) => t.id === task.id) ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task];
}

export const remove = (tasks, id) => tasks.filter((t) => t.id !== id);

/** Every filter at once: words in the title, description or tags, plus priority, tag, project and sprint. */
export function filter(tasks, f = {}) {
  const words = String(f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return tasks.filter((t) => {
    const hay = `${t.title} ${t.description} ${t.tags.join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w))
      && (!f.priority || t.priority === f.priority)
      && (!f.tag || t.tags.includes(f.tag))
      && (!f.project || t.project === f.project)
      && (!f.sprint || t.sprint === f.sprint);
  });
}

const PRIORITY_RANK = Object.fromEntries(PRIORITIES.map((p, i) => [p, i]));
const COLUMN_RANK = Object.fromEntries(COLUMNS.map((c, i) => [c.id, i]));

/** Sorts for the list view; tasks with no due date go last when sorting by due date. */
export function sortBy(tasks, key = 'due', dir = 'asc') {
  const val = {
    title: (t) => t.title.toLowerCase(),
    priority: (t) => PRIORITY_RANK[t.priority],
    column: (t) => COLUMN_RANK[t.column],
    points: (t) => t.points ?? -1,
    due: (t) => t.due || (dir === 'asc' ? '9999' : '0000'),
  }[key] ?? ((t) => t.order);
  const sign = dir === 'desc' ? -1 : 1;
  return [...tasks].sort((a, b) => (val(a) < val(b) ? -sign : val(a) > val(b) ? sign : a.order - b.order));
}

/** The distinct values used, for the filter menus. */
export function facets(tasks) {
  const uniq = (xs) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return { tags: uniq(tasks.flatMap((t) => t.tags)), projects: uniq(tasks.map((t) => t.project)), sprints: uniq(tasks.map((t) => t.sprint)) };
}

/** Counts and story points per column, and what share of the points is done. */
export function stats(tasks, today = isoDay()) {
  const by = Object.fromEntries(COLUMNS.map((c) => [c.id, { count: 0, points: 0 }]));
  for (const t of tasks) { by[t.column].count++; by[t.column].points += t.points ?? 0; }
  const total = tasks.reduce((s, t) => s + (t.points ?? 0), 0);
  const overdue = tasks.filter((t) => t.due && t.due < today && t.column !== 'done').length;
  return { by, total, donePoints: by.done.points, percent: total ? Math.round((100 * by.done.points) / total) : 0, overdue };
}

export const checklistDone = (t) => ({ done: t.checklist.filter((c) => c.done).length, total: t.checklist.length });

export function isoDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- saving ----

export const KEY = 'dev-task-board';
export const VERSION = 1;

/** Reads the saved board; anything broken is dropped task by task instead of losing everything. */
export function load(storage = globalThis.localStorage, fallback = sample) {
  try {
    const raw = storage?.getItem(KEY);
    if (raw == null) return fallback();
    return parseBoard(raw).tasks;
  } catch {
    return fallback();
  }
}

export function save(tasks, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, serialize(tasks));
    return true;
  } catch {
    return false;
  }
}

export const serialize = (tasks) => JSON.stringify({ app: 'dev-task-board', version: VERSION, tasks });

/** Reads a saved or exported board. Throws with a plain message if it isn't one. */
export function parseBoard(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file isn’t a board export (it isn’t JSON).'); }
  const list = Array.isArray(data) ? data : data?.tasks;
  if (!Array.isArray(list)) throw new Error('That file isn’t a board export.');
  const tasks = [];
  const seen = new Set();
  for (const t of list.slice(0, 2000)) {
    if (!t || typeof t !== 'object') continue;
    const id = typeof t.id === 'string' && /^[\w-]{1,40}$/.test(t.id) && !seen.has(t.id) ? t.id : undefined;
    const r = cleanTask({ ...t, id }, { created: typeof t.created === 'string' ? t.created : undefined });
    if (r.ok) { seen.add(r.task.id); tasks.push(r.task); }
  }
  return { tasks, skipped: list.length - tasks.length };
}

/** A few example tasks for the first visit, dated around today. */
export function sample(today = new Date()) {
  const day = (n) => isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
  const base = [
    ['Design the database schema', 'Tables for users, projects and tasks with foreign keys.', 'review', 'high', ['database', 'backend'], 5, 1],
    ['Set up the dev environment', 'Node, linting, tests and a one-command start.', 'done', 'high', ['devops', 'setup'], 3, -3],
    ['Build the REST API endpoints', 'CRUD for tasks with validation and clear status codes.', 'progress', 'urgent', ['backend', 'api'], 8, 2],
    ['Reusable UI components', 'Buttons, inputs, dialog and toast with keyboard support.', 'progress', 'medium', ['frontend', 'ui'], 5, 4],
    ['Sign-in with sessions', 'Hashed passwords, HttpOnly cookie, sign-out everywhere.', 'backlog', 'high', ['backend', 'security'], 8, 7],
    ['Write the README', 'How to run it, the architecture and screenshots.', 'backlog', 'low', ['docs'], 2, 10],
    ['Fix: dates shift a day in some time zones', 'Use local YYYY-MM-DD keys instead of toISOString().', 'backlog', 'urgent', ['bug', 'frontend'], 2, -1],
    ['Dark mode', 'Custom properties for colors and a saved preference.', 'done', 'medium', ['frontend', 'ui'], 3, -6],
  ];
  return base.map(([title, description, column, priority, tags, points, due], i) => cleanTask({
    title, description, column, priority, tags, points, due: day(due), project: i % 3 === 2 ? 'Portfolio' : 'Task API',
    sprint: due < 3 ? 'Sprint 4' : 'Sprint 5', order: (i + 1) * 1000,
    checklist: i === 2 ? [{ text: 'GET and POST', done: true }, { text: 'PUT and DELETE', done: false }, { text: 'Tests', done: false }] : [],
  }).task);
}
