# 2. A schema file, not a database connection

## Context

Reading the schema from a live database would always be current, but it needs credentials, a network path to the database, and drivers for every engine.

## Decision

- The tool reads SQL DDL from a file: a migration folder concatenated, or the output of a schema dump.
- It never connects to a database and never asks for credentials.

## Consequences

- It runs in any pipeline with no secrets. The schema must be dumped or concatenated first; docs/checks.md lists the statements it reads.
