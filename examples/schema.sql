-- A made-up project tracker sold as SaaS. Shows what tenancy-check reports; not a recommended design.
CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE plans (
  id text PRIMARY KEY,
  monthly_price numeric NOT NULL
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  email text NOT NULL UNIQUE,
  role text NOT NULL
);

CREATE TABLE projects (
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  id uuid NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, name)
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants (id),
  project_id uuid NOT NULL,
  assignee_id uuid REFERENCES users (id),
  title text NOT NULL,
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects (tenant_id, id)
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_tenant ON users (tenant_id, email);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_by_tenant ON projects USING (tenant_id = current_setting('app.tenant_id')::uuid);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
