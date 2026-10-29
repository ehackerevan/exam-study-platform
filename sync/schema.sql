CREATE TABLE IF NOT EXISTS sync_accounts (id TEXT PRIMARY KEY, lookup TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, verifier TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sync_sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sync_sessions_expiry ON sync_sessions(expires);
CREATE TABLE IF NOT EXISTS sync_progress (account_id TEXT NOT NULL, course TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(account_id, course)) WITHOUT ROWID;
