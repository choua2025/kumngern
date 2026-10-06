-- Forgot password with an emailed one-time code (OTP).
-- Expand-only: a new table, so the previous api image keeps working (rollback-safe).
-- Only an HMAC-SHA256 of the code is stored; a code dies after use, 5 wrong attempts or
-- expires_at (10 minutes). See modules/password-reset.

CREATE TABLE "password_reset_codes" (
    "code_id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "user_id" BIGINT NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("code_id"),
    CONSTRAINT "chk_reset_codes_attempts" CHECK ("attempts" BETWEEN 0 AND 5)
);

-- Latest code of a user first (verify + cooldown + daily cap all read this way).
CREATE INDEX "idx_reset_codes_user_created" ON "password_reset_codes"("user_id", "created_at" DESC);

ALTER TABLE "password_reset_codes" ADD CONSTRAINT "fk_reset_codes_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
