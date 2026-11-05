import { useEffect, useRef, useState } from 'react';
import { COLUMNS, POINTS, PRIORITIES, cleanTask } from '../lib/tasks.js';

const blank = (column) => ({ title: '', description: '', column, priority: 'medium', tags: [], project: '', sprint: '', points: null, due: '', checklist: [] });

/** The task editor, in a native <dialog> (so focus, Escape and the backdrop work like any dialog). */
export default function Editor({ task, column, facets, onSave, onDelete, onClose }) {
  const ref = useRef(null);
  const [form, setForm] = useState(() => (task ? { ...task } : blank(column)));
  const [tags, setTags] = useState(() => (task ? task.tags.join(', ') : ''));
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [item, setItem] = useState('');

  useEffect(() => { const d = ref.current; if (!d.open) d.showModal(); return () => d.open && d.close(); }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const r = cleanTask({ ...form, tags }, task ?? {});
    if (!r.ok) { setError(r.error); return; }
    onSave(r.task);
  };
  const addItem = () => {
    const text = item.trim();
    if (!text) return;
    setForm((f) => ({ ...f, checklist: [...f.checklist, { text, done: false }] }));
    setItem('');
  };
  const toggle = (i) => setForm((f) => ({ ...f, checklist: f.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c)) }));
  const drop = (i) => setForm((f) => ({ ...f, checklist: f.checklist.filter((_, j) => j !== i) }));

  return (
    <dialog ref={ref} className="editor" aria-labelledby="editor-h" onClose={onClose} onCancel={onClose}>
      <form onSubmit={submit} noValidate>
        <header><h2 id="editor-h">{task ? 'Edit task' : 'New task'}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>×</button></header>
        <label className="wide">Title<input value={form.title} onChange={set('title')} maxLength={120} required autoFocus /></label>
        <label className="wide">Description<textarea value={form.description} onChange={set('description')} rows={3} maxLength={4000} /></label>
        <label>Status<select value={form.column} onChange={set('column')}>{COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>Priority<select value={form.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select></label>
        <label>Story points<select value={form.points ?? ''} onChange={set('points')}><option value="">None</option>{POINTS.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        <label>Due date<input type="date" value={form.due} onChange={set('due')} /></label>
        <label>Project<input value={form.project} onChange={set('project')} list="projects" maxLength={40} /></label>
        <label>Sprint<input value={form.sprint} onChange={set('sprint')} list="sprints" maxLength={40} placeholder="e.g. Sprint 5" /></label>
        <label className="wide">Tags <small>separated by commas</small><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="frontend, bug" /></label>
        <datalist id="projects">{facets.projects.map((p) => <option key={p} value={p} />)}</datalist>
        <datalist id="sprints">{facets.sprints.map((p) => <option key={p} value={p} />)}</datalist>
        <fieldset className="wide checklist">
          <legend>Checklist</legend>
          <ul>
            {form.checklist.map((c, i) => (
              <li key={i}>
                <label><input type="checkbox" checked={c.done} onChange={() => toggle(i)} /> <span className={c.done ? 'struck' : ''}>{c.text}</span></label>
                <button type="button" className="icon-btn small" aria-label={`Remove “${c.text}”`} onClick={() => drop(i)}>×</button>
              </li>
            ))}
          </ul>
          <div className="add-item">
            <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Add a step" aria-label="New checklist step"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} />
            <button type="button" onClick={addItem}>Add</button>
          </div>
        </fieldset>
        {error && <p className="form-error wide" role="alert">{error}</p>}
        <footer className="wide">
          {task && (confirm
            ? <button type="button" className="danger" onClick={() => onDelete(task.id)}>Yes, delete it</button>
            : <button type="button" className="ghost" onClick={() => setConfirm(true)}>Delete…</button>)}
          <span className="spacer" />
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">{task ? 'Save' : 'Add task'}</button>
        </footer>
      </form>
    </dialog>
  );
}
