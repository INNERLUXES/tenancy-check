import test from 'node:test';
import assert from 'node:assert/strict';
import { statements, ident, splitTop, parseSchema } from '../src/index.js';

const table = (s, name) => s.tables.find((t) => t.name === name);

test('statements: comments, quotes and dollar blocks do not split', () => {
  const sql = "-- a; comment\nCREATE TABLE a (x text DEFAULT 'a;b'); /* b; */ CREATE FUNCTION f() RETURNS int AS $$ SELECT 1; $$ LANGUAGE sql; SELECT 1";
  const st = statements(sql);
  assert.equal(st.length, 3);
  assert.match(st[0], /DEFAULT 'a;b'/);
  assert.match(st[1], /\$\$ SELECT 1; \$\$/);
});

test('ident and splitTop', () => {
  assert.equal(ident('public."Users"'), 'users');
  assert.equal(ident('`Orders`'), 'orders');
  assert.deepEqual(splitTop("a int, b numeric(10,2), c text DEFAULT 'x,y'"), ['a int', 'b numeric(10,2)', "c text DEFAULT 'x,y'"]);
});

test('parseSchema: columns, keys, uniques, references, indexes, row level security', () => {
  const s = parseSchema(`
    CREATE TABLE IF NOT EXISTS public.orders (
      tenant_id uuid NOT NULL,
      id uuid,
      customer_id uuid REFERENCES customers(id),
      code text UNIQUE,
      CONSTRAINT pk PRIMARY KEY (tenant_id, id),
      CONSTRAINT u UNIQUE (tenant_id, code),
      FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id),
      CHECK (code <> '')
    );
    ALTER TABLE ONLY orders ADD COLUMN note text NOT NULL;
    ALTER TABLE orders ADD CONSTRAINT fk2 FOREIGN KEY (tenant_id, note) REFERENCES notes (tenant_id, id);
    CREATE UNIQUE INDEX IF NOT EXISTS o_code ON orders USING btree (tenant_id, lower(code));
    CREATE INDEX o_partial ON orders (code) WHERE code IS NOT NULL;
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    CREATE POLICY p ON orders USING (true);
    CREATE EXTENSION pgcrypto;
    VACUUM orders;
  `);
  const o = table(s, 'orders');
  assert.deepEqual([...o.columns.keys()], ['tenant_id', 'id', 'customer_id', 'code', 'note']);
  assert.equal(o.columns.get('tenant_id').notNull, true);
  assert.equal(o.columns.get('note').notNull, true);
  assert.deepEqual(o.primaryKey, ['tenant_id', 'id']);
  assert.deepEqual(o.uniques, [['code'], ['tenant_id', 'code'], ['tenant_id', 'lower(code)']]);
  assert.deepEqual(o.foreignKeys.map((f) => [f.columns.join('+'), f.table]), [['customer_id', 'customers'], ['tenant_id+customer_id', 'customers'], ['tenant_id+note', 'notes']]);
  assert.equal(o.indexes.length, 2);
  assert.equal(o.rls, true);
  assert.equal(o.policies, 1);
  assert.deepEqual(s.unread, ['VACUUM orders']);
});
