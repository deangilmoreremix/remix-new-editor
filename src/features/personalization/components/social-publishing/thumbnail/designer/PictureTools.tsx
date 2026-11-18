'use client';

import React, { useState } from 'react';
import { Loader2, Scissors, Sparkles } from 'lucide-react';
import { AI_TOOL_IDS, FREE_TOOLS, aiToolLabel, type FreeToolId } from './pictureTools';
import type { EditorOperationId } from '@ohb/shared/personalization/image-editor/imageEditRegistry';
import { inputStyle } from './designerUi';

export type PictureTool = { kind: 'free'; id: FreeToolId } | { kind: 'ai'; id: EditorOperationId; note: string };

/**
 * Tools for the selected picture layer. The free tools work on the device and need no account or key.
 * The AI tools are optional extras; finishing a thumbnail never requires them.
 */
export default function PictureTools({ onTool, busy }: { onTool: (tool: PictureTool) => void; busy?: string | null }) {
  const [aiId, setAiId] = useState<EditorOperationId>(AI_TOOL_IDS[0]);
  const [note, setNote] = useState('');
  const working = !!busy;
  return (
    <div className="space-y-2" data-testid="picture-tools">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Picture tools</p>
        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: 'rgba(217,255,0,0.12)', color: '#d9ff00' }}>Free</span>
      </div>
      <div className="grid gap-1.5">
        {FREE_TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.hint}
            disabled={working}
            onClick={() => onTool({ kind: 'free', id: t.id })}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-semibold transition-all disabled:opacity-50"
            style={{ background: 'transparent', border: '1px solid rgba(217,255,0,0.45)', color: '#d9ff00' }}
          >
            {busy === t.id ? <><Loader2 size={13} className="animate-spin" />Working…</> : <>{t.id === 'cutout_person' ? <Scissors size={13} /> : null}{t.label}</>}
          </button>
        ))}
      </div>

      <details className="rounded-lg border border-white/10 p-2" data-testid="ai-picture-tools">
        <summary className="cursor-pointer text-[11px] font-semibold text-white/70"><Sparkles size={11} className="mr-1 inline" />AI tools (optional, uses your OpenAI key)</summary>
        <div className="mt-2 space-y-2">
          <select aria-label="AI tool" value={aiId} onChange={(e) => setAiId(e.target.value as EditorOperationId)} className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={inputStyle}>
            {AI_TOOL_IDS.map((id) => <option key={id} value={id}>{aiToolLabel(id)}</option>)}
          </select>
          <input aria-label="Note for the AI tool" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note, e.g. a bright city street" className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={inputStyle} />
          <button
            type="button"
            disabled={working}
            onClick={() => onTool({ kind: 'ai', id: aiId, note })}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-semibold disabled:opacity-50"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}
          >
            {busy === aiId ? <><Loader2 size={13} className="animate-spin" />Working…</> : 'Apply with AI'}
          </button>
          <p className="text-[10px] text-white/30">Works on the whole picture. Undo brings the old one back.</p>
        </div>
      </details>
      <p className="text-[10px] text-white/30">A white outline on the layer then makes a cut-out pop. Undo and Redo work for every tool.</p>
    </div>
  );
}
