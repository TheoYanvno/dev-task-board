import { useState } from 'react';
import Card from './Card.jsx';
import { COLUMNS, inColumn } from '../lib/tasks.js';

/** Where in a column the pointer is: the index of the first card whose middle is below it. */
function dropIndex(list, clientY) {
  const cards = [...list.querySelectorAll('.card')];
  const i = cards.findIndex((c) => { const r = c.getBoundingClientRect(); return clientY < r.top + r.height / 2; });
  return i === -1 ? cards.length : i;
}

export default function Board({ tasks, today, onOpen, onMove, onAdd }) {
  const [over, setOver] = useState(null);       // { column, index } while dragging

  const start = (e, task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const end = () => setOver(null);

  return (
    <div className="board" onDragEnd={end}>
      {COLUMNS.map((col) => {
        const list = inColumn(tasks, col.id);
        return (
          <section key={col.id} className={`column ${col.id}${over?.column === col.id ? ' over' : ''}`} aria-labelledby={`col-${col.id}`}>
            <header>
              <h2 id={`col-${col.id}`}><span className="dot" aria-hidden="true" />{col.label} <span className="count">({list.length})</span></h2>
              <button type="button" className="icon-btn" aria-label={`Add a task to ${col.label}`} onClick={() => onAdd(col.id)}>+</button>
            </header>
            <ol
              className="cards"
              onDragOver={(e) => { e.preventDefault(); setOver({ column: col.id, index: dropIndex(e.currentTarget, e.clientY) }); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                const index = dropIndex(e.currentTarget, e.clientY);
                // the dragged card is still in this list while measuring; don't count it above itself
                const before = list.findIndex((t) => t.id === id);
                onMove(id, col.id, before !== -1 && before < index ? index - 1 : index);
                end();
              }}
            >
              {list.map((t, i) => (
                <FragmentWithMarker key={t.id} show={over?.column === col.id && over.index === i}>
                  <Card task={t} today={today} onOpen={onOpen} onMove={(id, c) => onMove(id, c)} onDragStart={start} />
                </FragmentWithMarker>
              ))}
              {over?.column === col.id && over.index >= list.length && <li className="drop-marker" aria-hidden="true" />}
              {list.length === 0 && over?.column !== col.id && (
                <li className="empty"><button type="button" onClick={() => onAdd(col.id)}><span aria-hidden="true">+</span> No tasks yet<small>Drag tasks here or click + to add</small></button></li>
              )}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function FragmentWithMarker({ show, children }) {
  return <>{show && <li className="drop-marker" aria-hidden="true" />}{children}</>;
}
