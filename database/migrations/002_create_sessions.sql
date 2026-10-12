BEGIN;

-- ============================================================================
-- Session table for express-session with connect-pg-simple.
-- Stores server-side sessions in PostgreSQL so sessions survive server
-- restarts and can be inspected/revoked. Column names and types must
-- match what connect-pg-simple expects.
-- ============================================================================
CREATE TABLE session (
    sid varchar(255) NOT NULL PRIMARY KEY,  -- session id (random, from express-session)
    sess json NOT NULL,                     -- session data (e.g. { userId: 1 })
    expire timestamp(6) NOT NULL            -- when the session expires (used for cleanup)
);

-- Index so the store can quickly find expired sessions to delete.
CREATE INDEX idx_session_expire ON session (expire);

COMMENT ON TABLE session IS 'Server-side HTTP sessions managed by connect-pg-simple.';

COMMIT;