// Command line: tenancy-check <schema.sql> [--tenant tenant_id] [--global a,b] [--tenant-table tenants] [--no-postgres]
//               [--skip check,check] [--format text|markdown|json|csv] [--output file] [--fail-on problem|warning]

import { readFile, writeFile } from 'node:fs/promises';
import { parseSchema } from './schema.js';
import { review, count, CHECKS } from './checks.js';
import { toText, toMarkdown, toJson, toCsv } from './report.js';

export const USAGE = `tenancy-check <schema.sql> [options]

Reads the SQL schema of a multi-tenant SaaS product and checks that every customer's data can be kept apart: the tenant
column on every table, never empty, in unique rules, in foreign keys and at the start of an index, and PostgreSQL row level
security with its policies. It reads the file you give it and fetches nothing.

Options
  --tenant <column>       the tenant column (default tenant_id)
  --global <list>         tables shared by all customers on purpose, comma separated (plans, countries...)
  --tenant-table <name>   the table of tenants itself, treated as global
  --no-postgres           skip the row level security check for other databases
  --skip <list>           checks to leave out: ${CHECKS.join(', ')}
  --format <f>            text (default), markdown, json or csv
  --output <file>         write the report to a file
  --fail-on <level>       exit 1 when there is a finding at this level or above: problem or warning
  --help                  this text

Exit codes: 0 done, 1 findings with --fail-on, 2 wrong usage or invalid input.`;

const list = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);

export function parseArgs(argv) {
  const o = { format: 'text', tenant: 'tenant_id', global: [], tenantTable: '', postgres: true, skip: [] };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { o.help = true; continue; }
    if (a === '--no-postgres') { o.postgres = false; continue; }
    if (!a.startsWith('--')) { files.push(a); continue; }
    if (!['--tenant', '--global', '--tenant-table', '--skip', '--format', '--output', '--fail-on'].includes(a)) throw new Error(`unknown option: ${a}`);
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`${a} needs a value`);
    const v = argv[++i];
    if (a === '--global') o.global = list(v);
    else if (a === '--skip') o.skip = list(v);
    else if (a === '--tenant-table') o.tenantTable = v.trim();
    else if (a === '--fail-on') o.failOn = v;
    else if (a === '--tenant') o.tenant = v.trim().toLowerCase();
    else o[a.slice(2)] = v;
  }
  if (o.help) return o;
  if (files.length !== 1) throw new Error('give exactly one schema file');
  o.file = files[0];
  if (!/^[a-z_][a-z0-9_$]*$/.test(o.tenant)) throw new Error(`--tenant must be a column name, not "${o.tenant}"`);
  if (!['text', 'markdown', 'json', 'csv'].includes(o.format)) throw new Error(`unknown format: ${o.format}`);
  const bad = o.skip.filter((c) => !CHECKS.includes(c));
  if (bad.length) throw new Error(`unknown check(s) in --skip: ${bad.join(', ')}`);
  if (o.failOn !== undefined && !['problem', 'warning'].includes(o.failOn)) throw new Error('--fail-on takes problem or warning');
  return o;
}

export async function main(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  let o, result;
  try {
    o = parseArgs(argv);
    if (o.help) { stdout.write(`${USAGE}\n`); return 0; }
    let text;
    try {
      text = await readFile(o.file, 'utf8');
    } catch (err) {
      throw new Error(`cannot read ${o.file}: ${err.message}`);
    }
    const schema = parseSchema(text);
    if (!schema.tables.length) throw new Error(`${o.file}: no CREATE TABLE found`);
    result = review(schema, o);
  } catch (err) {
    stderr.write(`${err.message}\n\n${USAGE}\n`);
    return 2;
  }
  const out = o.format === 'json' ? toJson(result) : o.format === 'csv' ? toCsv(result)
    : o.format === 'markdown' ? toMarkdown(result) : toText(result);
  if (o.output) await writeFile(o.output, `${out}\n`);
  else stdout.write(`${out}\n`);
  if (o.failOn) {
    const n = count(result, 'problem') + (o.failOn === 'warning' ? count(result, 'warning') : 0);
    if (n) {
      stderr.write(`${n} finding(s) at ${o.failOn} level or above\n`);
      return 1;
    }
  }
  return 0;
}
