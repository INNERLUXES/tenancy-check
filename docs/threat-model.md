# Threat model

The tool reads the schema of a product that holds many customers' data, and prints findings that decide what is fixed before release. The risks are a missed way for customers' data to mix, a part of the schema silently not checked, and the schema going where it should not.

| Threat | Response |
|---|---|
| A table without a tenant column is overlooked | Every table is a tenant table unless named global on the command line. |
| A row can reference another customer's row | Foreign keys between tenant tables without the tenant column are reported. |
| A unique rule leaks that a value exists in another customer | Unique rules without the tenant column are reported. |
| A statement the reader cannot parse hides a problem | It is listed as not understood, in every format. |
| The tool is given database credentials | It never connects to a database; it reads a file. |
| A table name runs as a formula when the CSV is opened | Cells that start with a formula character are prefixed with an apostrophe. |
| The schema leaves the machine | The tool opens no network connection and writes a file only when `--output` is given. |

## Outside this model

- The application's queries; docs/limits.md says why.
- A modified copy of the tool. Install from a release and check the attestation and checksums.
