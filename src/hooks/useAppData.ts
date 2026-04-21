import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Category, GlossaryTerm, GuideArticle, Question } from '../types';
import { useDatabase } from '../db/provider';
import { getCategories, getGlossaryTerms, getGuideArticles, getQuestionById, getQuestionsByCategory, getQuestionsByIds } from '../repositories/contentRepository';
import { buildHandbookLearnedKey, getLearnedHandbookItemKeys, getPreferences, getUserStats, hydrateContentSetOverrides, isQuestionSaved } from '../repositories/userRepository';
import { useAppStore } from '../store/useAppStore';
import { buildStateScopedCategoryId, TRAFFIC_SIGNS_BASE_CATEGORY_ID } from '../data/stateContent';

export function useHydratePreferences() {
  const db = useDatabase();
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setStateCode = useAppStore((state) => state.setStateCode);
  const setStudyMode = useAppStore((state) => state.setStudyMode);
  const setQuestionDisplayMode = useAppStore((state) => state.setQuestionDisplayMode);
  const setSpeechRate = useAppStore((state) => state.setSpeechRate);
  const setBlindListeningEnabled = useAppStore((state) => state.setBlindListeningEnabled);
  const setRemindersEnabled = useAppStore((state) => state.setRemindersEnabled);
  const setHasCompletedOnboarding = useAppStore((state) => state.setHasCompletedOnboarding);
  const setIsPremium = useAppStore((state) => state.setIsPremium);
  const [isReady, setIsReady] = useState(false);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (hasHydratedRef.current) {
      return;
    }

    let isMounted = true;

    async function hydrate() {
      const preferences = await getPreferences(db);
      await hydrateContentSetOverrides(db);

      if (!isMounted) {
        return;
      }

      setIsPremium(preferences.isPremium);
      setLanguage(preferences.language);
      setStateCode(preferences.stateCode);
      setStudyMode(preferences.studyMode);
      setQuestionDisplayMode(preferences.questionDisplayMode);
      setSpeechRate(preferences.speechRate);
      setBlindListeningEnabled(preferences.blindListeningEnabled);
      setRemindersEnabled(preferences.remindersEnabled);
      setHasCompletedOnboarding(preferences.hasCompletedOnboarding);
      hasHydratedRef.current = true;
      setIsReady(true);
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [db, setBlindListeningEnabled, setHasCompletedOnboarding, setIsPremium, setLanguage, setQuestionDisplayMode, setRemindersEnabled, setSpeechRate, setStateCode, setStudyMode]);

  return isReady;
}

export function useCategories() {
  const db = useDatabase();
  const stateCode = useAppStore((state) => state.stateCode);
  const contentRevision = useAppStore((state) => state.contentRevision);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void getCategories(db, stateCode).then(setCategories);
  }, [contentRevision, db, stateCode]);

  return categories;
}

export function useQuestions(categoryId?: string) {
  const db = useDatabase();
  const stateCode = useAppStore((state) => state.stateCode);
  const contentRevision = useAppStore((state) => state.contentRevision);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    void getQuestionsByCategory(db, stateCode, categoryId === 'random' ? undefined : categoryId).then((rows) => {
      if (categoryId !== 'random') {
        setQuestions(rows);
        return;
      }

      const shuffled = [...rows];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }

      setQuestions(shuffled);
    });
  }, [categoryId, contentRevision, db, stateCode]);

  return questions;
}

export function useSingleQuestion(questionId?: string) {
  const db = useDatabase();
  const stateCode = useAppStore((state) => state.stateCode);
  const contentRevision = useAppStore((state) => state.contentRevision);
  const [question, setQuestion] = useState<Question | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!questionId) {
      return;
    }

    void getQuestionById(db, stateCode, questionId).then(setQuestion);
    void isQuestionSaved(db, stateCode, questionId).then(setSaved);
  }, [contentRevision, db, questionId, stateCode]);

  return { question, saved, setSaved };
}

export function useQuestionList(questionIds: string[]) {
  const db = useDatabase();
  const stateCode = useAppStore((state) => state.stateCode);
  const contentRevision = useAppStore((state) => state.contentRevision);
  const [questions, setQuestions] = useState<Question[]>([]);
  const questionIdsKey = questionIds.join('|');

  useEffect(() => {
    if (questionIds.length === 0) {
      setQuestions([]);
      return;
    }

    void getQuestionsByIds(db, stateCode, questionIds).then(setQuestions);
  }, [contentRevision, db, questionIdsKey, stateCode]);

  return questions;
}

export function useGuideArticles() {
  const db = useDatabase();
  const stateCode = useAppStore((state) => state.stateCode);
  const contentRevision = useAppStore((state) => state.contentRevision);
  const [articles, setArticles] = useState<GuideArticle[]>([]);

  useEffect(() => {
    void getGuideArticles(db, stateCode).then(setArticles);
  }, [contentRevision, db, stateCode]);

  return articles;
}

export function useGlossaryTerms() {
  const db = useDatabase();
  const stateCode = useAppStore((state) => state.stateCode);
  const contentRevision = useAppStore((state) => state.contentRevision);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);

  useEffect(() => {
    void getGlossaryTerms(db, stateCode).then(setTerms);
  }, [contentRevision, db, stateCode]);

  return terms;
}

export function useUserStats() {
  const db = useDatabase();
  const stateCode = useAppStore((state) => state.stateCode);
  const [stats, setStats] = useState({
    totalAnswered: 0,
    todayAnswered: 0,
    todayAccuracy: 0,
    accuracy: 0,
    mistakeCount: 0,
    savedCount: 0,
    mockTestsTaken: 0,
    savedQuestionIds: [] as string[],
    mistakeQuestionIds: [] as string[],
  });

  const refresh = async () => {
    const next = await getUserStats(db, stateCode);
    setStats(next);
  };

  useEffect(() => {
    void refresh();
  }, [db, stateCode]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [db, stateCode])
  );

  return { stats, refresh };
}

export function useHandbookLearned() {
  const db = useDatabase();
  const stateCode = useAppStore((state) => state.stateCode);
  const [learnedKeys, setLearnedKeys] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const keys = await getLearnedHandbookItemKeys(db, stateCode);
    setLearnedKeys(keys);
  }, [db, stateCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const learnedSet = useMemo(() => new Set(learnedKeys), [learnedKeys]);
  const isLearned = useCallback(
    (sectionSlug: string, itemSlug: string) => learnedSet.has(buildHandbookLearnedKey(stateCode, sectionSlug, itemSlug)),
    [learnedSet, stateCode]
  );

  return { learnedKeys, learnedSet, isLearned, refresh };
}

type RecommendationReason = 'mistakes' | 'accuracy' | 'start';
type RecommendationKind = 'chapter' | 'roadSigns';

export function useHomeRecommendation(categories: Category[]) {
  const db = useDatabase();
  const stateCode = useAppStore((state) => state.stateCode);
  const contentRevision = useAppStore((state) => state.contentRevision);
  const [recommendation, setRecommendation] = useState<{
    continueCategoryId?: string;
    recommendedCategoryId?: string;
    recommendedKind: RecommendationKind;
    reason: RecommendationReason;
    wrongCount: number;
    accuracy: number | null;
  }>({
    continueCategoryId: categories[0]?.id,
    recommendedCategoryId: categories[0]?.id,
    recommendedKind: 'chapter',
    reason: 'start',
    wrongCount: 0,
    accuracy: null,
  });

  const refresh = useCallback(async () => {
    if (categories.length === 0) {
      setRecommendation({
        continueCategoryId: undefined,
        recommendedCategoryId: undefined,
        recommendedKind: 'chapter',
        reason: 'start',
        wrongCount: 0,
        accuracy: null,
      });
      return;
    }

    const [questions, attempts, mistakes] = await Promise.all([
      getQuestionsByCategory(db, stateCode),
      db.getAllAsync<{ question_id: string; is_correct: number; answered_at: string }>(
        'SELECT question_id, is_correct, answered_at FROM user_question_attempts WHERE exam_version_code = ? ORDER BY answered_at DESC',
        stateCode
      ),
      db.getAllAsync<{ question_id: string; mistake_count: number; last_wrong_at: string | null }>(
        'SELECT question_id, mistake_count, last_wrong_at FROM user_mistake_status WHERE exam_version_code = ? AND is_active = 1 ORDER BY last_wrong_at DESC',
        stateCode
      ),
    ]);

    const metrics = new Map<string, { attempts: number; correct: number; wrongCount: number }>(
      categories.map((category) => [
        category.id,
        {
          attempts: 0,
          correct: 0,
          wrongCount: 0,
        },
      ])
    );
    const questionToCategory = new Map(questions.map((question) => [question.id, question.categoryId] as const));

    for (const attempt of attempts) {
      const categoryId = questionToCategory.get(attempt.question_id);
      if (!categoryId) {
        continue;
      }

      const categoryMetrics = metrics.get(categoryId);
      if (!categoryMetrics) {
        continue;
      }

      categoryMetrics.attempts += 1;
      if (attempt.is_correct === 1) {
        categoryMetrics.correct += 1;
      }
    }

    for (const mistake of mistakes) {
      const categoryId = questionToCategory.get(mistake.question_id);
      if (!categoryId) {
        continue;
      }

      const categoryMetrics = metrics.get(categoryId);
      if (!categoryMetrics) {
        continue;
      }

      categoryMetrics.wrongCount += mistake.mistake_count;
    }

    const lastAttemptCategoryId = attempts.length > 0
      ? questionToCategory.get(attempts[0].question_id) ?? categories[0]?.id
      : categories[0]?.id;

    const categoriesByMistakes = categories
      .map((category) => ({
        categoryId: category.id,
        wrongCount: metrics.get(category.id)?.wrongCount ?? 0,
      }))
      .filter((item) => item.wrongCount > 0)
      .sort((left, right) => right.wrongCount - left.wrongCount);

    if (categoriesByMistakes.length > 0) {
      const topCategory = categoriesByMistakes[0];
      const accuracy = (() => {
        const categoryMetrics = metrics.get(topCategory.categoryId);
        if (!categoryMetrics || categoryMetrics.attempts === 0) {
          return null;
        }

        return Math.round((categoryMetrics.correct / categoryMetrics.attempts) * 100);
      })();

      setRecommendation({
        continueCategoryId: lastAttemptCategoryId,
        recommendedCategoryId: topCategory.categoryId,
        recommendedKind:
          topCategory.categoryId === buildStateScopedCategoryId(stateCode, TRAFFIC_SIGNS_BASE_CATEGORY_ID) && topCategory.wrongCount >= 3
            ? 'roadSigns'
            : 'chapter',
        reason: 'mistakes',
        wrongCount: topCategory.wrongCount,
        accuracy,
      });
      return;
    }

    const categoriesByAccuracy = categories
      .map((category) => {
        const categoryMetrics = metrics.get(category.id);
        const accuracy = categoryMetrics && categoryMetrics.attempts > 0
          ? Math.round((categoryMetrics.correct / categoryMetrics.attempts) * 100)
          : null;

        return {
          categoryId: category.id,
          accuracy,
        };
      })
      .filter((item): item is { categoryId: string; accuracy: number } => item.accuracy !== null)
      .sort((left, right) => left.accuracy - right.accuracy);

    if (categoriesByAccuracy.length > 0) {
      const weakestCategory = categoriesByAccuracy[0];

      setRecommendation({
        continueCategoryId: lastAttemptCategoryId,
        recommendedCategoryId: weakestCategory.categoryId,
        recommendedKind:
          weakestCategory.categoryId === buildStateScopedCategoryId(stateCode, TRAFFIC_SIGNS_BASE_CATEGORY_ID) && weakestCategory.accuracy < 70
            ? 'roadSigns'
            : 'chapter',
        reason: 'accuracy',
        wrongCount: 0,
        accuracy: weakestCategory.accuracy,
      });
      return;
    }

    setRecommendation({
      continueCategoryId: categories[0]?.id,
      recommendedCategoryId: categories[0]?.id,
      recommendedKind: 'chapter',
      reason: 'start',
      wrongCount: 0,
      accuracy: null,
    });
  }, [categories, contentRevision, db, stateCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return recommendation;
}

export function useCategoryPerformance(categories: Category[]) {
  const db = useDatabase();
  const stateCode = useAppStore((state) => state.stateCode);
  const contentRevision = useAppStore((state) => state.contentRevision);
  const [performance, setPerformance] = useState<Record<string, { attempts: number; accuracy: number }>>({});

  const refresh = useCallback(async () => {
    if (categories.length === 0) {
      setPerformance({});
      return;
    }

    const [questions, attempts] = await Promise.all([
      getQuestionsByCategory(db, stateCode),
      db.getAllAsync<{ question_id: string; is_correct: number }>(
        'SELECT question_id, is_correct FROM user_question_attempts WHERE exam_version_code = ? ORDER BY answered_at DESC',
        stateCode
      ),
    ]);

    const questionToCategory = new Map(questions.map((question) => [question.id, question.categoryId] as const));
    const metrics = new Map<string, { attempts: number; correct: number }>(
      categories.map((category) => [
        category.id,
        {
          attempts: 0,
          correct: 0,
        },
      ])
    );

    for (const attempt of attempts) {
      const categoryId = questionToCategory.get(attempt.question_id);
      if (!categoryId) {
        continue;
      }

      const entry = metrics.get(categoryId);
      if (!entry) {
        continue;
      }

      entry.attempts += 1;
      if (attempt.is_correct === 1) {
        entry.correct += 1;
      }
    }

    setPerformance(
      Object.fromEntries(
        Array.from(metrics.entries()).map(([categoryId, entry]) => [
          categoryId,
          {
            attempts: entry.attempts,
            accuracy: entry.attempts > 0 ? Math.round((entry.correct / entry.attempts) * 100) : 0,
          },
        ])
      )
    );
  }, [categories, contentRevision, db, stateCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return performance;
}
