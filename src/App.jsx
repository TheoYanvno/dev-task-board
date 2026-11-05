import { useEffect, useMemo, useRef, useState } from 'react';
import Board from './components/Board.jsx';
import Editor from './components/Editor.jsx';
import { CalendarView, ListView } from './components/Views.jsx';
import { COLUMNS, PRIORITIES, facets as getFacets, filter, isoDay, load, move, parseBoard, remove, sample, save, serialize, stats, upsert } from './lib/tasks.js';

const VIEWS = [['board', 'Board'], ['list', 'List'], ['calendar', 'Calendar']];

export default function App({ storage = globalThis.localStorage }) {
  const [tasks, setTasks] = useState(() => load(storage));
  const [view, setView] = useState('board');
  const [f, setF] = useState({ q: '', priority: '', tag: '', project: '', sprint: '' });
  const [editing, setEditing] = useState(null);       // { task } or { column } for a new one
  const [note, setNote] = useState('');
  const [theme, setTheme] = useState(() => { try { return storage?.getItem('dev-task-board-theme') || 'dark'; } catch { return 'dark'; } });
  const file = useRef(null);
  const today = isoDay();

  useEffect(() => { if (!save(tasks, storage)) setNote('Your browser is blocking storage, so changes last only until you close this tab.'); }, [tasks, storage]);
  useEffect(() => { document.documentElement.dataset.theme = theme; try { storage?.setItem('dev-task-board-theme', theme); } catch { /* fine */ } }, [theme, storage]);
  useEffect(() => { if (!note) return undefined; const t = setTimeout(() => setNote(''), 5000); return () => clearTimeout(t); }, [note]);

  const facets = useMemo(() => getFacets(tasks), [tasks]);
  const shown = useMemo(() => filter(tasks, f), [tasks, f]);
  const s = useMemo(() => stats(tasks, today), [tasks, today]);
  const filtering = Object.values(f).some(Boolean);
  const setFilter = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const saveTask = (task) => { setTasks((ts) => upsert(ts, task)); setEditing(null); setNote(`Saved “${task.title}”.`); };
  const deleteTask = (id) => {
    const gone = tasks.find((t) => t.id === id);
    setTasks((ts) => remove(ts, id));
    setEditing(null);
    setNote(`Deleted “${gone?.title}”.`);
  };
  const onMove = (id, column, index) => setTasks((ts) => move(ts, id, column, index));

  const exportBoard = () => {
    const url = URL.createObjectURL(new Blob([serialize(tasks)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `task-board-${today}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const importBoard = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    try {
      const { tasks: loaded, skipped } = parseBoard(await picked.text());
      setTasks(loaded);
      setNote(`Imported ${loaded.length} tasks${skipped ? ` (${skipped} couldn’t be read)` : ''}.`);
    } catch (err) { setNote(err.message); }
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><img src="icon.svg" alt="" width="34" height="34" /> Shipboard</div>
        <nav className="views" aria-label="Views">
          {VIEWS.map(([id, label]) => <button key={id} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}
        </nav>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={exportBoard}>Export</button>
          <button type="button" className="ghost" onClick={() => file.current.click()}>Import</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={importBoard} />
          <button type="button" className="icon-btn" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? '☾' : '☀'}</button>
        </div>
      </header>

      <section className="toolbar" aria-label="Search and filters">
        <input type="search" className="q" placeholder="Search tasks…" aria-label="Search tasks" value={f.q} onChange={setFilter('q')} />
        <div className="filters">
          <select aria-label="Priority" value={f.priority} onChange={setFilter('priority')}><option value="">All priorities</option>{PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select>
          <select aria-label="Tag" value={f.tag} onChange={setFilter('tag')}><option value="">All tags</option>{facets.tags.map((t) => <option key={t} value={t}>#{t}</option>)}</select>
          <select aria-label="Project" value={f.project} onChange={setFilter('project')}><option value="">All projects</option>{facets.projects.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <select aria-label="Sprint" value={f.sprint} onChange={setFilter('sprint')}><option value="">All sprints</option>{facets.sprints.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          {filtering && <button type="button" className="ghost" onClick={() => setF({ q: '', priority: '', tag: '', project: '', sprint: '' })}>Clear</button>}
        </div>
        <button type="button" className="primary new" onClick={() => setEditing({ column: 'backlog' })}>+ New task</button>
      </section>

      <section className="stats" aria-label="Progress">
        {COLUMNS.map((c) => <div key={c.id} className={`stat ${c.id}`}><strong>{s.by[c.id].count}</strong><span>{c.label}</span></div>)}
        <div className="stat points"><strong>{s.percent}%</strong><span>{s.donePoints} of {s.total} points done</span>
          <span className="bar" role="img" aria-label={`${s.percent}% of story points done`}><span style={{ width: `${s.percent}%` }} /></span></div>
        {s.overdue > 0 && <div className="stat late"><strong>{s.overdue}</strong><span>overdue</span></div>}
      </section>

      {filtering && <p className="muted showing">Showing {shown.length} of {tasks.length} tasks.</p>}

      <main>
        {view === 'board' && <Board tasks={shown} today={today} onOpen={(task) => setEditing({ task })} onMove={onMove} onAdd={(column) => setEditing({ column })} />}
        {view === 'list' && <ListView tasks={shown} today={today} onOpen={(task) => setEditing({ task })} />}
        {view === 'calendar' && <CalendarView tasks={shown} today={today} onOpen={(task) => setEditing({ task })} />}
      </main>

      {tasks.length === 0 && (
        <p className="muted center">Your board is empty. <button type="button" className="link" onClick={() => setTasks(sample())}>Load example tasks</button></p>
      )}

      {editing && <Editor task={editing.task} column={editing.column} facets={facets} onSave={saveTask} onDelete={deleteTask} onClose={() => setEditing(null)} />}
      <div className="toast" role="status" aria-live="polite">{note}</div>
      <footer className="foot">Saved in this browser only. Use Export to keep a copy or move your board to another computer.</footer>
    </div>
  );
}
