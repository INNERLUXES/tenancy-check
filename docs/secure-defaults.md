# Secure defaults

| Setting | Default | Why |
|---|---|---|
| Every table | A tenant table, unless named global | A table forgotten in a list must be checked, not skipped. |
| Statements not understood | Listed in every format | A part of the schema that was not read must never look clean. |
| Row level security off | Reported (info) on PostgreSQL | It is the database's own guard against a missing filter. |
| Database connection | Never made | The tool reads a schema file; it never needs credentials. |
| Exit code | 0, unless `--fail-on` is given | The tool reports by default; a pipeline decides whether findings block it. |
| CSV cells | Formula characters prefixed with an apostrophe | Table names are free text and must not run in a spreadsheet. |
| Network | Never used | A schema describes a product's data and stays on the machine. |
| Output | Terminal | Nothing is written to disk unless `--output` is given. |
