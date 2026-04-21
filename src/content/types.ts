import { Category, GlossaryTerm, GuideArticle, Question } from '../types';

export type RemoteBundleType = 'question-bank' | 'guide' | 'glossary';
export type RemoteUpdateMode = 'silent' | 'recommended' | 'required' | 'disabled';

export type RemoteUpdatePolicy = {
  mode: RemoteUpdateMode;
  wifiOnly?: boolean;
  retryable?: boolean;
  forceReloadAfterApply?: boolean;
};

export type RemoteContentBundleManifestItem = {
  id: string;
  type: RemoteBundleType;
  targetCode: string;
  version: string;
  url: string;
  sha256: string;
  updatePolicy: RemoteUpdatePolicy;
};

export type RemoteContentManifest = {
  schemaVersion: number;
  publishedAt: string;
  releaseRules: {
    checkIntervalHours: number;
    maxParallelDownloads: number;
    fallbackToBuiltinOnFailure: boolean;
  };
  bundles: RemoteContentBundleManifestItem[];
};

export type RemoteQuestionBankBundle = {
  type: 'question-bank';
  targetCode: string;
  version: string;
  categories: Category[];
  questionsByCategory: Record<string, Question[]>;
  highFrequencyQuestionIds: string[];
  mockQuestionIds: string[];
};

export type RemoteGuideBundle = {
  type: 'guide';
  targetCode: string;
  version: string;
  guideArticles: GuideArticle[];
};

export type RemoteGlossaryBundle = {
  type: 'glossary';
  targetCode: string;
  version: string;
  glossaryTerms: GlossaryTerm[];
};

export type RemoteBundlePayload = RemoteQuestionBankBundle | RemoteGuideBundle | RemoteGlossaryBundle;

export type AppliedRemoteBundle = {
  bundleId: string;
  type: RemoteBundleType;
  targetCode: string;
  version: string;
};

export type RemoteContentUpdateCheckResult = {
  appliedBundles: AppliedRemoteBundle[];
  recommendedBundles: RemoteContentBundleManifestItem[];
};
