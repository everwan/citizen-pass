import { Category, GlossaryTerm, GuideArticle, Question } from '../../types';

export type StateQuestionBank = {
  bundleVersion?: string;
  generatedAt?: string;
  testUpdatesReviewedDate?: string | null;
  testUpdatesSourceUrl?: string | null;
  categories: Category[];
  questionsByCategory: Record<string, Question[]>;
  guideArticles: GuideArticle[];
  glossaryTerms: GlossaryTerm[];
  highFrequencyQuestionIds: string[];
  mockQuestionIds: string[];
};

export function defineStateQuestionBank(questionBank: StateQuestionBank) {
  return questionBank;
}
