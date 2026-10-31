#!/usr/bin/env python3
"""
Adds model catalog entries that exist in upstream Open-Generative-AI's
packages/studio/src/models.js but not in src/lib/models.js.

It only READS the upstream file as text (nothing from it is executed) and
appends the missing entry blocks to the end of the matching array in ours.
Entries already present (same id, or same endpoint) are left alone, and
entries that reference an upstream-only constant or helper (e.g. a
`GROK_RESOLUTION_INPUT` value or a `...SPREAD`) are skipped and reported.

    python3 -I scripts/sync-upstream-models.py <upstream models.js> [--write]

Without --write it prints what it would add.
"""
import re
import sys

ARRAYS = ['t2iModels', 'i2iModels', 't2vModels', 'i2vModels', 'v2vModels', 'lipsyncModels', 'audioModels']


def scan(src):
    """name -> (list of top-level entry blocks, index of the array's closing ']')."""
    out = {}
    for m in re.finditer(r'^export const (\w+Models) = \[', src, re.M):
        name, depth, instr, esc, j, start, blocks = m.group(1), 1, None, False, m.end(), None, []
        while j < len(src) and depth > 0:
            c = src[j]
            if instr:
                if esc:
                    esc = False
                elif c == '\\':
                    esc = True
                elif c == instr:
                    instr = None
            elif c == '/' and src[j:j + 2] == '//':
                j = src.index('\n', j)
            elif c in '"\'`':
                instr = c
            elif c in '[{(':
                depth += 1
                if c == '{' and depth == 2:
                    start = j
            elif c in ']})':
                depth -= 1
                if c == '}' and depth == 1 and start is not None:
                    blocks.append(src[start:j + 1])
                    start = None
            j += 1
        out[name] = (blocks, j - 1)
    return out


def shared_consts(src):
    """Top-level `const NAME = Object.freeze(...)` definitions before the first
    exported array: plain data shared between upstream model entries."""
    first = re.search(r'^export const \w+Models = \[', src, re.M)
    head = src[:first.start()] if first else ''
    m = re.search(r'^const [A-Z0-9_]+ = Object\.freeze\(', head, re.M)
    if not m:
        return '', set()
    text = head[m.start():].rstrip() + '\n'
    names = set(re.findall(r'^const ([A-Z0-9_]+) = ', text, re.M))
    return text, names


# Plain JS used inside generated entries (e.g. Array.from({ length }, (_, index) => ...)).
JS_BUILTINS = {'true', 'false', 'null', 'Array', 'from', 'length', 'index', '_', 'Object', 'freeze', 'String', 'Number'}


def field(block, key):
    m = re.search(r'"%s"\s*:\s*"([^"]+)"' % key, block)
    return m.group(1) if m else None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    write = '--write' in sys.argv
    if not args:
        sys.exit(__doc__)
    up_src = open(args[0], encoding='utf-8').read()
    up = scan(up_src)
    consts_text, const_names = shared_consts(up_src)
    path = 'src/lib/models.js'
    ours_src = open(path, encoding='utf-8').read()
    ours = scan(ours_src)

    inserts = []  # (index, text)
    total = 0
    for name in ARRAYS:
        if name not in up or name not in ours:
            continue
        have_ids = {field(b, 'id') for b in ours[name][0]}
        have_eps = {field(b, 'endpoint') for b in ours[name][0]}
        add, skipped = [], []
        for block in up[name][0]:
            bid, ep = field(block, 'id'), field(block, 'endpoint')
            if not bid or bid in have_ids or (ep and ep in have_eps):
                continue
            # Keys and values are quoted in plain data entries, so any bare
            # identifier left after removing strings is a reference to an
            # upstream-only constant/helper that we don't have.
            bare = re.findall(r'\b[A-Za-z_]\w*\b(?!\s*:)', re.sub(r'"(?:[^"\\]|\\.)*"', '""', block))
            if [t for t in bare if t not in JS_BUILTINS and t not in const_names]:
                skipped.append(bid)
                continue
            add.append(block)
            have_ids.add(bid)
            have_eps.add(ep)
        print(f'{name:14} adding {len(add):3}  skipped {len(skipped)} {skipped}')
        total += len(add)
        if add:
            body = ''.join(',\n  ' + b.replace('\n', '\n  ') for b in add)
            # insert after the last existing entry, before the closing ']'
            close = ours[name][1]
            last_end = ours_src.rfind('}', 0, close) + 1
            inserts.append((last_end, body))

    # Shared constants the added entries refer to go in before the first array.
    have_consts = set(re.findall(r'^const ([A-Z0-9_]+) = ', ours_src, re.M))
    if consts_text and not const_names <= have_consts and total:
        first = re.search(r'^export const \w+Models = \[', ours_src, re.M)
        inserts.append((first.start(), '// Shared input definitions copied from upstream (used by the synced entries below).\n' + consts_text + '\n'))
        print(f'shared constants: {len(const_names - have_consts)} added')

    if write:
        for idx, text in sorted(inserts, reverse=True):
            ours_src = ours_src[:idx] + text + ours_src[idx:]
        open(path, 'w', encoding='utf-8').write(ours_src)
        print(f'wrote {total} entries to {path}')
    else:
        print(f'dry run: {total} entries would be added')


if __name__ == '__main__':
    main()
