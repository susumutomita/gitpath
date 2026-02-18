-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "provider" VARCHAR(20) NOT NULL DEFAULT 'email',
    "google_sub" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "github_user_id" BIGINT NOT NULL,
    "github_username" VARCHAR(255) NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "scope" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "current_step" VARCHAR(100) NOT NULL DEFAULT 'hearing',
    "accumulated_seconds" INTEGER NOT NULL DEFAULT 0,
    "first_started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "device_info" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hearing_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "learning_session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hearing_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hearing_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hearing_session_id" UUID NOT NULL,
    "question_number" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_text" TEXT,
    "is_skipped" BOOLEAN NOT NULL DEFAULT false,
    "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hearing_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_level_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "learning_session_id" UUID NOT NULL,
    "level_estimate" VARCHAR(20) NOT NULL,
    "occupation" VARCHAR(255),
    "pc_experience_years" INTEGER,
    "programming_experience" VARCHAR(50),
    "product_idea_summary" TEXT,
    "domain_keywords" JSONB,
    "curriculum" JSONB NOT NULL,
    "estimated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_level_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_definitions" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "github_verification_type" VARCHAR(50),

    CONSTRAINT "milestone_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "learning_session_id" UUID NOT NULL,
    "milestone_id" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ,
    "verified_via_github_api" BOOLEAN NOT NULL DEFAULT false,
    "github_api_response" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminal_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "learning_session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "process_pid" INTEGER,
    "sandbox_path" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "cols" INTEGER NOT NULL DEFAULT 80,
    "rows" INTEGER NOT NULL DEFAULT 24,
    "reconnect_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terminal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "terminal_session_id" UUID NOT NULL,
    "learning_session_id" UUID NOT NULL,
    "command_text" TEXT NOT NULL,
    "stdout" TEXT,
    "stderr" TEXT,
    "exit_code" INTEGER,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" VARCHAR(255),
    "consecutive_error_count" INTEGER NOT NULL DEFAULT 0,
    "executed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_explanation_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "learning_session_id" UUID NOT NULL,
    "step_id" VARCHAR(100) NOT NULL,
    "request_type" VARCHAR(50) NOT NULL,
    "prompt_sent" TEXT NOT NULL,
    "response_received" TEXT,
    "response_time_ms" INTEGER,
    "is_filtered" BOOLEAN NOT NULL DEFAULT false,
    "api_error" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_explanation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sandbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "learning_session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "step_name" VARCHAR(100) NOT NULL,
    "duration_ms" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sandbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_understanding_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "learning_session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "understands" BOOLEAN NOT NULL,
    "free_text" TEXT,
    "responded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "git_understanding_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "learning_session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "github_username" VARCHAR(255) NOT NULL,
    "elapsed_seconds" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ NOT NULL,
    "milestone_details" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_conflict_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "learning_session_id" UUID NOT NULL,
    "winning_device_info" JSONB,
    "conflicted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_conflict_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "github_credentials_user_id_key" ON "github_credentials"("user_id");

-- CreateIndex
CREATE INDEX "idx_learning_sessions_user_id" ON "learning_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_learning_sessions_status" ON "learning_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "hearing_answers_hearing_session_id_question_number_key" ON "hearing_answers"("hearing_session_id", "question_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_level_profiles_learning_session_id_key" ON "user_level_profiles"("learning_session_id");

-- CreateIndex
CREATE INDEX "idx_user_milestones_session" ON "user_milestones"("learning_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_milestones_learning_session_id_milestone_id_key" ON "user_milestones"("learning_session_id", "milestone_id");

-- CreateIndex
CREATE INDEX "idx_command_logs_terminal_session" ON "command_logs"("terminal_session_id");

-- CreateIndex
CREATE INDEX "idx_ai_explanation_logs_session" ON "ai_explanation_logs"("learning_session_id");

-- CreateIndex
CREATE INDEX "idx_sandbox_events_session" ON "sandbox_events"("learning_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_learning_session_id_key" ON "certificates"("learning_session_id");

-- CreateIndex
CREATE INDEX "idx_certificates_id" ON "certificates"("id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_credentials" ADD CONSTRAINT "github_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hearing_sessions" ADD CONSTRAINT "hearing_sessions_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hearing_sessions" ADD CONSTRAINT "hearing_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hearing_answers" ADD CONSTRAINT "hearing_answers_hearing_session_id_fkey" FOREIGN KEY ("hearing_session_id") REFERENCES "hearing_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_level_profiles" ADD CONSTRAINT "user_level_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_level_profiles" ADD CONSTRAINT "user_level_profiles_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_milestones" ADD CONSTRAINT "user_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_milestones" ADD CONSTRAINT "user_milestones_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_milestones" ADD CONSTRAINT "user_milestones_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestone_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_logs" ADD CONSTRAINT "command_logs_terminal_session_id_fkey" FOREIGN KEY ("terminal_session_id") REFERENCES "terminal_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_logs" ADD CONSTRAINT "command_logs_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_explanation_logs" ADD CONSTRAINT "ai_explanation_logs_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sandbox_events" ADD CONSTRAINT "sandbox_events_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sandbox_events" ADD CONSTRAINT "sandbox_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_understanding_responses" ADD CONSTRAINT "git_understanding_responses_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_understanding_responses" ADD CONSTRAINT "git_understanding_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_conflict_logs" ADD CONSTRAINT "device_conflict_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_conflict_logs" ADD CONSTRAINT "device_conflict_logs_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
