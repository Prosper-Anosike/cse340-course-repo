-- Week 06 additive migration: volunteer-project registrations.
-- Safe to run on existing databases without replacing prior data.

BEGIN;

CREATE TABLE IF NOT EXISTS project_volunteer (
  user_id INTEGER NOT NULL
    REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  project_id INTEGER NOT NULL
    REFERENCES project (project_id) ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS project_volunteer_project_id_idx
  ON project_volunteer (project_id);

COMMIT;
