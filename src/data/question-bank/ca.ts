import {
  categories,
  glossaryTerms,
  guideArticles,
  highFrequencyQuestionIds,
  mockQuestionIds,
  questionsByCategory,
} from '../sampleData';
import { defineStateQuestionBank } from './types';

export const californiaQuestionBank = defineStateQuestionBank({
  categories,
  questionsByCategory,
  guideArticles,
  glossaryTerms,
  highFrequencyQuestionIds,
  mockQuestionIds,
});
