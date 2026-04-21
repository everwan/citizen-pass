import * as Localization from 'expo-localization';
import { createContext, ReactNode, useContext, useMemo } from 'react';
import { defaultStateCode, isAvailableStateCode } from '../data/stateConfig';
import { getStateContent } from '../data/stateContent';
import { AppDatabase, RowValue } from './types';

type WebState = {
  preferences: Record<string, string>;
  savedQuestions: { exam_version_code: string; question_id: string; saved_at: string }[];
  mistakes: { exam_version_code: string; question_id: string; mistake_count: number; is_active: number; last_wrong_at: string | null }[];
  attempts: { exam_version_code: string; question_id: string; selected_option_key: string; is_correct: number; source: string; answered_at: string }[];
};

const deviceLanguage = Localization.getLocales()[0]?.languageCode === 'zh' ? 'zh' : 'en';
const defaultStudyMode = deviceLanguage === 'zh' ? 'zh-first' : 'en-first';

const initialState: WebState = {
  preferences: {
    language: deviceLanguage,
    examVersionCode: defaultStateCode,
    studyMode: defaultStudyMode,
    questionDisplayMode: 'english',
    remindersEnabled: 'true',
    hasCompletedOnboarding: 'false',
  },
  savedQuestions: [],
  mistakes: [],
  attempts: [],
};

const DatabaseContext = createContext<AppDatabase | null>(null);

function createWebDatabase(state: WebState): AppDatabase {
  function getActiveStateCode() {
    return isAvailableStateCode(state.preferences.examVersionCode) ? state.preferences.examVersionCode : defaultStateCode;
  }

  function getActiveContent() {
    return getStateContent(getActiveStateCode());
  }

  function getAllQuestions() {
    return Object.values(getActiveContent()?.questionsByCategory ?? {}).flat();
  }

  return {
    async execAsync() {
      return;
    },
    async runAsync(source: string, ...params: RowValue[]) {
      if (source.includes('app_preferences')) {
        const key = String(params[0]);
        if (source.includes('INSERT OR IGNORE') && key in state.preferences) {
          return;
        }

        state.preferences[key] = String(params[1]);
        return;
      }

      if (source.includes('DELETE FROM user_saved_questions')) {
        state.savedQuestions = state.savedQuestions.filter(
          (item) => !(item.exam_version_code === params[0] && item.question_id === params[1])
        );
        return;
      }

      if (source.includes('INSERT INTO user_saved_questions')) {
        state.savedQuestions.unshift({
          exam_version_code: String(params[0]),
          question_id: String(params[1]),
          saved_at: String(params[2]),
        });
        return;
      }

      if (source.includes('INSERT INTO user_question_attempts')) {
        state.attempts.unshift({
          exam_version_code: String(params[0]),
          question_id: String(params[1]),
          selected_option_key: String(params[2]),
          is_correct: Number(params[3]),
          source: String(params[4]),
          answered_at: String(params[5]),
        });
        return;
      }

      if (source.includes('DELETE FROM user_mistake_status')) {
        state.mistakes = state.mistakes.filter(
          (item) => !(item.exam_version_code === params[0] && item.question_id === params[1])
        );
        return;
      }

      if (source.includes('UPDATE user_mistake_status')) {
        state.mistakes = state.mistakes.map((item) =>
          item.exam_version_code === params[2] && item.question_id === params[3]
            ? {
                ...item,
                mistake_count: Number(params[0]),
                last_wrong_at: String(params[1]),
                is_active: 1,
              }
            : item
        );
        return;
      }

      if (source.includes('INSERT INTO user_mistake_status')) {
        state.mistakes.unshift({
          exam_version_code: String(params[0]),
          question_id: String(params[1]),
          mistake_count: Number(params[2]),
          is_active: 1,
          last_wrong_at: String(params[3]),
        });
      }
    },
    async getFirstAsync<T>(source: string, ...params: RowValue[]) {
      if (source.includes('COUNT(*) as count FROM categories')) {
        return { count: getActiveContent()?.categories.length ?? 0 } as T;
      }

      if (source.includes('SELECT question_id FROM user_saved_questions WHERE exam_version_code = ? AND question_id = ?')) {
        const row = state.savedQuestions.find((item) => item.exam_version_code === params[0] && item.question_id === params[1]) ?? null;
        return row as T | null;
      }

      if (source.includes('SELECT mistake_count FROM user_mistake_status WHERE exam_version_code = ? AND question_id = ?')) {
        const row = state.mistakes.find((item) => item.exam_version_code === params[0] && item.question_id === params[1]) ?? null;
        return row as T | null;
      }

      if (source.includes("COUNT(*) as count FROM user_question_attempts WHERE exam_version_code = ? AND is_correct = 1 AND date(answered_at, 'localtime') = date('now', 'localtime')")) {
        return {
          count: state.attempts.filter((item) => item.exam_version_code === params[0] && item.is_correct === 1).length,
        } as T;
      }

      if (source.includes("COUNT(*) as count FROM user_question_attempts WHERE exam_version_code = ? AND date(answered_at, 'localtime') = date('now', 'localtime')")) {
        return {
          count: state.attempts.filter((item) => item.exam_version_code === params[0]).length,
        } as T;
      }

      if (source.includes('COUNT(*) as count FROM user_question_attempts WHERE exam_version_code = ? AND is_correct = 1')) {
        return { count: state.attempts.filter((item) => item.exam_version_code === params[0] && item.is_correct === 1).length } as T;
      }

      if (source.includes('COUNT(*) as count FROM user_question_attempts WHERE exam_version_code = ?')) {
        return { count: state.attempts.filter((item) => item.exam_version_code === params[0]).length } as T;
      }

      if (source.includes('COUNT(*) as count FROM user_mistake_status WHERE exam_version_code = ? AND is_active = 1')) {
        return { count: state.mistakes.filter((item) => item.exam_version_code === params[0] && item.is_active === 1).length } as T;
      }

      if (source.includes('COUNT(*) as count FROM user_saved_questions WHERE exam_version_code = ?')) {
        return { count: state.savedQuestions.filter((item) => item.exam_version_code === params[0]).length } as T;
      }

      return null;
    },
    async getAllAsync<T>(source: string, ...params: RowValue[]) {
      if (source.includes('SELECT key, value FROM app_preferences')) {
        const likePrefix = typeof params[0] === 'string' ? String(params[0]).replace('%', '') : null;
        const requiredValue = typeof params[1] === 'string' ? String(params[1]) : null;

        if (likePrefix && requiredValue) {
          return Object.entries(state.preferences)
            .filter(([key, value]) => key.startsWith(likePrefix) && value === requiredValue)
            .map(([key, value]) => ({ key, value })) as T[];
        }

        return Object.entries(state.preferences).map(([key, value]) => ({ key, value })) as T[];
      }

      if (source.includes('SELECT * FROM categories')) {
        return (getActiveContent()?.categories ?? [])
          .map((category) => ({
            exam_version_code: getActiveStateCode(),
            id: category.id,
            name_en: category.nameEn,
            name_zh: category.nameZh,
            question_count: category.questionCount,
            progress: category.progress,
            accuracy: category.accuracy,
          }))
          .sort((a, b) => a.name_en.localeCompare(b.name_en)) as T[];
      }

      if (source.includes('SELECT * FROM questions WHERE exam_version_code = ? AND category_id = ?')) {
        return getAllQuestions()
          .filter((question) => question.categoryId === params[1])
          .map((question) => ({
            id: question.id,
            exam_version_code: getActiveStateCode(),
            category_id: question.categoryId,
            category_label: question.categoryLabel,
            question_en: question.questionEn,
            question_zh: question.questionZh,
            explanation_en: question.explanationEn,
            explanation_zh: question.explanationZh,
          })) as T[];
      }

      if (source.includes('SELECT * FROM questions WHERE exam_version_code = ? ORDER BY id')) {
        return getAllQuestions().map((question) => ({
          id: question.id,
          exam_version_code: getActiveStateCode(),
          category_id: question.categoryId,
          category_label: question.categoryLabel,
          question_en: question.questionEn,
          question_zh: question.questionZh,
          explanation_en: question.explanationEn,
          explanation_zh: question.explanationZh,
        })) as T[];
      }

      if (source.includes('FROM question_options WHERE question_id = ?')) {
        const question = getAllQuestions().find((item) => item.id === params[0]);
        return (question?.options ?? []).map((option) => ({
          option_key: option.key,
          text_en: option.textEn,
          text_zh: option.textZh,
          is_correct: option.isCorrect ? 1 : 0,
        })) as T[];
      }

      if (source.includes('SELECT * FROM guide_articles')) {
        return (getActiveContent()?.guideArticles ?? []).map((article) => ({
          exam_version_code: getActiveStateCode(),
          slug: article.slug,
          title_en: article.titleEn,
          title_zh: article.titleZh,
          content_en: article.contentEn,
          content_zh: article.contentZh,
        })) as T[];
      }

      if (source.includes('SELECT * FROM glossary_terms')) {
        return (getActiveContent()?.glossaryTerms ?? []).map((term) => ({
          exam_version_code: getActiveStateCode(),
          term_en: term.termEn,
          term_zh: term.termZh,
          definition_zh: term.definitionZh,
          source_tag: term.sourceTag,
        })) as T[];
      }

      if (source.includes('SELECT question_id FROM user_saved_questions')) {
        return state.savedQuestions
          .filter((item) => item.exam_version_code === params[0])
          .map((item) => ({ question_id: item.question_id })) as T[];
      }

      if (source.includes('SELECT question_id FROM user_mistake_status')) {
        return state.mistakes
          .filter((item) => item.exam_version_code === params[0] && item.is_active === 1)
          .map((item) => ({ question_id: item.question_id })) as T[];
      }

      if (source.includes('SELECT question_id, is_correct, answered_at FROM user_question_attempts')) {
        return [...state.attempts]
          .filter((item) => item.exam_version_code === params[0])
          .sort((a, b) => b.answered_at.localeCompare(a.answered_at))
          .map((item) => ({
            question_id: item.question_id,
            is_correct: item.is_correct,
            answered_at: item.answered_at,
          })) as T[];
      }

      if (source.includes('SELECT question_id, mistake_count, last_wrong_at FROM user_mistake_status WHERE is_active = 1')) {
        return state.mistakes
          .filter((item) => item.exam_version_code === params[0] && item.is_active === 1)
          .sort((a, b) => (b.last_wrong_at ?? '').localeCompare(a.last_wrong_at ?? ''))
          .map((item) => ({
            question_id: item.question_id,
            mistake_count: item.mistake_count,
            last_wrong_at: item.last_wrong_at,
          })) as T[];
      }

      return [];
    },
  };
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const db = useMemo(() => createWebDatabase(structuredClone(initialState)), []);
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

export function useDatabase() {
  const db = useContext(DatabaseContext);

  if (!db) {
    throw new Error('DatabaseProvider is missing');
  }

  return db;
}
