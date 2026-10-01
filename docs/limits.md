# What a schema check cannot see

- **The queries.** A perfect schema still leaks when the application forgets the tenant filter in one query. Row level security catches that in PostgreSQL; elsewhere, test it: query as one customer and expect none of another's rows.
- **Policies' content.** The tool counts row level security policies; it does not judge whether each policy compares the right column with the right setting.
- **Other kinds of isolation.** A schema per tenant or a database per tenant keeps data apart without a tenant column; run the tool on one tenant's schema with `--skip tenant-column,not-null,unique,foreign-key,index`, or not at all.
- **SQL it does not read.** Vendor-specific syntax outside the list in docs/checks.md is reported as not understood rather than guessed.
