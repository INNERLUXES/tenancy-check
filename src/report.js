// The review in four formats. Every format carries the same facts: skipped checks and statements the reader did not
// understand are never left out of one of them.

import { CHECKS, count } from './checks.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const LEVELS = ['problem', 'warning', 'info'];

function summary(r) {
  return `Tenancy check (tenant column ${r.tenant}): ${plural(r.tables, 'table')}, ${r.global.length} global, `
    + `${plural(count(r, 'problem'), 'problem')}, ${plural(count(r, 'warning'), 'warning')}`;
}

function notes(r) {
  const out = [];
  if (r.global.length) out.push(`Global tables, shared by all customers on purpose: ${r.global.join(', ')}`);
  if (r.skipped.length) out.push(`Not checked: ${r.skipped.join(', ')}`);
  if (r.unread.length) out.push(`Statements not understood, so not checked (${r.unread.length}): ${r.unread.slice(0, 10).map((s) => s.replace(/\s+/g, ' ')).join(' | ')}${r.unread.length > 10 ? ' | ...' : ''}`);
  return out;
}

export function toText(r) {
  const lines = [summary(r), ''];
  for (const c of CHECKS.filter((x) => r.checked.includes(x))) {
    const items = r.findings.filter((x) => x.check === c).sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
    lines.push(`${c}: ${items.length ? plural(items.length, 'finding') : 'none found'}`);
    for (const x of items) lines.push(`  ${x.level.padEnd(7)}  ${x.table}  ${x.message}`);
  }
  const n = notes(r);
  if (n.length) lines.push('', ...n);
  return lines.join('\n');
}

const md = (s) => String(s).replace(/[|\\`*_[\]<>]/g, (c) => `\\${c}`);

export function toMarkdown(r) {
  const lines = ['# Tenancy check', '', md(summary(r)), '', '| Check | Level | Table | Finding |', '|---|---|---|---|'];
  for (const x of r.findings) lines.push(`| ${x.check} | ${x.level} | ${md(x.table)} | ${md(x.message)} |`);
  const n = notes(r);
  if (n.length) lines.push('', '## Notes', '', ...n.map((x) => `- ${md(x)}`));
  return lines.join('\n');
}

export function toJson(r) {
  return JSON.stringify({ ...r, counts: Object.fromEntries(LEVELS.map((l) => [l, count(r, l)])), notes: notes(r) }, null, 2);
}

const cell = (v) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(r) {
  const out = ['check,level,table,message'];
  for (const x of r.findings) out.push([x.check, x.level, x.table, x.message].map(cell).join(','));
  for (const c of r.skipped) out.push([c, 'not checked', '', 'skipped'].map(cell).join(','));
  for (const u of r.unread) out.push(['reader', 'not checked', '', `not understood: ${u.replace(/\s+/g, ' ')}`].map(cell).join(','));
  return out.join('\n');
}
