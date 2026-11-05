import { useState } from 'react';
import { Priority, shortDate } from './Card.jsx';
import { COLUMNS, sortBy } from '../lib/tasks.js';
import { byDay, monthGrid, monthLabel, shiftMonth } from '../lib/calendar.js';

const COLUMN_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.id, c.label]));
const HEADS = [['title', 'Task'], ['column', 'Status'], ['priority', 'Priority'], ['points', 'Points'], ['due', 'Due']];

/** Every task as a table you can sort by any column. */
export function ListView({ tasks, today, onOpen }) {
  const [sort, setSort] = useState({ key: 'due', dir: 'asc' });
  const rows = sortBy(tasks, sort.key, sort.dir);
  const click = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  return (
    <div className="table-wrap">
      <table className="list">
        <thead>
          <tr>{HEADS.map(([key, label]) => (
            <th key={key} scope="col" aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" onClick={() => click(key)}>{label}{sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</button>
            </th>
          ))}<th scope="col">Tags</th></tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td><button type="button" className="link" onClick={() => onOpen(t)}>{t.title}</button>{t.project && <small className="muted"> · {t.project}</small>}</td>
              <td><span className={`status ${t.column}`}>{COLUMN_LABEL[t.column]}</span></td>
              <td><Priority value={t.priority} /></td>
              <td>{t.points ?? '–'}</td>
              <td className={t.due && t.due < today && t.column !== 'done' ? 'late' : ''}>{t.due ? shortDate(t.due) : '–'}</td>
              <td>{t.tags.map((x) => <span key={x} className="tag">#{x}</span>)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">No tasks match.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A month of due dates; click a task to open it. */
export function CalendarView({ tasks, today, onOpen }) {
  const [ym, setYm] = useState(() => ({ year: +today.slice(0, 4), month: +today.slice(5, 7) - 1 }));
  const days = byDay(tasks);
  return (
    <section className="calendar" aria-labelledby="cal-h">
      <header>
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setYm((v) => shiftMonth(v.year, v.month, -1))}>‹</button>
        <h2 id="cal-h">{monthLabel(ym.year, ym.month)}</h2>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setYm((v) => shiftMonth(v.year, v.month, 1))}>›</button>
        <button type="button" className="ghost" onClick={() => setYm({ year: +today.slice(0, 4), month: +today.slice(5, 7) - 1 })}>Today</button>
      </header>
      <div className="cal-grid" role="grid" aria-labelledby="cal-h">
        <div className="cal-row head" role="row">{WEEKDAYS.map((d) => <div key={d} role="columnheader">{d}</div>)}</div>
        {monthGrid(ym.year, ym.month).map((week) => (
          <div className="cal-row" role="row" key={week[0].key}>
            {week.map((d) => (
              <div key={d.key} role="gridcell" className={`cal-day${d.inMonth ? '' : ' out'}${d.key === today ? ' today' : ''}`} aria-label={d.key}>
                <span className="num">{d.day}</span>
                {(days.get(d.key) ?? []).map((t) => (
                  <button key={t.id} type="button" className={`chip ${t.priority}${t.column === 'done' ? ' done' : ''}`} onClick={() => onOpen(t)} title={t.title}>{t.title}</button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
