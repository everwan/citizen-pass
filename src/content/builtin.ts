import { getAvailableContentStateCodes, getStateContent } from '../data/stateContent';
import { StateCode } from '../types';
import { RemoteBundlePayload } from './types';

const BUILTIN_CONTENT_VERSION = '2026.04.18';

export function getBuiltinBundleId(type: 'question-bank' | 'guide' | 'glossary', targetCode: StateCode) {
  return `${type}-${targetCode}`;
}

export function getBuiltinContentVersion() {
  return BUILTIN_CONTENT_VERSION;
}

export function getBuiltinContentBundles(): RemoteBundlePayload[] {
  const bundles: RemoteBundlePayload[] = [];

  for (const stateCode of getAvailableContentStateCodes()) {
    const content = getStateContent(stateCode);
    if (!content) {
      continue;
    }

    if (content.categories.length > 0 && Object.keys(content.questionsByCategory).length > 0) {
      bundles.push({
        type: 'question-bank',
        targetCode: stateCode,
        version: getBuiltinContentVersion(),
        categories: content.categories,
        questionsByCategory: content.questionsByCategory,
        highFrequencyQuestionIds: content.highFrequencyQuestionIds,
        mockQuestionIds: content.mockQuestionIds,
      });
    }

    if (content.guideArticles.length > 0) {
      bundles.push({
        type: 'guide',
        targetCode: stateCode,
        version: getBuiltinContentVersion(),
        guideArticles: content.guideArticles,
      });
    }

    if (content.glossaryTerms.length > 0) {
      bundles.push({
        type: 'glossary',
        targetCode: stateCode,
        version: getBuiltinContentVersion(),
        glossaryTerms: content.glossaryTerms,
      });
    }
  }

  return bundles;
}
