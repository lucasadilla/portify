-- Reference schema (PostgreSQL) mirroring the Visual SQL Agent in-memory SQLite model.
-- Runtime queries use sql.js per request; this documents the intended relational shape.

-- Users (portfolio owner / GitHub identity)
CREATE TABLE IF NOT EXISTS agent_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL
);

-- Repositories
CREATE TABLE IF NOT EXISTS agent_repos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT '',
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  last_commit_date DATE
);

-- Commits (synthetic monthly rows derived from cached commit history)
CREATE TABLE IF NOT EXISTS agent_commits (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES agent_repos(id),
  date DATE NOT NULL,
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0
);
