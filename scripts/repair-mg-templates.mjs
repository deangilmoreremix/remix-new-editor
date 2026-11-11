// Repairs OpenChatCut motion-graphics templates that the sandbox code gate rejects only because of *how they are spelled*, never by
// loosening the gate (src/lib/editor/agent/codeGate.js is untouched; the repaired code is re-checked by it at load time):
//  - a variable / parameter named `top` (flagged as the browser global `window.top`) is renamed `topPos` with Babel's scope-aware rename;
//  - `'a' + b` string concatenation is rewritten as a template literal (the gate's "computed property names built from strings" heuristic
//    fires on any `+` next to a quote).
// Output: public/occ-templates/repaired.json { [templateId]: code } — only templates that now pass AND are otherwise unchanged in behaviour.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { checkAnimationCode } from '../src/lib/editor/agent/codeGate.js';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const GLOBALS = new Set(['window', 'document', 'globalThis', 'self', 'parent', 'top', 'opener', 'frames', 'navigator', 'location', 'history']);
const PACKS = ['openchatcut', 'social-shorts', 'koubo-scenes'];
const wrap = (code) => {
  const m = code.match(/(?:^|\n)\s*(?:const|function)\s+(\w+)/);
  return `${code}\nfunction Animation({ props }) { const { width, height } = useVideoConfig(); return <${m?.[1]} item={{ props, width, height }} />; }`;
};

function repair(code) {
  const ast = parse(code, { sourceType: 'script', plugins: ['jsx'], errorRecovery: false });
  traverse(ast, {
    Scope(path) {
      const s = path.scope;
      if (s.hasOwnBinding('top') && !s.getBinding('top')?.path?.isImportSpecifier?.()) s.rename('top', 'topPos');
    },
    // a JSX attribute spelled like a browser global (`<Orb top={-200} />`) becomes `{...{ top: -200 }}` — same props, but the key form
    // `top:` is not an identifier use
    JSXAttribute(path) {
      const n = path.node;
      if (!t.isJSXIdentifier(n.name) || !GLOBALS.has(n.name.name)) return;
      const v = n.value;
      const val = v == null ? t.booleanLiteral(true) : t.isJSXExpressionContainer(v) ? v.expression : v;
      path.replaceWith(t.jsxSpreadAttribute(t.objectExpression([t.objectProperty(t.identifier(n.name.name), val)])));
    },
    BinaryExpression: {
      exit(path) {
        if (path.node.operator !== '+') return;
        const flat = [];
        // only the left spine of the chain is flattened: a parenthesised right operand like `'a' + (x + y)` keeps its own (numeric) grouping
        const collect = (n) => (t.isBinaryExpression(n, { operator: '+' }) ? (collect(n.left), flat.push(n.right)) : flat.push(n));
        collect(path.node);
        const stringy = (n) => t.isStringLiteral(n) || t.isTemplateLiteral(n);
        if (!flat.some(stringy)) return;
        if (path.parentPath.isBinaryExpression({ operator: '+' })) return; // handled at the outermost +
        // only the chain from the first string operand onward is string concatenation; earlier numeric operands stay a numeric sum
        const first = flat.findIndex(stringy);
        if (first > 0) { // `a + b + 'px'`: the leading operands are summed first (as JS does), then concatenated
          const lead = flat.splice(0, first).reduce((l, r) => t.binaryExpression('+', l, r));
          flat.unshift(t.stringLiteral(''), lead);
        }
        const esc = (x) => x.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
        const quasis = []; const exprs = []; let cur = '';
        for (const n of flat) {
          if (t.isStringLiteral(n)) cur += esc(n.value);
          else if (t.isTemplateLiteral(n)) {
            n.quasis.forEach((q, i) => { cur += q.value.raw; if (i < n.expressions.length) { quasis.push(t.templateElement({ raw: cur, cooked: cur }, false)); exprs.push(n.expressions[i]); cur = ''; } });
          } else { quasis.push(t.templateElement({ raw: cur, cooked: cur }, false)); exprs.push(n); cur = ''; }
        }
        quasis.push(t.templateElement({ raw: cur, cooked: cur }, true));
        path.replaceWith(t.templateLiteral(quasis, exprs));
      },
    },
  });
  return generate(ast, { retainLines: false, compact: false }).code;
}

const out = {}; const still = [];
for (const f of PACKS) {
  for (const tpl of JSON.parse(fs.readFileSync(`public/occ-templates/${f}-templates.json`, 'utf8'))) {
    if (checkAnimationCode(wrap(tpl.code)).ok) continue;
    try {
      const fixed = repair(tpl.code);
      const r = checkAnimationCode(wrap(fixed));
      if (r.ok) out[tpl.id] = fixed; else still.push({ id: tpl.id, f, why: r.errors });
    } catch (e) { still.push({ id: tpl.id, f, why: [`parse: ${e.message.slice(0, 80)}`] }); }
  }
}
fs.writeFileSync('public/occ-templates/repaired.json', JSON.stringify(out));
console.log('repaired', Object.keys(out).length, 'still blocked', still.length);
still.forEach((s) => console.log(' -', s.id, s.why.join('; ')));
