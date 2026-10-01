// Reading SQL DDL: CREATE TABLE, ALTER TABLE ... ADD CONSTRAINT, CREATE [UNIQUE] INDEX, ENABLE ROW LEVEL SECURITY and
// CREATE POLICY. It is a reader for schema files, not a full SQL parser: statements it does not understand are counted and
// listed, never silently treated as "nothing there".

// Comments out, then statements split on semicolons that are outside quotes and $$ blocks.
export function statements(sql) {
  const s = String(sql).replace(/^﻿/, '');
  const out = [];
  let cur = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const two = s.slice(i, i + 2);
    if (two === '--') { const e = s.indexOf('\n', i); i = e < 0 ? s.length : e; continue; }
    if (two === '/*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 2; cur += ' '; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < s.length && !(s[j] === c && s[j + 1] !== c)) j += s[j] === c ? 2 : 1;
      cur += s.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const dollar = /^\$[A-Za-z_]*\$/.exec(s.slice(i, i + 40));
    if (dollar) {
      const e = s.indexOf(dollar[0], i + dollar[0].length);
      const end = e < 0 ? s.length : e + dollar[0].length;
      cur += s.slice(i, end);
      i = end;
      continue;
    }
    if (c === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; i++; continue; }
    cur += c;
    i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// "public"."Users" -> users ; keeps the last part of a qualified name, without quotes, lower-cased.
export function ident(raw) {
  const parts = String(raw).trim().split('.');
  return parts[parts.length - 1].replace(/^["`[]|["`\]]$/g, '').toLowerCase();
}

const list = (raw) => splitTop(raw).map(ident).filter(Boolean);

// Splits on commas that are not inside brackets or quotes.
export function splitTop(s) {
  const out = [];
  let depth = 0, cur = '', q = null;
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function inner(stmt, from) {
  const open = stmt.indexOf('(', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < stmt.length; i++) {
    if (stmt[i] === '(') depth++;
    else if (stmt[i] === ')') { depth--; if (depth === 0) return { body: stmt.slice(open + 1, i), end: i + 1 }; }
  }
  return null;
}

const NAME = String.raw`((?:"[^"]+"|\`[^\`]+\`|\[[^\]]+\]|[\w$]+)(?:\.(?:"[^"]+"|\`[^\`]+\`|\[[^\]]+\]|[\w$]+))*)`;

function emptyTable(name) {
  return { name, columns: new Map(), primaryKey: [], uniques: [], foreignKeys: [], indexes: [], rls: false, policies: 0 };
}

function constraint(table, text) {
  const t = text.replace(/^constraint\s+\S+\s+/i, '');
  let m;
  if ((m = /^primary\s+key\s*\(([^)]*)\)/i.exec(t))) table.primaryKey = list(m[1]);
  else if ((m = /^unique\s*(?:nulls\s+(?:not\s+)?distinct\s*)?\(([^)]*)\)/i.exec(t))) table.uniques.push(list(m[1]));
  else if ((m = new RegExp(String.raw`^foreign\s+key\s*\(([^)]*)\)\s*references\s+${NAME}\s*(?:\(([^)]*)\))?`, 'i').exec(t))) {
    table.foreignKeys.push({ columns: list(m[1]), table: ident(m[2]), refColumns: m[3] ? list(m[3]) : [] });
  } else return false;
  return true;
}

export function parseSchema(sql) {
  const tables = new Map();
  const unread = [];
  const get = (name) => {
    if (!tables.has(name)) tables.set(name, emptyTable(name));
    return tables.get(name);
  };
  for (const stmt of statements(sql)) {
    let m;
    if ((m = new RegExp(String.raw`^create\s+(?:(?:global|local)\s+)?(?:temp(?:orary)?\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?${NAME}`, 'i').exec(stmt))) {
      const table = get(ident(m[1]));
      const body = inner(stmt, m.index + m[0].length);
      if (!body) { unread.push(stmt.slice(0, 80)); continue; }
      for (const part of splitTop(body.body)) {
        if (/^(constraint\s|primary\s+key|unique\b|foreign\s+key|check\b|exclude\b)/i.test(part)) {
          if (!constraint(table, part) && !/^(constraint\s+\S+\s+)?(check|exclude)\b/i.test(part)) unread.push(part.slice(0, 80));
          continue;
        }
        if (/^like\s/i.test(part)) { unread.push(part.slice(0, 80)); continue; }
        const cm = /^("[^"]+"|`[^`]+`|\[[^\]]+\]|[\w$]+)\s+(.*)$/s.exec(part);
        if (!cm) { unread.push(part.slice(0, 80)); continue; }
        const col = ident(cm[1]);
        const rest = cm[2];
        table.columns.set(col, { notNull: /\bnot\s+null\b/i.test(rest) || /\bprimary\s+key\b/i.test(rest) });
        if (/\bprimary\s+key\b/i.test(rest)) table.primaryKey = [col];
        if (/\bunique\b/i.test(rest)) table.uniques.push([col]);
        const ref = new RegExp(String.raw`\breferences\s+${NAME}\s*(?:\(([^)]*)\))?`, 'i').exec(rest);
        if (ref) table.foreignKeys.push({ columns: [col], table: ident(ref[1]), refColumns: ref[2] ? list(ref[2]) : [] });
      }
    } else if ((m = new RegExp(String.raw`^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${NAME}\s+(.*)$`, 'is').exec(stmt))) {
      const table = get(ident(m[1]));
      const action = m[2].trim();
      if (/^enable\s+row\s+level\s+security/i.test(action)) table.rls = true;
      else if (/^force\s+row\s+level\s+security/i.test(action)) table.rls = true;
      else if (/^add\s+/i.test(action)) {
        const what = action.replace(/^add\s+/i, '');
        if (!constraint(table, what)) {
          const col = /^(?:column\s+)?(?:if\s+not\s+exists\s+)?("[^"]+"|[\w$]+)\s+(.*)$/is.exec(what);
          if (col && !/^constraint\b/i.test(what)) table.columns.set(ident(col[1]), { notNull: /\bnot\s+null\b/i.test(col[2]) });
          else unread.push(stmt.slice(0, 80));
        }
      } else if ((m = /^alter\s+(?:column\s+)?("[^"]+"|[\w$]+)\s+set\s+not\s+null/i.exec(action))) {
        const c = table.columns.get(ident(m[1]));
        if (c) c.notNull = true;
      } else unread.push(stmt.slice(0, 80));
    } else if ((m = new RegExp(String.raw`^create\s+(unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(?:${NAME}\s+)?on\s+(?:only\s+)?${NAME}\s*(?:using\s+\w+\s*)?`, 'i').exec(stmt))) {
      const table = get(ident(m[3]));
      const body = inner(stmt, m.index + m[0].length - 1);
      if (!body) { unread.push(stmt.slice(0, 80)); continue; }
      const cols = splitTop(body.body).map((c) => ident(c.split(/\s+/)[0]));
      table.indexes.push(cols);
      if (m[1] && !/\swhere\s/i.test(stmt.slice(body.end))) table.uniques.push(cols);
    } else if ((m = new RegExp(String.raw`^create\s+policy\s+\S+\s+on\s+${NAME}`, 'i').exec(stmt))) {
      get(ident(m[1])).policies++;
    } else if (/^(create\s+(extension|schema|type|sequence|function|procedure|trigger|view|materialized|domain|role)|comment\s|grant\s|revoke\s|set\s|begin|commit|insert\s|drop\s|select\s|do\s)/i.test(stmt)) {
      // not about tenancy: skipped on purpose
    } else unread.push(stmt.slice(0, 80));
  }
  return { tables: [...tables.values()], unread };
}
