# Changes

## 1.0.0

First release.

- Six checks on a SQL schema: tenant column on every table, never empty, in unique rules, in foreign keys between tenant tables, at the start of an index, and PostgreSQL row level security with policies.
- Global tables and the tenants table named on the command line; any tenant column name.
- Statements the reader does not understand are listed in every format.
- Reports as text, Markdown, JSON and CSV; `--fail-on problem|warning` for use in a pipeline.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation.
