# 1. Every table is a tenant table unless named global

## Context

A tool could guess which tables are shared, such as `countries` or `plans`, from their names. A wrong guess on a table that does hold customer data would hide exactly the problem the tool exists to find.

## Decision

- Every table is checked as a tenant table. Shared tables are named with `--global`, and the table of tenants with `--tenant-table`.
- The report lists the global tables, so the list itself can be reviewed.

## Consequences

- The first run reports shared tables as missing a tenant column until they are named. Naming them is a short, useful review.
