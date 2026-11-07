-- The Common Sense: initial schema (spec v0.1, six tables).
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  disclosure_accepted_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,            -- SHA-256 of the cookie token; the raw token is never stored
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE situations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'answered', 'analyzed')),
  bank_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX situations_user_created ON situations(user_id, created_at DESC);

CREATE TABLE answers (
  id TEXT PRIMARY KEY,
  situation_id TEXT NOT NULL REFERENCES situations(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  value TEXT NOT NULL,
  note TEXT,
  UNIQUE (situation_id, question_id)
);

CREATE TABLE results (
  id TEXT PRIMARY KEY,
  situation_id TEXT NOT NULL UNIQUE REFERENCES situations(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,             -- YYYY-MM-DD in Asia/Manila
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
