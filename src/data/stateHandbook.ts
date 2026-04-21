import { LanguageCode, StateCode } from '../types';
import { handbookDirectorySections as californiaHandbookDirectorySections } from './handbookDirectory';
import { getHandbookNativeChapter as getCaliforniaHandbookNativeChapter } from './handbookNativeContent';
import { handbookCanonicalZhTitleByEnglish, refineHandbookZhText } from './handbookTranslations';
import { HandbookDirectorySection, HandbookNativeBlock, HandbookNativeChapter } from '../types';

type HandbookManualData = {
  meta: {
    title: string;
    titleShort: string;
  };
  directorySections: HandbookDirectorySection[];
  nativeChapters: HandbookNativeChapter[];
};

const nyHandbookManualEn = require('./handbook-data/ny/en/manual.json') as HandbookManualData;
const nyHandbookManualZh = require('./handbook-data/ny/zh/manual.json') as HandbookManualData;

type StateHandbookSource = {
  titleEn: string;
  titleZh: string;
  getDirectorySections: (language: LanguageCode) => typeof californiaHandbookDirectorySections;
  getNativeChapter: typeof getCaliforniaHandbookNativeChapter;
  formatTitle: (language: LanguageCode, titleEn: string, titleZh: string) => string;
};

const californiaHandbookSource: StateHandbookSource = {
  titleEn: 'California Driver Handbook',
  titleZh: '加州驾驶员手册',
  getDirectorySections: () => californiaHandbookDirectorySections,
  getNativeChapter: getCaliforniaHandbookNativeChapter,
  formatTitle: (language, titleEn, titleZh) => {
    if (language === 'en') {
      return titleEn;
    }

    return refineHandbookZhText(handbookCanonicalZhTitleByEnglish[titleEn] ?? titleZh);
  },
};

const nyHandbookSource: StateHandbookSource = {
  titleEn: nyHandbookManualEn.meta.title,
  titleZh: nyHandbookManualZh.meta.titleShort,
  getDirectorySections: (language) =>
    language === 'zh' ? nyHandbookManualZh.directorySections : nyHandbookManualEn.directorySections,
  getNativeChapter: (language, sectionId) => {
    const manual = language === 'zh' ? nyHandbookManualZh : nyHandbookManualEn;
    return manual.nativeChapters.find((chapter) => chapter.id === sectionId)
      ?? manual.nativeChapters[0];
  },
  formatTitle: (_language, titleEn, titleZh) => titleZh || titleEn,
};

const handbookSourceByState: Partial<Record<StateCode, StateHandbookSource>> = {
  '2008': californiaHandbookSource,
  '2025': nyHandbookSource,
  CA: californiaHandbookSource,
  NY: nyHandbookSource,
};

function normalizeZhHandbookBlock(block: HandbookNativeBlock): HandbookNativeBlock {
  if (block.type === 'paragraph' || block.type === 'note') {
    return {
      ...block,
      text: refineHandbookZhText(block.text),
    };
  }

  if (block.type === 'heading') {
    return {
      ...block,
      text: refineHandbookZhText(block.text),
    };
  }

  if (block.type === 'list') {
    return {
      ...block,
      items: block.items.map((item) => refineHandbookZhText(item)),
    };
  }

  if (block.type === 'image') {
    return {
      ...block,
      alt: block.alt ? refineHandbookZhText(block.alt) : block.alt,
      caption: block.caption ? refineHandbookZhText(block.caption) : block.caption,
    };
  }

  if (block.type === 'table') {
    return {
      ...block,
      headers: block.headers.map((item) => refineHandbookZhText(item)),
      rows: block.rows.map((row) => row.map((cell) => refineHandbookZhText(cell))),
    };
  }

  return block;
}

function normalizeZhHandbookChapter(chapter: HandbookNativeChapter): HandbookNativeChapter {
  return {
    ...chapter,
    title: refineHandbookZhText(chapter.title),
    introBlocks: chapter.introBlocks.map(normalizeZhHandbookBlock),
    itemsByAnchor: Object.fromEntries(
      Object.entries(chapter.itemsByAnchor).map(([anchor, item]) => [
        anchor,
        {
          ...item,
          blocks: item.blocks.map(normalizeZhHandbookBlock),
        },
      ])
    ),
  };
}

export function hasStateHandbook(stateCode: StateCode) {
  return Boolean(handbookSourceByState[stateCode]);
}

export function getStateHandbookDirectorySections(stateCode: StateCode, language: LanguageCode) {
  const sections = handbookSourceByState[stateCode]?.getDirectorySections(language) ?? [];
  if (language !== 'zh') {
    return sections;
  }

  return sections.map((section) => ({
    ...section,
    titleZh: refineHandbookZhText(section.titleZh),
    items: section.items.map((item) => ({
      ...item,
      titleZh: refineHandbookZhText(item.titleZh),
    })),
  }));
}

export function getStateHandbookDirectorySection(stateCode: StateCode, language: LanguageCode, sectionSlug?: string) {
  const sections = getStateHandbookDirectorySections(stateCode, language);
  return sections.find((section) => section.slug === sectionSlug) ?? sections[0];
}

export function getStateHandbookNativeChapter(stateCode: StateCode, language: LanguageCode, sectionId: string) {
  const source = handbookSourceByState[stateCode];
  const chapter = source?.getNativeChapter(language, sectionId) ?? getCaliforniaHandbookNativeChapter(language, sectionId);
  return language === 'zh' ? normalizeZhHandbookChapter(chapter) : chapter;
}

export function formatStateHandbookTitle(
  stateCode: StateCode,
  language: LanguageCode,
  titleEn: string,
  titleZh: string
) {
  const source = handbookSourceByState[stateCode];
  if (!source) {
    return language === 'zh' ? titleZh : titleEn;
  }

  return source.formatTitle(language, titleEn, titleZh);
}

export function getStateHandbookTitle(stateCode: StateCode, language: LanguageCode) {
  const source = handbookSourceByState[stateCode];
  if (!source) {
    return language === 'zh' ? '驾驶员手册' : 'Driver Handbook';
  }

  return language === 'zh' ? source.titleZh : source.titleEn;
}
