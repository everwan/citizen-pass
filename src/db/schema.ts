export const appSchema = `
CREATE TABLE IF NOT EXISTS app_preferences (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  exam_version_code TEXT NOT NULL,
  id TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  accuracy INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (exam_version_code, id)
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY NOT NULL,
  exam_version_code TEXT NOT NULL,
  category_id TEXT NOT NULL,
  category_label TEXT NOT NULL,
  question_en TEXT NOT NULL,
  question_zh TEXT NOT NULL,
  explanation_en TEXT NOT NULL,
  explanation_zh TEXT NOT NULL,
  memory_tip_en TEXT NOT NULL DEFAULT '',
  memory_tip_zh TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_questions_exam_version_category
ON questions(exam_version_code, category_id);

CREATE TABLE IF NOT EXISTS question_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL,
  option_key TEXT NOT NULL,
  text_en TEXT NOT NULL,
  text_zh TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_option_unique
ON question_options(question_id, option_key);

CREATE TABLE IF NOT EXISTS guide_articles (
  exam_version_code TEXT NOT NULL,
  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  content_en TEXT NOT NULL,
  content_zh TEXT NOT NULL,
  official_url TEXT,
  PRIMARY KEY (exam_version_code, slug)
);

CREATE TABLE IF NOT EXISTS glossary_terms (
  exam_version_code TEXT NOT NULL,
  term_en TEXT NOT NULL,
  term_zh TEXT NOT NULL,
  definition_zh TEXT NOT NULL,
  source_tag TEXT NOT NULL DEFAULT 'reading',
  PRIMARY KEY (exam_version_code, term_en)
);

CREATE TABLE IF NOT EXISTS content_bundles (
  bundle_id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  target_code TEXT NOT NULL,
  version TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL,
  applied_at TEXT,
  source TEXT NOT NULL DEFAULT 'remote'
);

CREATE TABLE IF NOT EXISTS user_saved_questions (
  exam_version_code TEXT NOT NULL,
  question_id TEXT NOT NULL,
  saved_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saved_questions_unique
ON user_saved_questions(exam_version_code, question_id);

CREATE TABLE IF NOT EXISTS user_mistake_status (
  exam_version_code TEXT NOT NULL,
  question_id TEXT NOT NULL,
  mistake_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_wrong_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_mistake_status_unique
ON user_mistake_status(exam_version_code, question_id);

CREATE TABLE IF NOT EXISTS user_question_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_version_code TEXT NOT NULL DEFAULT '2025',
  question_id TEXT NOT NULL,
  selected_option_key TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  source TEXT NOT NULL,
  answered_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_question_attempts_exam_version
ON user_question_attempts(exam_version_code, answered_at);
`;
