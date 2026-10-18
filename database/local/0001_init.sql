-- 0001_init — the dictation history (spec historico §9, spec historico-dados-v1 §6.6).
-- Only the text of dictations that ended with text: never audio, never the focused app, never the clipboard.
-- Applied by frontend/src/main/history/migrations.ts inside a transaction; never edited once applied.
CREATE TABLE dictations (
  id          TEXT PRIMARY KEY,                                    -- sessionId (UUID v4)
  created_at  TEXT NOT NULL,                                       -- ISO-8601 UTC, with ms
  text        TEXT NOT NULL CHECK (length(text) > 0),
  audio_ms    INTEGER NOT NULL CHECK (audio_ms >= 0),
  status      TEXT NOT NULL CHECK (status IN ('inserted', 'copied', 'failed'))
);

CREATE INDEX idx_dictations_created_at ON dictations (created_at DESC, id DESC);
