import * as Localization from 'expo-localization';
import { defaultStateCode } from '../data/stateConfig';
import { seedBuiltinContentBundles } from '../content/remoteContentService';
import { AppDatabase } from './types';

const deviceLanguage = Localization.getLocales()[0]?.languageCode === 'zh' ? 'zh' : 'en';
const defaultStudyMode = deviceLanguage === 'zh' ? 'zh-first' : 'en-first';

export async function seedDatabase(db: AppDatabase) {
  try {
    await db.execAsync(`ALTER TABLE guide_articles ADD COLUMN official_url TEXT;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE glossary_terms ADD COLUMN source_tag TEXT NOT NULL DEFAULT 'reading';`);
  } catch {}

  await seedBuiltinContentBundles(db);

  await db.runAsync(`INSERT OR IGNORE INTO app_preferences (key, value) VALUES ('language', ?)`, deviceLanguage);
  await db.runAsync(`INSERT OR IGNORE INTO app_preferences (key, value) VALUES ('studyMode', ?)`, defaultStudyMode);
  await db.runAsync(`INSERT OR IGNORE INTO app_preferences (key, value) VALUES ('examVersionCode', ?)`, defaultStateCode);
  await db.runAsync(`INSERT OR IGNORE INTO app_preferences (key, value) VALUES ('questionDisplayMode', 'english')`);
  await db.runAsync(`INSERT OR IGNORE INTO app_preferences (key, value) VALUES ('remindersEnabled', 'true')`);
  await db.runAsync(`INSERT OR IGNORE INTO app_preferences (key, value) VALUES ('hasCompletedOnboarding', 'false')`);
}
