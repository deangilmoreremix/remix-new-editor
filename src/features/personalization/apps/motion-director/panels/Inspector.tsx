import React, { useRef, useState } from "react";
import type { PropField } from "../cards/types";
import { cardFps, inOffsetFps, sourceLength } from "../cards/types";
import { CARDS } from "../cards/registry";
import { findClip, useStore } from "../store";
import { THEME_MANIFEST } from '../cards/projectCards';
import { themedProps } from '../theme';
import { cardName, tx, useT, useTx } from "../i18n";
import { ThemePanel } from "./ThemePanel";
import { DEMO_TEXTS } from "../demosrc/_generated/demoTexts";
import { parseTextMap } from "../lib/textOverrides";
import { rulesOf } from "../lib/shotRules";

/** What to know before rewriting the words of a recipe (from its upstream card). */
const textNote = (component: string): string => {
  const text = rulesOf(component)?.text;
  if (text === 'fixed') return 'These words are part of the effect (hand-drawn letters or fixed segments): changing them breaks it.';
  if (text === 'structural') return 'These words are part of the effect: keep the same number of words and about the same length.';
  return 'Type new words over any line this shot draws.';
};

/** 单个属性控件：按 schema 字段类型渲染 */
const PropControl: React.FC<{
  field: PropField;
  value: unknown;
  onChange: (v: unknown) => void;
  onBegin: () => void;
}> = ({ field, value, onChange, onBegin }) => {
  switch (field.type) {
    case "text":
      return (
        <input
          type="text"
          value={String(value ?? "")}
          onFocus={onBegin}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <textarea
          rows={3}
          value={String(value ?? "")}
          onFocus={onBegin}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <span className="ctl-row">
          <input
            type="number"
            value={Number(value ?? 0)}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            onFocus={onBegin}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          {field.unit && <span className="unit">{field.unit}</span>}
        </span>
      );
    case "slider":
      return (
        <span className="ctl-row">
          <input
            type="range"
            value={Number(value ?? field.default)}
            min={field.min}
            max={field.max}
            step={field.step}
            onPointerDown={onBegin}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="slider-val">
            {Number(value ?? field.default)}
            {field.unit ?? ""}
          </span>
        </span>
      );
    case "color":
      return (
        <span className="ctl-row">
          <input
            type="color"
            value={String(value ?? field.default)}
            onFocus={onBegin}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="text"
            className="color-text"
            value={String(value ?? field.default)}
            onFocus={onBegin}
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
      );
    case "select":
      return (
        <select
          value={String(value ?? field.default)}
          onFocus={onBegin}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {tx(o.label)}
            </option>
          ))}
        </select>
      );
    case "boolean":
      return (
        <input
          type="checkbox"
          checked={Boolean(value ?? field.default)}
          onChange={(e) => {
            onBegin();
            onChange(e.target.checked);
          }}
        />
      );
  }
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="prop-row">
    <span className="prop-label">{label}</span>
    <span className="prop-ctl">{children}</span>
  </label>
);

type InspectorTab = "props" | "theme";

export const Inspector: React.FC = () => {
  const t = useT();
  const tx = useTx();
  const project = useStore((s) => s.project);
  const selectedClipId = useStore((s) => s.selectedClipId);
  const updateClip = useStore((s) => s.updateClip);
  const updateClipProps = useStore((s) => s.updateClipProps);
  const removeClip = useStore((s) => s.removeClip);
  const commit = useStore((s) => s.commit);
  // 属性面板有两个面：片段属性 + 影片主题（预设主题 / 配色编辑器）
  const [tab, setTab] = useState<InspectorTab>("props");

  const hit = selectedClipId ? findClip(project, selectedClipId) : null;
  const card = hit ? CARDS[hit.clip.cardId] : undefined;
  // 连续编辑合并为一步撤销：间隔 >800ms 才压新快照
  const lastBeginRef = useRef(0);

  // 每次编辑手势开始压一次撤销快照；短时间内的连续输入合并为一步
  const begin = () => {
    const now = Date.now();
    if (now - lastBeginRef.current > 800) commit();
    lastBeginRef.current = now;
  };

  const tabClass = (id: InspectorTab) =>
    `inspector-tab${tab === id ? " on" : ""}`;

  return (
    <div className="inspector">
      <div className="panel-title">
        {tab === "theme"
          ? t("theme.aria")
          : hit
            ? card
              ? cardName(card)
              : hit.clip.cardId
            : t("insp.title")}
        {hit && tab === "props" && (
          <span className="dim" style={{ marginLeft: 8, fontWeight: 400 }}>
            {tx(hit.track.name)}
          </span>
        )}
      </div>

      <div className="inspector-tabs" role="tablist" aria-label={t("insp.title")}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "props"}
          className={tabClass("props")}
          onClick={() => setTab("props")}
          data-testid="inspector-tab-props"
        >
          {t("insp.title")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "theme"}
          className={tabClass("theme")}
          onClick={() => setTab("theme")}
          data-testid="inspector-tab-theme"
        >
          {t("theme.aria")}
        </button>
      </div>

      {tab === "theme" ? (
        <div className="inspector-scroll">
          <ThemePanel />
        </div>
      ) : !hit ? (
        <div className="inspector-empty dim">
          {t("insp.empty1")}
          <br />
          {t("insp.empty2")}
          <br />
          {t("insp.empty3")}
          <br />
          <br />
          {t("insp.shortcuts1")}
          <br />
          {t("insp.shortcuts2")}
        </div>
      ) : (
        <div className="inspector-scroll">
          {(() => {
            const { track, clip } = hit;
            const fps = project.fps;
            // 卡片编排帧率 ≠ 工程帧率（只有逐帧编排的卡需要提示；媒体卡按墙钟走无此问题）
            const srcFps = card ? cardFps(card) : fps;
            const fpsMismatch = !!card && card.timing !== "realtime" && srcFps !== fps;
            // 裁入点按源帧计（见 inOffsetFps），秒数换算不能一律用工程 fps
            const inFps = inOffsetFps(card, fps);
            return (
              <>
                {card && card.schema.length > 0 && (
                  <section>
                    <div className="sec-title">{t("insp.contentStyle")}</div>
                    {card.schema.map((field) => (
                      <Row key={field.key} label={tx(field.label)}>
                        <PropControl
                          field={field}
                          value={themedProps(THEME_MANIFEST, card, project.themeId, clip.props, project.themeColors)[field.key] ?? field.default}
                          onChange={(v) => updateClipProps(clip.id, { [field.key]: v })}
                          onBegin={begin}
                        />
                      </Row>
                    ))}
                  </section>
                )}

                {clip.cardId.startsWith("demo:") && (DEMO_TEXTS[clip.cardId.slice(5)]?.length ?? 0) > 0 && (() => {
                  const original = DEMO_TEXTS[clip.cardId.slice(5)];
                  const texts = parseTextMap(clip.props.texts);
                  const set = (from: string, to: string) => {
                    const next = { ...texts };
                    if (to.trim()) next[from] = to;
                    else delete next[from];
                    updateClipProps(clip.id, { texts: next });
                  };
                  return (
                    <section data-testid="template-text">
                      <div className="sec-title">
                        Template text
                        {Object.keys(texts).length > 0 && (
                          <button type="button" className="mini" style={{ marginLeft: 8 }} onClick={() => { begin(); updateClipProps(clip.id, { texts: {} }); }}>
                            Reset all
                          </button>
                        )}
                      </div>
                      <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
                        {textNote(clip.cardId.slice(5))}
                      </div>
                      {original.slice(0, 60).map((line) => (
                        <label key={line} className="prop-row">
                          <span className="prop-label" title={line} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line}</span>
                          <span className="prop-ctl">
                            <input
                              type="text"
                              value={texts[line] ?? ""}
                              placeholder={line}
                              data-testid="template-text-input"
                              onFocus={begin}
                              onChange={(e) => set(line, e.target.value)}
                            />
                          </span>
                        </label>
                      ))}
                    </section>
                  );
                })()}

                <section>
                  <div className="sec-title">{t("insp.timing")}</div>
                  <Row label={t("insp.start")}>
                    <span className="ctl-row">
                      <input
                        type="number"
                        value={Number((clip.start / fps).toFixed(2))}
                        min={0}
                        step={0.1}
                        onFocus={begin}
                        onChange={(e) =>
                          updateClip(clip.id, { start: Math.max(0, Math.round(Number(e.target.value) * fps)) })
                        }
                      />
                      <span className="unit">s</span>
                    </span>
                  </Row>
                  <Row label={t("insp.duration")}>
                    <span className="ctl-row">
                      <input
                        type="number"
                        value={Number((clip.duration / fps).toFixed(2))}
                        min={2 / fps}
                        step={0.1}
                        onFocus={begin}
                        onChange={(e) =>
                          updateClip(clip.id, {
                            duration: Math.max(2, Math.round(Number(e.target.value) * fps)),
                          })
                        }
                      />
                      <span className="unit">s</span>
                    </span>
                  </Row>
                  <Row label={t("insp.speed")}>
                    <span className="ctl-row">
                      <input
                        type="range"
                        min={0.25}
                        max={4}
                        step={0.05}
                        value={clip.speed}
                        onPointerDown={begin}
                        onChange={(e) => updateClip(clip.id, { speed: Number(e.target.value) })}
                      />
                      <span className="slider-val">{clip.speed}×</span>
                    </span>
                  </Row>
                  <Row label="">
                    <span className="ctl-row preset-row">
                      {[0.5, 1, 1.5, 2].map((v) => (
                        <button
                          key={v}
                          className={`mini preset${clip.speed === v ? " on" : ""}`}
                          onClick={() => {
                            begin();
                            updateClip(clip.id, { speed: v });
                          }}
                        >
                          {v}×
                        </button>
                      ))}
                    </span>
                  </Row>
                  <Row label={t("insp.inPoint")}>
                    <span className="ctl-row">
                      <input
                        type="number"
                        value={Number((clip.inOffset / inFps).toFixed(2))}
                        min={0}
                        step={0.1}
                        onFocus={begin}
                        onChange={(e) =>
                          updateClip(clip.id, {
                            inOffset: Math.max(0, Math.round(Number(e.target.value) * inFps)),
                          })
                        }
                      />
                      <span className="unit">s</span>
                    </span>
                  </Row>
                  {card && (
                    <Row label="">
                      <button
                        className="mini"
                        title={t("insp.restore.title")}
                        onClick={() => {
                          begin();
                          updateClip(clip.id, {
                            duration: Math.max(
                              2,
                              Math.round((sourceLength(card, fps) - clip.inOffset) / clip.speed),
                            ),
                          });
                        }}
                      >
                        {t("insp.restore")}
                      </button>
                    </Row>
                  )}
                  {fpsMismatch && (
                    <div className="dim" style={{ fontSize: 11, lineHeight: 1.5, padding: "4px 0 2px" }}>
                      {t("insp.fpsMismatch", { src: srcFps, fps, ratio: (srcFps / fps).toFixed(2), inv: (fps / srcFps).toFixed(2) })}
                    </div>
                  )}
                </section>

                <section>
                  <div className="sec-title">{t("insp.layer")}</div>
                  <Row label={t("insp.opacity")}>
                    <span className="ctl-row">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={clip.opacity}
                        onPointerDown={begin}
                        onChange={(e) => updateClip(clip.id, { opacity: Number(e.target.value) })}
                      />
                      <span className="slider-val">{Math.round(clip.opacity * 100)}%</span>
                    </span>
                  </Row>
                  <Row label={t("insp.scale")}>
                    <span className="ctl-row">
                      <input
                        type="range"
                        min={0.2}
                        max={3}
                        step={0.01}
                        value={clip.scale}
                        onPointerDown={begin}
                        onChange={(e) => updateClip(clip.id, { scale: Number(e.target.value) })}
                      />
                      <span className="slider-val">{clip.scale.toFixed(2)}</span>
                    </span>
                  </Row>
                  <Row label={t("insp.x")}>
                    <span className="ctl-row">
                      <input
                        type="number"
                        value={clip.x}
                        step={2}
                        onFocus={begin}
                        onChange={(e) => updateClip(clip.id, { x: Number(e.target.value) })}
                      />
                      <span className="unit">px</span>
                    </span>
                  </Row>
                  <Row label={t("insp.y")}>
                    <span className="ctl-row">
                      <input
                        type="number"
                        value={clip.y}
                        step={2}
                        onFocus={begin}
                        onChange={(e) => updateClip(clip.id, { y: Number(e.target.value) })}
                      />
                      <span className="unit">px</span>
                    </span>
                  </Row>
                </section>

                <section>
                  <button className="btn danger" onClick={() => removeClip(clip.id)}>
                    {t("insp.deleteClip")}
                  </button>
                </section>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
