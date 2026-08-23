// src/lib/controls/visibility.js
// Safe expression evaluator for conditional visibility.
// Grammar: <field> <op> <value>  where op is ==, !=, exists, in
// No eval(). Only simple comparisons.

export function evaluateVisibility(expression, state) {
  if (!expression || typeof expression !== 'string') return true;

  const trimmed = expression.trim();

  // exists check
  const existsMatch = trimmed.match(/^(.+?)\s+exists$/);
  if (existsMatch) {
    const field = existsMatch[1].trim();
    return field in state.values && state.values[field] !== undefined && state.values[field] !== null && state.values[field] !== '';
  }

  // in check: field in ["a","b"]
  const inMatch = trimmed.match(/^(.+?)\s+in\s+\[(.+?)\]$/);
  if (inMatch) {
    const field = inMatch[1].trim();
    const rawValues = inMatch[2].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const val = state.values[field];
    return rawValues.includes(String(val));
  }

  // equality / inequality
  const eqMatch = trimmed.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
  if (eqMatch) {
    const field = eqMatch[1].trim();
    const op = eqMatch[2];
    let rawVal = eqMatch[3].trim().replace(/^["']|["']$/g, '');
    const val = state.values[field];

    // Numeric coercion if both sides look numeric
    const numVal = Number(rawVal);
    const numField = Number(val);
    const compare = (isNaN(numVal) ? rawVal : numVal);
    const fieldVal = (isNaN(numField) ? String(val) : numField);

    if (op === '==') return fieldVal == compare;
    if (op === '!=') return fieldVal != compare;
  }

  return true;
}
