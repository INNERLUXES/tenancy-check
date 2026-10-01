import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSchema, review, count } from '../src/index.js';

const at = (r, check) => r.findings.filter((f) => f.check === check).map((f) => `${f.level} ${f.table}`);

test('tenant column: missing is a problem unless the table is global or the tenants table', () => {
  const s = parseSchema('CREATE TABLE tenants (id int PRIMARY KEY); CREATE TABLE plans (id int PRIMARY KEY); CREATE TABLE notes (id int PRIMARY KEY);');
  assert.deepEqual(at(review(s, { tenantTable: 'tenants', global: ['plans'] }), 'tenant-column'), ['problem notes']);
  assert.deepEqual(at(review(s, { tenantTable: 'tenants', global: ['PLANS', 'notes'] }), 'tenant-column'), []);
});

test('a different tenant column name', () => {
  const s = parseSchema('CREATE TABLE a (org_id int NOT NULL, id int, PRIMARY KEY (org_id, id));');
  assert.equal(count(review(s, { tenant: 'org_id', postgres: false }), 'problem'), 0);
  assert.deepEqual(at(review(s), 'tenant-column'), ['problem a']);
});

test('not null, unique, index', () => {
  const s = parseSchema(`
    CREATE TABLE a (tenant_id int, id int PRIMARY KEY, email text UNIQUE);
    CREATE TABLE b (tenant_id int NOT NULL, id int, email text, PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, email));
    CREATE TABLE c (tenant_id int NOT NULL, id int PRIMARY KEY);
    CREATE INDEX c_t ON c (tenant_id);`);
  const r = review(s, { postgres: false });
  assert.deepEqual(at(r, 'not-null'), ['problem a']);
  assert.deepEqual(at(r, 'unique'), ['warning a']);
  assert.deepEqual(at(r, 'index'), ['warning a']);
});

test('foreign keys between tenant tables must carry the tenant column', () => {
  const s = parseSchema(`
    CREATE TABLE tenants (id int PRIMARY KEY);
    CREATE TABLE p (tenant_id int NOT NULL REFERENCES tenants(id), id int, PRIMARY KEY (tenant_id, id));
    CREATE TABLE t (tenant_id int NOT NULL, id int, p_id int REFERENCES p(id), q_id int, PRIMARY KEY (tenant_id, id),
      FOREIGN KEY (tenant_id, q_id) REFERENCES p (tenant_id, id));`);
  const r = review(s, { tenantTable: 'tenants', postgres: false });
  assert.deepEqual(at(r, 'foreign-key'), ['warning t']);
  assert.match(r.findings.find((f) => f.check === 'foreign-key').message, /\(p_id\) to p/);
});

test('row level security: off is info, on without a policy is a problem, --no-postgres skips it', () => {
  const s = parseSchema(`
    CREATE TABLE a (tenant_id int NOT NULL, id int, PRIMARY KEY (tenant_id, id));
    CREATE TABLE b (tenant_id int NOT NULL, id int, PRIMARY KEY (tenant_id, id));
    CREATE TABLE c (tenant_id int NOT NULL, id int, PRIMARY KEY (tenant_id, id));
    ALTER TABLE b ENABLE ROW LEVEL SECURITY;
    ALTER TABLE c ENABLE ROW LEVEL SECURITY; CREATE POLICY pc ON c USING (true);`);
  assert.deepEqual(at(review(s), 'row-security'), ['info a', 'problem b']);
  const r = review(s, { postgres: false });
  assert.deepEqual(at(r, 'row-security'), []);
  assert.deepEqual(r.skipped, ['row-security']);
});

test('skip leaves a check out and says so', () => {
  const s = parseSchema('CREATE TABLE a (id int PRIMARY KEY);');
  const r = review(s, { skip: ['tenant-column'] });
  assert.deepEqual(r.findings, []);
  assert.ok(r.skipped.includes('tenant-column'));
});
