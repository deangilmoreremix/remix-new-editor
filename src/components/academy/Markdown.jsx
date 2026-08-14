// Minimal Markdown renderer for the imported Academy content.
// Renders headings, lists, blockquotes, code, tables and inline emphasis.
// Inline images are intentionally dropped (the SEE tab shows media properly
// via the asset gallery), so broken relative image links never appear.
import React, { useEffect, useState } from 'react';

function inline(text, keyBase = 'i') {
  const parts = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\([^)]+\))/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] != null) parts.push(<strong key={`${keyBase}-${k++}`}>{m[2]}</strong>);
    else if (m[3] != null)
      parts.push(
        <code key={`${keyBase}-${k++}`} className="px-1 py-0.5 rounded bg-white/10 text-[12px]">
          {m[3]}
        </code>
      );
    else if (m[4] != null) parts.push(<span key={`${keyBase}-${k++}`}>{m[4]}</span>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderBlocks(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];

    // code fence
    if (line.startsWith('```')) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre key={key++} className="text-xs bg-black/40 border border-white/10 rounded-xl p-3 overflow-auto my-2">
          {buf.join('\n')}
        </pre>
      );
      continue;
    }

    // heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1
          ? 'text-xl font-bold text-white mt-4 mb-2'
          : level === 2
          ? 'text-lg font-semibold text-white mt-4 mb-2'
          : 'text-sm font-semibold text-white/90 mt-3 mb-1';
      blocks.push(
        <p key={key++} className={cls}>
          {inline(h[2], `h${key}`)}
        </p>
      );
      i++;
      continue;
    }

    // blockquote
    if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-white/20 pl-3 my-2 text-white/70 italic">
          {inline(buf.join(' '), `q${key}`)}
        </blockquote>
      );
      continue;
    }

    // table
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map((c) => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === '')));
        i++;
      }
      const head = rows[0];
      const body = rows.slice(2);
      blocks.push(
        <table key={key++} className="w-full text-xs my-2 border border-white/10 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-white/5">
              {head.map((c, ci) => (
                <th key={ci} className="text-left p-2 font-semibold text-white/80">{inline(c, `th${key}-${ci}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri} className="border-t border-white/10">
                {r.map((c, ci) => (
                  <td key={ci} className="p-2 text-white/70 align-top">{inline(c, `td${key}-${ri}-${ci}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    // list
    if (/^(\s*[-*]\s+|\s*\d+\.\s+)/.test(line)) {
      const items = [];
      while (i < lines.length && /^(\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) {
        items.push(lines[i].replace(/^(\s*[-*]\s+|\s*\d+\.\s+)/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 space-y-1 my-2 text-white/75">
          {items.map((it, ii) => (
            <li key={ii}>{inline(it, `li${key}-${ii}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // paragraph (merge consecutive non-special lines)
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('```') &&
      !/^(\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i]) &&
      !lines[i].includes('|')
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="text-sm text-white/75 leading-relaxed my-2">
        {inline(buf.join(' '), `p${key}`)}
      </p>
    );
  }
  return blocks;
}

export function Markdown({ rawPath }) {
  const [text, setText] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(rawPath)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => alive && setText(t))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [rawPath]);
  if (err) return <p className="text-sm text-white/50">Could not load content.</p>;
  if (!text) return <p className="text-sm text-white/40">Loading…</p>;
  return <div className="academy-md">{renderBlocks(text)}</div>;
}
