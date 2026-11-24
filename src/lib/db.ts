import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const now = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

// Append new migrations to the end. Never edit one that has shipped.
const MIGRATIONS = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (${now})
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE api_tokens (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (${now}),
    last_used_at TEXT
  );
  CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    color TEXT NOT NULL,
    UNIQUE (user_id, name)
  );
  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    quadrant INTEGER CHECK (quadrant BETWEEN 1 AND 4),
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done','dropped')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
    area TEXT NOT NULL DEFAULT 'personal' CHECK (area IN ('work','personal')),
    due_date TEXT,
    repeat TEXT CHECK (repeat IN ('daily','weekly','monthly','yearly')),
    repeated_from INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    created_by TEXT NOT NULL DEFAULT 'user' CHECK (created_by IN ('user','agent')),
    created_at TEXT NOT NULL DEFAULT (${now}),
    updated_at TEXT NOT NULL DEFAULT (${now}),
    started_at TEXT,
    completed_at TEXT,
    deleted_at TEXT
  );
  CREATE INDEX tasks_user_status ON tasks (user_id, status, completed_at);
  CREATE INDEX tasks_repeated_from ON tasks (repeated_from);
  CREATE TABLE task_tags (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
  );
  CREATE TABLE activity (
    id INTEGER PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    actor_kind TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    changes TEXT,
    at TEXT NOT NULL DEFAULT (${now})
  );
  CREATE INDEX activity_task ON activity (task_id);
  `,
  // Quadrant colours and depth as JSON; null means the defaults in lib/colours.ts.
  `ALTER TABLE users ADD COLUMN colours TEXT;`,
  // Areas become a per-person list. Existing work/personal tasks move to the matching new rows.
  `
  CREATE TABLE areas (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, name)
  );
  INSERT INTO areas (user_id, name, position) SELECT id, 'Work', 0 FROM users;
  INSERT INTO areas (user_id, name, position) SELECT id, 'Personal', 1 FROM users;
  ALTER TABLE tasks ADD COLUMN area_id INTEGER REFERENCES areas(id);
  UPDATE tasks SET area_id = (
    SELECT a.id FROM areas a WHERE a.user_id = tasks.user_id AND a.name = CASE tasks.area WHEN 'work' THEN 'Work' ELSE 'Personal' END
  );
  ALTER TABLE tasks DROP COLUMN area;
  CREATE INDEX tasks_area ON tasks (area_id);
  `,
];

function open() {
  const file = process.env.ODOT_DB_PATH ?? path.join(process.cwd(), "data", "odot.db");
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return db;
}

const g = globalThis as unknown as { odotDb?: DatabaseSync };

/** Opened on first use, so `next build` never creates a database file. */
export function db() {
  return (g.odotDb ??= open());
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export const nowISO = () => new Date().toISOString();

/** An error whose message is safe to show to the user or the agent. */
export class UserError extends Error {}
