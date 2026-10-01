# tenancy-check

Checks the SQL schema of a multi-tenant SaaS product for the ways one customer's data could mix with another's.

In a SaaS product many customers share one database, and every table that holds their data must say whose each row is. This tool reads the schema and answers:

- Which tables have no tenant column, and which let it be empty?
- Which unique rules are unique across all customers, so one customer can block or discover another's value?
- Which foreign keys let a row point to another customer's row?
- Which tables have no index that starts with the tenant column, so per-customer queries slow down as they grow?
- On PostgreSQL, which tables lack row level security, and which have it switched on with no policy?

Plain JavaScript, no dependencies. It reads the schema file you give it, never connects to a database, and fetches nothing.

```
npm test
```

```
# tests 12
# pass 12
# fail 0
```

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/tenancy-check.git
cd tenancy-check
npm run example
```

```
Tenancy check (tenant column tenant_id): 6 tables, 2 global, 3 problems, 3 warnings

tenant-column: 1 finding
  problem  audit_log  no tenant_id column: every row belongs to no customer, or to all of them; list it with --global if it is shared on purpose
not-null: 1 finding
  problem  tasks  tenant_id can be empty: a row without a customer is visible to queries that forget the filter
unique: 1 finding
  warning  users  unique (email) is unique across all customers: one customer can block another's value and learn it exists; add tenant_id unless that is intended
foreign-key: 1 finding
  warning  tasks  foreign key (assignee_id) to users does not include tenant_id: a row can point to another customer's row; use a composite key (tenant_id, assignee_id)
index: 1 finding
  warning  tasks  no index starts with tenant_id: every per-customer query reads the whole table as it grows
row-security: 2 findings
  problem  tasks  row level security is enabled with no policy: the table denies every row to normal users
  info     users  row level security is not enabled: the database will not stop a query that forgets the tenant filter

Global tables, shared by all customers on purpose: tenants, plans
```

The project tracker in `examples/schema.sql` is made up, and written to show the findings, not as a design to copy.

## Your own schema

Give it one SQL file: a schema dump, or your migrations joined into one file.

```
node bin/tenancy-check.js schema.sql --tenant-table tenants --global plans,countries
```

[docs/checks.md](docs/checks.md) gives the exact rule behind each check and lists the SQL the reader understands.

## Options

| Option | What it does |
|---|---|
| `--tenant <column>` | The tenant column (default `tenant_id`) |
| `--global <list>` | Tables shared by all customers on purpose |
| `--tenant-table <name>` | The table of tenants itself, treated as global |
| `--no-postgres` | Leave out the row level security check on other databases |
| `--skip <list>` | Checks to leave out: tenant-column, not-null, unique, foreign-key, index, row-security |
| `--format text\|markdown\|json\|csv` | CSV has one line per finding, ready to turn into tickets |
| `--output <file>` | Write the report to a file |
| `--fail-on problem\|warning` | Exit 1 when there is a finding at that level or above |

Exit codes: 0 done, 1 findings with `--fail-on`, 2 wrong usage or invalid input.

## Rules that keep the check honest

- Every table is a tenant table unless you name it global, so a forgotten table is checked rather than skipped.
- A statement the reader does not understand is listed as not checked, in every format.
- It never connects to a database, so it never needs credentials.
- A schema cannot show what the queries do; [docs/limits.md](docs/limits.md) says what to test as well.

## As a library

```js
import { parseSchema, review, toMarkdown } from './src/index.js';

const result = review(parseSchema(sqlText), { tenant: 'tenant_id', global: ['plans'] });
console.log(toMarkdown(result));
```

## How this repository is kept

- No runtime dependencies, a committed lock file, `npm ci` in the pipeline.
- Tests on Linux, Windows and macOS with Node 22 and 24, CodeQL, and repository checks for syntax, exports, credentials and leftovers.
- Every workflow sets its token permissions and pins every action to a full commit hash; Dependabot keeps them current.
- The pipeline checks the repository against NIST SP 800-218 with [ssdf-repo-check](https://github.com/INNERLUXES/ssdf-repo-check).
- Releases come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation.
- [SECURITY.md](SECURITY.md), [threat model](docs/threat-model.md), [secure defaults](docs/secure-defaults.md), [design decisions](docs/decisions).

## Related

Built by the team behind [SaaS development services at INNERLUXES](https://innerluxes.dev/software-development/saas).

## License

MIT
