import * as Localization from 'expo-localization';
import { LanguageCode, QuestionDisplayMode, StateCode, StudyMode } from '../types';
import { AppDatabase } from '../db/types';
import { defaultStateCode, isAvailableStateCode } from '../data/stateConfig';
import { setQuestionSetOverrides } from '../data/stateContent';

type PreferenceKey = string;

type PreferenceRow = {
  key: PreferenceKey;
  value: string | null;
};

export type UserStats = {
  totalAnswered: number;
  todayAnswered: number;
  todayAccuracy: number;
  accuracy: number;
  mistakeCount: number;
  savedCount: number;
  mockTestsTaken: number;
  savedQuestionIds: string[];
  mistakeQuestionIds: string[];
};

export type BillingState = {
  isPremium: boolean;
};

export async function getPreferences(db: AppDatabase) {
  const rows = await db.getAllAsync<PreferenceRow>('SELECT key, value FROM app_preferences');
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value ?? '']));
  const deviceLanguage: LanguageCode = Localization.getLocales()[0]?.languageCode === 'zh' ? 'zh' : 'en';
  const hasCompletedOnboarding = values.hasCompletedOnboarding === 'true';
  const storedLanguage = values.language === 'zh' || values.language === 'en' ? (values.language as LanguageCode) : undefined;
  const shouldUseDeviceDefaults =
    !hasCompletedOnboarding &&
    deviceLanguage === 'zh' &&
    (!storedLanguage || (storedLanguage === 'en' && values.studyMode !== 'zh-first'));
  const resolvedLanguage = shouldUseDeviceDefaults ? deviceLanguage : storedLanguage ?? deviceLanguage;
  const resolvedStudyMode =
    values.studyMode === 'zh-first' || values.studyMode === 'en-first'
      ? (shouldUseDeviceDefaults ? 'zh-first' : (values.studyMode as StudyMode))
      : resolvedLanguage === 'zh'
        ? 'zh-first'
        : 'en-first';
  const allowedSpeechRates = new Set(['0.5', '0.75', '1', '1.25']);
  const resolvedSpeechRate = allowedSpeechRates.has(values.speechRate) ? Number(values.speechRate) : 1;
  const isPremium = values['billing.isPremium'] === 'true';

  return {
    isPremium,
    language: resolvedLanguage,
    stateCode: isAvailableStateCode(values.examVersionCode) ? values.examVersionCode : defaultStateCode,
    studyMode: resolvedStudyMode,
    questionDisplayMode:
      values.questionDisplayMode === 'bilingual' ? ('bilingual' as QuestionDisplayMode) : ('english' as QuestionDisplayMode),
    speechRate: resolvedSpeechRate,
    blindListeningEnabled: isPremium && values.blindListeningEnabled === 'true',
    remindersEnabled: values.remindersEnabled !== 'false',
    hasCompletedOnboarding,
  };
}

export async function savePreference(db: AppDatabase, key: PreferenceKey, value: string) {
  await db.runAsync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)', key, value);
}

const CONTENT_SET_KEY_PREFIX = 'contentSet';

export function buildContentSetPreferenceKey(stateCode: StateCode, setType: 'highFrequency' | 'mock') {
  return `${CONTENT_SET_KEY_PREFIX}:${stateCode}:${setType}`;
}

export async function saveContentSetPreference(
  db: AppDatabase,
  stateCode: StateCode,
  setType: 'highFrequency' | 'mock',
  questionIds: string[]
) {
  await savePreference(db, buildContentSetPreferenceKey(stateCode, setType), JSON.stringify(questionIds));
}

export async function hydrateContentSetOverrides(db: AppDatabase) {
  const rows = await db.getAllAsync<PreferenceRow>(
    'SELECT key, value FROM app_preferences WHERE key LIKE ?',
    `${CONTENT_SET_KEY_PREFIX}:%`
  );

  for (const row of rows) {
    if (!row.value) {
      continue;
    }

    const [, stateCodeValue, setType] = row.key.split(':');
    if (!isAvailableStateCode(stateCodeValue)) {
      continue;
    }

    try {
      const parsed = JSON.parse(row.value);
      if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
        continue;
      }

      if (setType === 'highFrequency') {
        setQuestionSetOverrides(stateCodeValue, { highFrequencyQuestionIds: parsed });
      } else if (setType === 'mock') {
        setQuestionSetOverrides(stateCodeValue, { mockQuestionIds: parsed });
      }
    } catch {
      continue;
    }
  }
}

export async function getBillingState(db: AppDatabase): Promise<BillingState> {
  const row = await db.getFirstAsync<PreferenceRow>(
    'SELECT key, value FROM app_preferences WHERE key = ?',
    'billing.isPremium'
  );

  return {
    isPremium: row?.value === 'true',
  };
}

export async function saveBillingState(db: AppDatabase, billingState: BillingState) {
  await savePreference(db, 'billing.isPremium', billingState.isPremium ? 'true' : 'false');
}

function getLocalDateKey(date = new Date()) {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
}

export async function getTodayMockTestUsage(db: AppDatabase) {
  const rows = await db.getAllAsync<PreferenceRow>(
    'SELECT key, value FROM app_preferences WHERE key IN (?, ?)',
    'usage.mockTests.date',
    'usage.mockTests.count'
  );
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value ?? '']));
  const today = getLocalDateKey();
  const storedDate = values['usage.mockTests.date'] ?? '';
  const count = storedDate === today ? Number(values['usage.mockTests.count'] ?? '0') || 0 : 0;

  if (storedDate !== today) {
    await savePreference(db, 'usage.mockTests.date', today);
    await savePreference(db, 'usage.mockTests.count', '0');
  }

  return {
    date: today,
    count,
  };
}

export async function incrementTodayMockTestUsage(db: AppDatabase) {
  const usage = await getTodayMockTestUsage(db);
  const nextCount = usage.count + 1;
  await savePreference(db, 'usage.mockTests.date', usage.date);
  await savePreference(db, 'usage.mockTests.count', String(nextCount));

  return {
    date: usage.date,
    count: nextCount,
  };
}

const HANDBOOK_LEARNED_PREFIX = 'handbookLearned:';
const ROAD_SIGN_RESUME_PREFIX = 'roadSignResume:';
const LISTENING_RESUME_PREFIX = 'listeningResume:';

export function buildHandbookLearnedKey(stateCode: StateCode, sectionSlug: string, itemSlug: string) {
  return `${HANDBOOK_LEARNED_PREFIX}${stateCode}:${sectionSlug}:${itemSlug}`;
}

export async function markHandbookItemLearned(
  db: AppDatabase,
  stateCode: StateCode,
  sectionSlug: string,
  itemSlug: string
) {
  await savePreference(db, buildHandbookLearnedKey(stateCode, sectionSlug, itemSlug), 'true');
}

export async function getLearnedHandbookItemKeys(db: AppDatabase, stateCode: StateCode) {
  const rows = await db.getAllAsync<PreferenceRow>(
    'SELECT key, value FROM app_preferences WHERE key LIKE ? AND value = ?',
    `${HANDBOOK_LEARNED_PREFIX}${stateCode}:%`,
    'true'
  );

  return rows.map((row) => row.key);
}

export function buildRoadSignResumeKey(stateCode: StateCode) {
  return `${ROAD_SIGN_RESUME_PREFIX}${stateCode}`;
}

export function buildListeningResumeKey(stateCode: StateCode) {
  return `${LISTENING_RESUME_PREFIX}${stateCode}`;
}

export async function getRoadSignResumeId(db: AppDatabase, stateCode: StateCode) {
  const row = await db.getFirstAsync<PreferenceRow>(
    'SELECT key, value FROM app_preferences WHERE key = ?',
    buildRoadSignResumeKey(stateCode)
  );

  return row?.value ?? null;
}

export async function saveRoadSignResumeId(db: AppDatabase, stateCode: StateCode, signId: string) {
  await savePreference(db, buildRoadSignResumeKey(stateCode), signId);
}

export async function clearRoadSignResumeId(db: AppDatabase, stateCode: StateCode) {
  await db.runAsync('DELETE FROM app_preferences WHERE key = ?', buildRoadSignResumeKey(stateCode));
}

export async function getListeningResumeQuestionId(db: AppDatabase, stateCode: StateCode) {
  const row = await db.getFirstAsync<PreferenceRow>(
    'SELECT key, value FROM app_preferences WHERE key = ?',
    buildListeningResumeKey(stateCode)
  );

  return row?.value ?? null;
}

export async function saveListeningResumeQuestionId(db: AppDatabase, stateCode: StateCode, questionId: string) {
  await savePreference(db, buildListeningResumeKey(stateCode), questionId);
}

export async function clearListeningResumeQuestionId(db: AppDatabase, stateCode: StateCode) {
  await db.runAsync('DELETE FROM app_preferences WHERE key = ?', buildListeningResumeKey(stateCode));
}

export async function toggleSavedQuestion(db: AppDatabase, stateCode: StateCode, questionId: string) {
  const existing = await db.getFirstAsync<{ question_id: string }>(
    'SELECT question_id FROM user_saved_questions WHERE exam_version_code = ? AND question_id = ?',
    stateCode,
    questionId
  );

  if (existing) {
    await db.runAsync('DELETE FROM user_saved_questions WHERE exam_version_code = ? AND question_id = ?', stateCode, questionId);
    return false;
  }

  await db.runAsync(
    'INSERT INTO user_saved_questions (exam_version_code, question_id, saved_at) VALUES (?, ?, ?)',
    stateCode,
    questionId,
    new Date().toISOString()
  );
  return true;
}

export async function isQuestionSaved(db: AppDatabase, stateCode: StateCode, questionId: string) {
  const existing = await db.getFirstAsync<{ question_id: string }>(
    'SELECT question_id FROM user_saved_questions WHERE exam_version_code = ? AND question_id = ?',
    stateCode,
    questionId
  );
  return Boolean(existing);
}

export async function recordAttempt(
  db: AppDatabase,
  params: { stateCode: StateCode; questionId: string; selectedOptionKey: string; isCorrect: boolean; source: string }
) {
  await db.runAsync(
    `INSERT INTO user_question_attempts (exam_version_code, question_id, selected_option_key, is_correct, source, answered_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    params.stateCode,
    params.questionId,
    params.selectedOptionKey,
    params.isCorrect ? 1 : 0,
    params.source,
    new Date().toISOString()
  );

  if (!params.isCorrect) {
    const existing = await db.getFirstAsync<{ mistake_count: number }>(
      'SELECT mistake_count FROM user_mistake_status WHERE exam_version_code = ? AND question_id = ?',
      params.stateCode,
      params.questionId
    );

    if (existing) {
      await db.runAsync(
        'UPDATE user_mistake_status SET mistake_count = ?, is_active = 1, last_wrong_at = ? WHERE exam_version_code = ? AND question_id = ?',
        existing.mistake_count + 1,
        new Date().toISOString(),
        params.stateCode,
        params.questionId
      );
    } else {
      await db.runAsync(
        'INSERT INTO user_mistake_status (exam_version_code, question_id, mistake_count, is_active, last_wrong_at) VALUES (?, ?, ?, 1, ?)',
        params.stateCode,
        params.questionId,
        1,
        new Date().toISOString()
      );
    }
    return;
  }

  await db.runAsync('DELETE FROM user_mistake_status WHERE exam_version_code = ? AND question_id = ?', params.stateCode, params.questionId);
}

export async function getUserStats(db: AppDatabase, stateCode: StateCode): Promise<UserStats> {
  const totalAnsweredRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_question_attempts WHERE exam_version_code = ?',
    stateCode
  );
  const correctAnsweredRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_question_attempts WHERE exam_version_code = ? AND is_correct = 1',
    stateCode
  );
  const todayAnsweredRow = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM user_question_attempts WHERE exam_version_code = ? AND date(answered_at, 'localtime') = date('now', 'localtime')",
    stateCode
  );
  const todayCorrectAnsweredRow = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM user_question_attempts WHERE exam_version_code = ? AND is_correct = 1 AND date(answered_at, 'localtime') = date('now', 'localtime')",
    stateCode
  );
  const mistakeCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_mistake_status WHERE exam_version_code = ? AND is_active = 1',
    stateCode
  );
  const savedCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_saved_questions WHERE exam_version_code = ?',
    stateCode
  );
  const savedRows = await db.getAllAsync<{ question_id: string }>(
    'SELECT question_id FROM user_saved_questions WHERE exam_version_code = ? ORDER BY saved_at DESC',
    stateCode
  );
  const mistakeRows = await db.getAllAsync<{ question_id: string }>(
    'SELECT question_id FROM user_mistake_status WHERE exam_version_code = ? AND is_active = 1 ORDER BY last_wrong_at DESC',
    stateCode
  );

  const totalAnswered = totalAnsweredRow?.count ?? 0;
  const correctAnswered = correctAnsweredRow?.count ?? 0;
  const todayAnswered = todayAnsweredRow?.count ?? 0;
  const todayCorrectAnswered = todayCorrectAnsweredRow?.count ?? 0;

  return {
    totalAnswered,
    todayAnswered,
    todayAccuracy: todayAnswered > 0 ? Math.round((todayCorrectAnswered / todayAnswered) * 100) : 0,
    accuracy: totalAnswered > 0 ? Math.round((correctAnswered / totalAnswered) * 100) : 0,
    mistakeCount: mistakeCountRow?.count ?? 0,
    savedCount: savedCountRow?.count ?? 0,
    mockTestsTaken: 0,
    savedQuestionIds: savedRows.map((row) => row.question_id),
    mistakeQuestionIds: mistakeRows.map((row) => row.question_id),
  };
}
