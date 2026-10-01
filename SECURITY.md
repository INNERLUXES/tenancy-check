# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "tenancy-check security", or use private vulnerability reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up schema that shows the problem, what you expected and what happened.

## Scope

In scope:

- a schema where a table that can mix customers' data passes without a finding
- a schema that makes the tool hang or use unbounded memory
- a CSV report that runs as a formula when opened in a spreadsheet
- anything that makes the tool open a network connection, or read or write a file it was not given

Out of scope: what the application does with the schema; docs/limits.md lists what a schema check cannot see.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
