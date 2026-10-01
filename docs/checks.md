# The checks

A table is a tenant table unless it is named with `--global` or `--tenant-table`. The tenant column is `tenant_id` unless `--tenant` names another.

| Check | Level | Finding |
|---|---|---|
| `tenant-column` | problem | A tenant table has no tenant column. Its rows belong to no customer, or to all of them. |
| `not-null` | problem | The tenant column can be empty. A row without a customer shows up in every query that forgets the filter. |
| `unique` | warning | A unique rule (a constraint or a unique index without a `WHERE`) does not include the tenant column. One customer can block a value for everyone else, and learn that it exists. A primary key on its own is not reported. |
| `foreign-key` | warning | A foreign key from one tenant table to another does not include the tenant column. A row can point to another customer's row; a composite key `(tenant_id, x)` prevents it. Keys to global tables are not reported. |
| `index` | warning | No index, primary key or unique rule starts with the tenant column. Every query for one customer reads the whole table as it grows. |
| `row-security` | info | PostgreSQL row level security is not enabled on a tenant table, so the database does not stop a query that forgets the tenant filter. Skipped with `--no-postgres`. |
| `row-security` | problem | Row level security is enabled but the table has no policy, so normal users see no rows at all. |

## What the reader understands

`CREATE TABLE` (columns, inline and table constraints), `ALTER TABLE ... ADD COLUMN / ADD CONSTRAINT / ALTER COLUMN ... SET NOT NULL / ENABLE ROW LEVEL SECURITY`, `CREATE [UNIQUE] INDEX` and `CREATE POLICY`. Statements that do not shape tenancy (`CREATE EXTENSION`, `CREATE FUNCTION`, `INSERT`, `GRANT` and similar) are skipped on purpose. Anything else is listed as "not understood, so not checked".
