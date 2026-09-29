import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Button from './Button';
import CopyButton from './CopyButton';
import Icon from './Icon';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Highlight({ text, query }) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'ig'));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>));
}

/** Displays the transcript exactly as stored: no rewriting, only search, copy and expand. */
export default function TranscriptViewer({ text }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const box = useRef(null);
  const q = query.trim();

  const paragraphs = useMemo(() => text.split(/\n+/).filter((p) => p.trim()), [text]);
  const matches = useMemo(() => (q ? (text.match(new RegExp(escapeRegex(q), 'ig')) || []).length : 0), [text, q]);

  useEffect(() => {
    if (q) box.current?.querySelector('mark')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [q]);

  if (!text) return <p className="faint">Transcript not available.</p>;

  return (
    <div className="transcript">
      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input className="input" type="search" placeholder="Search transcript" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search transcript" />
        </div>
        <CopyButton getText={() => text} toastMessage="Transcript copied">Copy</CopyButton>
        <Button size="sm" variant="ghost" icon={expanded ? 'chevronDown' : 'chevronRight'} onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>
      {q && <p className="faint transcript-count" role="status">{matches ? `${matches} ${matches === 1 ? 'match' : 'matches'}` : 'No matches'}</p>}
      <div ref={box} className={`transcript-box ${expanded ? 'is-expanded' : ''}`} tabIndex={0} aria-label="Transcript text">
        {paragraphs.map((p, i) => <p key={i}><Highlight text={p} query={q} /></p>)}
      </div>
    </div>
  );
}
