-- US-03: single-use email sign-in links. Only a SHA-256 hash of the token is stored.
CREATE TABLE login_links (
  token_hash  TEXT PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
CREATE INDEX login_links_account_idx ON login_links(account_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);
