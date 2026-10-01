import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSchema, review, toText, toMarkdown, toJson, toCsv, parseArgs, main } from '../src/index.js';

const EX = join(fileURLToPath(import.meta.url), '..', '..', 'examples', 'schema.sql');

function sink() {
  let data = '';
  return { write(s) { data += s; }, get text() { return data; } };
}

const sample = () => review(parseSchema('CREATE TABLE "=x" (id int PRIMARY KEY); VACUUM; CREATE TABLE plans (id int);'), { global: ['plans'], postgres: false });

test('every format carries global tables, skipped checks and statements not understood', () => {
  const r = sample();
  for (const out of [toText(r), toMarkdown(r)]) {
    assert.match(out, /Global tables, shared by all customers on purpose: plans/);
    assert.match(out, /Not checked: row-security/);
    assert.match(out, /Statements not understood, so not checked \(1\): VACUUM/);
  }
  const j = JSON.parse(toJson(r));
  assert.deepEqual(j.counts, { problem: 1, warning: 0, info: 0 });
  assert.match(toCsv(r), /^tenant-column,problem,'=x,/m);
  assert.match(toCsv(r), /^row-security,not checked,,skipped$/m);
  assert.match(toCsv(r), /^reader,not checked,,not understood: VACUUM$/m);
});

test('parseArgs', () => {
  const o = parseArgs(['s.sql', '--tenant', 'Org_ID', '--global', 'plans, countries', '--tenant-table', 'orgs', '--no-postgres', '--fail-on', 'warning']);
  assert.equal(o.tenant, 'org_id');
  assert.deepEqual(o.global, ['plans', 'countries']);
  assert.equal(o.tenantTable, 'orgs');
  assert.equal(o.postgres, false);
  assert.throws(() => parseArgs([]), /exactly one schema file/);
  assert.throws(() => parseArgs(['s.sql', '--tenant', 'a b']), /must be a column name/);
  assert.throws(() => parseArgs(['s.sql', '--skip', 'nope']), /unknown check/);
  assert.throws(() => parseArgs(['s.sql', '--fail-on', 'info']), /problem or warning/);
  assert.throws(() => parseArgs(['s.sql', '--format', 'xml']), /unknown format/);
  assert.throws(() => parseArgs(['s.sql', '--global']), /needs a value/);
  assert.throws(() => parseArgs(['s.sql', '--nope', 'x']), /unknown option/);
  assert.equal(parseArgs(['--help']).help, true);
});

test('the example, --fail-on, --output and bad input', async (t) => {
  const args = [EX, '--tenant-table', 'tenants', '--global', 'plans'];
  const out = sink();
  assert.equal(await main(args, { stdout: out, stderr: sink() }), 0);
  assert.match(out.text, /6 tables, 2 global, 3 problems, 3 warnings/);
  assert.match(out.text, /problem  audit_log  no tenant_id column/);
  assert.match(out.text, /warning  users  unique \(email\) is unique across all customers/);
  const err = sink();
  assert.equal(await main([...args, '--fail-on', 'problem'], { stdout: sink(), stderr: err }), 1);
  assert.match(err.text, /3 finding\(s\) at problem level/);
  const d = await mkdtemp(join(tmpdir(), 'tc-'));
  t.after(() => rm(d, { recursive: true, force: true }));
  assert.equal(await main([...args, '--format', 'json', '--output', join(d, 'r.json')], { stdout: sink(), stderr: sink() }), 0);
  assert.equal(JSON.parse(await readFile(join(d, 'r.json'), 'utf8')).tables, 6);
  await writeFile(join(d, 'empty.sql'), 'SELECT 1;');
  const e2 = sink();
  assert.equal(await main([join(d, 'empty.sql')], { stdout: sink(), stderr: e2 }), 2);
  assert.match(e2.text, /no CREATE TABLE found/);
  assert.equal(await main([join(d, 'missing.sql')], { stdout: sink(), stderr: sink() }), 2);
  const help = sink();
  assert.equal(await main(['--help'], { stdout: help, stderr: sink() }), 0);
  assert.match(help.text, /Exit codes/);
});
