import { useRef, useState, useSyncExternalStore } from "react";
import type { Platform } from "../composition/config/endcard";
import { setCustomBrand } from "../composition/config/endcard";
import type { RecorderProject } from "../project";
import { Check, Field, Select, TextInput } from "./controls";

const BRAND_KEY = "recorderStudioBrand";
const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "discord", label: "Discord" },
];

type Brand = { displayName: string; handles: Partial<Record<Platform, string>>; isLinkedInBusinessPage: boolean; avatarUrl: string | null };

const emptyBrand = (): Brand => ({ displayName: "", handles: {}, isLinkedInBusinessPage: false, avatarUrl: null });

/** Saved channel details (the avatar is not persisted: a blob URL would not survive a reload). */
export const loadBrand = (): Brand => {
  try {
    const saved = JSON.parse(localStorage.getItem(BRAND_KEY) ?? "null") as Brand | null;
    return saved ? { ...emptyBrand(), ...saved, avatarUrl: null } : emptyBrand();
  } catch {
    return emptyBrand();
  }
};

export const applyBrand = (brand: Brand) => setCustomBrand(brand);

export const StylePanel = ({ project }: { project: RecorderProject }) => {
  const props = useSyncExternalStore(project.store.subscribe, project.store.getProps);
  const [brand, setBrand] = useState<Brand>(loadBrand);
  const avatarInput = useRef<HTMLInputElement>(null);

  const update = (next: Brand) => {
    setBrand(next);
    applyBrand(next);
    try { localStorage.setItem(BRAND_KEY, JSON.stringify({ ...next, avatarUrl: null })); } catch { /* storage unavailable */ }
    project.store.bumpRevision();
  };

  return (
    <>
      <Field label="Canvas" hint="Landscape suits YouTube; square suits social feeds. Captions look different in each.">
        <Select value={props.canvasLayout} options={[{ value: "landscape", label: "Landscape 16:9 (1920×1080)" }, { value: "square", label: "Square 1:1 (1080×1080)" }]} onChange={project.setCanvasLayout} />
      </Field>
      <Field label="Theme">
        <Select value={props.theme} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} onChange={project.setTheme} />
      </Field>
      <Field label="Platform" hint="Decides which follow button the end card shows.">
        <Select value={props.platform} options={PLATFORMS} onChange={project.setPlatform} />
      </Field>

      <div className="rs-divider" />
      <span className="rs-label">Your channel (end card)</span>
      <Field label="Display name">
        <TextInput value={brand.displayName} placeholder="Your channel or company" onChange={(displayName) => update({ ...brand, displayName })} />
      </Field>
      {PLATFORMS.map((p) => (
        <Field key={p.value} label={`${p.label} handle`}>
          <TextInput value={brand.handles[p.value] ?? ""} placeholder={p.value === "youtube" ? "@yourchannel" : "@handle"} onChange={(v) => update({ ...brand, handles: { ...brand.handles, [p.value]: v } })} />
        </Field>
      ))}
      <Check checked={brand.isLinkedInBusinessPage} onChange={(isLinkedInBusinessPage) => update({ ...brand, isLinkedInBusinessPage })} label="LinkedIn page is a company page" />
      <div className="rs-row">
        <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) update({ ...brand, avatarUrl: URL.createObjectURL(file) });
          e.target.value = "";
        }} />
        <button className="rs-btn" onClick={() => avatarInput.current?.click()}>Upload avatar</button>
        {brand.avatarUrl ? <button className="rs-btn" onClick={() => update({ ...brand, avatarUrl: null })}>Use letter avatar</button> : null}
      </div>
    </>
  );
};
