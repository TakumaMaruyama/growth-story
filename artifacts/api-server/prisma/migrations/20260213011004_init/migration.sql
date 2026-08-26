-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "login_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "log_date" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "practiced" BOOLEAN NOT NULL DEFAULT false,
    "good_text" TEXT,
    "improve_text" TEXT,
    "tomorrow_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_versions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_answers" (
    "id" TEXT NOT NULL,
    "story_version_id" TEXT NOT NULL,
    "question_no" INTEGER NOT NULL,
    "answer_text" TEXT NOT NULL,

    CONSTRAINT "story_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sex" "Sex" NOT NULL,
    "birth_date" DATE NOT NULL,
    "father_height_cm" DOUBLE PRECISION,
    "mother_height_cm" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_measurements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "measured_on" DATE NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "sitting_height_cm" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_id_key" ON "users"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "daily_logs_user_id_log_date_idx" ON "daily_logs"("user_id", "log_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_logs_user_id_log_date_key" ON "daily_logs"("user_id", "log_date");

-- CreateIndex
CREATE INDEX "story_versions_user_id_version_idx" ON "story_versions"("user_id", "version" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "story_versions_user_id_version_key" ON "story_versions"("user_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "story_answers_story_version_id_question_no_key" ON "story_answers"("story_version_id", "question_no");

-- CreateIndex
CREATE UNIQUE INDEX "growth_profiles_user_id_key" ON "growth_profiles"("user_id");

-- CreateIndex
CREATE INDEX "growth_measurements_user_id_measured_on_idx" ON "growth_measurements"("user_id", "measured_on" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "growth_measurements_user_id_measured_on_key" ON "growth_measurements"("user_id", "measured_on");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_answers" ADD CONSTRAINT "story_answers_story_version_id_fkey" FOREIGN KEY ("story_version_id") REFERENCES "story_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_profiles" ADD CONSTRAINT "growth_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_measurements" ADD CONSTRAINT "growth_measurements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

