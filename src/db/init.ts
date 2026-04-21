import { appSchema } from './schema';
import { seedDatabase } from './seed';
import { AppDatabase } from './types';

const SCHEMA_VERSION = 'citizenship-v3';

export async function initializeDatabase(db: AppDatabase) {
  await ensurePreferencesTable(db);
  await migrateDatabase(db);
  await db.execAsync(appSchema);
  await seedDatabase(db);
}

async function ensurePreferencesTable(db: AppDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_preferences (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);
}

async function migrateDatabase(db: AppDatabase) {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_preferences WHERE key = 'schemaVersion'`
  );

  if (row?.value === SCHEMA_VERSION) {
    return;
  }

  await dropLegacyContentTables(db);
  await migrateSavedQuestionsTable(db);
  await migrateMistakeStatusTable(db);

  await db.runAsync(
    `INSERT OR REPLACE INTO app_preferences (key, value) VALUES ('schemaVersion', ?)`,
    SCHEMA_VERSION
  );
}

async function dropLegacyContentTables(db: AppDatabase) {
  await db.execAsync(`
    DROP INDEX IF EXISTS idx_question_option_unique;
    DROP TABLE IF EXISTS question_options;
    DROP TABLE IF EXISTS questions;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS guide_articles;
    DROP TABLE IF EXISTS glossary_terms;
    DROP TABLE IF EXISTS user_saved_questions;
    DROP TABLE IF EXISTS user_mistake_status;
    DROP TABLE IF EXISTS user_question_attempts;
  `);
}

async function migrateSavedQuestionsTable(db: AppDatabase) {
  await db.execAsync(`
    DROP TABLE IF EXISTS user_saved_questions_v2;
    CREATE TABLE user_saved_questions_v2 (
      exam_version_code TEXT NOT NULL,
      question_id TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (exam_version_code, question_id)
    );
  `);

  try {
    await db.execAsync(`
      INSERT OR IGNORE INTO user_saved_questions_v2 (exam_version_code, question_id, saved_at)
      SELECT '2025', question_id, saved_at
      FROM user_saved_questions;
    `);
  } catch {}

  await db.execAsync(`
    DROP TABLE IF EXISTS user_saved_questions;
    ALTER TABLE user_saved_questions_v2 RENAME TO user_saved_questions;
  `);
}

async function migrateMistakeStatusTable(db: AppDatabase) {
  await db.execAsync(`
    DROP TABLE IF EXISTS user_mistake_status_v2;
    CREATE TABLE user_mistake_status_v2 (
      exam_version_code TEXT NOT NULL,
      question_id TEXT NOT NULL,
      mistake_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_wrong_at TEXT,
      PRIMARY KEY (exam_version_code, question_id)
    );
  `);

  try {
    await db.execAsync(`
      INSERT OR IGNORE INTO user_mistake_status_v2 (exam_version_code, question_id, mistake_count, is_active, last_wrong_at)
      SELECT '2025', question_id, mistake_count, is_active, last_wrong_at
      FROM user_mistake_status;
    `);
  } catch {}

  await db.execAsync(`
    DROP TABLE IF EXISTS user_mistake_status;
    ALTER TABLE user_mistake_status_v2 RENAME TO user_mistake_status;
  `);
}
