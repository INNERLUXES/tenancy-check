// The checks. docs/checks.md says the same in words; a change here changes that page too.
// Each finding: { check, level, table, message }. Levels: problem, warning, info.

export const CHECKS = ['tenant-column', 'not-null', 'unique', 'foreign-key', 'index', 'row-security'];

const has = (cols, c) => cols.includes(c);
const f = (check, level, table, message) => ({ check, level, table, message });

export function review(schema, { tenant = 'tenant_id', global = [], tenantTable = '', postgres = true, skip = [] } = {}) {
  const globals = new Set(global.map((g) => g.toLowerCase()));
  if (tenantTable) globals.add(tenantTable.toLowerCase());
  const owned = schema.tables.filter((t) => !globals.has(t.name));
  const isOwned = new Set(owned.map((t) => t.name));
  const findings = [];
  const run = (name, fn) => { if (!skip.includes(name)) fn(); };

  run('tenant-column', () => {
    for (const t of owned) if (!t.columns.has(tenant)) findings.push(f('tenant-column', 'problem', t.name, `no ${tenant} column: every row belongs to no customer, or to all of them; list it with --global if it is shared on purpose`));
  });
  const withTenant = owned.filter((t) => t.columns.has(tenant));
  run('not-null', () => {
    for (const t of withTenant) if (!t.columns.get(tenant).notNull) findings.push(f('not-null', 'problem', t.name, `${tenant} can be empty: a row without a customer is visible to queries that forget the filter`));
  });
  run('unique', () => {
    for (const t of withTenant) {
      for (const u of t.uniques) {
        if (u.length && !has(u, tenant) && !(u.length === 1 && t.primaryKey.length === 1 && u[0] === t.primaryKey[0])) {
          findings.push(f('unique', 'warning', t.name, `unique (${u.join(', ')}) is unique across all customers: one customer can block another's value and learn it exists; add ${tenant} unless that is intended`));
        }
      }
    }
  });
  run('foreign-key', () => {
    for (const t of withTenant) {
      for (const fk of t.foreignKeys) {
        if (!isOwned.has(fk.table)) continue;
        if (!has(fk.columns, tenant)) findings.push(f('foreign-key', 'warning', t.name, `foreign key (${fk.columns.join(', ')}) to ${fk.table} does not include ${tenant}: a row can point to another customer's row; use a composite key (${tenant}, ${fk.columns.join(', ')})`));
      }
    }
  });
  run('index', () => {
    for (const t of withTenant) {
      const leads = [t.primaryKey, ...t.indexes, ...t.uniques].some((cols) => cols[0] === tenant);
      if (!leads) findings.push(f('index', 'warning', t.name, `no index starts with ${tenant}: every per-customer query reads the whole table as it grows`));
    }
  });
  run('row-security', () => {
    if (!postgres) return;
    for (const t of withTenant) {
      if (!t.rls) findings.push(f('row-security', 'info', t.name, 'row level security is not enabled: the database will not stop a query that forgets the tenant filter'));
      else if (!t.policies) findings.push(f('row-security', 'problem', t.name, 'row level security is enabled with no policy: the table denies every row to normal users'));
    }
  });

  return {
    tenant,
    tables: schema.tables.length,
    global: schema.tables.filter((t) => globals.has(t.name)).map((t) => t.name),
    checked: CHECKS.filter((c) => !skip.includes(c) && !(c === 'row-security' && !postgres)),
    skipped: CHECKS.filter((c) => skip.includes(c) || (c === 'row-security' && !postgres)),
    findings,
    unread: schema.unread
  };
}

export function count(result, level) {
  return result.findings.filter((x) => x.level === level).length;
}
