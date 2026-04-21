import { StateCode } from '../types';
import { defaultStateCode } from './stateConfig';
import {
  uscis2008QuestionBank,
  uscis2025QuestionBank,
  StateQuestionBank,
  validateStateQuestionBank,
} from './question-bank';

export const TRAFFIC_SIGNS_BASE_CATEGORY_ID = 'traffic-signals-and-signs';

export type StateContentBundle = StateQuestionBank;

const baseContentByState: Partial<Record<StateCode, StateQuestionBank>> = {
  '2008': uscis2008QuestionBank,
  '2025': uscis2025QuestionBank,
};

for (const [stateCode, content] of Object.entries(baseContentByState) as [StateCode, StateQuestionBank][]) {
  validateStateQuestionBank(stateCode, content);
}

const questionImageById = new Map(
  Object.values(baseContentByState)
    .flatMap((content) => Object.values(content?.questionsByCategory ?? {}).flat())
    .filter((question) => question.image?.src)
    .map((question) => [question.id, question.image] as const)
);

const scopedContentCache = new Map<StateCode, StateContentBundle>();
const questionSetOverrides = new Map<
  StateCode,
  {
    highFrequencyQuestionIds?: string[];
    mockQuestionIds?: string[];
  }
>();

export function buildStateScopedCategoryId(stateCode: StateCode, categoryId: string) {
  return `${stateCode}:${categoryId}`;
}

export function getBaseCategoryId(categoryId: string) {
  const separatorIndex = categoryId.indexOf(':');
  return separatorIndex >= 0 ? categoryId.slice(separatorIndex + 1) : categoryId;
}

export function isTrafficSignsCategoryId(stateCode: StateCode, categoryId: string) {
  return categoryId === buildStateScopedCategoryId(stateCode, TRAFFIC_SIGNS_BASE_CATEGORY_ID);
}

export function hasStateContent(stateCode: StateCode) {
  return Boolean(baseContentByState[stateCode]);
}

export function getAvailableContentStateCodes() {
  return Object.keys(baseContentByState) as StateCode[];
}

export function getStateContent(stateCode: StateCode): StateContentBundle | null {
  const cached = scopedContentCache.get(stateCode);
  if (cached) {
    return cached;
  }

  const baseContent = baseContentByState[stateCode] ?? baseContentByState[defaultStateCode];
  if (!baseContent) {
    return null;
  }

  const categories = baseContent.categories.map((category) => ({
    ...category,
    id: buildStateScopedCategoryId(stateCode, category.id),
  }));

  const questionsByCategory = Object.fromEntries(
    Object.entries(baseContent.questionsByCategory).map(([categoryId, questions]) => {
      const scopedCategoryId = buildStateScopedCategoryId(stateCode, categoryId);

      return [
        scopedCategoryId,
        questions.map((question) => ({
          ...question,
          categoryId: scopedCategoryId,
        })),
      ];
    })
  );

  const scopedContent: StateContentBundle = {
    categories,
    questionsByCategory,
    guideArticles: baseContent.guideArticles,
    glossaryTerms: baseContent.glossaryTerms,
    highFrequencyQuestionIds: questionSetOverrides.get(stateCode)?.highFrequencyQuestionIds ?? baseContent.highFrequencyQuestionIds,
    mockQuestionIds: questionSetOverrides.get(stateCode)?.mockQuestionIds ?? baseContent.mockQuestionIds,
  };

  scopedContentCache.set(stateCode, scopedContent);
  return scopedContent;
}

export function getHighFrequencyQuestionIds(stateCode: StateCode) {
  return getStateContent(stateCode)?.highFrequencyQuestionIds ?? [];
}

export function getMockQuestionIds(stateCode: StateCode) {
  return getStateContent(stateCode)?.mockQuestionIds ?? [];
}

export function setQuestionSetOverrides(
  stateCode: StateCode,
  overrides: {
    highFrequencyQuestionIds?: string[];
    mockQuestionIds?: string[];
  }
) {
  const nextOverrides = {
    ...(questionSetOverrides.get(stateCode) ?? {}),
    ...overrides,
  };

  questionSetOverrides.set(stateCode, nextOverrides);
  scopedContentCache.delete(stateCode);
}

export function getQuestionImageById(questionId: string) {
  return questionImageById.get(questionId);
}

export function getTotalQuestionCountForState(stateCode: StateCode) {
  return Object.values(getStateContent(stateCode)?.questionsByCategory ?? {}).reduce(
    (sum, questions) => sum + questions.length,
    0
  );
}
