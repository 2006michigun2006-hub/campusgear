-- CampusGear core schema: Asset, Account, Reservation (+ sessions).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE accounts (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'staff')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_account_idx ON sessions(account_id);

CREATE TABLE assets (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL,
  condition          TEXT NOT NULL,
  pickup_location    TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'unavailable')),
  unavailable_reason TEXT,          -- staff-only (US-08)
  public_notice      TEXT,          -- shown to students
  status_changed_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX assets_type_idx ON assets(type);

CREATE TABLE reservations (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_id         TEXT NOT NULL REFERENCES assets(id),
  account_id       INTEGER NOT NULL REFERENCES accounts(id),
  start_at         TIMESTAMPTZ NOT NULL,
  planned_end_at   TIMESTAMPTZ NOT NULL,   -- original end, preserved on early/late return (US-07)
  status           TEXT NOT NULL CHECK (status IN ('confirmed', 'checked_out', 'returned', 'cancelled')),
  idempotency_key  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at   TIMESTAMPTZ,
  checked_out_by   INTEGER REFERENCES accounts(id),
  returned_at      TIMESTAMPTZ,
  returned_by      INTEGER REFERENCES accounts(id),
  cancelled_at     TIMESTAMPTZ,
  cancelled_by     INTEGER REFERENCES accounts(id),
  CHECK (planned_end_at > start_at),
  -- G2 / US-04: the database itself refuses overlapping active intervals for one asset.
  -- Cancelled and returned reservations drop out, which reopens their time.
  CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
    asset_id WITH =,
    tstzrange(start_at, planned_end_at, '[)') WITH &&
  ) WHERE (status IN ('confirmed', 'checked_out'))
);

-- At most one active reservation per asset/student.
CREATE UNIQUE INDEX reservations_one_active_per_student
  ON reservations(asset_id, account_id) WHERE status IN ('confirmed', 'checked_out');
-- US-11: a retried request with the same key never creates a second booking.
CREATE UNIQUE INDEX reservations_idempotency
  ON reservations(account_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX reservations_account_idx ON reservations(account_id, status);
CREATE INDEX reservations_status_start_idx ON reservations(status, start_at);
