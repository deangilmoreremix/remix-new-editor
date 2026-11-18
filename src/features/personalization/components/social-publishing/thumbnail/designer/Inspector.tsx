'use client';

import React, { useEffect, useState } from 'react';
import { DEFAULT_FONTS, type ImageLayer, type Layer, type ShapeLayer, type TextLayer } from './model';
import PictureTools, { type PictureTool } from './PictureTools';
import { CheckField, ColorField, Field, Section, SliderField, ToggleGroup, TRANSPARENT, inputStyle, isTransparent, withAlpha } from './designerUi';

export interface InspectorProps {
  layer: Layer;
  onChange: (patch: Partial<Layer>) => void;
  onTool?: (tool: PictureTool) => void;
  toolBusy?: string | null;
}

const fontName = (f: string) => f.split(',')[0].trim();

function TextInspector({ layer, onChange }: { layer: TextLayer; onChange: (patch: Partial<TextLayer>) => void }) {
  // The raw text of the highlight field, so typing a comma or a space is not eaten by the word list round trip.
  const [wordsText, setWordsText] = useState(layer.highlight.words.join(', '));
  const words = layer.highlight.words;
  const parseWords = (t: string) => t.split(/[,\n]/).map((w) => w.trim()).filter(Boolean);
  // Undo/redo can change the words from outside: show them, unless the field already stands for them.
  useEffect(() => {
    setWordsText((cur) => { const parsed = parseWords(cur); return parsed.length === words.length && parsed.every((w, i) => w === words[i]) ? cur : words.join(', '); });
  }, [words]);
  const set = onChange;
  const shadow = layer.shadow;
  const box = layer.box;
  return (
    <>
      <Field label="Text">
        <textarea id="designer-text-content" value={layer.text} rows={3} onChange={(e) => set({ text: e.target.value })} className="w-full resize-none rounded-lg px-2.5 py-1.5 text-[12px] outline-none" style={inputStyle} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Font">
          <select value={layer.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={inputStyle}>
            {[...(DEFAULT_FONTS.includes(layer.fontFamily as never) ? [] : [layer.fontFamily]), ...DEFAULT_FONTS].map((f) => <option key={f} value={f}>{fontName(f)}</option>)}
          </select>
        </Field>
        <Field label="Weight">
          <select value={layer.fontWeight} onChange={(e) => set({ fontWeight: Number(e.target.value) })} className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={inputStyle}>
            <option value={400}>Regular</option>
            <option value={700}>Bold</option>
            <option value={900}>Black</option>
          </select>
        </Field>
      </div>
      <SliderField label="Size" value={layer.fontSize} min={12} max={400} onChange={(fontSize) => set({ fontSize })} unit="px" />
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Colour" value={layer.color} onChange={(color) => set({ color })} />
        <ToggleGroup label="Align" value={layer.align} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }]} onChange={(align) => set({ align })} />
      </div>
      <SliderField label="Line height" value={layer.lineHeight} min={0.8} max={2} step={0.05} onChange={(lineHeight) => set({ lineHeight })} />

      <Section title="Outline">
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Outline colour" value={layer.strokeColor} onChange={(strokeColor) => set({ strokeColor })} />
          <SliderField label="Outline width" value={layer.strokeWidth} min={0} max={Math.max(20, Math.round(layer.fontSize * 0.2))} onChange={(strokeWidth) => set({ strokeWidth })} unit="px" />
        </div>
      </Section>

      <Section title="Shadow">
        <CheckField label="Drop shadow" checked={!!shadow} onChange={(on) => set({ shadow: on ? { color: 'rgba(0,0,0,0.6)', blur: Math.round(layer.fontSize * 0.15), offsetX: 0, offsetY: Math.round(layer.fontSize * 0.06) } : null })} />
        {shadow && (
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Shadow colour" value={shadow.color} onChange={(hex) => set({ shadow: { ...shadow, color: withAlpha(hex, 0.6) } })} />
            <SliderField label="Shadow blur" value={shadow.blur} min={0} max={60} onChange={(blur) => set({ shadow: { ...shadow, blur } })} unit="px" />
          </div>
        )}
      </Section>

      <Section title="Box behind text">
        <CheckField label="Filled box" checked={!!box} onChange={(on) => set({ box: on ? { color: '#000000', padding: Math.round(layer.fontSize * 0.25), radius: Math.round(layer.fontSize * 0.2) } : null })} />
        {box && (
          <div className="grid grid-cols-3 gap-2">
            <ColorField label="Box colour" value={box.color} onChange={(color) => set({ box: { ...box, color } })} />
            <SliderField label="Padding" value={box.padding} min={0} max={80} onChange={(padding) => set({ box: { ...box, padding } })} />
            <SliderField label="Corners" value={box.radius} min={0} max={80} onChange={(radius) => set({ box: { ...box, radius } })} />
          </div>
        )}
      </Section>

      <Section title="Highlight words">
        <Field label="Words to highlight">
          <input type="text" value={wordsText} placeholder="e.g. FREE, new" onChange={(e) => { setWordsText(e.target.value); set({ highlight: { ...layer.highlight, words: parseWords(e.target.value) } }); }} className="w-full rounded-lg px-2.5 py-1.5 text-[11px] outline-none" style={inputStyle} />
        </Field>
        <ColorField label="Highlight colour" value={layer.highlight.color} onChange={(color) => set({ highlight: { ...layer.highlight, color } })} />
      </Section>
    </>
  );
}

function ImageInspector({ layer, onChange, onTool, toolBusy }: { layer: ImageLayer; onChange: (patch: Partial<ImageLayer>) => void; onTool?: (tool: PictureTool) => void; toolBusy?: string | null }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <ToggleGroup label="Fit" value={layer.fit} options={[{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Fill' }]} onChange={(fit) => onChange({ fit })} />
        <Field label="Outline">
          <select value={layer.outline} onChange={(e) => onChange({ outline: e.target.value as ImageLayer['outline'] })} className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={inputStyle}>
            <option value="none">None</option>
            <option value="white">White outline</option>
            <option value="glow">Glow</option>
          </select>
        </Field>
      </div>
      {onTool && <PictureTools onTool={onTool} busy={toolBusy} />}
    </>
  );
}

function ShapeInspector({ layer, onChange }: { layer: ShapeLayer; onChange: (patch: Partial<ShapeLayer>) => void }) {
  const filled = !isTransparent(layer.fill);
  const hasStroke = !isTransparent(layer.stroke);
  const canFill = layer.shape !== 'arrow';
  const canStroke = layer.shape !== 'divider';
  return (
    <>
      {canFill && (
        <div className="grid grid-cols-2 items-end gap-2">
          <ColorField label="Fill colour" value={isTransparent(layer.fill) ? '#ef4444' : layer.fill} onChange={(fill) => onChange({ fill })} />
          {layer.shape !== 'divider' && layer.shape !== 'badge' && <CheckField label="Filled" checked={filled} onChange={(on) => onChange({ fill: on ? '#ef4444' : TRANSPARENT })} />}
        </div>
      )}
      {canStroke && (
        <div className="grid grid-cols-2 items-end gap-2">
          <ColorField label={layer.shape === 'arrow' ? 'Arrow colour' : 'Line colour'} value={isTransparent(layer.stroke) ? '#ef4444' : layer.stroke} onChange={(stroke) => onChange({ stroke })} />
          {layer.shape !== 'arrow' && <CheckField label="Line" checked={hasStroke} onChange={(on) => onChange({ stroke: on ? '#ffffff' : TRANSPARENT })} />}
        </div>
      )}
      {canStroke && <SliderField label="Line width" value={layer.strokeWidth} min={0} max={60} onChange={(strokeWidth) => onChange({ strokeWidth })} unit="px" />}
      {layer.shape === 'badge' && (
        <Field label="Badge label">
          <input type="text" value={layer.label} maxLength={24} onChange={(e) => onChange({ label: e.target.value })} className="w-full rounded-lg px-2.5 py-1.5 text-[11px] outline-none" style={inputStyle} />
        </Field>
      )}
    </>
  );
}

/** Edits for the selected layer: name, opacity and rotation for all, then the controls of its kind. */
export default function Inspector({ layer, onChange, onTool, toolBusy }: InspectorProps) {
  const patch = onChange as (patch: Partial<Layer>) => void;
  return (
    <div className="space-y-3" data-testid="designer-inspector" key={layer.id}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Edit {layer.kind}</p>
      <Field label="Layer name">
        <input type="text" value={layer.name} maxLength={40} onChange={(e) => patch({ name: e.target.value })} className="w-full rounded-lg px-2.5 py-1.5 text-[11px] outline-none" style={inputStyle} />
      </Field>
      {layer.kind === 'text' && <TextInspector layer={layer} onChange={patch as (p: Partial<TextLayer>) => void} />}
      {layer.kind === 'image' && <ImageInspector layer={layer} onChange={patch as (p: Partial<ImageLayer>) => void} onTool={onTool} toolBusy={toolBusy} />}
      {layer.kind === 'shape' && <ShapeInspector layer={layer} onChange={patch as (p: Partial<ShapeLayer>) => void} />}
      <Section title="Position">
        <SliderField label="Opacity" value={Math.round(layer.opacity * 100)} min={0} max={100} onChange={(v) => patch({ opacity: v / 100 })} unit="%" />
        <SliderField label="Rotation" value={Math.round(layer.rotation)} min={-180} max={180} onChange={(rotation) => patch({ rotation })} unit="°" />
      </Section>
    </div>
  );
}
