import { COLUMNS, checklistDone } from '../lib/tasks.js';

const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

export function Priority({ value }) {
  return <span className={`prio ${value}`}>{PRIORITY_LABEL[value]}</span>;
}

export function shortDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * One task on the board. Drag it with a mouse, or focus it and use the Move menu; Enter or a
 * click opens it.
 */
export default function Card({ task, today, onOpen, onMove, onDragStart }) {
  const list = checklistDone(task);
  const overdue = task.due && task.due < today && task.column !== 'done';
  return (
    <li className="card" draggable onDragStart={(e) => onDragStart(e, task)} data-id={task.id}>
      <button type="button" className="card-open" onClick={() => onOpen(task)} aria-label={`Open “${task.title}”`}>
        <span className="card-top"><Priority value={task.priority} />{task.points != null && <span className="pts" title="Story points">{task.points} pt</span>}</span>
        <strong className="card-title">{task.title}</strong>
        {task.description && <span className="card-desc">{task.description}</span>}
        {task.tags.length > 0 && <span className="tags">{task.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</span>}
        <span className="card-foot">
          {task.project && <span className="proj">{task.project}</span>}
          {list.total > 0 && <span className="check" title="Checklist">☑ {list.done}/{list.total}</span>}
          {task.due && <span className={overdue ? 'due late' : 'due'}>{overdue ? 'Overdue · ' : ''}{shortDate(task.due)}</span>}
        </span>
      </button>
      <label className="move">
        <span className="sr-only">Move “{task.title}” to</span>
        <select value={task.column} onChange={(e) => onMove(task.id, e.target.value)}>
          {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
    </li>
  );
}
