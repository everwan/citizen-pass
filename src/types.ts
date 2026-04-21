export type LanguageCode = 'en' | 'zh';
export type StudyMode = 'zh-first' | 'en-first';
export type ExamVersionCode = '2008' | '2025';
export type StateCode = ExamVersionCode | 'CA' | 'NY';
export type QuestionDisplayMode = 'english' | 'bilingual';

export type RootStackParamList = {
  Welcome: undefined;
  LanguageSelect: undefined;
  StudyModeSelect: undefined;
  StateSelect: undefined;
  MainTabs: undefined;
  Settings: {
    entryPoint?: 'HomeTab' | 'PracticeHome' | 'GuideHome' | string;
    autoPurchasePremium?: boolean;
  } | undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  PracticeTab: undefined;
  ListeningTab: undefined;
  GuideTab: undefined;
};

export type QuestionOption = {
  key: 'A' | 'B' | 'C' | 'D';
  textEn: string;
  textZh: string;
  isCorrect: boolean;
};

export type QuestionImage = {
  src: string;
  alt?: string;
};

export type Question = {
  id: string;
  examVersionCode?: ExamVersionCode;
  categoryId: string;
  categoryLabel: string;
  questionEn: string;
  questionZh: string;
  explanationEn: string;
  explanationZh: string;
  memoryTipEn?: string;
  memoryTipZh?: string;
  image?: QuestionImage;
  currentAnswerReviewDate?: string | null;
  currentAnswerSourceUrl?: string | null;
  options: QuestionOption[];
};

export type Category = {
  id: string;
  nameEn: string;
  nameZh: string;
  questionCount: number;
  progress: number;
  accuracy: number;
};

export type GuideArticle = {
  slug: string;
  titleEn: string;
  titleZh: string;
  contentEn: string;
  contentZh: string;
  officialUrl?: string;
};

export type GlossaryTerm = {
  termEn: string;
  termZh: string;
  definitionZh: string;
  sourceTag?: 'reading' | 'writing' | 'both';
};

export type HandbookDirectoryItem = {
  slug: string;
  anchorEn: string;
  anchorZh: string;
  titleEn: string;
  titleZh: string;
};

export type HandbookDirectorySection = {
  slug: string;
  order: number;
  titleEn: string;
  titleZh: string;
  remoteFileEn: string;
  remoteFileZh: string;
  items: HandbookDirectoryItem[];
};

export type HandbookNativeBlock =
  | {
      type: 'heading';
      level: number;
      text: string;
    }
  | {
      type: 'paragraph';
      text: string;
    }
  | {
      type: 'list';
      ordered: boolean;
      items: string[];
    }
  | {
      type: 'image';
      src: string;
      alt?: string;
      caption?: string;
    }
  | {
      type: 'table';
      headers: string[];
      rows: string[][];
    }
  | {
      type: 'note';
      tone: 'important' | 'note';
      text: string;
    };

export type HandbookNativeItemContent = {
  blocks: HandbookNativeBlock[];
};

export type HandbookNativeChapter = {
  id: string;
  slug: string;
  title: string;
  introBlocks: HandbookNativeBlock[];
  itemsByAnchor: Record<string, HandbookNativeItemContent>;
};
