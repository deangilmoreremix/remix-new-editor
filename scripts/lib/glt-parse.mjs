// Pure parser for gl-transitions (https://github.com/gl-transitions/gl-transitions) shader files.
// Used by scripts/gen-gl-transitions-catalog.mjs and by tests. No I/O, no timestamps: output is deterministic.
// Spec: header `// Author:` / `// License:` (+ optional `// Description:` / `// Tags:`); parameters are
// `uniform <type> <name>; // = <default>` optionally preceded by `// @range(min, max[, step]) text`, `// @color text` or `// @param text`.

export const SUPPORTED_TYPES = ['float', 'int', 'bool', 'vec2', 'vec3', 'vec4', 'ivec2'];

const COMPONENTS = { float: 1, int: 1, bool: 1, vec2: 2, vec3: 3, vec4: 4, ivec2: 2 };

export function parseDefault(type, text) {
  const t = text.replace(/\/\/.*$/, '').trim().replace(/;$/, '').trim();
  if (type === 'bool') {
    if (t === 'true') return true;
    if (t === 'false') return false;
    throw new Error(`bad bool default: ${t}`);
  }
  const n = COMPONENTS[type];
  const num = (s) => {
    const v = Number(s.trim());
    if (!Number.isFinite(v)) throw new Error(`bad number: ${s}`);
    return v;
  };
  if (n === 1) return num(t);
  const m = /^i?vec([234])\s*\(([^)]*)\)$/.exec(t);
  if (!m) throw new Error(`bad ${type} default: ${t}`);
  const parts = m[2].split(',').map(num);
  if (parts.length === 1) return Array(n).fill(parts[0]);
  if (parts.length !== n) throw new Error(`bad ${type} default arity: ${t}`);
  return parts;
}

/** @returns {{ header: {author:string, license:string, description:string, tags:string[]}, params: object[], textures: string[], errors: string[] }} */
export function parseTransition(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const header = { author: '', license: '', description: '', tags: [] };
  const errors = [];
  for (const line of lines) {
    const m = /^\/\/\s*(Author|License|Description|Tags)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === 'tags') header.tags = m[2].split(',').map((s) => s.trim()).filter(Boolean);
    else header[k] = m[2].trim();
  }
  const params = [];
  const textures = [];
  for (let i = 0; i < lines.length; i++) {
    const um = /^uniform\s+(\w+)\s+(\w+)\s*;\s*(?:\/\/\s*=\s*(.*))?$/.exec(lines[i].trim());
    if (!um) continue;
    const [, type, name, def] = um;
    if (type === 'sampler2D') { textures.push(name); continue; }
    if (!SUPPORTED_TYPES.includes(type)) { errors.push(`unsupported uniform type ${type} ${name}`); continue; }
    // gather the contiguous comment block directly above
    let doc = [];
    for (let j = i - 1; j >= 0 && lines[j].trim().startsWith('//'); j--) doc.unshift(lines[j].trim().replace(/^\/\/\s?/, ''));
    const p = { name, type };
    let text = doc.join(' ').trim();
    const rm = /@range\(\s*([^)]*)\)\s*(.*)$/.exec(text);
    if (rm) {
      const [min, max, step] = rm[1].split(',').map((s) => Number(s.trim()));
      p.min = min; p.max = max; if (Number.isFinite(step)) p.step = step;
      text = rm[2];
    } else if (/^@color\b/.test(text)) { p.color = true; text = text.replace(/^@color\s*/, ''); }
    else if (/^@param\b/.test(text)) text = text.replace(/^@param\s*/, '');
    if (text) p.description = text;
    if (def === undefined) { errors.push(`no default for ${name}`); }
    else {
      try { p.default = parseDefault(type, def); } catch (e) { errors.push(`${name}: ${e.message}`); }
    }
    params.push(p);
  }
  if (!header.author) errors.push('missing Author');
  if (!header.license) errors.push('missing License');
  return { header, params, textures, errors };
}

export const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();
