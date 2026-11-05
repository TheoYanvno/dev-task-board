import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checklistDone, cleanTags, cleanTask, facets, filter, inColumn, load, move, parseBoard, remove, sample, save, serialize, sortBy, stats, upsert } from '../src/lib/tasks.js';
import { byDay, monthGrid, monthLabel, shiftMonth } from '../src/lib/calendar.js';

const t = (id, column, order, extra = {}) => cleanTask({ id, title: id, column, order, ...extra }).task;
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('cleaning a task: a title is required, values are checked and tidied', () => {
  assert.equal(cleanTask({ title: '   ' }).error, 'Give the task a title.');
  assert.match(cleanTask({ title: 'x', due: 'tomorrow' }).error, /date/);
  assert.match(cleanTask({ title: 'x', points: 4 }).error, /1, 2, 3, 5, 8, 13/);
  const r = cleanTask({ title: '  Fix   the bug ', priority: 'nope', column: 'nowhere', tags: 'Bug, front end,bug', points: '5' });
  assert.equal(r.task.title, 'Fix the bug');
  assert.equal(r.task.priority, 'medium');
  assert.equal(r.task.column, 'backlog');
  assert.deepEqual(r.task.tags, ['bug', 'front-end']);
  assert.equal(r.task.points, 5);
  assert.deepEqual(cleanTags(['A', 'b', 'c', 'd', 'e', 'f', 'g']).length, 6);
});

test('editing keeps the id, column, created time and order', () => {
  const a = t('a', 'review', 5000);
  const b = cleanTask({ title: 'Renamed' }, a).task;
  assert.deepEqual([b.id, b.column, b.created, b.order], [a.id, 'review', a.created, 5000]);
});

test('moving: reorder within a column, and drop into another column at an exact spot', () => {
  let tasks = [t('a', 'backlog', 1), t('b', 'backlog', 2), t('c', 'backlog', 3), t('x', 'review', 1)];
  tasks = move(tasks, 'c', 'backlog', 0);
  assert.deepEqual(inColumn(tasks, 'backlog').map((x) => x.id), ['c', 'a', 'b']);
  tasks = move(tasks, 'a', 'review', 0);
  assert.deepEqual(inColumn(tasks, 'review').map((x) => x.id), ['a', 'x']);
  assert.deepEqual(inColumn(tasks, 'backlog').map((x) => x.id), ['c', 'b']);
  tasks = move(tasks, 'b', 'done');
  assert.deepEqual(inColumn(tasks, 'done').map((x) => x.id), ['b']);
  assert.equal(move(tasks, 'zzz', 'done'), tasks);
  assert.equal(move(tasks, 'b', 'nowhere'), tasks);
});

test('add, update and remove', () => {
  let tasks = upsert([], t('a', 'backlog', 1));
  tasks = upsert(tasks, { ...tasks[0], title: 'A2' });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'A2');
  assert.deepEqual(remove(tasks, 'a'), []);
});

test('filters combine: words, priority, tag, project and sprint', () => {
  const tasks = sample(new Date(2026, 10, 5));
  assert.ok(filter(tasks, { q: 'api' }).every((x) => /api/i.test(`${x.title} ${x.description} ${x.tags}`)));
  assert.ok(filter(tasks, { priority: 'urgent' }).every((x) => x.priority === 'urgent'));
  const both = filter(tasks, { tag: 'frontend', priority: 'urgent' });
  assert.deepEqual(both.map((x) => x.title), ['Fix: dates shift a day in some time zones']);
  assert.equal(filter(tasks, {}).length, tasks.length);
  const f = facets(tasks);
  assert.ok(f.tags.includes('backend') && f.projects.includes('Task API') && f.sprints.includes('Sprint 5'));
});

test('sorting for the list view, with no due date last', () => {
  const tasks = [t('a', 'done', 1, { due: '2026-11-09', priority: 'low' }), t('b', 'backlog', 2, { priority: 'urgent' }), t('c', 'review', 3, { due: '2026-11-06', priority: 'high' })];
  assert.deepEqual(sortBy(tasks, 'due').map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(sortBy(tasks, 'priority', 'desc').map((x) => x.id), ['b', 'c', 'a']);
  assert.deepEqual(sortBy(tasks, 'column').map((x) => x.id), ['b', 'c', 'a']);
});

test('stats: counts, points done and overdue tasks', () => {
  const tasks = [t('a', 'done', 1, { points: 5 }), t('b', 'progress', 2, { points: 3, due: '2026-11-01' }), t('c', 'done', 3, { due: '2026-11-01' })];
  const s = stats(tasks, '2026-11-05');
  assert.equal(s.by.done.count, 2);
  assert.equal(s.total, 8);
  assert.equal(s.percent, 63);
  assert.equal(s.overdue, 1, 'done tasks are never overdue');
  assert.deepEqual(checklistDone(cleanTask({ title: 'x', checklist: [{ text: 'a', done: true }, { text: 'b' }, { text: ' ' }] }).task), { done: 1, total: 2 });
});

test('saving and loading, including broken storage and files', () => {
  const s = memory();
  const tasks = [t('a', 'review', 1), t('b', 'done', 2)];
  assert.ok(save(tasks, s));
  assert.deepEqual(load(s).map((x) => [x.id, x.column]), [['a', 'review'], ['b', 'done']]);
  assert.equal(load(memory(), () => 'first visit'), 'first visit');
  s.setItem('dev-task-board', '{oops');
  assert.equal(load(s, () => 'fallback'), 'fallback');
  const blocked = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  assert.equal(save(tasks, blocked), false);
  const mixed = JSON.stringify({ tasks: [{ id: 'a', title: 'ok' }, { title: '' }, 'junk', { id: 'a', title: 'dupe id' }] });
  const r = parseBoard(mixed);
  assert.equal(r.tasks.length, 2);
  assert.equal(r.skipped, 2);
  assert.notEqual(r.tasks[0].id, r.tasks[1].id);
  assert.throws(() => parseBoard('nope'), /isn’t JSON/);
  assert.throws(() => parseBoard('{"x":1}'), /isn’t a board/);
  assert.deepEqual(parseBoard(serialize(tasks)).tasks, tasks);
});

test('the month grid starts on Sunday, fills whole weeks and marks the month', () => {
  const weeks = monthGrid(2026, 10);           // November 2026 starts on a Sunday
  assert.equal(weeks[0][0].key, '2026-11-01');
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks.length, 5);
  assert.equal(weeks[4][6].key, '2026-12-05');
  assert.equal(weeks[4][6].inMonth, false);
  assert.equal(monthGrid(2026, 1)[0][0].key, '2026-02-01');
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.equal(monthLabel(2026, 10), 'November 2026');
  const map = byDay([t('a', 'backlog', 1, { due: '2026-11-06' }), t('b', 'done', 2, { due: '2026-11-06' }), t('c', 'done', 3)]);
  assert.equal(map.get('2026-11-06').length, 2);
  assert.equal(map.size, 1);
});
