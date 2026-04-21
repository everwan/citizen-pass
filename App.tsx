import { CommonActions, NavigationContainer, DefaultTheme, TabActions, createNavigationContainerRef, useIsFocused, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { StatusBar } from 'expo-status-bar';
import {
  AudioModule,
  createAudioPlayer,
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Localization from 'expo-localization';
import * as Speech from 'expo-speech';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Alert, AppState, AppStateStatus, FlatList, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { getAnswerAudioSource, getQuestionAudioSource } from './src/audio/uscisAudio';
import { getCopy, getModeLabel } from './src/copy';
import { availableAppStates, defaultStateCode, getStateDmvLabel, getStateGuideLabel } from './src/data/stateConfig';
import { buildStateScopedCategoryId, getHighFrequencyQuestionIds, getMockQuestionIds, TRAFFIC_SIGNS_BASE_CATEGORY_ID } from './src/data/stateContent';
import {
  formatStateHandbookTitle,
  getStateHandbookDirectorySection,
  getStateHandbookDirectorySections,
  getStateHandbookNativeChapter,
  getStateHandbookTitle,
} from './src/data/stateHandbook';
import i18n from './src/i18n';
import { roadSignByQuestionCode, roadSigns, RoadSign, roadSignSectionMeta } from './src/data/roadSignData';
import { buildRoadSignQuestionFromSign, buildRoadSignQuestionId, getRoadSignIdFromQuestionId } from './src/data/roadSignQuestions';
import { getRoadSignAssetSource, roadSignAssetMap } from './src/data/roadSignAssets';
import {
  getRoadSignIdsForState,
  getRoadSignPackHomeSubtitle,
  getRoadSignPackIntroBody,
  getRoadSignPackPracticeBody,
  getRoadSignPackSummaryTitle,
  getRoadSignGroupsForState,
  getRoadSignsForState,
  getRoadSignTagLabels,
  nyHandbookRoadSignIds,
  nyOfficialRoadSignIds,
} from './src/data/roadSignPack';
import { NativePracticeAdCard } from './src/ads/NativePracticeAdCard';
import {
  FREE_DAILY_MOCK_TEST_LIMIT,
  FREE_LISTENING_QUESTION_LIMIT,
  canListenToQuestion,
  canRevealPracticeExplanations,
  canUseBlindListening,
  canUseUnlimitedMockTests,
} from './src/billing/entitlements';
import { isBillingConfigured } from './src/billing/config';
import {
  classifyBillingError,
  getBillingSetupInstructions,
  getCustomerPremiumStatus,
  getPremiumProducts,
  initializeBilling,
  pickPreferredPremiumProduct,
  purchasePremiumProduct,
  restorePurchases,
  subscribeToBillingUpdates,
  type PremiumProduct,
} from './src/billing/service';
import {
  getAdsDebugState,
  NativeAd,
  initializeAds,
  loadPracticeNativeAd,
  prepareMockInterstitialAd,
  reinitializeAdsConsent,
  showAppOpenAdIfAvailable,
  showMockInterstitialAd,
  showPreparedMockInterstitialAd,
  subscribeToAdsDebug,
} from './src/ads/service';
import { DatabaseProvider, useDatabase } from './src/db/provider';
import { applyRemoteManifestBundle, checkForRemoteContentUpdates } from './src/content/remoteContentService';
import { useCategories, useCategoryPerformance, useGlossaryTerms, useGuideArticles, useHandbookLearned, useHomeRecommendation, useHydratePreferences, useQuestionList, useQuestions, useSingleQuestion, useUserStats } from './src/hooks/useAppData';
import {
  getListeningResumeQuestionId,
  clearRoadSignResumeId,
  incrementTodayMockTestUsage,
  getRoadSignResumeId,
  getTodayMockTestUsage,
  isQuestionSaved,
  markHandbookItemLearned,
  recordAttempt,
  saveBillingState,
  saveListeningResumeQuestionId,
  saveRoadSignResumeId,
  savePreference,
  toggleSavedQuestion,
} from './src/repositories/userRepository';
import { useAppStore } from './src/store/useAppStore';
import { HandbookNativeBlock, HandbookNativeItemContent, Question, RootStackParamList, StateCode, StudyMode, TabParamList } from './src/types';

const appVersion = require('./app.json').expo.version as string;

function getStateContentDescription(stateCode: StateCode, language: 'en' | 'zh') {
  if (stateCode === '2008') {
    return language === 'zh'
      ? '适用于 2025 年 10 月 20 日之前提交 N-400 的申请人。'
      : 'For applicants who filed Form N-400 before October 20, 2025.';
  }

  return language === 'zh'
    ? '适用于 2025 年 10 月 20 日及之后提交 N-400 的申请人。'
    : 'For applicants who filed Form N-400 on or after October 20, 2025.';
}

type PremiumGateReason =
  | 'ads'
  | 'blind-listening'
  | 'practice-explanations'
  | 'listening-limit'
  | 'mock-limit';

function showPremiumUpgradePrompt(language: 'en' | 'zh', reason: PremiumGateReason, details?: { remainingMocks?: number }) {
  const copyByReason = {
    ads: {
      title: language === 'zh' ? '会员可去除广告' : 'Premium removes ads',
      message: language === 'zh'
        ? '开通会员后，练习、模拟考试和应用内的广告都会关闭。'
        : 'Upgrade to Premium to remove ads throughout practice, mock tests, and the rest of the app.',
    },
    'blind-listening': {
      title: language === 'zh' ? '盲听模式仅限会员' : 'Blind listening is Premium only',
      message: language === 'zh'
        ? '盲听模式需要会员权限。开通后可以自动隐藏题目并直接进入听题训练。'
        : 'Blind listening requires Premium. Upgrade to auto-hide prompts and train in full listening mode.',
    },
    'practice-explanations': {
      title: language === 'zh' ? '答案与解析仅限会员' : 'Answers and explanations are Premium only',
      message: language === 'zh'
        ? '免费用户练习后不会显示正确答案区和解析区。开通会员后可完整查看。'
        : 'Free practice hides the correct-answer and explanation sections. Upgrade to Premium for the full review.',
    },
    'listening-limit': {
      title: language === 'zh' ? '听题额度已用完' : 'Listening limit reached',
      message: language === 'zh'
        ? `免费用户每轮只可听前 ${FREE_LISTENING_QUESTION_LIMIT} 道题。开通会员后可无限听题。`
        : `Free users can listen to only the first ${FREE_LISTENING_QUESTION_LIMIT} questions in a session. Upgrade to Premium for unlimited listening.`,
    },
    'mock-limit': {
      title: language === 'zh' ? '今日模拟次数已达上限' : 'Daily mock limit reached',
      message: language === 'zh'
        ? `免费用户每天最多开始 ${FREE_DAILY_MOCK_TEST_LIMIT} 次模拟考试。开通会员后可不限次数。${typeof details?.remainingMocks === 'number' && details.remainingMocks > 0 ? ` 今天还剩 ${details.remainingMocks} 次。` : ''}`
        : `Free users can start up to ${FREE_DAILY_MOCK_TEST_LIMIT} mock tests per day. Upgrade to Premium for unlimited mock tests.${typeof details?.remainingMocks === 'number' && details.remainingMocks > 0 ? ` You have ${details.remainingMocks} left today.` : ''}`,
    },
  } as const;

  const selectedCopy = copyByReason[reason];

  Alert.alert(
    selectedCopy.title,
    selectedCopy.message,
    [
      {
        text: language === 'zh' ? '稍后' : 'Later',
        style: 'cancel',
      },
      {
        text: language === 'zh' ? '开通会员' : 'Unlock Premium',
        onPress: () => {
          if (!navigationRef.isReady()) {
            return;
          }
          navigationRef.navigate('Settings', { autoPurchasePremium: true } as never);
        },
      },
    ]
  );
}

function getBillingErrorMessage(language: 'en' | 'zh', error: unknown, action: 'purchase' | 'restore') {
  const code = classifyBillingError(error);

  if (code === 'network') {
    return language === 'zh'
      ? '网络连接异常，请检查网络后重试。'
      : 'Network error. Please check your connection and try again.';
  }

  if (code === 'store-unavailable') {
    return language === 'zh'
      ? 'App Store 当前不可用，请稍后重试。'
      : 'App Store is currently unavailable. Please try again later.';
  }

  if (code === 'purchase-not-allowed') {
    return language === 'zh'
      ? '当前设备不允许内购，请检查“屏幕使用时间/购买限制”设置。'
      : 'In-app purchases are not allowed on this device. Check Screen Time / purchase restrictions.';
  }

  if (code === 'already-owned') {
    return language === 'zh'
      ? '检测到你可能已经购买过，请点击“恢复购买”同步会员状态。'
      : 'This product may already be owned. Tap Restore Purchases to sync Premium access.';
  }

  if (code === 'invalid-offering' || code === 'configuration') {
    return language === 'zh'
      ? '商品配置异常，请检查 App Store Connect 与 RevenueCat 的产品映射。'
      : 'Product configuration issue. Verify your App Store Connect and RevenueCat mapping.';
  }

  return action === 'purchase'
    ? (language === 'zh' ? '暂时无法完成购买，请稍后重试。' : 'Unable to complete the purchase right now. Please try again later.')
    : (language === 'zh' ? '暂时无法恢复购买，请稍后重试。' : 'Unable to restore purchases right now. Please try again later.');
}

async function maybeConsumeMockTestStart(db: ReturnType<typeof useDatabase>) {
  if (canUseUnlimitedMockTests()) {
    return true;
  }

  const usage = await getTodayMockTestUsage(db);
  const remainingMocks = Math.max(0, FREE_DAILY_MOCK_TEST_LIMIT - usage.count);

  if (usage.count >= FREE_DAILY_MOCK_TEST_LIMIT) {
    showPremiumUpgradePrompt(useAppStore.getState().language, 'mock-limit', { remainingMocks });
    return false;
  }

  await incrementTodayMockTestUsage(db);
  return true;
}

async function persistPremiumAccess(db: ReturnType<typeof useDatabase>, isPremium: boolean) {
  const effectivePremium = FORCE_PREMIUM_FOR_TESTING || isPremium;
  useAppStore.getState().setIsPremium(effectivePremium);

  if (!effectivePremium && useAppStore.getState().blindListeningEnabled) {
    useAppStore.getState().setBlindListeningEnabled(false);
    await savePreference(db, 'blindListeningEnabled', 'false');
  }

  await saveBillingState(db, { isPremium: effectivePremium });
}

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const PracticeStack = createNativeStackNavigator();
const HandbookStack = createNativeStackNavigator();
const GuideStack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

type ScreenshotTarget =
  | 'home'
  | 'practice'
  | 'question-bilingual'
  | 'question-answered'
  | 'signs'
  | 'listening'
  | 'guide'
  | 'mock-intro'
  | 'mock-result';

type ScreenshotRequest = {
  target: ScreenshotTarget;
  language?: 'en' | 'zh';
  mode?: StudyMode;
};

const screenshotLaunchRequestPath = LegacyFileSystem.documentDirectory
  ? `${LegacyFileSystem.documentDirectory}screenshot-request.txt`
  : null;

const FORCE_PREMIUM_FOR_TESTING = false;

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f4efe6',
    card: '#f8f4ec',
    text: '#172126',
    border: '#dccdb7',
    primary: '#165a72',
    notification: '#ca4d2f',
  },
};

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => char + char)
        .join('')
    : normalized;
  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildTtsReadyEnglish(text: string) {
  return text
    .replace(/\bUSCIS\b/gi, 'U S C I S')
    .replace(/\bU\.S\.\b/g, 'United States')
    .replace(/\bN[-\s]?400\b/gi, 'N 400')
    .replace(/\bN[-\s]?6\b/gi, 'N 6')
    .replace(/\s*\/\s*/g, ' or ')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\((.*?)\)/g, ', $1, ')
    .replace(/[:;]+/g, '. ')
    .replace(/[–—]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isEnglishVoiceLanguage(languageTag?: string | null) {
  if (!languageTag) {
    return false;
  }

  return /^en([-_]|$)/i.test(languageTag.trim());
}

function choosePreferredEnglishVoice(
  voices: Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>
) {
  const englishVoices = voices.filter((voice) => isEnglishVoiceLanguage(voice.language));
  if (englishVoices.length === 0) {
    return null;
  }

  const usVoices = englishVoices.filter((voice) => /en[-_]us/i.test(voice.language ?? ''));
  const voicePool = usVoices.length > 0 ? usVoices : englishVoices;
  const preferredNames = ['samantha', 'ava', 'allison', 'susan'];

  return preferredNames
    .map((name) => voicePool.find((voice) => voice.name?.toLowerCase().includes(name)))
    .find(Boolean)
    ?? voicePool.find((voice) => voice.quality === 'Enhanced')
    ?? voicePool[0]
    ?? null;
}

function getTtsRate(rawRate: number) {
  if (rawRate <= 0.5) {
    return 0.47;
  }
  if (rawRate <= 0.75) {
    return 0.68;
  }
  if (rawRate <= 1) {
    return 0.86;
  }
  return 1.02;
}

type MinimalAudioPlayer = ReturnType<typeof createAudioPlayer>;

async function stopAudioPlayer(player: MinimalAudioPlayer) {
  try {
    if (player.playing) {
      player.pause();
    }
  } catch {}

  try {
    await player.seekTo(0);
  } catch {}
}

async function playLocalAudioSource(
  player: MinimalAudioPlayer,
  source: number,
  playbackRate: number,
  options?: {
    isCancelled?: () => boolean;
  }
) {
  const isCancelled = options?.isCancelled;

  if (isCancelled?.()) {
    throw new Error('sequence-cancelled');
  }

  player.replace(source);
  player.setPlaybackRate(playbackRate);
  await player.seekTo(0);
  player.play();

  let hasStarted = false;

  while (true) {
    if (isCancelled?.()) {
      await stopAudioPlayer(player);
      throw new Error('sequence-cancelled');
    }

    if (player.playing) {
      hasStarted = true;
    }

    const currentTime = Number(player.currentTime ?? 0);
    const duration = Number(player.duration ?? 0);
    const playbackFinished = hasStarted && !player.playing && (duration <= 0 || currentTime >= Math.max(0, duration - 0.08));

    if (playbackFinished) {
      break;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 120));
  }

  await stopAudioPlayer(player);
}

function handbookTitle(stateCode: StateCode, language: 'en' | 'zh', titleEn: string, titleZh: string) {
  return formatStateHandbookTitle(stateCode, language, titleEn, titleZh);
}

function normalizeHandbookHeadingKey(value: string) {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function resolveHandbookItemContent(
  stateCode: StateCode,
  language: 'en' | 'zh',
  chapter: any,
  item: { anchorEn: string; anchorZh: string; titleEn: string; titleZh: string }
) {
  const primaryAnchor = language === 'zh' ? item.anchorZh : item.anchorEn;
  const candidates = [
    primaryAnchor,
    item.anchorEn,
    item.anchorZh,
    item.titleEn,
    item.titleZh,
    handbookTitle(stateCode, language, item.titleEn, item.titleZh),
    handbookTitle(stateCode, 'zh', item.titleEn, item.titleZh),
    handbookTitle(stateCode, 'en', item.titleEn, item.titleZh),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const blocks = chapter.itemsByAnchor?.[candidate]?.blocks;
    if (blocks?.length) {
      return blocks;
    }
  }

  const normalizedCandidates = new Set(candidates.map((candidate) => normalizeHandbookHeadingKey(candidate)));

  for (const [anchor, content] of Object.entries(chapter.itemsByAnchor ?? {})) {
    if (normalizedCandidates.has(normalizeHandbookHeadingKey(anchor))) {
      return (content as HandbookNativeItemContent).blocks ?? [];
    }
  }

  return [];
}

function getHandbookItemBlocks(
  stateCode: StateCode,
  language: 'en' | 'zh',
  chapter: any,
  item: { anchorEn: string; anchorZh: string; titleEn: string; titleZh: string },
  index: number
) {
  const rawBlocks = [
    ...(index === 0 ? chapter.introBlocks : []),
    ...resolveHandbookItemContent(stateCode, language, chapter, item),
  ];
  const normalizedItemTitle = normalizeHandbookHeadingKey(
    handbookTitle(stateCode, language, item.titleEn, item.titleZh)
  );

  return rawBlocks.filter((block: HandbookNativeBlock, blockIndex: number) => {
    if (block.type !== 'heading' || blockIndex !== 0) {
      return true;
    }

    return normalizeHandbookHeadingKey(block.text) !== normalizedItemTitle;
  });
}

function getRenderableHandbookEntries(
  stateCode: StateCode,
  language: 'en' | 'zh',
  section: any,
  chapter: any
) {
  return section.items
    .map((item: any, index: number) => ({
      item,
      blocks: getHandbookItemBlocks(stateCode, language, chapter, item, index),
    }))
    .filter(({ blocks }: { blocks: HandbookNativeBlock[] }) => blocks.length > 0);
}

function parseScreenshotRequest(url: string): ScreenshotRequest | null {
  try {
    const parsed = new URL(url);
    const segments = [parsed.host, ...parsed.pathname.split('/').filter(Boolean)];

    if (segments[0] !== 'screenshot') {
      return null;
    }

    const target = segments[1] as ScreenshotTarget | undefined;
    if (!target) {
      return null;
    }

    const language = parsed.searchParams.get('lang');
    const mode = parsed.searchParams.get('mode');

    return {
      target,
      language: language === 'zh' || language === 'en' ? language : undefined,
      mode: mode === 'zh-first' || mode === 'en-first' ? mode : undefined,
    };
  } catch {
    return null;
  }
}

async function readScreenshotLaunchRequest() {
  if (!screenshotLaunchRequestPath) {
    return null;
  }

  try {
    const info = await LegacyFileSystem.getInfoAsync(screenshotLaunchRequestPath);
    if (!info.exists) {
      return null;
    }

    const rawValue = await LegacyFileSystem.readAsStringAsync(screenshotLaunchRequestPath);
    const trimmedValue = rawValue.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  } catch (error) {
    console.warn('Failed to read screenshot launch request', error);
    return null;
  }
}

function buildMockPreviewParams(stateCode: StateCode = defaultStateCode) {
  const mockQuestionIds = getMockQuestionIds(stateCode);
  const answers = Object.fromEntries(
    mockQuestionIds.map((questionId, index) => [questionId, index % 6 !== 0] as const),
  );
  const correctCount = Object.values(answers).filter(Boolean).length;

  return {
    total: mockQuestionIds.length,
    correctCount,
    answers,
  };
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleIds(ids: string[], count: number, seed: number) {
  if (count >= ids.length) {
    return [...ids];
  }

  const random = createSeededRandom(seed);
  const shuffled = [...ids];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, count);
}

function getMockExamRule(stateCode: StateCode) {
  if (stateCode === '2008') {
    return {
      totalQuestions: 10,
      correctToPass: 6,
      signQuestionCount: 0,
      signCorrectToPass: 0,
    };
  }

  return {
    totalQuestions: 20,
    correctToPass: 12,
    signQuestionCount: 0,
    signCorrectToPass: 0,
  };
}

function getMockPracticeCardBody(stateCode: StateCode, language: 'en' | 'zh') {
  const rule = getMockExamRule(stateCode);

  if (stateCode === '2008') {
    return language === 'zh'
      ? `${rule.totalQuestions}题，按 2008 版公民考试节奏出题`
      : `${rule.totalQuestions} questions using the 2008 civics test format.`;
  }

  return language === 'zh'
    ? `${rule.totalQuestions}题，按 2025 版公民考试节奏出题`
    : `${rule.totalQuestions} questions using the 2025 civics test format.`;
}

function getMockIntroSummary(stateCode: StateCode, language: 'en' | 'zh') {
  const rule = getMockExamRule(stateCode);

  if (stateCode === '2008') {
    return language === 'zh'
      ? `按 2008 版公民考试结构出题：共 ${rule.totalQuestions} 题，交卷后统一看结果。`
      : `Built around the 2008 civics test: ${rule.totalQuestions} questions total, with results shown after submission.`;
  }

  return language === 'zh'
    ? `按 2025 版公民考试结构出题：共 ${rule.totalQuestions} 题，交卷后统一查看结果和章节表现。`
    : `Built around the 2025 civics test: ${rule.totalQuestions} questions, with results and chapter feedback after submission.`;
}

function getMockFormatDescription(stateCode: StateCode, language: 'en' | 'zh') {
  const rule = getMockExamRule(stateCode);

  if (stateCode === '2008') {
    return language === 'zh'
      ? `单次完成 ${rule.totalQuestions} 题，交卷后统一查看结果。`
      : `Complete ${rule.totalQuestions} questions in one sitting and review results after submission.`;
  }

  return language === 'zh'
    ? `单次完成 ${rule.totalQuestions} 题，交卷后统一查看结果。`
    : `Complete ${rule.totalQuestions} questions in one sitting and review results after submission.`;
}

function getMockPassingDescription(stateCode: StateCode, language: 'en' | 'zh') {
  const rule = getMockExamRule(stateCode);

  if (stateCode === '2008') {
    return language === 'zh'
      ? `至少答对 ${rule.correctToPass}/${rule.totalQuestions} 题。`
      : `Get at least ${rule.correctToPass} of ${rule.totalQuestions} questions right.`;
  }

  return language === 'zh'
    ? `至少答对 ${rule.correctToPass}/${rule.totalQuestions} 题。`
    : `Get at least ${rule.correctToPass} of ${rule.totalQuestions} questions right.`;
}

function getMockResultSummary(params: {
  stateCode: StateCode;
  language: 'en' | 'zh';
  accuracy: number;
  passedByScore: boolean;
  passedBySigns: boolean;
  signCorrectCount: number;
}) {
  const { stateCode, language, accuracy, passedByScore, passedBySigns, signCorrectCount } = params;
  const rule = getMockExamRule(stateCode);

  if (stateCode === '2008') {
    if (passedByScore) {
      return language === 'zh'
        ? `得分 ${accuracy}%。你已达到 2008 版 ${rule.correctToPass}/${rule.totalQuestions} 的通过线。`
        : `Score ${accuracy}%. You cleared the 2008 test passing mark of ${rule.correctToPass}/${rule.totalQuestions}.`;
    }

    return language === 'zh'
      ? `得分 ${accuracy}%。2008 版需至少答对 ${rule.correctToPass}/${rule.totalQuestions} 题。`
      : `Score ${accuracy}%. The 2008 test requires at least ${rule.correctToPass} correct out of ${rule.totalQuestions}.`;
  }

  if (passedByScore) {
    return language === 'zh'
      ? `得分 ${accuracy}%。你已达到 2025 版 ${rule.correctToPass}/${rule.totalQuestions} 的通过线。`
      : `Score ${accuracy}%. You cleared the 2025 test passing mark of ${rule.correctToPass}/${rule.totalQuestions}.`;
  }

  return language === 'zh'
    ? `得分 ${accuracy}%。2025 版需至少答对 ${rule.correctToPass}/${rule.totalQuestions} 题。`
    : `Score ${accuracy}%. The 2025 test requires at least ${rule.correctToPass} correct out of ${rule.totalQuestions}.`;
}

function buildMockSessionQuestionIds(params: {
  stateCode: StateCode;
  questions: Question[];
  sessionSeed: number;
}) {
  const { stateCode, questions, sessionSeed } = params;
  const baseMockQuestionIds = getMockQuestionIds(stateCode);

  if (stateCode !== 'NY') {
    return baseMockQuestionIds;
  }

  const trafficSignsCategoryId = buildStateScopedCategoryId(stateCode, TRAFFIC_SIGNS_BASE_CATEGORY_ID);
  const signCandidates = questions
    .filter((question) => question.categoryId === trafficSignsCategoryId && question.image)
    .map((question) => question.id);
  const nonSignIds = baseMockQuestionIds.filter((questionId) => !questionId.startsWith('NY-RS-'));
  const sampledSignIds = sampleIds(signCandidates, 4, sessionSeed);

  return [...sampledSignIds, ...nonSignIds];
}

function navigateToScreenshotTarget(target: ScreenshotTarget, language: 'en' | 'zh') {
  if (!navigationRef.isReady()) {
    return;
  }

  const chapterLabel = language === 'zh' ? '美国政府原则' : 'Principles of American Government';
  const screenshotCategoryId = buildStateScopedCategoryId(
    defaultStateCode,
    'american-government-principles-of-american-government'
  );
  const screenshotStateCode = defaultStateCode;

  switch (target) {
    case 'home':
      navigationRef.navigate('MainTabs', { screen: 'HomeTab' } as never);
      break;
    case 'practice':
      navigationRef.navigate('MainTabs', {
        screen: 'PracticeTab',
        params: {
          screen: 'PracticeHome',
          params: {
            previewExpandChapters: true,
          },
        },
      } as never);
      break;
    case 'question-bilingual':
      navigationRef.navigate('MainTabs', {
        screen: 'PracticeTab',
        params: {
          screen: 'QuestionFlow',
          params: {
            categoryId: screenshotCategoryId,
            source: 'chapter',
            sourceLabel: chapterLabel,
            initialQuestionId: 'USCIS-2025-001',
          },
        },
      } as never);
      break;
    case 'question-answered':
      navigationRef.navigate('MainTabs', {
        screen: 'PracticeTab',
        params: {
          screen: 'QuestionFlow',
          params: {
            categoryId: screenshotCategoryId,
            source: 'chapter',
            sourceLabel: chapterLabel,
            initialQuestionId: 'USCIS-2025-001',
            previewSelectedOptionKey: 'first',
            previewFocus: 'answer-review',
          },
        },
      } as never);
      break;
    case 'signs':
      navigationRef.navigate('MainTabs', {
        screen: 'PracticeTab',
        params: {
          screen: 'RoadSignIntro',
        },
      } as never);
      break;
    case 'listening':
      navigationRef.navigate('MainTabs', {
        screen: 'ListeningTab',
      } as never);
      break;
    case 'guide':
      navigationRef.navigate('MainTabs', {
        screen: 'GuideTab',
      } as never);
      break;
    case 'mock-intro':
      navigationRef.navigate('MainTabs', {
        screen: 'PracticeTab',
        params: {
          screen: 'MockIntro',
        },
      } as never);
      break;
    case 'mock-result':
      navigationRef.navigate('MainTabs', {
        screen: 'PracticeTab',
        params: {
          screen: 'MockResult',
          params: {
            ...buildMockPreviewParams(screenshotStateCode),
            previewHideActionBar: true,
          },
        },
      } as never);
      break;
  }
}

let suppressAppOpenAdUntil = 0;

function suppressNextAppOpenAd(durationMs = 8000) {
  suppressAppOpenAdUntil = Date.now() + durationMs;
}

function shouldSkipAppOpenAd() {
  return Date.now() < suppressAppOpenAdUntil;
}

function AppBody() {
  const db = useDatabase();
  const isReady = useHydratePreferences();
  const hasCompletedOnboarding = useAppStore((state) => state.hasCompletedOnboarding);
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setStudyMode = useAppStore((state) => state.setStudyMode);
  const bumpContentRevision = useAppStore((state) => state.bumpContentRevision);
  const [remoteUpdateProgress, setRemoteUpdateProgress] = useState<{
    completed: number;
    total: number;
    visible: boolean;
  }>({ completed: 0, total: 0, visible: false });
  const t = getCopy(language);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isReady || !hasCompletedOnboarding) {
      return;
    }

    let isMounted = true;

    async function syncRemoteContent() {
      try {
        const { appliedBundles, recommendedBundles } = await checkForRemoteContentUpdates(db, appVersion);
        if (!isMounted) {
          return;
        }

        if (appliedBundles.length > 0) {
          bumpContentRevision();
        }

        if (recommendedBundles.length === 0) {
          return;
        }

        setRemoteUpdateProgress({
          completed: 0,
          total: recommendedBundles.length,
          visible: true,
        });

        let appliedCount = 0;

        for (let index = 0; index < recommendedBundles.length; index += 1) {
          const bundle = recommendedBundles[index];
          const result = await applyRemoteManifestBundle(db, bundle);
          if (!isMounted) {
            return;
          }

          if (result) {
            appliedCount += 1;
          }

          setRemoteUpdateProgress({
            completed: index + 1,
            total: recommendedBundles.length,
            visible: true,
          });
        }

        if (appliedCount > 0) {
          bumpContentRevision();
        }

        if (isMounted) {
          setRemoteUpdateProgress({
            completed: recommendedBundles.length,
            total: recommendedBundles.length,
            visible: false,
          });
        }
      } catch (error) {
        if (isMounted) {
          setRemoteUpdateProgress({
            completed: 0,
            total: 0,
            visible: false,
          });
        }
        console.warn('Failed to synchronize remote content', error);
      }
    }

    void syncRemoteContent();

    return () => {
      isMounted = false;
    };
  }, [bumpContentRevision, db, hasCompletedOnboarding, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    void initializeAds({ enableAppOpen: hasCompletedOnboarding });
  }, [hasCompletedOnboarding, isReady]);

  useEffect(() => {
    if (!isReady || !hasCompletedOnboarding) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      const isReturningToForeground =
        (previousAppState === 'background' || previousAppState === 'inactive') && nextAppState === 'active';

      if (!isReturningToForeground) {
        return;
      }

      if (shouldSkipAppOpenAd()) {
        return;
      }

      void showAppOpenAdIfAvailable();
    });

    return () => {
      subscription.remove();
    };
  }, [hasCompletedOnboarding, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    async function syncBilling() {
      const configured = await initializeBilling();
      if (!configured) {
        return;
      }

      try {
        const premiumStatus = await getCustomerPremiumStatus();
        if (isMounted) {
          await persistPremiumAccess(db, premiumStatus);
        }
      } catch (error) {
        console.warn('Failed to synchronize billing status', error);
      }

      unsubscribe = await subscribeToBillingUpdates((isPremium) => {
        if (!isMounted) {
          return;
        }
        void persistPremiumAccess(db, isPremium);
      });
    }

    void syncBilling();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [db, isReady]);

  useEffect(() => {
    if (!isReady || !hasCompletedOnboarding) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function applyScreenshotRequest(url: string) {
      const request = parseScreenshotRequest(url);
      if (!request) {
        return;
      }

      const nextLanguage = request.language ?? useAppStore.getState().language;
      if (request.language) {
        setLanguage(request.language);
      }
      if (request.mode) {
        setStudyMode(request.mode);
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        navigateToScreenshotTarget(request.target, nextLanguage);
      }, 180);
    }

    const subscription = Linking.addEventListener('url', ({ url }) => {
      applyScreenshotRequest(url);
    });

    void Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        applyScreenshotRequest(initialUrl);
      }
    });

    void readScreenshotLaunchRequest().then((storedUrl) => {
      if (storedUrl) {
        applyScreenshotRequest(storedUrl);
      }
    });

    return () => {
      subscription.remove();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasCompletedOnboarding, isReady, setLanguage, setStudyMode]);

  if (!isReady) {
    return null;
  }

  const updateProgressValue =
    remoteUpdateProgress.total > 0 ? remoteUpdateProgress.completed / remoteUpdateProgress.total : 0;

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={navTheme}
      >
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {hasCompletedOnboarding ? (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ presentation: 'modal', headerShown: true, title: t.settings }}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
              <Stack.Screen name="StateSelect" component={StateSelectScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {remoteUpdateProgress.visible ? (
        <View style={styles.remoteUpdateOverlay}>
          <View style={styles.remoteUpdateCard}>
            <Text style={styles.remoteUpdateTitle}>
              {language === 'zh' ? '正在更新题库内容' : 'Updating study content'}
            </Text>
            <Text style={styles.remoteUpdateBody}>
              {language === 'zh'
                ? `正在下载并应用更新（${remoteUpdateProgress.completed}/${remoteUpdateProgress.total}）`
                : `Downloading and applying updates (${remoteUpdateProgress.completed}/${remoteUpdateProgress.total})`}
            </Text>
            <View style={styles.remoteUpdateProgressTrack}>
              <View
                style={[
                  styles.remoteUpdateProgressFill,
                  { width: `${Math.max(updateProgressValue * 100, 8)}%` },
                ]}
              />
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <DatabaseProvider>
          <AppBody />
        </DatabaseProvider>
      </SafeAreaProvider>
    </I18nextProvider>
  );
}

function MainTabs() {
  const language = useAppStore((state) => state.language);
  const t = getCopy(language);
  const insets = useSafeAreaInsets();
  const iconMap: Record<keyof TabParamList, { active: keyof typeof MaterialCommunityIcons.glyphMap; inactive: keyof typeof MaterialCommunityIcons.glyphMap }> = {
    HomeTab: { active: 'home-variant', inactive: 'home-variant-outline' },
    PracticeTab: { active: 'book-open-page-variant', inactive: 'book-open-page-variant-outline' },
    ListeningTab: { active: 'headphones', inactive: 'headphones' },
    GuideTab: { active: 'compass', inactive: 'compass-outline' },
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: route.name === 'HomeTab' ? (props) => <StackHeader {...props} /> : undefined,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 66 + Math.max(insets.bottom, 10),
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarActiveTintColor: '#2a1700',
        tabBarInactiveTintColor: '#746755',
        tabBarShowLabel: false,
        tabBarIcon: ({ color, size, focused }) => {
          const icon = iconMap[route.name as keyof TabParamList];
          const label =
            route.name === 'HomeTab'
              ? t.home
              : route.name === 'PracticeTab'
                ? t.practice
                : route.name === 'ListeningTab'
                  ? (language === 'zh' ? '听题' : 'Listening')
                  : t.guide;
          const needsWideTab =
            (route.name === 'PracticeTab' && label.length > 4)
            || route.name === 'ListeningTab';
          return (
            <View
              style={[
                styles.tabBarVisual,
                needsWideTab && styles.tabBarVisualWide,
                focused && styles.tabBarVisualActive,
              ]}
            >
              <MaterialCommunityIcons
                name={focused ? icon.active : icon.inactive}
                size={22}
                color={color}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.tabBarLabel,
                  focused && styles.tabBarLabelActive,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: t.home, headerRight: () => <HeaderSettingsButton entryPoint="HomeTab" /> }}
      />
      <Tab.Screen
        name="PracticeTab"
        component={PracticeNavigator}
        options={{ title: t.practice, headerShown: false }}
      />
      <Tab.Screen
        name="ListeningTab"
        component={ListeningScreen}
        options={{
          title: language === 'zh' ? '听题' : 'Listening',
          headerRight: () => <HeaderSettingsButton entryPoint="ListeningTab" />,
        }}
      />
      <Tab.Screen
        name="GuideTab"
        component={GuideNavigator}
        options={{ title: t.guide, headerShown: false, popToTopOnBlur: true }}
      />
    </Tab.Navigator>
  );
}

function PracticeNavigator() {
  const language = useAppStore((state) => state.language);
  const t = getCopy(language);

  function goHomeAndResetPractice(navigation: any) {
    const parent = navigation.getParent();

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'PracticeHome' }],
      }),
    );
    parent?.dispatch(TabActions.jumpTo('HomeTab'));
  }

  return (
    <PracticeStack.Navigator
      screenOptions={{
        header: (props) => <StackHeader {...props} />,
      }}
    >
      <PracticeStack.Screen
        name="PracticeHome"
        component={PracticeHomeScreen}
        options={{
          title: t.practice,
          headerLeft: () => <View style={styles.stackHeaderSide} />,
        }}
      />
      <PracticeStack.Screen
        name="CategoryDetail"
        component={CategoryDetailScreen}
        options={({ navigation }) => ({
          title: t.chapterPractice,
          headerLeft: () => <HeaderBackActionButton onPress={() => navigation.goBack()} />,
        })}
      />
      <PracticeStack.Screen
        name="RoadSignIntro"
        component={RoadSignIntroScreen}
        options={({ navigation }) => ({
          title: t.roadSignsSpecial,
          headerLeft: () => <HeaderBackActionButton onPress={() => navigation.goBack()} />,
        })}
      />
      <PracticeStack.Screen
        name="RoadSignQuiz"
        component={RoadSignQuizScreen}
        options={({ navigation }) => ({
          title: t.roadSignsSpecial,
          headerLeft: () => <HeaderBackActionButton onPress={() => navigation.goBack()} />,
        })}
      />
      <PracticeStack.Screen
        name="HighFrequencyIntro"
        component={HighFrequencyIntroScreen}
        options={({ navigation }) => ({
          title: t.highFrequencyPack,
          headerLeft: () => <HeaderBackActionButton onPress={() => navigation.goBack()} />,
        })}
      />
      <PracticeStack.Screen
        name="MistakesNotebook"
        component={MistakesScreen}
        options={({ navigation, route }: any) => ({
          title: t.mistakes,
          headerLeft: () => (
            <HeaderBackActionButton
              onPress={() => {
                if (route.params?.returnTarget === 'home') {
                  goHomeAndResetPractice(navigation);
                  return;
                }

                navigation.goBack();
              }}
            />
          ),
        })}
      />
      <PracticeStack.Screen
        name="SavedNotebook"
        component={SavedScreen}
        options={({ navigation, route }: any) => ({
          title: t.saved,
          headerLeft: () => (
            <HeaderBackActionButton
              onPress={() => {
                if (route.params?.returnTarget === 'home') {
                  goHomeAndResetPractice(navigation);
                  return;
                }

                navigation.goBack();
              }}
            />
          ),
        })}
      />
      <PracticeStack.Screen
        name="QuestionFlow"
        component={QuestionFlowScreen}
        options={({ route, navigation }: any) => ({
          title: route.params?.sourceLabel ?? t.chapterPractice,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
          headerLeft: () => (
            <HeaderBackActionButton
              onPress={() => {
                const source = route.params?.source;
                if (source === 'mistakes') {
                  if (route.params?.returnTarget === 'home') {
                    goHomeAndResetPractice(navigation);
                    return;
                  }
                  navigation.goBack();
                  return;
                }
                if (source === 'saved') {
                  if (route.params?.returnTarget === 'home') {
                    goHomeAndResetPractice(navigation);
                    return;
                  }
                  navigation.goBack();
                  return;
                }
                if (source === 'high-frequency') {
                  navigation.goBack();
                  return;
                }
                navigation.goBack();
              }}
            />
          ),
        })}
      />
      <PracticeStack.Screen
        name="MockIntro"
        component={MockIntroScreen}
        options={({ navigation, route }: any) => ({
          title: t.mockTest,
          headerLeft: () => (
            <HeaderBackActionButton
              onPress={() => {
                if (route.params?.returnTarget === 'home') {
                  goHomeAndResetPractice(navigation);
                  return;
                }

                navigation.goBack();
              }}
            />
          ),
        })}
      />
      <PracticeStack.Screen
        name="MockSession"
        component={MockSessionScreen}
        options={({ navigation }) => ({
          title: t.mockTest,
          headerLeft: () => <HeaderBackActionButton onPress={() => navigation.goBack()} />,
        })}
      />
      <PracticeStack.Screen
        name="MockResult"
        component={MockResultScreen}
        options={({ navigation }) => ({
          title: t.results,
          headerLeft: () => <HeaderBackActionButton onPress={() => navigation.goBack()} />,
        })}
      />
    </PracticeStack.Navigator>
  );
}

function GuideNavigator() {
  const language = useAppStore((state) => state.language);
  const t = getCopy(language);

  return (
    <GuideStack.Navigator
      screenOptions={{
        header: (props) => <StackHeader {...props} />,
      }}
    >
      <GuideStack.Screen name="GuideHome" component={GuideScreen} options={{ title: t.guide }} />
      <GuideStack.Screen name="GuideArticle" component={GuideArticleScreen} options={{ title: t.guide }} />
      <GuideStack.Screen name="Glossary" component={GlossaryScreen} options={{ title: t.glossary }} />
    </GuideStack.Navigator>
  );
}

function HandbookNavigator() {
  const language = useAppStore((state) => state.language);
  const t = getCopy(language);

  return (
    <HandbookStack.Navigator
      screenOptions={{
        header: (props) => <StackHeader {...props} />,
      }}
    >
      <HandbookStack.Screen name="HandbookHome" component={HandbookScreen} options={{ title: t.handbook }} />
      <HandbookStack.Screen name="HandbookSection" component={HandbookSectionScreen} options={{ title: t.handbook }} />
      <HandbookStack.Screen
        name="HandbookReader"
        component={HandbookReaderScreen}
        options={({ route }: any) => ({ title: route.params?.title ?? t.handbook })}
      />
    </HandbookStack.Navigator>
  );
}

function HeaderSettingsButton({ entryPoint }: { entryPoint?: string }) {
  const navigation = useNavigation<any>();
  const language = useAppStore((state) => state.language);
  const t = getCopy(language);

  return (
    <Pressable style={styles.headerButton} onPress={() => navigation.navigate('Settings', { entryPoint })}>
      <Text style={styles.headerButtonText}>
        {t.settings}
      </Text>
    </Pressable>
  );
}

function HeaderBackActionButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.headerBackButton} onPress={onPress}>
      <Text style={styles.headerBackButtonText}>‹</Text>
    </Pressable>
  );
}

function StackHeader({ navigation, route, options, back }: any) {
  const insets = useSafeAreaInsets();
  const title =
    typeof options.title === 'string'
      ? options.title
      : typeof route?.name === 'string'
        ? route.name
        : '';

  const leftNode = options.headerLeft
    ? options.headerLeft({
        canGoBack: Boolean(back),
        tintColor: '#172126',
      })
    : back
      ? <HeaderBackActionButton onPress={() => navigation.goBack()} />
      : <View style={styles.stackHeaderSide} />;

  const rightNode = options.headerRight
    ? options.headerRight({
        tintColor: '#165a72',
      })
    : <HeaderSettingsButton entryPoint={route?.name} />;

  return (
    <View style={[styles.stackHeader, { paddingTop: insets.top + 6 }]}>
      <View style={styles.stackHeaderRow}>
        <View style={styles.stackHeaderSide}>{leftNode}</View>
        <Text numberOfLines={1} style={styles.stackHeaderTitle}>{title}</Text>
        <View style={[styles.stackHeaderSide, styles.stackHeaderRight]}>{rightNode}</View>
      </View>
    </View>
  );
}

function ScreenFrame({
  children,
  accent,
  scrollable = true,
  overlay,
  bare = false,
}: {
  children: React.ReactNode;
  accent?: string;
  scrollable?: boolean;
  overlay?: React.ReactNode;
  bare?: boolean;
}) {
  const contentStyle = [bare ? styles.screenContentBare : styles.screenContent, accent ? { borderTopColor: accent } : null];

  if (!scrollable) {
    return (
      <View style={styles.screen}>
        <View style={[contentStyle, styles.staticScreenContent]}>{children}</View>
        {overlay}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={contentStyle}>
        {children}
      </ScrollView>
      {overlay}
    </View>
  );
}

function OnboardingFrame({
  step,
  title,
  description,
  accent,
  children,
}: {
  step: string;
  title: string;
  description: string;
  accent: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.onboardingContent,
        {
          paddingTop: insets.top + 18,
          borderTopColor: accent,
        },
      ]}
    >
      <View style={styles.onboardingHeader}>
        <Text style={styles.onboardingStep}>{step}</Text>
        <Text style={styles.onboardingTitle}>{title}</Text>
        <Text style={styles.onboardingDescription}>{description}</Text>
      </View>
      <View style={styles.onboardingBody}>{children}</View>
    </ScrollView>
  );
}

function HeroCard({
  eyebrow,
  title,
  body,
  actionLabel,
  onPress,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.heroCard}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroBody}>{body}</Text>
      <PrimaryButton label={actionLabel} onPress={onPress} />
    </View>
  );
}

function usePracticeInlineNativeAd() {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const nativeAdRef = useRef<NativeAd | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [adsReady, setAdsReady] = useState(() => {
    const state = getAdsDebugState();
    return state.initialized && state.canRequestAds;
  });

  useEffect(() => {
    return subscribeToAdsDebug(() => {
      const state = getAdsDebugState();
      setAdsReady(state.initialized && state.canRequestAds);
    });
  }, []);

  useEffect(() => {
    if (!adsReady) {
      return;
    }

    let isActive = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    void loadPracticeNativeAd().then((loadedAd) => {
      if (!isActive) {
        loadedAd?.destroy?.();
        return;
      }

      nativeAdRef.current?.destroy?.();
      nativeAdRef.current = loadedAd;
      setNativeAd(loadedAd);

      if (!loadedAd) {
        const retryDelay = getAdsDebugState().useTestAds ? 2000 : 5000;
        retryTimer = setTimeout(() => {
          setLoadAttempt((value) => value + 1);
        }, retryDelay);
      }
    });

    return () => {
      isActive = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      nativeAdRef.current?.destroy?.();
      nativeAdRef.current = null;
      setNativeAd(null);
    };
  }, [adsReady, loadAttempt]);

  return nativeAd;
}

function DevNativeAdPlaceholder({
  language,
  status,
  error,
}: {
  language: 'en' | 'zh';
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
}) {
  const title =
    language === 'zh'
      ? (status === 'error' ? '广告未加载成功' : '广告加载中')
      : (status === 'error' ? 'Ad failed to load' : 'Loading ad');
  const body =
    language === 'zh'
      ? (error || '当前这块不是隐藏内容，而是原生广告素材还没有返回。')
      : (error || 'This section is not hidden content. The native ad assets have not returned yet.');

  return (
    <View style={styles.devAdCard}>
      <View style={styles.devAdStatusBadge}>
        <Text style={styles.devAdStatusBadgeText}>{status.toUpperCase()}</Text>
      </View>
      <View style={styles.devAdCopy}>
        <Text style={styles.devAdStatusTitle}>{title}</Text>
        <Text style={styles.devAdStatusBody}>{body}</Text>
      </View>
    </View>
  );
}

function AdsDebugCard({ language }: { language: 'en' | 'zh' }) {
  const [debugState, setDebugState] = useState(getAdsDebugState());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPreparingInterstitial, setIsPreparingInterstitial] = useState(false);
  const [isShowingInterstitial, setIsShowingInterstitial] = useState(false);

  useEffect(() => {
    setDebugState(getAdsDebugState());
    return subscribeToAdsDebug(() => {
      setDebugState(getAdsDebugState());
    });
  }, []);

  const rows = [
    {
      label: language === 'zh' ? '测试广告位' : 'Test ads',
      value: debugState.useTestAds ? 'YES' : 'NO',
    },
    {
      label: language === 'zh' ? '广告已初始化' : 'Ads initialized',
      value: debugState.initialized ? 'YES' : 'NO',
    },
    {
      label: language === 'zh' ? '允许请求广告' : 'Can request ads',
      value: debugState.canRequestAds ? 'YES' : 'NO',
    },
    {
      label: language === 'zh' ? 'Consent 可请求' : 'Consent requestable',
      value: debugState.consentCanRequestAds == null ? 'null' : debugState.consentCanRequestAds ? 'YES' : 'NO',
    },
    {
      label: language === 'zh' ? 'Consent 状态' : 'Consent status',
      value: debugState.trackingStatus ?? 'null',
    },
    {
      label: language === 'zh' ? '原生广告状态' : 'Native ad status',
      value: debugState.nativeLastStatus,
    },
    {
      label: language === 'zh' ? '插屏已加载' : 'Interstitial loaded',
      value: debugState.mockInterstitialLoaded ? 'YES' : 'NO',
    },
    {
      label: language === 'zh' ? '开屏已加载' : 'App open loaded',
      value: debugState.appOpenLoaded ? 'YES' : 'NO',
    },
  ];

  return (
    <View style={styles.settingsOptionGroup}>
      <View style={[styles.settingsOptionCard, styles.settingsDebugCard]}>
        <View style={styles.settingsOptionCopy}>
          <Text style={styles.settingsOptionTitle}>{language === 'zh' ? '广告调试状态' : 'Ads debug state'}</Text>
          <Text style={styles.settingsOptionDescription}>
            {language === 'zh'
              ? '用于确认广告是否完成初始化、是否允许请求，以及最近一次加载是否报错。'
              : 'Use this to confirm initialization, request permission, and the latest load result.'}
          </Text>
        </View>
        <View style={styles.debugDivider} />
        {rows.map((row) => (
          <View key={row.label} style={styles.debugRow}>
            <Text style={styles.debugLabel}>{row.label}</Text>
            <Text style={styles.debugValue}>{row.value}</Text>
          </View>
        ))}
        <View style={styles.debugDivider} />
        <View style={styles.debugRow}>
          <Text style={styles.debugLabel}>{language === 'zh' ? '最近错误' : 'Last error'}</Text>
          <Text style={[styles.debugValue, styles.debugValueMultiline]}>{debugState.lastError ?? 'none'}</Text>
        </View>
        <View style={styles.debugDivider} />
        <View style={styles.settingsDebugButtonRow}>
          <Pressable
            style={styles.settingsDebugButton}
            onPress={async () => {
              if (isRefreshing) {
                return;
              }
              setIsRefreshing(true);
              try {
                await reinitializeAdsConsent();
              } finally {
                setIsRefreshing(false);
              }
            }}
          >
            <Text style={styles.settingsDebugButtonText}>
              {isRefreshing
                ? (language === 'zh' ? '刷新中...' : 'Refreshing...')
                : (language === 'zh' ? '重新初始化广告' : 'Reinitialize ads')}
            </Text>
          </Pressable>
          <Pressable
            style={styles.settingsDebugButton}
            onPress={async () => {
              if (isPreparingInterstitial) {
                return;
              }
              setIsPreparingInterstitial(true);
              try {
                await prepareMockInterstitialAd();
              } finally {
                setIsPreparingInterstitial(false);
              }
            }}
          >
            <Text style={styles.settingsDebugButtonText}>
              {isPreparingInterstitial
                ? (language === 'zh' ? '准备中...' : 'Preparing...')
                : (language === 'zh' ? '预加载插屏' : 'Prepare interstitial')}
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.settingsDebugButton}
          onPress={async () => {
            if (isShowingInterstitial) {
              return;
            }
            setIsShowingInterstitial(true);
            try {
              const shown = await showPreparedMockInterstitialAd();
              if (!shown) {
                await showMockInterstitialAd();
              }
            } finally {
              setIsShowingInterstitial(false);
            }
          }}
        >
          <Text style={styles.settingsDebugButtonText}>
            {isShowingInterstitial
              ? (language === 'zh' ? '展示中...' : 'Showing...')
              : (language === 'zh' ? '立即展示插屏' : 'Show interstitial now')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PracticeInlineAdSection({
  nativeAd,
  language,
}: {
  nativeAd: NativeAd | null;
  language: 'en' | 'zh';
}) {
  if (!nativeAd) {
    const adsDebugState = getAdsDebugState();
    const shouldShowPlaceholder =
      __DEV__ ||
      !Device.isDevice ||
      adsDebugState.useTestAds ||
      adsDebugState.nativeLastStatus === 'loading' ||
      adsDebugState.nativeLastStatus === 'error';

    if (!shouldShowPlaceholder) {
      return null;
    }

    return (
      <View style={styles.inlineAdSection}>
        <View style={styles.inlineAdHeader}>
          <View style={styles.inlineAdBadgeRow}>
            <View style={styles.inlineAdBadge}>
              <Text style={styles.inlineAdBadgeText}>{language === 'zh' ? '广告' : 'AD'}</Text>
            </View>
            <Text style={styles.inlineAdEyebrow}>{language === 'zh' ? '赞助内容' : 'Sponsored'}</Text>
          </View>
          <Text style={styles.inlineAdTitle}>
            {language === 'zh' ? '赞助内容' : 'Sponsored content'}
          </Text>
        </View>
        <DevNativeAdPlaceholder
          language={language}
          status={adsDebugState.nativeLastStatus}
          error={adsDebugState.lastError}
        />
      </View>
    );
  }

  return (
    <View style={styles.inlineAdSection}>
      <View style={styles.inlineAdHeader}>
        <View style={styles.inlineAdBadgeRow}>
          <View style={styles.inlineAdBadge}>
            <Text style={styles.inlineAdBadgeText}>{language === 'zh' ? '广告' : 'AD'}</Text>
          </View>
          <Text style={styles.inlineAdEyebrow}>{language === 'zh' ? '赞助内容' : 'Sponsored'}</Text>
        </View>
        <Text style={styles.inlineAdTitle}>
          {language === 'zh' ? '赞助内容' : 'Sponsored content'}
        </Text>
      </View>
      <NativePracticeAdCard nativeAd={nativeAd} language={language} />
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SelectCard({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.selectCard, selected && styles.selectCardSelected]}
      onPress={onPress}
      android_ripple={{ color: 'transparent' }}
    >
      <View style={styles.selectCardTopRow}>
        <View style={styles.selectCardCopy}>
          <Text style={styles.selectCardTitle}>{title}</Text>
          <Text style={styles.selectCardDescription}>{description}</Text>
        </View>
        {selected ? (
          <View style={styles.selectCardCheck}>
            <MaterialCommunityIcons name="check" size={16} color="#002045" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.sectionHeading, compact ? styles.sectionHeadingCompact : null]}>
      {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionHeadingTitle}>{title}</Text>
      {description ? <Text style={styles.sectionHeadingDescription}>{description}</Text> : null}
    </View>
  );
}

function WelcomeScreen({ navigation }: RootScreenProps<'Welcome'>) {
  const welcomeLanguage = Localization.getLocales()[0]?.languageCode === 'zh' ? 'zh' : 'en';
  const t = getCopy(welcomeLanguage);
  const insets = useSafeAreaInsets();
  const welcomeStateLabel = getStateDmvLabel(defaultStateCode, welcomeLanguage);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.onboardingContent,
        {
          paddingTop: insets.top + 18,
        },
      ]}
    >
      <View style={styles.onboardingWelcomeCard}>
        <View style={styles.onboardingWelcomeBadge}>
          <Text style={styles.onboardingWelcomeBadgeText}>{welcomeStateLabel}</Text>
        </View>
        <Text style={styles.onboardingWelcomeTitle}>{t.welcomeTitle}</Text>
        <Text style={styles.onboardingWelcomeBody}>{t.welcomeBody}</Text>

        <View style={styles.onboardingWelcomeHighlights}>
          <View style={styles.onboardingWelcomeHighlight}>
            <MaterialCommunityIcons name="translate" size={18} color="#f1d6af" />
            <Text style={styles.onboardingWelcomeHighlightText}>
              {welcomeLanguage === 'zh' ? '中英双语练习' : 'Bilingual practice'}
            </Text>
          </View>
          <View style={styles.onboardingWelcomeHighlight}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={18} color="#f1d6af" />
            <Text style={styles.onboardingWelcomeHighlightText}>
              {welcomeLanguage === 'zh' ? '模拟考试与专项训练' : 'Mocks and focused drills'}
            </Text>
          </View>
        </View>

        <PrimaryButton label={t.getStarted} onPress={() => navigation.navigate('LanguageSelect')} />
      </View>
    </ScrollView>
  );
}

function LanguageSelectScreen({ navigation }: RootScreenProps<'LanguageSelect'>) {
  const db = useDatabase();
  const onboardingLanguage = Localization.getLocales()[0]?.languageCode === 'zh' ? 'zh' : 'en';
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setStudyMode = useAppStore((state) => state.setStudyMode);
  const t = getCopy(onboardingLanguage);

  async function handleLanguageChange(nextLanguage: 'en' | 'zh') {
    const nextMode: StudyMode = nextLanguage === 'zh' ? 'zh-first' : 'en-first';

    setLanguage(nextLanguage);
    setStudyMode(nextMode);

    try {
      await savePreference(db, 'language', nextLanguage);
      await savePreference(db, 'studyMode', nextMode);
    } catch (error) {
      console.warn('Failed to save language preference', error);
    }
  }

  return (
    <OnboardingFrame step="01 / 02" title={t.chooseLanguage} description={t.languageHint} accent="#165a72">
      <SelectCard title={t.chineseOptionTitle} description={t.chineseOptionBody} selected={language === 'zh'} onPress={() => void handleLanguageChange('zh')} />
      <SelectCard title={t.englishOptionTitle} description={t.englishOptionBody} selected={language === 'en'} onPress={() => void handleLanguageChange('en')} />
      <PrimaryButton label={t.continue} onPress={() => navigation.navigate('StateSelect')} />
    </OnboardingFrame>
  );
}

function StateSelectScreen({ navigation }: RootScreenProps<'StateSelect'>) {
  const db = useDatabase();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const setStateCode = useAppStore((state) => state.setStateCode);
  const t = getCopy(language);

  function startLearning() {
    completeOnboarding();
    void persistOnboardingState();
  }

  async function persistOnboardingState() {
    try {
      await savePreference(db, 'language', useAppStore.getState().language);
      await savePreference(db, 'stateCode', useAppStore.getState().stateCode);
      await savePreference(db, 'studyMode', useAppStore.getState().studyMode);
      await savePreference(db, 'hasCompletedOnboarding', 'true');
    } catch (error) {
      console.warn('Failed to persist onboarding preferences', error);
    }
  }

  return (
    <OnboardingFrame step="02 / 02" title={t.chooseState} description={t.stateHint} accent="#2f6f4e">
      {availableAppStates.map((state) => (
        <SelectCard
          key={state.code}
          title={language === 'zh' ? state.nameZh : state.nameEn}
          description={getStateContentDescription(state.code, language)}
          selected={stateCode === state.code}
          onPress={() => setStateCode(state.code)}
        />
      ))}
      <PrimaryButton label={t.startLearning} onPress={startLearning} />
    </OnboardingFrame>
  );
}

function HomeScreen({ navigation }: TabScreenProps<'HomeTab'>) {
  const studyMode = useAppStore((state) => state.studyMode);
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const t = getCopy(language);
  const studyModeLabel = getModeLabel(studyMode, language);
  const highFrequencyQuestionIds = getHighFrequencyQuestionIds(stateCode);
  const stateGuideLabel = getStateGuideLabel(stateCode, language);
  const categories = useCategories();
  const { stats } = useUserStats();
  const recommendation = useHomeRecommendation(categories);
  const continueCategory = categories.find((item) => item.id === recommendation.continueCategoryId) ?? categories[0];
  const recommendedCategory = categories.find((item) => item.id === recommendation.recommendedCategoryId) ?? categories[0];
  const continueCategoryLabel = continueCategory ? (language === 'zh' ? continueCategory.nameZh : continueCategory.nameEn) : t.chapterPractice;
  const recommendedCategoryLabel = recommendedCategory ? (language === 'zh' ? recommendedCategory.nameZh : recommendedCategory.nameEn) : t.chapterPractice;
  const totalQuestionCount = categories.reduce((sum, category) => sum + (category.questionCount ?? 0), 0);
  const totalCompleted = stats.totalAnswered > 0 ? Math.round((stats.accuracy / 100) * stats.totalAnswered) : 0;
  const accuracyPercent = Math.max(0, Math.min(100, stats.todayAccuracy ?? 0));
  const todayAnswered = stats.todayAnswered ?? 0;
  const recommendedBody = (() => {
    if (!recommendedCategory) {
      return t.focusBody;
    }

    if (recommendation.reason === 'mistakes') {
      return language === 'zh'
        ? `这是你当前错题最多的章节，建议重新练习。`
        : `This chapter currently has the most active mistakes. A focused retry is recommended.`;
    }

    if (recommendation.reason === 'accuracy' && recommendation.accuracy !== null) {
      return language === 'zh'
        ? `这是你当前正确率最低的章节，建议先补强。`
        : `This chapter has your lowest accuracy right now. It is the best place to strengthen first.`;
    }

    return language === 'zh'
      ? `适合作为今天重新开始的第一章。`
      : `A strong place to restart today’s study.`;
  })();
  const openRecommendedFocus = () => {
    navigation.navigate(
      'PracticeTab',
      {
        screen: 'QuestionFlow',
        params: {
          categoryId: recommendedCategory?.id,
          source: 'chapter',
          sourceLabel: recommendedCategoryLabel,
        },
      } as never
    );
  };

  const openContinuePractice = () => {
    navigation.navigate(
      'PracticeTab',
      {
        screen: 'QuestionFlow',
        params: {
          categoryId: continueCategory?.id,
          source: 'chapter',
          sourceLabel: continueCategoryLabel,
        },
      } as never
    );
  };

  return (
    <ScreenFrame scrollable={false} bare>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.homeScreenContent,
          {
            paddingTop: 10,
          },
        ]}
      >
        <View style={styles.homeContentInner}>
          <View style={styles.homeBackdropGrid} />

          <View style={styles.homeSectionHeaderCompact}>
            <View style={styles.homeSectionBadge}>
              <MaterialCommunityIcons name="chart-line-variant" size={15} color="#002045" />
            </View>
            <View style={styles.homeSectionTitleWrap}>
              <Text style={styles.homeModulesTitle}>{language === 'zh' ? '今日学习进度' : 'Today progress'}</Text>
              <Text style={styles.homeSectionCaption}>
                {language === 'zh' ? '继续今天的学习节奏' : 'Keep today moving'}
              </Text>
            </View>
          </View>

          <View style={styles.homeHeroShell}>
            <View style={styles.homeHeroBackdropOrbOne} />
            <View style={styles.homeHeroBackdropOrbTwo} />

            <View style={styles.homeHeroProgressHeader}>
              <View style={styles.homeHeroProgressLeft}>
                <Text style={styles.homeHeroProgressLabel}>
                  {language === 'zh' ? `上次学习内容：${continueCategoryLabel}` : `Last studied: ${continueCategoryLabel}`}
                </Text>
                <Text style={styles.homeHeroMainTitle}>
                  {language === 'zh' ? `已做题数:${todayAnswered}` : `Questions done: ${todayAnswered}`}
                </Text>
              </View>
              <View style={styles.homeHeroProgressRight}>
                <Text style={styles.homeHeroProgressMeta}>
                  {language === 'zh' ? '正确率' : 'Accuracy'}
                </Text>
                <View style={styles.homeHeroScoreRow}>
                  <Text style={styles.homeHeroScoreValue}>{accuracyPercent}%</Text>
                </View>
              </View>
            </View>

            <View style={styles.homeHeroProgressTrack}>
              <View style={[styles.homeHeroProgressFill, { width: `${accuracyPercent}%` }]} />
            </View>

            <View style={styles.homeHeroButtons}>
              <Pressable
                style={[styles.primaryButton, styles.homeHeroPrimaryButton]}
                onPress={openContinuePractice}
              >
                <Text style={styles.homeHeroPrimaryButtonText}>{t.continuePractice}</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, styles.homeHeroSecondaryButton]}
                onPress={() =>
                  navigation.navigate('PracticeTab', {
                    screen: 'MockIntro',
                    params: {
                      returnTarget: 'home',
                    },
                  } as never)
                }
              >
                <Text style={styles.homeHeroSecondaryButtonText}>{t.startMockTest}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.moduleList}>
            <ActionCard
              title={t.chapterPractice}
              subtitle={language === 'zh' ? '按模块深度学习知识点' : 'Study topics one module at a time'}
              meta={language === 'zh' ? `${totalQuestionCount}题总库 / ${categories.length}章` : `${totalQuestionCount} total / ${categories.length} chapters`}
              accentColor="#002045"
              badge={language === 'zh' ? '学习' : 'Study'}
              iconName="book-open-page-variant"
              cardTone="#f2f7ff"
              onPress={() => navigation.navigate('PracticeTab', { screen: 'PracticeHome' } as never)}
            />
            <ActionCard
              title={language === 'zh' ? '听题' : 'Listening'}
              subtitle={language === 'zh' ? '顺序听题目和正确答案，专门练听力' : 'Listen through questions and correct answers for focused audio practice'}
              meta={language === 'zh' ? `${totalQuestionCount}题可听` : `${totalQuestionCount} questions available`}
              accentColor="#165a72"
              badge={language === 'zh' ? '音频' : 'Audio'}
              iconName="headphones"
              cardTone="#eef7fa"
              onPress={() => navigation.navigate('ListeningTab')}
            />
            <ActionCard
              title={t.highFrequencyPack}
              subtitle={language === 'zh' ? '基于大数据统计的考点' : 'Most-missed rules and exam traps'}
              meta={`${highFrequencyQuestionIds.length} ${t.questions}`}
              accentColor="#ba1a1a"
              badge={language === 'zh' ? '冲刺' : 'Focus'}
              iconName="flash-outline"
              cardTone="#fff4f4"
              onPress={() => navigation.navigate('PracticeTab', { screen: 'HighFrequencyIntro' } as never)}
            />
            <ActionCard
              title={t.mistakes}
              subtitle={language === 'zh' ? '查漏补缺，攻克难点' : 'Target your weak points faster'}
              meta={language === 'zh' ? `${stats.mistakeCount}题待复习` : `${stats.mistakeCount} to review`}
              accentColor="#2e476e"
              badge={language === 'zh' ? '纠错' : 'Fix'}
              iconName="file-document-edit-outline"
              cardTone="#f6f5ff"
              onPress={() =>
                stats.mistakeQuestionIds.length > 0
                  ? navigation.navigate('PracticeTab', {
                      screen: 'QuestionFlow',
                      params: {
                        questionIds: stats.mistakeQuestionIds,
                        initialQuestionId: stats.mistakeQuestionIds[0],
                        source: 'mistakes',
                        sourceLabel: t.mistakes,
                        returnTarget: 'home',
                      },
                    } as never)
                  : navigation.navigate('PracticeTab', {
                      screen: 'MistakesNotebook',
                      params: {
                        returnTarget: 'home',
                      },
                    } as never)
              }
            />
            <ActionCard
              title={t.saved}
              subtitle={language === 'zh' ? '随时回顾你的关注点' : 'Come back to saved focus items'}
              meta={language === 'zh' ? `${stats.savedCount}已收藏` : `${stats.savedCount} saved`}
              accentColor="#855300"
              badge={language === 'zh' ? '收藏' : 'Saved'}
              iconName="bookmark"
              cardTone="#fdfaf3"
              onPress={() =>
                stats.savedQuestionIds.length > 0
                  ? navigation.navigate('PracticeTab', {
                      screen: 'QuestionFlow',
                      params: {
                        questionIds: stats.savedQuestionIds,
                        initialQuestionId: stats.savedQuestionIds[0],
                        source: 'saved',
                        sourceLabel: t.saved,
                        returnTarget: 'home',
                      },
                    } as never)
                  : navigation.navigate('PracticeTab', {
                      screen: 'SavedNotebook',
                      params: {
                        returnTarget: 'home',
                      },
                  } as never)
              }
            />
            <ActionCard
              title={t.guideCard}
              subtitle={language === 'zh' ? `${stateGuideLabel}、材料与常见问题` : 'Guide, documents, FAQ, glossary'}
              meta={language === 'zh' ? '4 分区' : '4 sections'}
              accentColor="#2F6F4E"
              badge={language === 'zh' ? '指南' : 'Guide'}
              iconName="compass-outline"
              cardTone="#f0f9f7"
              onPress={() => navigation.navigate('GuideTab')}
            />
          </View>

          <View style={styles.homeRecommendationSection}>
            <View style={styles.homeRecommendationSectionHeader}>
              <View style={styles.homeRecommendationSectionAccent} />
              <Text style={styles.homeRecommendationSectionTitle}>{language === 'zh' ? '推荐复习区' : 'Recommended review'}</Text>
            </View>
            <Pressable style={styles.homeRecommendationCard} onPress={openRecommendedFocus}>
              <View style={styles.homeRecommendationMarkerRow}>
                <View style={styles.homeRecommendationMarkerDot} />
                <Text style={styles.homeRecommendationEyebrow}>{language === 'zh' ? '重点巩固' : 'Priority review'}</Text>
              </View>
              <View style={styles.homeRecommendationRow}>
                <View style={styles.homeRecommendationContent}>
                  <Text style={styles.homeRecommendationTitle}>{recommendedCategoryLabel}</Text>
                  <Text style={styles.homeRecommendationBody}>{recommendedBody}</Text>
                </View>
                <View style={styles.homeRecommendationActions}>
                  <View style={styles.homeRecommendationAlertWrap}>
                    <MaterialCommunityIcons name="alert" size={18} color="#fea619" />
                  </View>
                  <View style={styles.homeRecommendationArrowWrap}>
                    <MaterialCommunityIcons name="arrow-right" size={18} color="#ffffff" />
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function ListeningScreen() {
  const db = useDatabase();
  const isFocused = useIsFocused();
  const navigation = useNavigation<any>();
  const language = useAppStore((state) => state.language);
  const isPremium = useAppStore((state) => state.isPremium);
  const stateCode = useAppStore((state) => state.stateCode);
  const speechRate = useAppStore((state) => state.speechRate);
  const setSpeechRate = useAppStore((state) => state.setSpeechRate);
  const blindListeningEnabled = useAppStore((state) => state.blindListeningEnabled);
  const questionDisplayMode = useAppStore((state) => state.questionDisplayMode);
  const setQuestionDisplayMode = useAppStore((state) => state.setQuestionDisplayMode);
  const questions = useQuestions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasUserStartedPlayback, setHasUserStartedPlayback] = useState(false);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [preferredVoiceId, setPreferredVoiceId] = useState<string | null>(null);
  const [showSpeechRateMenu, setShowSpeechRateMenu] = useState(false);
  const [isQuestionTextVisible, setIsQuestionTextVisible] = useState(!blindListeningEnabled);
  const currentIndexRef = useRef(0);
  const sequenceTokenRef = useRef(0);
  const hasRestoredListeningProgressRef = useRef<StateCode | null>(null);
  const pendingPlaybackQuestionIdRef = useRef<string | null>(null);
  const localSpeechPlayerRef = useRef(createAudioPlayer(null, { keepAudioSessionActive: true }));
  const localSpeechPlayer = localSpeechPlayerRef.current;
  const lastListeningLimitPromptQuestionRef = useRef<number | null>(null);
  const t = getCopy(language);
  const question = questions[currentIndex];
  const canUseCurrentListeningQuestion = canListenToQuestion(currentIndex + 1);
  const correctOption = useMemo(
    () => question?.options.find((option) => option.isCorrect) ?? null,
    [question]
  );

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    hasRestoredListeningProgressRef.current = null;
  }, [stateCode]);

  useEffect(() => {
    if (questions.length === 0) {
      return;
    }

    let isMounted = true;

    async function restoreListeningProgress() {
      const savedQuestionId = await getListeningResumeQuestionId(db, stateCode);

      if (!isMounted) {
        return;
      }

      const restoredIndex = savedQuestionId ? questions.findIndex((item) => item.id === savedQuestionId) : -1;
      const nextIndex = restoredIndex >= 0 ? restoredIndex : 0;
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
      hasRestoredListeningProgressRef.current = stateCode;
    }

    void restoreListeningProgress();

    return () => {
      isMounted = false;
    };
  }, [db, questions, stateCode]);

  useEffect(() => {
    if (questions.length === 0 || hasRestoredListeningProgressRef.current !== stateCode) {
      return;
    }

    const currentQuestionId = questions[currentIndex]?.id;
    if (!currentQuestionId) {
      return;
    }

    void saveListeningResumeQuestionId(db, stateCode, currentQuestionId);
  }, [currentIndex, db, questions, stateCode]);

  useEffect(() => {
    let isMounted = true;

    async function loadPreferredVoice() {
      if (Platform.OS !== 'ios') {
        return;
      }

      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const preferredVoice = choosePreferredEnglishVoice(voices);

        if (isMounted) {
          setPreferredVoiceId(preferredVoice?.identifier ?? null);
        }
      } catch {
        if (isMounted) {
          setPreferredVoiceId(null);
        }
      }
    }

    void loadPreferredVoice();

    return () => {
      isMounted = false;
      sequenceTokenRef.current += 1;
      void Speech.stop();
      void stopAudioPlayer(localSpeechPlayer);
      localSpeechPlayer.remove();
    };
  }, [localSpeechPlayer]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderBackActionButton
          onPress={() => {
            Alert.alert(
              language === 'zh' ? '返回第一题？' : 'Return to the first question?',
              language === 'zh'
                ? '确认后会立即回到听题的第 1 题。'
                : 'This will jump back to question 1 in Listening.',
              [
                { text: language === 'zh' ? '取消' : 'Cancel', style: 'cancel' },
                {
                  text: language === 'zh' ? '确定' : 'Confirm',
                  onPress: () => {
                    pendingPlaybackQuestionIdRef.current = null;
                    sequenceTokenRef.current += 1;
                    currentIndexRef.current = 0;
                    setCurrentIndex(0);
                    setIsPlaying(false);
                    setHasUserStartedPlayback(false);
                    setShowSpeechRateMenu(false);
                    void Speech.stop();
                    void stopAudioPlayer(localSpeechPlayer);
                  },
                },
              ]
            );
          }}
        />
      ),
    });
  }, [language, localSpeechPlayer, navigation]);

  useEffect(() => {
    pendingPlaybackQuestionIdRef.current = null;
    setIsPlaying(false);
    sequenceTokenRef.current += 1;
    setShowSpeechRateMenu(false);
    setIsQuestionTextVisible(!blindListeningEnabled);
    void Speech.stop();
    void stopAudioPlayer(localSpeechPlayer);
  }, [blindListeningEnabled, localSpeechPlayer]);

  useEffect(() => {
    setIsPlaying(false);
    sequenceTokenRef.current += 1;
    setShowSpeechRateMenu(false);
    setIsQuestionTextVisible(!blindListeningEnabled);
    void Speech.stop();
    void stopAudioPlayer(localSpeechPlayer);
  }, [localSpeechPlayer, question?.id]);

  async function speakSegment(text: string, token: number) {
    const normalized = buildTtsReadyEnglish(text);
    if (!normalized) {
      return;
    }

    await new Promise<void>((resolve) => {
      Speech.speak(normalized, {
        language: 'en-US',
        pitch: 1,
        rate: getTtsRate(speechRate),
        voice: preferredVoiceId ?? undefined,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });

    if (sequenceTokenRef.current !== token) {
      throw new Error('sequence-cancelled');
    }
  }

  async function playQuestionSegment(targetQuestion: Question, token: number) {
    if (!targetQuestion) {
      return;
    }

    const localSource = getQuestionAudioSource(targetQuestion.id);
    if (localSource != null) {
      await playLocalAudioSource(localSpeechPlayer, localSource, speechRate, {
        isCancelled: () => sequenceTokenRef.current !== token,
      });
      return;
    }

    await speakSegment(targetQuestion.questionEn, token);
  }

  async function playAnswerSegment(
    targetQuestion: Question,
    targetCorrectOption: Question['options'][number] | null,
    token: number
  ) {
    if (!targetCorrectOption?.textEn || !targetQuestion) {
      return;
    }

    const localSource = getAnswerAudioSource(targetQuestion.id);
    if (localSource != null) {
      await playLocalAudioSource(localSpeechPlayer, localSource, speechRate, {
        isCancelled: () => sequenceTokenRef.current !== token,
      });
      return;
    }

    await speakSegment(targetCorrectOption.textEn, token);
  }

  async function waitBetween(ms: number, token: number) {
    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => resolve(), ms);
      if (sequenceTokenRef.current !== token) {
        clearTimeout(timeoutId);
        resolve();
      }
    });

    if (sequenceTokenRef.current !== token) {
      throw new Error('sequence-cancelled');
    }
  }

  async function speakSequence(
    targetQuestion: Question,
    targetCorrectOption: Question['options'][number] | null,
    targetIndex: number,
    parts: Array<'question' | 'answer'>,
    options?: { autoAdvance?: boolean }
  ) {
    const cleanParts = parts.filter((part) =>
      part === 'question' ? Boolean(targetQuestion?.questionEn) : Boolean(targetCorrectOption?.textEn)
    );
    if (cleanParts.length === 0) {
      return;
    }

    const token = sequenceTokenRef.current + 1;
    sequenceTokenRef.current = token;
    setIsPlaying(true);
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      interruptionMode: 'doNotMix',
      shouldRouteThroughEarpiece: false,
    });
    await Speech.stop();
    await stopAudioPlayer(localSpeechPlayer);

    try {
      for (let index = 0; index < cleanParts.length; index += 1) {
        if (cleanParts[index] === 'question') {
          await playQuestionSegment(targetQuestion, token);
        } else {
          await playAnswerSegment(targetQuestion, targetCorrectOption, token);
        }

        if (index < cleanParts.length - 1) {
          await waitBetween(1500, token);
        }
      }

      if (options?.autoAdvance && targetIndex < questions.length - 1) {
        await waitBetween(1800, token);
        const nextQuestion = questions[targetIndex + 1];
        pendingPlaybackQuestionIdRef.current = nextQuestion?.id ?? null;
        setCurrentIndex(targetIndex + 1);
      }
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'sequence-cancelled') {
        setIsPlaying(false);
      }
      return;
    }

    setIsPlaying(false);
  }

  async function handlePlayQuestion() {
    if (!question) {
      return;
    }
    if (!canUseCurrentListeningQuestion) {
      showPremiumUpgradePrompt(language, 'listening-limit');
      return;
    }
    await speakSequence(question, correctOption, currentIndex, ['question']);
  }

  async function handlePlayAnswer() {
    if (!canUseCurrentListeningQuestion) {
      showPremiumUpgradePrompt(language, 'listening-limit');
      return;
    }
    if (!correctOption?.textEn) {
      return;
    }
    await speakSequence(question, correctOption, currentIndex, ['answer']);
  }

  async function handlePlayQuestionAndAnswer() {
    if (!canUseCurrentListeningQuestion) {
      showPremiumUpgradePrompt(language, 'listening-limit');
      return;
    }
    if (!question || !correctOption?.textEn) {
      return;
    }
    await speakSequence(question, correctOption, currentIndex, ['question', 'answer'], { autoAdvance: autoAdvanceEnabled });
  }

  async function handleChangeSpeechRate(nextRate: number) {
    setSpeechRate(nextRate);
    setShowSpeechRateMenu(false);
  }

  async function handleChangeQuestionDisplay(nextMode: 'english' | 'bilingual') {
    setQuestionDisplayMode(nextMode);
    await savePreference(db, 'questionDisplayMode', nextMode);
  }

  function navigateListeningQuestion(offset: -1 | 1) {
    const baseIndex = currentIndexRef.current;
    const clampedIndex = Math.max(0, Math.min(questions.length - 1, baseIndex + offset));
    if (clampedIndex === baseIndex) {
      return;
    }

    const shouldResumePlayback = isPlaying;
    const targetQuestion = questions[clampedIndex];
    sequenceTokenRef.current += 1;
    currentIndexRef.current = clampedIndex;
    setCurrentIndex(clampedIndex);
    setIsPlaying(false);
    setShowSpeechRateMenu(false);
    void Speech.stop();
    void stopAudioPlayer(localSpeechPlayer);

    if (shouldResumePlayback && targetQuestion && canListenToQuestion(clampedIndex + 1)) {
      pendingPlaybackQuestionIdRef.current = targetQuestion.id;
      setHasUserStartedPlayback(true);
    } else {
      pendingPlaybackQuestionIdRef.current = null;
    }
  }

  function handleTogglePlayback() {
    if (!canUseCurrentListeningQuestion && !isPlaying) {
      showPremiumUpgradePrompt(language, 'listening-limit');
      return;
    }
    if (isPlaying) {
      pendingPlaybackQuestionIdRef.current = null;
      sequenceTokenRef.current += 1;
      setIsPlaying(false);
      setHasUserStartedPlayback(false);
      void Speech.stop();
      void stopAudioPlayer(localSpeechPlayer);
      return;
    }
    setHasUserStartedPlayback(true);
    void handlePlayQuestionAndAnswer();
  }

  useEffect(() => {
    if (!isFocused || isPlaying || pendingPlaybackQuestionIdRef.current !== question?.id) {
      return;
    }

    if (!question || !correctOption?.textEn || !canUseCurrentListeningQuestion) {
      pendingPlaybackQuestionIdRef.current = null;
      return;
    }

    pendingPlaybackQuestionIdRef.current = null;
    void speakSequence(question, correctOption, currentIndex, ['question', 'answer'], { autoAdvance: autoAdvanceEnabled });
  }, [
    autoAdvanceEnabled,
    canUseCurrentListeningQuestion,
    correctOption?.textEn,
    currentIndex,
    isFocused,
    isPlaying,
    question?.id,
  ]);

  useEffect(() => {
    if (isFocused) {
      return;
    }

    pendingPlaybackQuestionIdRef.current = null;
    sequenceTokenRef.current += 1;
    setIsPlaying(false);
    setHasUserStartedPlayback(false);
    setShowSpeechRateMenu(false);
    void Speech.stop();
    void stopAudioPlayer(localSpeechPlayer);
  }, [isFocused, localSpeechPlayer]);

  useEffect(() => {
    if (!isFocused || isPremium || canUseCurrentListeningQuestion) {
      if (canUseCurrentListeningQuestion) {
        lastListeningLimitPromptQuestionRef.current = null;
      }
      return;
    }

    const questionNumber = currentIndex + 1;
    if (lastListeningLimitPromptQuestionRef.current === questionNumber) {
      return;
    }

    lastListeningLimitPromptQuestionRef.current = questionNumber;
    sequenceTokenRef.current += 1;
    setIsPlaying(false);
    setHasUserStartedPlayback(false);
    setShowSpeechRateMenu(false);
    void Speech.stop();
    void stopAudioPlayer(localSpeechPlayer);
    showPremiumUpgradePrompt(language, 'listening-limit');
  }, [canUseCurrentListeningQuestion, currentIndex, isFocused, isPremium, language, localSpeechPlayer]);

  if (!question) {
    return (
      <ScreenFrame accent="#165a72">
        <Text style={styles.sectionTitle}>{language === 'zh' ? '正在加载听题内容...' : 'Loading listening practice...'}</Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame accent="#165a72" bare>
      <ScrollView style={styles.screen} contentContainerStyle={styles.listeningScreenContent}>
        <View style={styles.listeningContentInner}>
          <View style={styles.listeningHero}>
            <Text style={styles.listeningHeroEyebrow}>{language === 'zh' ? 'AUDIO PRACTICE' : 'AUDIO PRACTICE'}</Text>
            <Text style={styles.listeningHeroTitle}>{language === 'zh' ? '听题' : 'Listening'}</Text>
            <Text style={styles.listeningHeroBody}>
              {language === 'zh'
                ? '顺序播放题目和正确答案，专门用于练习听力和口语反应。'
                : 'Listen through questions and correct answers in sequence for dedicated audio practice.'}
            </Text>
            {!isPremium ? (
              <Text style={styles.listeningMetaText}>
                {language === 'zh'
                  ? `免费用户每轮只可听前 ${FREE_LISTENING_QUESTION_LIMIT} 道题。`
                  : `Free users can listen to only the first ${FREE_LISTENING_QUESTION_LIMIT} questions in each session.`}
              </Text>
            ) : null}
          </View>

          <View style={styles.listeningStatusCard}>
            <View style={styles.listeningStatusTopRow}>
              <View style={styles.listeningStatusChip}>
                <MaterialCommunityIcons name="headphones" size={14} color="#165a72" />
                <Text style={styles.listeningStatusChipText}>
                  {language === 'zh' ? `第 ${currentIndex + 1} 题 / 共 ${questions.length} 题` : `Question ${currentIndex + 1} of ${questions.length}`}
                </Text>
              </View>
            </View>
            <View style={styles.listeningStatusTrack}>
              <View
                style={[
                  styles.listeningStatusFill,
                  { width: `${((currentIndex + 1) / Math.max(questions.length, 1)) * 100}%` },
                ]}
              />
            </View>
            <View style={styles.listeningStatusControls}>
              <View style={styles.questionAudioControls}>
                <Pressable
                  style={[styles.questionReadButton, isPlaying && styles.questionReadButtonActive]}
                  onPress={handleTogglePlayback}
                >
                  <MaterialCommunityIcons
                    name={isPlaying ? 'stop-circle-outline' : 'volume-high'}
                    size={18}
                    color={isPlaying ? '#ffffff' : '#165a72'}
                  />
                </Pressable>
                <View style={styles.speechRateWrap}>
                  <Pressable
                    style={[styles.speechRateButton, showSpeechRateMenu && styles.speechRateButtonActive]}
                    onPress={() => setShowSpeechRateMenu((value) => !value)}
                  >
                    <Text style={[styles.speechRateButtonText, showSpeechRateMenu && styles.speechRateButtonTextActive]}>
                      {speechRate % 1 === 0 ? `${speechRate.toFixed(0)}x` : `${speechRate}x`}
                    </Text>
                    <MaterialCommunityIcons
                      name={showSpeechRateMenu ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={showSpeechRateMenu ? '#ffffff' : '#165a72'}
                    />
                  </Pressable>
                  {showSpeechRateMenu ? (
                    <View style={styles.speechRateMenu}>
                      {[0.5, 0.75, 1, 1.25].map((rate) => {
                        const label = rate % 1 === 0 ? `${rate.toFixed(0)}x` : `${rate}x`;
                        const isSelectedRate = speechRate === rate;
                        return (
                          <Pressable
                            key={rate}
                            style={[styles.speechRateMenuItem, isSelectedRate && styles.speechRateMenuItemActive]}
                            onPress={() => void handleChangeSpeechRate(rate)}
                          >
                            <Text style={[styles.speechRateMenuItemText, isSelectedRate && styles.speechRateMenuItemTextActive]}>
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>

              <Pressable
                style={styles.listeningAutoAdvanceInlineBar}
                onPress={() => setAutoAdvanceEnabled((value) => !value)}
              >
                <MaterialCommunityIcons name="skip-next-circle-outline" size={16} color="#165a72" />
                <Text style={styles.listeningAutoAdvanceInlineLabel}>
                  {language === 'zh' ? '自动下一题' : 'Auto next'}
                </Text>
                <View style={[styles.listeningAutoAdvancePill, autoAdvanceEnabled && styles.listeningAutoAdvancePillActive]}>
                  <Text style={[styles.listeningAutoAdvancePillText, autoAdvanceEnabled && styles.listeningAutoAdvancePillTextActive]}>
                    {autoAdvanceEnabled
                      ? (language === 'zh' ? '开' : 'ON')
                      : (language === 'zh' ? '关' : 'OFF')}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          <View style={styles.listeningCard}>
            <View style={styles.listeningLanguageRow}>
              <Text style={styles.listeningLanguageLabel}>
                {language === 'zh' ? '显示模式' : 'Display'}
              </Text>
              <View style={styles.modeRow}>
                {(['english', 'bilingual'] as const).map((item) => (
                  <Pressable
                    key={item}
                    style={[styles.modeChip, questionDisplayMode === item && styles.modeChipActive]}
                    onPress={() => void handleChangeQuestionDisplay(item)}
                  >
                    <Text style={[styles.modeChipText, questionDisplayMode === item && styles.modeChipTextActive]}>
                      {item === 'english'
                        ? (language === 'zh' ? '英文' : 'English')
                        : (language === 'zh' ? '双语' : 'Bilingual')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {blindListeningEnabled && !isQuestionTextVisible ? (
              <View style={styles.blindListeningCard}>
                <Text style={styles.blindListeningTitle}>
                  {language === 'zh' ? '盲听模式已开启' : 'Blind listening mode is on'}
                </Text>
                <Text style={styles.blindListeningBody}>
                  {language === 'zh'
                    ? '当前题目的文字已隐藏。点击播放按钮后会连播题目和答案，需要时可以手动显示内容。'
                    : 'The current question text is hidden first. Tap play to hear the question and answer sequence, and reveal the text anytime.'}
                </Text>
                <Pressable style={styles.blindListeningRevealButton} onPress={() => setIsQuestionTextVisible(true)}>
                  <MaterialCommunityIcons name="eye-outline" size={16} color="#165a72" />
                  <Text style={styles.blindListeningRevealButtonText}>
                    {language === 'zh' ? '显示题目和答案' : 'Show question and answer'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.listeningContentStack}>
                <View style={styles.listeningPromptBlock}>
                  <Text style={styles.listeningSectionLabel}>{language === 'zh' ? '题目' : 'Question'}</Text>
                  <Text style={styles.listeningQuestionText}>{question.questionEn}</Text>
                  {questionDisplayMode === 'bilingual' ? (
                    <Text style={styles.listeningQuestionSecondary}>{question.questionZh}</Text>
                  ) : null}
                </View>

                <View style={styles.listeningDividerRow}>
                  <View style={styles.listeningDividerLine} />
                  <View style={styles.listeningDividerDot} />
                  <View style={styles.listeningDividerLine} />
                </View>

                <View style={styles.listeningAnswerPanel}>
                  <Text style={styles.listeningSectionLabel}>{language === 'zh' ? '正确答案' : 'Correct answer'}</Text>
                  <Text style={styles.listeningAnswerText}>{correctOption?.textEn ?? '-'}</Text>
                  {questionDisplayMode === 'bilingual' && correctOption?.textZh ? (
                    <Text style={styles.listeningAnswerSecondary}>{correctOption.textZh}</Text>
                  ) : null}
                </View>

                <View style={styles.listeningHintPanel}>
                  <MaterialCommunityIcons name="ear-hearing" size={16} color="#855300" />
                  <Text style={styles.listeningAnswerHint}>
                    {language === 'zh'
                      ? '当前页面会自动连播题目和正确答案，你也可以随时暂停、调速或手动切换下一题。'
                      : 'This page auto-plays the question and correct answer, and you can pause, change speed, or move manually anytime.'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.listeningNavRow}>
            <Pressable
              style={[styles.listeningNavButton, currentIndex === 0 && styles.listeningNavButtonDisabled]}
              onPress={() => navigateListeningQuestion(-1)}
              disabled={currentIndex === 0}
            >
              <MaterialCommunityIcons name="arrow-left" size={16} color={currentIndex === 0 ? '#a8a39a' : '#5d605f'} />
              <Text style={[styles.listeningNavButtonText, currentIndex === 0 && styles.listeningNavButtonTextDisabled]}>
                {language === 'zh' ? '上一题' : 'Previous'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.listeningNavButton, currentIndex === questions.length - 1 && styles.listeningNavButtonDisabled]}
              onPress={() => navigateListeningQuestion(1)}
              disabled={currentIndex === questions.length - 1}
            >
              <Text
                style={[
                  styles.listeningNavButtonText,
                  currentIndex === questions.length - 1 && styles.listeningNavButtonTextDisabled,
                ]}
              >
                {language === 'zh' ? '下一题' : 'Next'}
              </Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={16}
                color={currentIndex === questions.length - 1 ? '#a8a39a' : '#5d605f'}
              />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function PracticeHomeScreen({ navigation, route }: any) {
  const categories = useCategories();
  const categoryPerformance = useCategoryPerformance(categories);
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const t = getCopy(language);
  const highFrequencyQuestionIds = getHighFrequencyQuestionIds(stateCode);
  const [chapterListExpanded, setChapterListExpanded] = useState(false);
  const totalQuestionCount = categories.reduce((sum, category) => sum + (category.questionCount ?? 0), 0);

  useEffect(() => {
    if (route.params?.previewExpandChapters) {
      setChapterListExpanded(true);
    }
  }, [route.params?.previewExpandChapters]);

  return (
    <ScreenFrame scrollable={false} bare>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.practiceHomeScreenContent}
      >
        <View style={styles.practiceHomeContentInner}>
          <View style={styles.practiceHeroSection}>
            <Text style={styles.practiceHeroTitle}>{language === 'zh' ? '选择练习方式' : 'Choose how to practice'}</Text>
            <Text style={styles.practiceHeroBody}>
              {language === 'zh'
                ? '按章节系统学习，或选择随机与高频练习集中训练'
                : 'Study by chapter, or use random and high-frequency drills.'}
            </Text>
          </View>

          <View style={styles.practiceChapterAccordionWrap}>
            <Pressable
              style={styles.practiceChapterAccordionTop}
              onPress={() => setChapterListExpanded((value) => !value)}
            >
              <View style={styles.practiceChapterAccordionIcon}>
                <MaterialCommunityIcons name="book-open-page-variant" size={24} color="#002045" />
              </View>
              <View style={styles.practiceChapterAccordionCopy}>
                <View style={styles.practiceChapterAccordionTitleRow}>
                  <View style={styles.practiceChapterAccordionTitleWrap}>
                    <Text style={styles.practiceChapterAccordionTitle}>{t.chapterPractice}</Text>
                    <MaterialCommunityIcons
                      name={chapterListExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="rgba(0,32,69,0.4)"
                    />
                  </View>
                  <View style={styles.practiceChapterAccordionCountPill}>
                    <Text style={styles.practiceChapterAccordionCountText}>
                      {categories.length} {language === 'zh' ? '章节' : 'chapters'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.practiceChapterAccordionSubtitle}>
                  {language === 'zh' ? '按知识点系统学习' : 'Study systematically by chapter'}
                </Text>
                <View style={styles.practiceChapterAccordionMetaPill}>
                  <Text style={styles.practiceChapterAccordionMetaText}>
                    {totalQuestionCount} {language === 'zh' ? '题' : 'questions'}
                  </Text>
                </View>
              </View>
            </Pressable>

            {chapterListExpanded ? (
              <View style={styles.practiceChapterAccordionList}>
              {categories.map((category) => {
                const title = language === 'zh' ? category.nameZh : category.nameEn;
                const subtitle = language === 'zh' ? category.nameEn : category.nameZh;
                const performance = categoryPerformance[category.id];
                const accuracy = performance?.accuracy ?? 0;
                const accuracyLabel = `${accuracy}%`;

                return (
                  <Pressable
                    key={category.id}
                    style={styles.practiceChapterListItem}
                    onPress={() =>
                      navigation.navigate('QuestionFlow', {
                        categoryId: category.id,
                        source: 'chapter',
                        sourceLabel: title,
                      })
                    }
                  >
                    <View style={styles.practiceChapterListItemCopy}>
                      <Text style={styles.practiceChapterListItemTitle}>{title}</Text>
                      <Text style={styles.practiceChapterListItemSubtitle}>{subtitle}</Text>
                      <Text style={styles.practiceChapterListItemMeta}>
                        {category.questionCount}{language === 'zh' ? '题' : ' questions'}
                      </Text>
                    </View>
                    <View style={styles.practiceChapterListItemPill}>
                      <Text
                        style={[
                          styles.practiceChapterListItemPillText,
                          accuracy === 0 && styles.practiceChapterListItemPillTextMuted,
                        ]}
                      >
                        {language === 'zh' ? `正确率 ${accuracyLabel}` : `Accuracy ${accuracyLabel}`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              </View>
            ) : null}
          </View>

          <Pressable
            style={styles.practiceModeCard}
            onPress={() => navigation.navigate('QuestionFlow', { categoryId: 'random', source: 'random', sourceLabel: t.randomPractice })}
          >
            <View style={[styles.practiceModeIconWrap, { backgroundColor: '#ffddb8' }]}>
              <MaterialCommunityIcons name="shuffle-variant" size={24} color="#855300" />
            </View>
            <View style={styles.practiceModeCopy}>
              <Text style={styles.practiceModeTitle}>{t.randomPractice}</Text>
              <Text style={styles.practiceModeBody}>
                {language === 'zh' ? '整套题库乱序刷题' : 'Mix the full bank into a random drill.'}
              </Text>
            </View>
          </Pressable>

          <Pressable style={styles.practiceModeCard} onPress={() => navigation.navigate('HighFrequencyIntro')}>
            <View style={[styles.practiceModeIconWrap, { backgroundColor: 'rgba(255, 218, 214, 0.72)' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#ba1a1a" />
            </View>
            <View style={styles.practiceModeCopy}>
              <View style={styles.practiceModeTitleRow}>
                <Text style={styles.practiceModeTitle}>{t.highFrequencyPack}</Text>
                <View style={styles.practiceModeHotPill}>
                  <Text style={styles.practiceModeHotPillText}>HOT</Text>
                </View>
              </View>
              <Text style={styles.practiceModeBody}>
                {language === 'zh' ? '集中刷高频混淆点' : 'Target the most-missed exam traps.'}
              </Text>
              <Text style={styles.practiceModeMetaEmphasis}>
                {highFrequencyQuestionIds.length} {language === 'zh' ? '题' : 'questions'}
              </Text>
            </View>
          </Pressable>

          <Pressable style={styles.practiceMockCard} onPress={() => navigation.navigate('MockIntro')}>
            <View style={styles.practiceMockEyebrowRow}>
              <View style={styles.practiceMockEyebrowDot} />
              <Text style={styles.practiceMockEyebrow}>
                {language === 'zh' ? 'REAL EXAM MODE' : 'REAL EXAM MODE'}
              </Text>
            </View>
            <Text style={styles.practiceMockTitle}>{t.mockTest}</Text>
            <Text style={styles.practiceMockBody}>
              {getMockPracticeCardBody(stateCode, language)}
            </Text>
            <View style={styles.practiceMockButton}>
              <Text style={styles.practiceMockButtonText}>
                {language === 'zh' ? '立即开始' : 'Start now'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function CategoryDetailScreen({ route, navigation }: any) {
  const categories = useCategories();
  const categoryPerformance = useCategoryPerformance(categories);
  const language = useAppStore((state) => state.language);
  const t = getCopy(language);
  const fallbackCategory = categories[0];
  const categoryId = route.params?.categoryId ?? fallbackCategory?.id;
  const category = categories.find((item) => item.id === categoryId) ?? fallbackCategory;

  if (!category) {
    return (
      <ScreenFrame>
        <Text style={styles.sectionTitle}>{t.loadingChapter}</Text>
      </ScreenFrame>
    );
  }

  const accuracy = categoryPerformance[category.id]?.accuracy ?? 0;

  return (
    <ScreenFrame accent="#8d6d2f">
      <Text style={styles.sectionTitle}>{language === 'zh' ? category.nameZh : category.nameEn}</Text>
      <Text style={styles.sectionDescription}>{language === 'zh' ? category.nameEn : category.nameZh}</Text>
      <View style={styles.panel}>
        <Text style={styles.statLine}>{t.questionCount}: {category.questionCount}</Text>
        <Text style={styles.statLine}>{t.progress}: {category.progress}%</Text>
        <Text style={styles.statLine}>{t.accuracy}: {accuracy}%</Text>
      </View>
      <PrimaryButton label={t.startPractice} onPress={() => navigation.navigate('QuestionFlow', { categoryId: category.id })} />
      <SecondaryButton label={t.reviewMistakes} onPress={() => navigation.navigate('MistakesNotebook')} />
    </ScreenFrame>
  );
}

function RoadSignIntroScreen({ navigation }: any) {
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const t = getCopy(language);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const roadSignIds = getRoadSignIdsForState(stateCode);
  const quizSigns = useMemo(
    () => getRoadSignsForState(stateCode).filter((sign) => roadSignIds.includes(sign.id)),
    [roadSignIds, stateCode]
  );
  const groupedSigns = useMemo(
    () => getRoadSignGroupsForState(stateCode, language, quizSigns),
    [language, quizSigns, stateCode]
  );
  const packTagLabels = stateCode === 'NY'
    ? (language === 'zh'
      ? ['官网重点', '交通信号', '路面标线', '施工与指路']
      : ['Official Focus', 'Signals', 'Markings', 'Work & Guide'])
    : getRoadSignTagLabels(
      groupedSigns.map((group) => group.id as keyof typeof roadSignSectionMeta),
      language
    );

  function getRoadSignGroupIcon(groupId: string) {
    switch (groupId) {
      case 'official-focus':
        return 'star-circle-outline';
      case 'signals':
        return 'traffic-light-outline';
      case 'markings':
        return 'vector-polyline';
      case 'warning':
        return 'alert';
      case 'regulatory':
        return 'close-octagon';
      case 'guide':
        return 'information';
      case 'construction':
        return 'cone';
      default:
        return 'map-marker-path';
    }
  }

  function getRoadSignGroupColor(groupId: string) {
    switch (groupId) {
      case 'official-focus':
        return '#855300';
      case 'signals':
      case 'guide':
        return '#2f6fdb';
      case 'markings':
        return '#2e476e';
      case 'warning':
        return '#c96b00';
      case 'regulatory':
        return '#ba1a1a';
      case 'construction':
        return '#855300';
      default:
        return '#2e476e';
    }
  }

  return (
    <ScreenFrame scrollable={false} bare>
      <ScrollView style={styles.screen} contentContainerStyle={styles.roadSignIntroScreenContent}>
        <View style={styles.roadSignIntroContentInner}>
          <View style={styles.roadSignIntroHero}>
            <Text style={styles.roadSignIntroTitle}>{t.roadSignsSpecial}</Text>
            <Text style={styles.roadSignIntroBody}>
              {getRoadSignPackIntroBody(stateCode, language)}
            </Text>
          </View>

          <View style={styles.roadSignIntroSummaryCard}>
            <View style={styles.roadSignIntroSummaryTopRow}>
              <View style={styles.roadSignIntroSummaryIcons}>
                <View style={[styles.roadSignIntroSummaryIconBubble, { backgroundColor: '#d6e3ff' }]}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#002045" />
                </View>
                <View style={[styles.roadSignIntroSummaryIconBubble, styles.roadSignIntroSummaryIconBubbleOverlap, { backgroundColor: '#ffddb8' }]}>
                  <MaterialCommunityIcons name="card-text-outline" size={20} color="#855300" />
                </View>
              </View>
              <View style={styles.roadSignIntroSummaryCopy}>
                <Text style={styles.roadSignIntroSummaryTitle}>
                  {getRoadSignPackSummaryTitle(stateCode, language)}
                </Text>
                <Text style={styles.roadSignIntroSummarySubtitle}>
                  {stateCode === 'NY'
                    ? (language === 'zh'
                      ? `包含 ${nyOfficialRoadSignIds.length} 个官网重点 + ${nyHandbookRoadSignIds.length} 个手册路标`
                      : `${nyOfficialRoadSignIds.length} focus + ${nyHandbookRoadSignIds.length} handbook signs`)
                    : (language === 'zh'
                      ? `包含 ${quizSigns.length} 个精选路标`
                      : `${quizSigns.length} curated sign cards`)}
                </Text>
              </View>
            </View>

            <View style={styles.roadSignIntroTagWrap}>
              {packTagLabels.map((label) => (
                <View key={label} style={styles.roadSignIntroTag}>
                  <Text style={styles.roadSignIntroTagText}>{label}</Text>
                </View>
              ))}
            </View>

            <Pressable style={styles.roadSignIntroStartButton} onPress={() => navigation.navigate('RoadSignQuiz')}>
              <Text style={styles.roadSignIntroStartButtonText}>{t.startRoadSignsSpecial}</Text>
              <MaterialCommunityIcons name="play" size={20} color="#2a1700" />
            </Pressable>
          </View>

          <View style={styles.roadSignIntroBrowseHeader}>
            <View style={styles.roadSignIntroBrowseHeaderRow}>
              <Text style={styles.roadSignIntroBrowseTitle}>{t.browseRoadSigns}</Text>
              <Text style={styles.roadSignIntroBrowseCount}>
                {language === 'zh' ? `全部 ${groupedSigns.length} 类` : `${groupedSigns.length} groups`}
              </Text>
            </View>
            <Text style={styles.roadSignIntroBrowseBody}>{t.roadSignLibraryBody}</Text>
          </View>

          <View style={styles.roadSignIntroGroups}>
            {groupedSigns.map((group) => (
              <View key={group.id} style={styles.roadSignIntroGroup}>
                <Pressable
                  style={styles.roadSignIntroGroupHeader}
                  onPress={() =>
                    setExpandedGroups((current) => ({
                      ...current,
                      [group.id]: !current[group.id],
                    }))
                  }
                >
                  <View style={styles.roadSignIntroGroupHeaderLeft}>
                    <MaterialCommunityIcons
                      name={getRoadSignGroupIcon(group.id)}
                      size={18}
                      color={getRoadSignGroupColor(group.id)}
                    />
                    <View style={styles.roadSignIntroGroupHeaderCopy}>
                      <Text style={styles.roadSignIntroGroupTitle}>{group.title}</Text>
                      <Text style={styles.roadSignIntroGroupMeta}>
                        {group.subtitle} · {group.signs.length}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name={expandedGroups[group.id] ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#7b7d83"
                  />
                </Pressable>

                {expandedGroups[group.id] ? (
                  <View style={styles.signGrid}>
                    {group.signs.map((sign) => (
                      <RoadSignLearningCard key={sign.id} sign={sign} />
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function RoadSignQuizScreen() {
  const db = useDatabase();
  const navigation = useNavigation<any>();
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const studyMode = useAppStore((state) => state.studyMode);
  const setStudyMode = useAppStore((state) => state.setStudyMode);
  const { refresh } = useUserStats();
  const t = getCopy(language);
  const roadSignIds = getRoadSignIdsForState(stateCode);
  const quizSigns = useMemo(
    () => getRoadSignsForState(stateCode).filter((sign) => roadSignIds.includes(sign.id)),
    [roadSignIds, stateCode]
  );
  const quizItems = useMemo(() => buildRoadSignQuizItems(quizSigns), [quizSigns]);
  const roadSignQuestionIds = useMemo(
    () => quizItems.map((entry) => buildRoadSignQuestionId(entry.sign.id)),
    [quizItems]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progressBySignId, setProgressBySignId] = useState<Record<string, QuestionProgressState>>({});
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [savedByQuestionId, setSavedByQuestionId] = useState<Record<string, boolean>>({});
  const [hasHydratedResume, setHasHydratedResume] = useState(false);
  const practiceInlineNativeAd = usePracticeInlineNativeAd();
  const pagerRef = useRef<FlatList<{ pageKey: string; logicalIndex: number; item: ReturnType<typeof buildRoadSignQuizItems>[number] }>>(null);
  const { width: windowWidth } = useWindowDimensions();
  const item = quizItems[currentIndex];
  const question = item ? buildRoadSignQuestionFromSign(item.sign, quizSigns) : null;
  const currentProgress = item
    ? progressBySignId[item.sign.id] ?? {
        selectedOption: null,
        hasChecked: false,
        isCorrect: null,
        recorded: false,
      }
    : {
        selectedOption: null,
        hasChecked: false,
        isCorrect: null,
        recorded: false,
      };
  const pagerItems = useMemo(
    () =>
      quizItems.map((entry, index) => ({
        pageKey: entry.sign.id,
        logicalIndex: index,
        item: entry,
      })),
    [quizItems]
  );

  useEffect(() => {
    let isMounted = true;

    async function hydrateRoadSignResume() {
      const resumeSignId = await getRoadSignResumeId(db, stateCode);

      if (!isMounted) {
        return;
      }

      if (resumeSignId) {
        const resumeIndex = quizItems.findIndex((entry) => entry.sign.id === resumeSignId);
        if (resumeIndex >= 0) {
          setCurrentIndex(resumeIndex);
        }
      }

      setHasHydratedResume(true);
    }

    void hydrateRoadSignResume();

    return () => {
      isMounted = false;
    };
  }, [db, quizItems, stateCode]);

  useEffect(() => {
    if (!hasHydratedResume) {
      return;
    }

    if (currentIndex >= quizItems.length) {
      void clearRoadSignResumeId(db, stateCode);
      return;
    }

    const currentSignId = quizItems[currentIndex]?.sign.id;
    if (!currentSignId) {
      return;
    }

    void saveRoadSignResumeId(db, stateCode, currentSignId);
  }, [currentIndex, db, hasHydratedResume, quizItems, stateCode]);

  useEffect(() => {
    if (currentIndex >= quizItems.length) {
      return;
    }

    pagerRef.current?.scrollToIndex({
      index: currentIndex,
      animated: true,
    });
  }, [currentIndex, quizItems.length]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSavedRoadSigns() {
      const entries = await Promise.all(
        roadSignQuestionIds.map(async (questionId) => [questionId, await isQuestionSaved(db, stateCode, questionId)] as const)
      );

      if (!isMounted) {
        return;
      }

      setSavedByQuestionId(Object.fromEntries(entries));
    }

    void hydrateSavedRoadSigns();

    return () => {
      isMounted = false;
    };
  }, [db, roadSignQuestionIds, stateCode]);

  if (!hasHydratedResume) {
    return (
      <ScreenFrame accent="#ca4d2f">
        <Text style={styles.sectionTitle}>{t.loadingChapter}</Text>
      </ScreenFrame>
    );
  }

  if (!item) {
    const correctCount = Object.values(answers).filter(Boolean).length;
    const accuracy = quizItems.length > 0 ? Math.round((correctCount / quizItems.length) * 100) : 0;

    return (
      <ScreenFrame accent="#ca4d2f">
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>{t.roadSignsSpecial}</Text>
          <Text style={styles.heroTitle}>{correctCount} / {quizItems.length} {t.correct}</Text>
          <Text style={styles.heroBody}>
            {t.accuracy} {accuracy}%。{language === 'zh' ? '这一轮只考看图识义，不再混入普通题库。' : 'This round only tests sign recognition, not general handbook questions.'}
          </Text>
        </View>
        <PrimaryButton
          label={t.practiceAgain}
          onPress={() => {
            void clearRoadSignResumeId(db, stateCode);
            setCurrentIndex(0);
            setAnswers({});
            setProgressBySignId({});
          }}
        />
      </ScreenFrame>
    );
  }

  const pageWidth = Math.max(windowWidth, 1);

  async function handleSelectOption(targetItem: ReturnType<typeof buildRoadSignQuizItems>[number], optionKey: string) {
    const existing = progressBySignId[targetItem.sign.id];
    if (existing?.hasChecked) {
      return;
    }

    const selected = targetItem.options.find((option) => option.key === optionKey);
    if (!selected) {
      return;
    }

    setProgressBySignId((current) => ({
      ...current,
      [targetItem.sign.id]: {
        selectedOption: optionKey,
        hasChecked: true,
        isCorrect: selected.isCorrect,
        recorded: true,
      },
    }));
    setAnswers((current) => ({ ...current, [targetItem.sign.id]: selected.isCorrect }));

    const targetQuestion = buildRoadSignQuestionFromSign(targetItem.sign, quizSigns);
    if (!targetQuestion) {
      return;
    }

    await recordAttempt(db, {
      stateCode,
      questionId: targetQuestion.id,
      selectedOptionKey: optionKey,
      isCorrect: selected.isCorrect,
      source: t.roadSignsSpecial,
    });
    void refresh();
  }

  function handlePrimaryAction() {
    setCurrentIndex((index) => Math.min(quizItems.length, index + 1));
  }

  return (
    <ScreenFrame accent="#ca4d2f" scrollable={false}>
      <View style={styles.notebookPagerWrap}>
        <FlatList
          ref={pagerRef}
          data={pagerItems}
          horizontal
          pagingEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          initialScrollIndex={Math.min(currentIndex, Math.max(pagerItems.length - 1, 0))}
          keyExtractor={(entry) => entry.pageKey}
          getItemLayout={(_, index) => ({
            length: pageWidth,
            offset: pageWidth * index,
            index,
          })}
          onScrollToIndexFailed={(info) => {
            pagerRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
          onMomentumScrollEnd={(event) => {
            const nextPageIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
            const clampedIndex = Math.max(0, Math.min(quizItems.length - 1, nextPageIndex));

            if (clampedIndex > currentIndex && !currentProgress.hasChecked) {
              pagerRef.current?.scrollToIndex({ index: currentIndex, animated: true });
              return;
            }

            if (clampedIndex === currentIndex) {
              return;
            }

            setCurrentIndex(clampedIndex);
          }}
          renderItem={({ item: pagerItem }) => {
            const pagerQuestion = buildRoadSignQuestionFromSign(pagerItem.item.sign, quizSigns);
            const pagerProgress = progressBySignId[pagerItem.item.sign.id] ?? {
              selectedOption: null,
              hasChecked: false,
              isCorrect: null,
              recorded: false,
            };

            if (!pagerQuestion) {
              return null;
            }

            return (
              <View style={[styles.notebookPagerPage, { width: pageWidth }]}>
                <ScrollView
                  style={styles.screen}
                  contentContainerStyle={styles.notebookPagerScrollContent}
                  directionalLockEnabled
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  <QuestionCard
                    db={db}
                    question={pagerQuestion}
                    questionIndex={pagerItem.logicalIndex + 1}
                    total={quizItems.length}
                    mode={studyMode}
                    onModeChange={setStudyMode}
                    revealExplanation
                    sourceLabel={t.roadSignsSpecial}
                    saved={savedByQuestionId[pagerQuestion.id] ?? false}
                    setSaved={(next) =>
                      setSavedByQuestionId((current) => ({
                        ...current,
                        [pagerQuestion.id]: next,
                      }))
                    }
                    selectedOption={pagerProgress.selectedOption}
                    hasChecked={pagerProgress.hasChecked}
                    primaryActionLabel={pagerItem.logicalIndex === quizItems.length - 1 ? t.practiceComplete : t.nextQuestion}
                    previousActionLabel={t.previousQuestion}
                    onSelectOption={(optionKey) => void handleSelectOption(pagerItem.item, optionKey)}
                    isNotebookFlow
                    canGoPrevious={pagerItem.logicalIndex > 0}
                    canGoNext={pagerProgress.hasChecked}
                    canExitBackward={pagerItem.logicalIndex === 0}
                    onPrevious={() => {
                      if (pagerItem.logicalIndex === 0) {
                        navigation.navigate('PracticeHome');
                        return;
                      }

                      setCurrentIndex(pagerItem.logicalIndex - 1);
                    }}
                    onAdvance={() => {
                      if (!pagerProgress.hasChecked) {
                        return;
                      }

                      if (pagerItem.logicalIndex === quizItems.length - 1) {
                        setCurrentIndex(quizItems.length);
                        return;
                      }

                      setCurrentIndex(pagerItem.logicalIndex + 1);
                    }}
                    roadSignOverride={pagerItem.item.sign}
                    collapsibleRoadSignDescription
                    inlineNativeAd={pagerItem.logicalIndex === currentIndex ? practiceInlineNativeAd : null}
                    enableBlindListeningAutoPlay={pagerItem.logicalIndex === currentIndex}
                    isActive={pagerItem.logicalIndex === currentIndex}
                  />
                </ScrollView>
              </View>
            );
          }}
        />
      </View>
    </ScreenFrame>
  );
}

function HighFrequencyIntroScreen({ navigation }: any) {
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const t = getCopy(language);
  const highFrequencyQuestionIds = getHighFrequencyQuestionIds(stateCode);

  return (
    <ScreenFrame accent="#8d6d2f" bare>
      <ScrollView style={styles.screen} contentContainerStyle={styles.highFrequencyIntroScreenContent}>
        <View style={styles.highFrequencyIntroContentInner}>
          <View style={styles.highFrequencyIntroHero}>
            <Text style={styles.highFrequencyIntroTitle}>{t.highFrequencyPack}</Text>
            <Text style={styles.highFrequencyIntroBody}>{t.highFrequencyPackBody}</Text>
          </View>

          <View style={styles.highFrequencyIntroFeatureCard}>
            <View style={styles.highFrequencyIntroFeatureTop}>
              <View style={styles.highFrequencyIntroFeatureIcon}>
                <MaterialCommunityIcons name="book-open-page-variant" size={22} color="#002045" />
              </View>
              <View style={styles.highFrequencyIntroFeatureCopy}>
                <Text style={styles.highFrequencyIntroFeatureLabel}>{t.questionCount}</Text>
                <Text style={styles.highFrequencyIntroFeatureValue}>
                  {highFrequencyQuestionIds.length}
                  <Text style={styles.highFrequencyIntroFeatureUnit}>{language === 'zh' ? ' 题' : ''}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.highFrequencyIntroMetaList}>
              <View style={styles.highFrequencyIntroMetaRow}>
                <View style={styles.highFrequencyIntroMetaDot} />
                <View style={styles.highFrequencyIntroMetaCopy}>
                  <Text style={styles.highFrequencyIntroMetaLabel}>{language === 'zh' ? '练习方式' : 'Practice mode'}</Text>
                  <Text style={styles.highFrequencyIntroMetaText}>
                    {language === 'zh' ? '按高频易错题包集中练习' : 'Practice through one focused mistake pack.'}
                  </Text>
                </View>
              </View>

              <View style={styles.highFrequencyIntroMetaRow}>
                <View style={styles.highFrequencyIntroMetaDot} />
                <View style={styles.highFrequencyIntroMetaCopy}>
                  <Text style={styles.highFrequencyIntroMetaLabel}>{language === 'zh' ? '适合场景' : 'Best for'}</Text>
                  <Text style={styles.highFrequencyIntroMetaText}>
                    {language === 'zh' ? '考前冲刺、查漏补缺、快速复习' : 'Final review, quick refreshers, and weak-point cleanup.'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Pressable
            style={styles.highFrequencyIntroPrimaryButton}
            onPress={() =>
              navigation.navigate('QuestionFlow', {
                questionIds: highFrequencyQuestionIds,
                source: 'high-frequency',
                sourceLabel: t.highFrequencyPack,
              })
            }
          >
            <Text style={styles.highFrequencyIntroPrimaryButtonText}>{t.startHighFrequencyPack}</Text>
          </Pressable>

          <View style={styles.highFrequencyIntroBenefits}>
            <View style={styles.highFrequencyIntroBenefitRow}>
              <MaterialCommunityIcons name="target" size={19} color="#fea619" />
              <Text style={styles.highFrequencyIntroBenefitText}>
                {language === 'zh' ? '聚焦最常错的知识点' : 'Focus on the concepts learners miss most often.'}
              </Text>
            </View>
            <View style={styles.highFrequencyIntroBenefitRow}>
              <MaterialCommunityIcons name="timer-outline" size={19} color="#fea619" />
              <Text style={styles.highFrequencyIntroBenefitText}>
                {language === 'zh' ? '适合考前快速再刷一遍' : 'Designed for a fast pre-test refresher.'}
              </Text>
            </View>
            <View style={styles.highFrequencyIntroBenefitRow}>
              <MaterialCommunityIcons name="check-circle-outline" size={19} color="#fea619" />
              <Text style={styles.highFrequencyIntroBenefitText}>
                {language === 'zh' ? '帮助你减少重复出错' : 'Helps reduce repeated mistakes before exam day.'}
              </Text>
            </View>
          </View>

          <View style={styles.highFrequencyIntroNotice}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#6b6d72" />
            <Text style={styles.highFrequencyIntroNoticeText}>
              {language === 'zh'
                ? '这不是按章节练习，而是按高频易错题单集中训练。'
                : 'This is not chapter-based practice. It is a concentrated pack of common mistakes.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

type QuestionProgressState = {
  selectedOption: string | null;
  hasChecked: boolean;
  isCorrect: boolean | null;
  recorded: boolean;
};

type PagerQuestionItem = {
  pageKey: string;
  logicalIndex: number;
  question: Question;
};

function QuestionFlowScreen({ route, navigation }: any) {
  const db = useDatabase();
  const categories = useCategories();
  const requestedCategoryId = route.params?.categoryId ?? categories[0]?.id;
  const source = route.params?.source ?? 'chapter';
  const sourceLabel = route.params?.sourceLabel ?? source;
  const requestedQuestionIds = route.params?.questionIds as string[] | undefined;
  const requestedQuestionIdsKey = requestedQuestionIds?.join('|') ?? '';
  const initialQuestionId = route.params?.initialQuestionId as string | undefined;
  const previewSelectedOptionKey = route.params?.previewSelectedOptionKey as 'first' | string | undefined;
  const previewFocus = route.params?.previewFocus as 'answer-review' | undefined;
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const t = getCopy(language);
  const categoryQuestions = useQuestions(requestedQuestionIds ? undefined : requestedCategoryId);
  const requestedQuestions = useQuestionList(requestedQuestionIds ?? []);
  const studyMode = useAppStore((state) => state.studyMode);
  const setStudyMode = useAppStore((state) => state.setStudyMode);
  const { refresh } = useUserStats();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [progressByQuestionId, setProgressByQuestionId] = useState<Record<string, QuestionProgressState>>({});
  const practiceInlineNativeAd = usePracticeInlineNativeAd();
  const pagerRef = useRef<FlatList<PagerQuestionItem>>(null);
  const { width: windowWidth } = useWindowDimensions();
  const isReviewFlow = source === 'mistakes' || source === 'saved';
  const isNotebookFlow = isReviewFlow || source === 'chapter' || source === 'random' || source === 'high-frequency';
  const filteredQuestions = useMemo(() => {
    if (!requestedQuestionIds?.length) {
      return categoryQuestions;
    }

    return requestedQuestions;
  }, [categoryQuestions, requestedQuestionIds, requestedQuestions]);
  const question = filteredQuestions[currentIndex];
  const pagerQuestions = useMemo<PagerQuestionItem[]>(() => {
    if (!isNotebookFlow) {
      return filteredQuestions.map((item, index) => ({
        pageKey: item.id,
        logicalIndex: index,
        question: item,
      }));
    }

    if (!isReviewFlow || filteredQuestions.length <= 1) {
      return filteredQuestions.map((item, index) => ({
        pageKey: item.id,
        logicalIndex: index,
        question: item,
      }));
    }

    return [
      {
        pageKey: `${filteredQuestions[filteredQuestions.length - 1]?.id}-sentinel-start`,
        logicalIndex: filteredQuestions.length - 1,
        question: filteredQuestions[filteredQuestions.length - 1],
      },
      ...filteredQuestions.map((item, index) => ({
        pageKey: item.id,
        logicalIndex: index,
        question: item,
      })),
      {
        pageKey: `${filteredQuestions[0]?.id}-sentinel-end`,
        logicalIndex: 0,
        question: filteredQuestions[0],
      },
    ];
  }, [filteredQuestions, isNotebookFlow, isReviewFlow]);
  const currentProgress = question
    ? progressByQuestionId[question.id] ?? {
        selectedOption: null,
        hasChecked: false,
        isCorrect: null,
        recorded: false,
      }
    : {
        selectedOption: null,
        hasChecked: false,
        isCorrect: null,
        recorded: false,
      };
  const currentCategoryIndex = categories.findIndex((item) => item.id === requestedCategoryId);
  const nextCategory = currentCategoryIndex >= 0 ? categories[currentCategoryIndex + 1] : undefined;
  const nextCategoryLabel = nextCategory ? (language === 'zh' ? nextCategory.nameZh : nextCategory.nameEn) : '';

  useEffect(() => {
    if (!question?.id) {
      setSaved(false);
      return;
    }

    void isQuestionSaved(db, stateCode, question.id).then(setSaved);
  }, [db, question?.id, stateCode]);

  useEffect(() => {
    if (initialQuestionId) {
      const nextIndex = filteredQuestions.findIndex((item) => item.id === initialQuestionId);
      if (nextIndex >= 0) {
        setCurrentIndex(nextIndex);
        setProgressByQuestionId({});
        return;
      }
    }

    setCurrentIndex(0);
    setProgressByQuestionId({});
  }, [filteredQuestions, initialQuestionId]);

  useEffect(() => {
    if (!previewSelectedOptionKey || !question) {
      return;
    }

    setProgressByQuestionId((current) => {
      if (current[question.id]?.hasChecked) {
        return current;
      }

      const selectedOption = previewSelectedOptionKey === 'first'
        ? question.options[0]
        : question.options.find((option) => option.key === previewSelectedOptionKey);

      if (!selectedOption) {
        return current;
      }

      return {
        ...current,
        [question.id]: {
          selectedOption: selectedOption.key,
          hasChecked: true,
          isCorrect: selectedOption.isCorrect,
          recorded: false,
        },
      };
    });
  }, [previewSelectedOptionKey, question]);

  useEffect(() => {
    if (!isNotebookFlow) {
      return;
    }
    pagerRef.current?.scrollToIndex({
      index: isReviewFlow && filteredQuestions.length > 1 ? currentIndex + 1 : currentIndex,
      animated: true,
    });
  }, [currentIndex, filteredQuestions.length, isNotebookFlow, isReviewFlow]);

  useEffect(() => {
    navigation.setOptions({ title: sourceLabel });
  }, [navigation, sourceLabel]);

  if (!question) {
    if (filteredQuestions.length > 0 && currentIndex >= filteredQuestions.length) {
      const correctCount = Object.values(progressByQuestionId).filter((item) => item.isCorrect).length;
      const accuracy = filteredQuestions.length > 0 ? Math.round((correctCount / filteredQuestions.length) * 100) : 0;
      const chapterLabel = sourceLabel || (language === 'zh' ? '当前章节' : 'Current chapter');
      const chapterSubtitle = language === 'zh' ? '本章练习已完成' : 'Chapter practice complete';

      return (
        <ScreenFrame scrollable={false} bare>
          <ScrollView style={styles.screen} contentContainerStyle={styles.practiceCompleteScreenContent}>
            <View style={styles.practiceCompleteContentInner}>
              <View style={styles.practiceCompleteStatusSection}>
                <Text style={styles.practiceCompleteBadge}>
                  {chapterLabel}
                </Text>
                <View style={styles.practiceCompleteHeadingWrap}>
                  <Text style={styles.practiceCompleteTitle}>
                    {language === 'zh'
                      ? `你已完成\n「${chapterLabel}」`
                      : `You completed\n"${chapterLabel}"`}
                  </Text>
                  <Text style={styles.practiceCompleteSubtitle}>{chapterSubtitle}</Text>
                </View>
              </View>

              <View style={styles.practiceCompleteSummaryCard}>
                <View style={styles.practiceCompleteOrb} />
                <View style={styles.practiceCompleteSummaryRow}>
                  <View>
                    <Text style={styles.practiceCompleteSummaryLabel}>
                      {language === 'zh' ? '答题表现' : 'Performance'}
                    </Text>
                    <View style={styles.practiceCompleteScoreRow}>
                      <Text style={styles.practiceCompleteScoreValue}>{correctCount}</Text>
                      <Text style={styles.practiceCompleteScoreTotal}>/ {filteredQuestions.length}</Text>
                    </View>
                  </View>
                  <View style={styles.practiceCompleteAccuracyBlock}>
                    <Text style={styles.practiceCompleteSummaryLabel}>
                      {language === 'zh' ? '正确率' : 'Accuracy'}
                    </Text>
                    <Text style={styles.practiceCompleteAccuracyValue}>{accuracy}%</Text>
                  </View>
                </View>
                <View style={styles.practiceCompleteSummaryNote}>
                  <Text style={styles.practiceCompleteSummaryNoteText}>{t.practiceCompleteBody}</Text>
                </View>
              </View>

              <View style={styles.practiceCompleteActions}>
                <Pressable
                  style={styles.practiceCompletePrimaryButton}
                  onPress={() => {
                    if (nextCategory) {
                      navigation.replace('QuestionFlow', {
                        categoryId: nextCategory.id,
                        source: 'chapter',
                        sourceLabel: language === 'zh' ? nextCategory.nameZh : nextCategory.nameEn,
                      });
                      return;
                    }

                    navigation.replace('MockIntro');
                  }}
                >
                  <Text style={styles.practiceCompletePrimaryButtonText}>
                    {nextCategory ? `${t.goToNextChapter} · ${nextCategoryLabel}` : t.startMockTest}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.practiceCompleteSecondaryButton}
                  onPress={() => {
                    setCurrentIndex(0);
                    setProgressByQuestionId({});
                    void refresh();
                  }}
                >
                  <Text style={styles.practiceCompleteSecondaryButtonText}>
                    {source === 'chapter' ? `${t.practiceAgain} · ${sourceLabel}` : t.practiceAgain}
                  </Text>
                </Pressable>

                <Pressable style={styles.practiceCompleteTertiaryButton} onPress={() => navigation.navigate('PracticeHome')}>
                  <Text style={styles.practiceCompleteTertiaryButtonText}>{t.backToPractice}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </ScreenFrame>
      );
    }

    return (
      <ScreenFrame>
        <Text style={styles.sectionTitle}>{t.noQuestionsYet}</Text>
      </ScreenFrame>
    );
  }

  if (isNotebookFlow) {
    const pageWidth = Math.max(windowWidth, 1);

    async function handleSelectOption(targetQuestion: Question, optionKey: string) {
      const existing = progressByQuestionId[targetQuestion.id];
      if (existing?.hasChecked) {
        return;
      }

      const selected = targetQuestion.options.find((option) => option.key === optionKey);
      if (!selected) {
        return;
      }

      setProgressByQuestionId((current) => ({
        ...current,
        [targetQuestion.id]: {
          selectedOption: optionKey,
          hasChecked: true,
          isCorrect: selected.isCorrect,
          recorded: true,
        },
      }));

      if (!existing?.recorded) {
        await recordAttempt(db, {
          stateCode,
          questionId: targetQuestion.id,
          selectedOptionKey: optionKey,
          isCorrect: selected.isCorrect,
          source: sourceLabel,
        });
        void refresh();
      }
    }

    function goBackFromFlow() {
      if (source === 'mistakes') {
        navigation.navigate('MistakesNotebook');
        return;
      }

      if (source === 'saved') {
        navigation.navigate('SavedNotebook');
        return;
      }

      navigation.navigate('PracticeHome');
    }

    return (
      <ScreenFrame
        accent="#2f6f4e"
        scrollable={false}
      >
        <View style={styles.notebookPagerWrap}>
          <FlatList
            ref={pagerRef}
            data={pagerQuestions}
            horizontal
            pagingEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            initialScrollIndex={Math.min(isReviewFlow && filteredQuestions.length > 1 ? currentIndex + 1 : currentIndex, Math.max(pagerQuestions.length - 1, 0))}
            keyExtractor={(item: any) => item.pageKey}
            getItemLayout={(_, index) => ({
              length: pageWidth,
              offset: pageWidth * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              pagerRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
            }}
            onMomentumScrollEnd={(event) => {
              const nextPageIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
              const maxPageIndex = Math.max(pagerQuestions.length - 1, 0);
              const clampedPageIndex = Math.max(0, Math.min(maxPageIndex, nextPageIndex));

              if (isReviewFlow && filteredQuestions.length > 1) {
                if (clampedPageIndex === 0) {
                  const targetLogicalIndex = filteredQuestions.length - 1;
                  setCurrentIndex(targetLogicalIndex);
                  pagerRef.current?.scrollToIndex({ index: filteredQuestions.length, animated: false });
                  return;
                }

                if (clampedPageIndex === pagerQuestions.length - 1) {
                  setCurrentIndex(0);
                  pagerRef.current?.scrollToIndex({ index: 1, animated: false });
                  return;
                }

                const nextLogicalIndex = pagerQuestions[clampedPageIndex]?.logicalIndex ?? 0;
                if (nextLogicalIndex !== currentIndex) {
                  setCurrentIndex(nextLogicalIndex);
                }
                return;
              }

              const clampedIndex = Math.max(0, Math.min(filteredQuestions.length - 1, clampedPageIndex));

              if (clampedIndex > currentIndex && !isReviewFlow && !currentProgress.hasChecked) {
                pagerRef.current?.scrollToIndex({ index: currentIndex, animated: true });
                return;
              }

              if (clampedIndex === currentIndex) {
                return;
              }

              setCurrentIndex(clampedIndex);
            }}
            renderItem={({ item }) => (
              <View style={[styles.notebookPagerPage, { width: pageWidth }]}>
                <ScrollView
                  style={styles.screen}
                  contentContainerStyle={styles.notebookPagerScrollContent}
                  directionalLockEnabled
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  <QuestionCard
                    db={db}
                    question={item.question}
                    questionIndex={item.logicalIndex + 1}
                    total={filteredQuestions.length}
                    mode={studyMode}
                    onModeChange={setStudyMode}
                    revealExplanation
                    sourceLabel={sourceLabel}
                    saved={item.question.id === question.id ? saved : undefined}
                    setSaved={item.question.id === question.id ? setSaved : undefined}
                  primaryActionLabel={isReviewFlow ? t.nextQuestion : item.logicalIndex === filteredQuestions.length - 1 ? t.practiceComplete : t.nextQuestion}
                  previousActionLabel={t.previousQuestion}
                  selectedOption={progressByQuestionId[item.question.id]?.selectedOption ?? null}
                  hasChecked={progressByQuestionId[item.question.id]?.hasChecked ?? false}
                  previewFocus={item.question.id === question.id ? previewFocus : undefined}
                  onSelectOption={(optionKey) => void handleSelectOption(item.question, optionKey)}
                    isNotebookFlow
                    allowAdvanceWithoutAnswer={isReviewFlow}
                    canGoPrevious={isReviewFlow ? filteredQuestions.length > 1 : item.logicalIndex > 0}
                    canGoNext={isReviewFlow || (progressByQuestionId[item.question.id]?.hasChecked ?? false)}
                    canExitBackward={!isReviewFlow && item.logicalIndex === 0}
                    onPrevious={() => {
                      if (isReviewFlow) {
                        if (item.logicalIndex === 0) {
                          pagerRef.current?.scrollToIndex({ index: 0, animated: true });
                          return;
                        }

                        setCurrentIndex(item.logicalIndex - 1);
                        return;
                      }

                      if (item.logicalIndex === 0) {
                        goBackFromFlow();
                        return;
                      }

                      setCurrentIndex(Math.max(0, item.logicalIndex - 1));
                    }}
                    onAdvance={() => {
                      if (!isReviewFlow && !(progressByQuestionId[item.question.id]?.hasChecked ?? false)) {
                        return;
                      }
                      if (isReviewFlow) {
                        if (item.logicalIndex === filteredQuestions.length - 1) {
                          pagerRef.current?.scrollToIndex({ index: pagerQuestions.length - 1, animated: true });
                          return;
                        }

                        setCurrentIndex(item.logicalIndex + 1);
                        return;
                      }
                      if (item.logicalIndex === filteredQuestions.length - 1) {
                        setCurrentIndex(filteredQuestions.length);
                        return;
                      }

                      setCurrentIndex(item.logicalIndex + 1);
                    }}
                    inlineNativeAd={item.question.id === question.id ? practiceInlineNativeAd : null}
                    enableBlindListeningAutoPlay={item.logicalIndex === currentIndex}
                    isActive={item.logicalIndex === currentIndex}
                  />
                </ScrollView>
              </View>
            )}
          />
        </View>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame accent="#2f6f4e">
      <QuestionCard
        db={db}
        question={question}
        questionIndex={currentIndex + 1}
        total={filteredQuestions.length}
        mode={studyMode}
        onModeChange={setStudyMode}
        revealExplanation
        sourceLabel={sourceLabel}
        saved={saved}
        setSaved={setSaved}
        selectedOption={currentProgress.selectedOption}
        hasChecked={currentProgress.hasChecked}
        previewFocus={previewFocus}
        primaryActionLabel={currentIndex === filteredQuestions.length - 1 ? t.practiceComplete : t.nextQuestion}
        previousActionLabel={t.previousQuestion}
        onSelectOption={() => null}
        onAdvance={() => {
          setCurrentIndex((index) => Math.min(filteredQuestions.length - 1, index + 1));
          void refresh();
        }}
        inlineNativeAd={practiceInlineNativeAd}
        enableBlindListeningAutoPlay
        isActive
      />
    </ScreenFrame>
  );
}

function MockIntroScreen({ navigation }: any) {
  const db = useDatabase();
  const language = useAppStore((state) => state.language);
  const isPremium = useAppStore((state) => state.isPremium);
  const stateCode = useAppStore((state) => state.stateCode);
  const t = getCopy(language);
  const mockRule = getMockExamRule(stateCode);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    void prepareMockInterstitialAd();
  }, []);

  return (
    <ScreenFrame accent="#ca4d2f" bare>
      <ScrollView style={styles.screen} contentContainerStyle={styles.mockIntroScreenContent}>
        <View style={styles.mockIntroContentInner}>
          <View style={styles.mockIntroHero}>
            <Text style={styles.mockIntroTitle}>{t.mockTest}</Text>
            <Text style={styles.mockIntroBody}>{getMockIntroSummary(stateCode, language)}</Text>
          </View>

          <View style={styles.mockIntroInfoCard}>
            <View style={styles.mockIntroInfoRow}>
              <View style={styles.mockIntroInfoIconWrap}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={22} color="#002045" />
              </View>
              <View style={styles.mockIntroInfoCopy}>
                <Text style={styles.mockIntroInfoTitle}>{t.questionSet}</Text>
                <Text style={styles.mockIntroInfoValue}>{mockRule.totalQuestions}</Text>
              </View>
            </View>

            <View style={styles.mockIntroInfoRow}>
              <View style={styles.mockIntroInfoIconWrap}>
                <MaterialCommunityIcons name="timer-outline" size={22} color="#002045" />
              </View>
              <View style={styles.mockIntroInfoCopy}>
                <Text style={styles.mockIntroInfoTitle}>{language === 'zh' ? '考试方式' : 'Test format'}</Text>
                <Text style={styles.mockIntroInfoDescription}>
                  {getMockFormatDescription(stateCode, language)}
                </Text>
              </View>
            </View>

            <View style={styles.mockIntroInfoRow}>
              <View style={styles.mockIntroInfoIconWrap}>
                <MaterialCommunityIcons name="shield-check-outline" size={22} color="#002045" />
              </View>
              <View style={styles.mockIntroInfoCopy}>
                <Text style={styles.mockIntroInfoTitle}>{language === 'zh' ? '通过标准' : 'Passing rule'}</Text>
                <Text style={styles.mockIntroInfoDescription}>
                  {getMockPassingDescription(stateCode, language)}
                </Text>
              </View>
            </View>

            <View style={styles.mockIntroInfoRow}>
              <View style={styles.mockIntroInfoIconWrap}>
                <MaterialCommunityIcons name="eye-off-outline" size={22} color="#002045" />
              </View>
              <View style={styles.mockIntroInfoCopy}>
                <Text style={styles.mockIntroInfoTitle}>{t.explanations}</Text>
                <Text style={styles.mockIntroInfoDescription}>
                  {language === 'zh' ? '考试过程中不显示答案和解析' : 'Answers and explanations stay hidden during the session.'}
                </Text>
              </View>
            </View>

            <View style={styles.mockIntroInfoRow}>
              <View style={styles.mockIntroInfoIconWrap}>
                <MaterialCommunityIcons name="translate" size={22} color="#002045" />
              </View>
              <View style={styles.mockIntroInfoCopy}>
                <Text style={styles.mockIntroInfoTitle}>{language === 'zh' ? '语言说明' : 'Language'}</Text>
                <Text style={styles.mockIntroInfoDescription}>
                  {language === 'zh' ? '题目语言跟随当前 App 语言' : 'Question language follows the current app language.'}
                </Text>
              </View>
            </View>
          </View>

          {!isPremium ? (
            <View style={styles.highFrequencyIntroNotice}>
              <MaterialCommunityIcons name="crown-outline" size={16} color="#6b6d72" />
              <Text style={styles.highFrequencyIntroNoticeText}>
                {language === 'zh'
                  ? `免费用户每天最多开始 ${FREE_DAILY_MOCK_TEST_LIMIT} 次模拟考试。`
                  : `Free users can start up to ${FREE_DAILY_MOCK_TEST_LIMIT} mock tests per day.`}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.mockIntroPrimaryButton, isPreparing && styles.mockIntroPrimaryButtonDisabled]}
            onPress={async () => {
              if (isPreparing) {
                return;
              }
              setIsPreparing(true);
              try {
                const canStart = await maybeConsumeMockTestStart(db);
                if (!canStart) {
                  return;
                }
                const shown = await showPreparedMockInterstitialAd();
                if (!shown) {
                  await showMockInterstitialAd();
                }
                navigation.navigate('MockSession', { sessionSeed: Date.now() });
              } finally {
                setIsPreparing(false);
              }
            }}
          >
            <Text style={styles.mockIntroPrimaryButtonText}>
              {isPreparing ? (language === 'zh' ? '正在准备模拟考试...' : 'Preparing mock test...') : t.startMockTest}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function MockSessionScreen({ navigation, route }: any) {
  const db = useDatabase();
  const questions = useQuestions();
  const studyMode = useAppStore((state) => state.studyMode);
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const t = getCopy(language);
  const sessionSeed = Number(route.params?.sessionSeed ?? 0) || Date.now();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const mockQuestionIds = useMemo(
    () => buildMockSessionQuestionIds({ stateCode, questions, sessionSeed }),
    [questions, sessionSeed, stateCode]
  );
  const mockQuestions = useMemo(
    () => mockQuestionIds
      .map((questionId) => questions.find((item) => item.id === questionId))
      .filter((item): item is Question => Boolean(item)),
    [mockQuestionIds, questions]
  );
  const question = mockQuestions[currentIndex];

  useEffect(() => {
    setSelectedOption(null);
  }, [question?.id]);

  useEffect(() => {
    if (mockQuestions.length > 0 && currentIndex >= mockQuestions.length) {
      const correctCount = Object.values(answers).filter(Boolean).length;
      navigation.replace('MockResult', {
        questionIds: mockQuestionIds,
        total: mockQuestions.length,
        correctCount,
        answers,
      });
    }
  }, [answers, currentIndex, mockQuestionIds, mockQuestions.length, navigation]);

  if (!question) {
    return (
      <ScreenFrame>
        <Text style={styles.sectionTitle}>{t.loadingMockTest}</Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame accent="#165a72">
      <QuestionCard
        db={db}
        question={question}
        questionIndex={currentIndex + 1}
        total={mockQuestions.length}
        mode={studyMode}
        languageOverride={language}
        hideModeSwitch
        sourceLabel="mock"
        suppressAnswerReadInBlindListening
        selectedOption={selectedOption}
        hasChecked={Boolean(selectedOption)}
        primaryActionLabel={currentIndex === mockQuestions.length - 1 ? t.submitTest : t.nextQuestion}
        onSelectOption={(optionKey) => {
          setSelectedOption(optionKey);
          const selected = question.options.find((option) => option.key === optionKey);
          if (!selected) {
            return;
          }
          setAnswers((current) => ({ ...current, [question.id]: selected.isCorrect }));
        }}
        onAdvance={() => {
          if (!selectedOption) {
            return;
          }
          setCurrentIndex((index) => index + 1);
        }}
        enableBlindListeningAutoPlay
        isActive
      />
    </ScreenFrame>
  );
}

function MockResultScreen({ route, navigation }: any) {
  const db = useDatabase();
  const categories = useCategories();
  const mockQuestions = useQuestions();
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const t = getCopy(language);
  const mockQuestionIds = route.params?.questionIds ?? getMockQuestionIds(stateCode);
  const [isPreparing, setIsPreparing] = useState(false);
  const previewHideActionBar = Boolean(route.params?.previewHideActionBar);
  const total = route.params?.total ?? mockQuestionIds.length;
  const correctCount = route.params?.correctCount ?? 0;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const mockRule = getMockExamRule(stateCode);
  const answers = route.params?.answers ?? {};
  const signQuestionIds = mockQuestions
    .filter((question) => mockQuestionIds.includes(question.id))
    .filter((question) => question.categoryId === buildStateScopedCategoryId(stateCode, TRAFFIC_SIGNS_BASE_CATEGORY_ID))
    .map((question) => question.id);
  const signCorrectCount = signQuestionIds.filter((questionId) => answers[questionId]).length;
  const passedByScore = correctCount >= mockRule.correctToPass;
  const passedBySigns = stateCode !== 'NY' || signCorrectCount >= mockRule.signCorrectToPass;
  const isPassed = passedByScore && passedBySigns;

  useEffect(() => {
    void prepareMockInterstitialAd();
  }, []);

  const perCategory = categories.map((category) => {
    const categoryQuestions = mockQuestions.filter((question) => mockQuestionIds.includes(question.id) && question.categoryId === category.id);
    const categoryCorrect = categoryQuestions.filter((question) => answers[question.id]).length;
    const categoryAccuracy = categoryQuestions.length > 0 ? Math.round((categoryCorrect / categoryQuestions.length) * 100) : 0;

    return {
      ...category,
      categoryAccuracy,
      categoryQuestions: categoryQuestions.length,
    };
  }).filter((item) => item.categoryQuestions > 0);
  const wrongQuestions = mockQuestions
    .filter((question) => mockQuestionIds.includes(question.id))
    .filter((question) => !answers[question.id]);
  const statusTitle = isPassed ? t.passed : t.keepPracticing;

  async function handleRetakeMock() {
    if (isPreparing) {
      return;
    }

    setIsPreparing(true);
    try {
      const canStart = await maybeConsumeMockTestStart(db);
      if (!canStart) {
        return;
      }
      const shown = await showPreparedMockInterstitialAd();
      if (!shown) {
        await showMockInterstitialAd();
      }
      navigation.replace('MockSession', { sessionSeed: Date.now() });
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <ScreenFrame accent="#8d6d2f" scrollable={false} bare>
      <View style={styles.mockResultScreenShell}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.mockResultScreenContent}>
          <View style={styles.mockResultContentInner}>
            <View style={styles.mockResultScoreSection}>
              <Text style={styles.mockResultScoreValue}>
                {correctCount}
                <Text style={styles.mockResultScoreDivider}> / </Text>
                <Text style={styles.mockResultScoreTotal}>{total}</Text>
              </Text>
              <View style={styles.mockResultScoreCopy}>
                <Text style={styles.mockResultStatus}>{statusTitle}</Text>
                <Text style={styles.mockResultBody}>
                  {getMockResultSummary({
                    stateCode,
                    language,
                    accuracy,
                    passedByScore,
                    passedBySigns,
                    signCorrectCount,
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.mockResultSection}>
              <Text style={styles.mockResultSectionEyebrow}>
                {language === 'zh' ? '章节表现对比' : 'Chapter performance'}
              </Text>
              <View style={styles.mockResultCategoryGrid}>
                {perCategory.map((category) => {
                  const pillStyle =
                    category.categoryAccuracy >= 70
                      ? styles.mockResultCategoryPillStrong
                      : category.categoryAccuracy >= 50
                        ? styles.mockResultCategoryPillMedium
                        : styles.mockResultCategoryPillWeak;
                  const pillTextStyle =
                    category.categoryAccuracy >= 70
                      ? styles.mockResultCategoryPillStrongText
                      : category.categoryAccuracy >= 50
                        ? styles.mockResultCategoryPillMediumText
                        : styles.mockResultCategoryPillWeakText;

                  return (
                    <Pressable
                      key={category.id}
                      style={styles.mockResultCategoryCard}
                      onPress={() =>
                        navigation.navigate('QuestionFlow', {
                          categoryId: category.id,
                          source: 'chapter',
                          sourceLabel: language === 'zh' ? category.nameZh : category.nameEn,
                        })
                      }
                    >
                      <Text style={styles.mockResultCategoryLabel}>
                        {language === 'zh' ? category.nameZh : category.nameEn}
                      </Text>
                      <View style={[styles.mockResultCategoryPill, pillStyle]}>
                        <Text style={[styles.mockResultCategoryPillText, pillTextStyle]}>
                          {category.categoryAccuracy}%
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {wrongQuestions.length > 0 ? (
              <View style={styles.mockResultWrongSection}>
                <View style={styles.mockResultWrongHeader}>
                  <Text style={styles.mockResultWrongTitle}>
                    {language === 'zh' ? '错题解析' : 'Wrong Answers'}
                  </Text>
                  <Text style={styles.mockResultWrongCount}>
                    {language === 'zh' ? `${wrongQuestions.length} 题错误` : `${wrongQuestions.length} wrong`}
                  </Text>
                </View>

                <View style={styles.mockResultWrongList}>
                  {wrongQuestions.map((question, index) => {
                    const correctOption = question.options.find((option) => option.isCorrect);

                    return (
                      <View key={question.id} style={styles.mockResultWrongItem}>
                        <View style={styles.mockResultWrongQuestionRow}>
                          <View style={styles.mockResultWrongIndex}>
                            <Text style={styles.mockResultWrongIndexText}>{index + 1}</Text>
                          </View>
                          <View style={styles.mockResultWrongQuestionCopy}>
                            {question.image ? (
                              <View style={styles.mockResultWrongImageWrap}>
                                <Image
                                  source={{ uri: question.image.src }}
                                  style={styles.mockResultWrongImage}
                                  resizeMode="contain"
                                />
                              </View>
                            ) : null}
                            <Text style={styles.mockResultWrongQuestionText}>
                              {question.questionEn}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.mockResultWrongBodyWrap}>
                          {correctOption ? (
                            <View style={styles.mockResultCorrectCard}>
                              <View style={styles.mockResultCorrectRow}>
                                <MaterialCommunityIcons name="check-circle" size={18} color="#2f8f5b" />
                                <View style={styles.mockResultCorrectCopy}>
                                  <Text style={styles.mockResultCorrectLabel}>
                                    {language === 'zh' ? '正确答案' : 'Correct Answer'}
                                  </Text>
                                  <Text style={styles.mockResultCorrectText}>
                                    {correctOption.key}. {correctOption.textEn}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          ) : null}

                          <View style={styles.mockResultExplanationCard}>
                            <Text style={styles.mockResultExplanationLabel}>
                              {language === 'zh' ? '知识解析' : 'Explanation'}
                            </Text>
                            <Text style={styles.mockResultExplanationText}>
                              {question.explanationEn}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {!previewHideActionBar ? (
          <View style={styles.mockResultActionBar}>
            <Pressable
              style={[styles.mockResultPrimaryButton, isPreparing && styles.mockResultPrimaryButtonDisabled]}
              onPress={() => void handleRetakeMock()}
            >
              <MaterialCommunityIcons name="refresh" size={18} color="#2a1700" />
              <Text style={styles.mockResultPrimaryButtonText}>
                {isPreparing ? (language === 'zh' ? '正在准备模拟考试...' : 'Preparing mock test...') : t.retakeMockTest}
              </Text>
            </Pressable>
            <Pressable
              style={styles.mockResultSecondaryButton}
              onPress={() => navigation.getParent()?.navigate('GuideTab')}
            >
              <MaterialCommunityIcons name="compass-outline" size={16} color="rgba(0, 32, 69, 0.6)" />
              <Text style={styles.mockResultSecondaryButtonText}>{t.guide}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScreenFrame>
  );
}

function MistakesScreen({ navigation }: any) {
  const language = useAppStore((state) => state.language);
  const t = getCopy(language);
  const { stats } = useUserStats();
  const questions = useQuestionList(stats.mistakeQuestionIds);
  const hasMistakes = stats.mistakeCount > 0;

  return (
    <ScreenFrame accent="#8d4b2f">
      <Text style={styles.sectionTitle}>{t.mistakes}</Text>
      <Text style={styles.sectionDescription}>{t.mistakeNotebookBody}</Text>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{stats.mistakeCount} {t.activeWrongQuestions}</Text>
        <PrimaryButton
          label={hasMistakes ? t.reviewMistakes : t.startRandomSet}
          onPress={() => {
            if (!hasMistakes) {
              navigation.navigate('QuestionFlow', {
                categoryId: 'random',
                source: 'random',
                sourceLabel: t.randomPractice,
              });
              return;
            }

            navigation.navigate('QuestionFlow', {
              questionIds: stats.mistakeQuestionIds,
              source: 'mistakes',
              sourceLabel: t.mistakes,
              returnTarget: 'notebook',
            });
          }}
        />
      </View>
      {questions.map((question) => (
        <QuestionPreview
          key={question.id}
          question={question}
          badge={t.mistake}
          onPress={() =>
            navigation.navigate('QuestionFlow', {
              questionIds: stats.mistakeQuestionIds,
              initialQuestionId: question.id,
              source: 'mistakes',
              sourceLabel: t.mistakes,
              returnTarget: 'notebook',
            })
          }
        />
      ))}
    </ScreenFrame>
  );
}

function SavedScreen({ navigation }: any) {
  const language = useAppStore((state) => state.language);
  const t = getCopy(language);
  const { stats } = useUserStats();
  const questions = useQuestionList(stats.savedQuestionIds);
  const hasSavedQuestions = stats.savedCount > 0;

  return (
    <ScreenFrame accent="#6b4e8d">
      <Text style={styles.sectionTitle}>{t.saved}</Text>
      <Text style={styles.sectionDescription}>{t.savedNotebookBody}</Text>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{stats.savedCount} {t.bookmarkedQuestions}</Text>
        <PrimaryButton
          label={hasSavedQuestions ? t.openSaved : t.startRandomSet}
          onPress={() => {
            if (!hasSavedQuestions) {
              navigation.navigate('QuestionFlow', {
                categoryId: 'random',
                source: 'random',
                sourceLabel: t.randomPractice,
              });
              return;
            }

            navigation.navigate('QuestionFlow', {
              questionIds: stats.savedQuestionIds,
              source: 'saved',
              sourceLabel: t.saved,
              returnTarget: 'notebook',
            });
          }}
        />
      </View>
      {questions.map((question) => (
        <QuestionPreview
          key={question.id}
          question={question}
          badge={t.saved}
          onPress={() =>
            navigation.navigate('QuestionFlow', {
              questionIds: stats.savedQuestionIds,
              initialQuestionId: question.id,
              source: 'saved',
              sourceLabel: t.saved,
              returnTarget: 'notebook',
            })
          }
        />
      ))}
    </ScreenFrame>
  );
}

function HandbookScreen({ navigation, route }: any) {
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const { isLearned } = useHandbookLearned();
  const previewLearnedSectionSlug = route.params?.previewLearnedSectionSlug as string | undefined;
  const previewLearnedItemSlug = route.params?.previewLearnedItemSlug as string | undefined;
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const handbookSections = getStateHandbookDirectorySections(stateCode, language);
  const visibleItemsBySection = useMemo(
    () =>
      Object.fromEntries(
        handbookSections.map((section) => {
          const chapter = getStateHandbookNativeChapter(stateCode, language, String(section.order).padStart(2, '0'));
          return [section.slug, getRenderableHandbookEntries(stateCode, language, section, chapter).map(({ item }: { item: any }) => item)];
        }),
      ),
    [handbookSections, language, stateCode]
  );

  useEffect(() => {
    if (!previewLearnedSectionSlug) {
      return;
    }

    setExpandedSections((current) => ({
      ...current,
      [previewLearnedSectionSlug]: true,
    }));
  }, [previewLearnedSectionSlug]);

  function openDirectoryItem(sectionSlug: string, item: { slug: string; anchorEn: string; anchorZh: string; titleEn: string; titleZh: string }) {
    const section = getStateHandbookDirectorySection(stateCode, language, sectionSlug);
    navigation.navigate('HandbookReader', {
      title: handbookTitle(stateCode, language, section.titleEn, section.titleZh),
      sectionSlug,
      itemSlug: item.slug,
      anchor: language === 'zh' ? item.anchorZh : item.anchorEn,
    });
  }

  return (
    <ScreenFrame accent="#455f7a" bare>
      <ScrollView style={styles.screen} contentContainerStyle={styles.handbookHomeScreenContent}>
        <View style={styles.handbookHomeContentInner}>
          <View style={styles.handbookHero}>
            <Text style={styles.handbookHeroEyebrow}>{language === 'zh' ? '官方章节顺序' : 'Official Chapter Order'}</Text>
            <Text style={styles.handbookHeroTitle}>
              {getStateHandbookTitle(stateCode, language)}
            </Text>
            <Text style={styles.handbookHeroBody}>
              {language === 'zh'
                ? '按官方章节顺序整理。展开后可查看每章的小节目录，并继续进入对应内容。'
                : 'Organized in the official chapter order. Expand a chapter to browse its section list and open the related content.'}
            </Text>
          </View>

          <View style={styles.handbookOfficialList}>
            {handbookSections.map((section) => (
              <View
                key={section.slug}
                style={styles.handbookOfficialRow}
              >
                <Pressable
                  style={styles.handbookOfficialRowTop}
                  onPress={() =>
                    setExpandedSections((current) => ({
                      ...current,
                      [section.slug]: !(current[section.slug] ?? false),
                    }))
                  }
                >
                  <View style={styles.handbookOfficialRowNumber}>
                    <Text style={styles.handbookOfficialRowNumberText}>{section.order}</Text>
                  </View>
                  <View style={styles.handbookOfficialRowCopy}>
                    <Text style={styles.handbookOfficialRowTitle}>{handbookTitle(stateCode, language, section.titleEn, section.titleZh)}</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={(expandedSections[section.slug] ?? false) ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#8b8173"
                  />
                </Pressable>

                {expandedSections[section.slug] ? (
                  <View style={styles.handbookPreviewList}>
                    {visibleItemsBySection[section.slug]?.map((item: any, index: number) => (
                      <Pressable
                        key={item.slug}
                        style={styles.handbookPreviewRow}
                        onPress={() => openDirectoryItem(section.slug, item)}
                      >
                        <View style={styles.handbookPreviewMain}>
                          <View style={styles.handbookTopicRowLabelWrap}>
                            <View style={styles.handbookTopicRowIndexBadge}>
                              <Text style={styles.handbookTopicRowIndexText}>{String(index + 1).padStart(2, '0')}</Text>
                            </View>
                            <Text style={styles.handbookPreviewText}>{handbookTitle(stateCode, language, item.titleEn, item.titleZh)}</Text>
                          </View>
                          {isLearned(section.slug, item.slug)
                          || (section.slug === previewLearnedSectionSlug && item.slug === previewLearnedItemSlug) ? (
                            <View style={styles.handbookLearnedBadge}>
                              <MaterialCommunityIcons name="check-circle" size={12} color="#2f6a44" />
                              <Text style={styles.handbookLearnedBadgeText}>{language === 'zh' ? '已学习' : 'Learned'}</Text>
                            </View>
                          ) : null}
                        </View>
                        <MaterialCommunityIcons name="open-in-new" size={14} color="rgba(68, 71, 78, 0.3)" />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function HandbookSectionScreen({ route, navigation }: any) {
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const { isLearned } = useHandbookLearned();
  const section = getStateHandbookDirectorySection(stateCode, language, route.params?.sectionSlug);
  const chapter = getStateHandbookNativeChapter(stateCode, language, String(section.order).padStart(2, '0'));
  const visibleEntries = useMemo(
    () => getRenderableHandbookEntries(stateCode, language, section, chapter),
    [chapter, language, section, stateCode]
  );

  function openDirectoryItem(item: { slug: string; anchorEn: string; anchorZh: string; titleEn: string; titleZh: string }) {
    navigation.navigate('HandbookReader', {
      title: handbookTitle(stateCode, language, section.titleEn, section.titleZh),
      sectionSlug: section.slug,
      itemSlug: item.slug,
      anchor: language === 'zh' ? item.anchorZh : item.anchorEn,
    });
  }

  return (
    <ScreenFrame accent="#455f7a" bare>
      <ScrollView style={styles.screen} contentContainerStyle={styles.handbookSectionScreenContent}>
        <View style={styles.handbookSectionContentInner}>
          <View style={styles.handbookDetailHero}>
            <View style={styles.handbookDetailMetaRow}>
              <View style={styles.handbookDetailNumberPill}>
                <Text style={styles.handbookDetailNumberPillText}>
                  {language === 'zh' ? `第 ${section.order} 章` : `Section ${section.order}`}
                </Text>
              </View>
            </View>
            <Text style={styles.handbookDetailTitle}>{handbookTitle(stateCode, language, section.titleEn, section.titleZh)}</Text>
          </View>

          <View style={styles.handbookTopicList}>
            {visibleEntries.map(({ item }: { item: any }, index: number) => (
              <Pressable
                key={item.slug}
                style={styles.handbookTopicRow}
                onPress={() => openDirectoryItem(item)}
              >
                <View style={styles.handbookTopicRowCopy}>
                  <View style={styles.handbookTopicRowLabelWrap}>
                    <View style={styles.handbookTopicRowIndexBadge}>
                      <Text style={styles.handbookTopicRowIndexText}>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
                    <Text style={styles.handbookTopicRowTitle}>{handbookTitle(stateCode, language, item.titleEn, item.titleZh)}</Text>
                  </View>
                  {isLearned(section.slug, item.slug) ? (
                    <View style={styles.handbookLearnedBadge}>
                      <MaterialCommunityIcons name="check-circle" size={12} color="#2f6a44" />
                      <Text style={styles.handbookLearnedBadgeText}>{language === 'zh' ? '已学习' : 'Learned'}</Text>
                    </View>
                  ) : null}
                </View>
                <MaterialCommunityIcons name="open-in-new" size={18} color="#8b8173" />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function HandbookReaderScreen({ route }: any) {
  const db = useDatabase();
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const practiceInlineNativeAd = usePracticeInlineNativeAd();
  const section = getStateHandbookDirectorySection(stateCode, language, route.params?.sectionSlug);
  const selectedItemSlug = route.params?.itemSlug as string | undefined;
  const chapter = getStateHandbookNativeChapter(stateCode, language, String(section.order).padStart(2, '0'));
  const chapterSections = useMemo(
    () => getRenderableHandbookEntries(stateCode, language, section, chapter),
    [chapter, language, section, stateCode]
  );
  const selectedEntry = chapterSections.find(({ item }: { item: any }) => item.slug === selectedItemSlug) ?? chapterSections[0];
  const selectedItem = selectedEntry?.item;
  const itemSlugOrder = useMemo(() => chapterSections.map(({ item }: { item: any }) => item.slug), [chapterSections]);
  const scrollRef = useRef<ScrollView>(null);
  const itemLayoutsRef = useRef<Record<string, number>>({});
  const learnedSlugsRef = useRef<Set<string>>(new Set(selectedItemSlug ? [selectedItemSlug] : []));

  useEffect(() => {
    if (!route.params?.sectionSlug || !selectedItem?.slug) {
      return;
    }

    void markHandbookItemLearned(db, stateCode, route.params.sectionSlug, selectedItem.slug);
  }, [db, route.params?.sectionSlug, selectedItem?.slug, stateCode]);

  function markSlugLearned(itemSlug: string) {
    if (learnedSlugsRef.current.has(itemSlug)) {
      return;
    }

    learnedSlugsRef.current.add(itemSlug);
    void markHandbookItemLearned(db, stateCode, section.slug, itemSlug);
  }

  function markRangeLearned(fromIndex: number, toIndex: number) {
    const start = Math.max(0, Math.min(fromIndex, toIndex));
    const end = Math.min(itemSlugOrder.length - 1, Math.max(fromIndex, toIndex));

    for (let index = start; index <= end; index += 1) {
      const itemSlug = itemSlugOrder[index];
      if (itemSlug) {
        markSlugLearned(itemSlug);
      }
    }
  }

  function scrollToSelectedItem() {
    if (!selectedItem?.slug) {
      return;
    }

    const y = itemLayoutsRef.current[selectedItem.slug];
    if (typeof y !== 'number') {
      return;
    }

    scrollRef.current?.scrollTo({
      y: Math.max(0, y - 12),
      animated: false,
    });
  }

  useEffect(() => {
    const timeouts = [
      setTimeout(scrollToSelectedItem, 60),
      setTimeout(scrollToSelectedItem, 180),
      setTimeout(scrollToSelectedItem, 420),
    ];

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [selectedItem?.slug]);

  function handleReaderScroll(event: any) {
    const offsetY = event.nativeEvent.contentOffset.y;
    const viewportHeight = event.nativeEvent.layoutMeasurement.height;
    const contentHeight = event.nativeEvent.contentSize.height;
    const probeY = offsetY + 120;
    let activeIndex = 0;

    for (let index = 0; index < itemSlugOrder.length; index += 1) {
      const slug = itemSlugOrder[index];
      const y = itemLayoutsRef.current[slug];
      if (typeof y !== 'number') {
        continue;
      }

      if (y <= probeY) {
        activeIndex = index;
      } else {
        break;
      }
    }

    const activeSlug = itemSlugOrder[activeIndex];
    if (activeSlug) {
      markSlugLearned(activeSlug);
    }

    const selectedIndex = selectedItemSlug ? itemSlugOrder.indexOf(selectedItemSlug) : -1;
    if (selectedIndex === -1) {
      return;
    }

    if (offsetY <= 12) {
      markRangeLearned(0, selectedIndex);
    }

    if (contentHeight - (offsetY + viewportHeight) <= 16) {
      markRangeLearned(selectedIndex, itemSlugOrder.length - 1);
    }
  }

  return (
    <ScreenFrame accent="#455f7a" bare>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.handbookReaderScreenContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleReaderScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.handbookReaderShell}>
          <View style={styles.handbookReaderHeader}>
            <Text style={styles.handbookReaderTitle}>
              {handbookTitle(stateCode, language, section.titleEn, section.titleZh)}
            </Text>
          </View>
          <View style={styles.handbookReaderContentCard}>
            {chapterSections.map(({ item, blocks }: { item: any; blocks: HandbookNativeBlock[] }, sectionIndex: number) => (
              <View
                key={item.slug}
                onLayout={(event) => {
                  itemLayoutsRef.current[item.slug] = event.nativeEvent.layout.y;
                  if (item.slug === selectedItem?.slug) {
                    requestAnimationFrame(scrollToSelectedItem);
                  }
                }}
                style={styles.handbookNativeSection}
              >
                {!(sectionIndex === 0
                  && normalizeHandbookHeadingKey(handbookTitle(stateCode, language, item.titleEn, item.titleZh))
                    === normalizeHandbookHeadingKey(handbookTitle(stateCode, language, section.titleEn, section.titleZh))) ? (
                  <Text style={[styles.handbookNativeHeading, sectionIndex === 0 ? styles.handbookNativeHeadingFirst : null]}>
                    {handbookTitle(stateCode, language, item.titleEn, item.titleZh)}
                  </Text>
                ) : null}
                {blocks.map((block: HandbookNativeBlock, index: number) => (
                  <HandbookNativeBlockView
                    key={`${item.slug}-${index}`}
                    block={block}
                    isFirst={false}
                    language={language}
                  />
                ))}
              </View>
            ))}
          </View>
          <View style={styles.handbookReaderInlineAd}>
            <PracticeInlineAdSection nativeAd={practiceInlineNativeAd} language={language} />
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function HandbookNativeBlockView({
  block,
  isFirst,
  language,
}: {
  block: HandbookNativeBlock;
  isFirst: boolean;
  language: 'en' | 'zh';
}) {
  function renderSelectableText(text: string, style: any) {
    return (
      <Text selectable style={style}>
        {text}
      </Text>
    );
  }

  if (block.type === 'paragraph') {
    return renderSelectableText(
      block.text,
      [styles.handbookNativeParagraph, isFirst && styles.handbookNativeFirstParagraph]
    );
  }

  if (block.type === 'heading') {
    return renderSelectableText(
      block.text,
      [
        styles.handbookNativeHeading,
        block.level >= 3 ? styles.handbookNativeHeadingSmall : null,
        isFirst ? styles.handbookNativeHeadingFirst : null,
      ]
    );
  }

  if (block.type === 'list') {
    return (
      <View style={styles.handbookNativeList}>
        {block.items.map((item, index) => (
          <View key={`${block.type}-${index}`} style={styles.handbookNativeListRow}>
            <Text style={styles.handbookNativeListMarker}>{block.ordered ? `${index + 1}.` : '•'}</Text>
            {renderSelectableText(item, styles.handbookNativeListText)}
          </View>
        ))}
      </View>
    );
  }

  if (block.type === 'note') {
    return (
      <View style={[styles.handbookNativeNote, block.tone === 'important' ? styles.handbookNativeNoteImportant : null]}>
        <Text style={styles.handbookNativeNoteLabel}>
          {language === 'zh' ? (block.tone === 'important' ? '重要' : '提示') : block.tone === 'important' ? 'Important' : 'Note'}
        </Text>
        {renderSelectableText(block.text, styles.handbookNativeNoteText)}
      </View>
    );
  }

  if (block.type === 'image') {
    return (
      <View style={styles.handbookNativeImageCard}>
        <Image source={{ uri: block.src }} style={styles.handbookNativeImage} resizeMode="contain" />
        {block.caption ? renderSelectableText(block.caption, styles.handbookNativeCaption) : null}
      </View>
    );
  }

  if (block.type === 'table') {
    const rows = block.headers.length ? [block.headers, ...block.rows] : block.rows;
    return (
      <View style={styles.handbookNativeTableCard}>
        {rows.map((row, rowIndex) => (
          <View
            key={`table-row-${rowIndex}`}
            style={[
              styles.handbookNativeTableRow,
              rowIndex === 0 && block.headers.length ? styles.handbookNativeTableHeaderRow : null,
            ]}
          >
            {row.map((cell, cellIndex) => (
              <View key={`table-cell-${rowIndex}-${cellIndex}`} style={styles.handbookNativeTableCell}>
                {renderSelectableText(
                  cell,
                  [
                    styles.handbookNativeTableText,
                    rowIndex === 0 && block.headers.length ? styles.handbookNativeTableHeaderText : null,
                  ]
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return null;
}

function GuideScreen({ navigation }: any) {
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const t = getCopy(language);
  const guideArticles = useGuideArticles();
  const glossaryTerms = useGlossaryTerms();
  const stateGuideLabel = getStateGuideLabel(stateCode, language);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    flow: true,
    study: true,
    exceptions: true,
  });
  const guideSections = [
    {
      key: 'flow',
      title: language === 'zh' ? '考试流程' : 'Exam Flow',
      body:
        language === 'zh'
          ? '先弄清你考哪个版本、英语怎么测、哪些答案会动态变化。'
          : 'Understand your test version, the English test format, and the answers that can change before the interview.',
      articleSlugs: ['uscis-test-overview', 'english-test-and-interview', 'test-updates-and-dynamic-answers'],
    },
    {
      key: 'study',
      title: language === 'zh' ? '官方资料' : 'Study Resources',
      body:
        language === 'zh'
          ? '直接进入 USCIS 官方资料入口，优先看题库、词汇表和多语言资源。'
          : 'Go straight to the USCIS study hub, vocabulary lists, and multilingual resources.',
      articleSlugs: ['study-materials-and-vocabulary', 'multilingual-resources'],
    },
    {
      key: 'exceptions',
      title: language === 'zh' ? '豁免与特殊安排' : 'Exceptions',
      body:
        language === 'zh'
          ? '把 50/20、55/15、65/20、翻译和 Form N-648 这些关键规则一次看清。'
          : 'Review 50/20, 55/15, 65/20, interpreter use, accommodations, and Form N-648 in one place.',
      articleSlugs: ['exceptions-and-accommodations', 'special-consideration-65-20'],
    },
    {
      key: 'glossary',
      title: language === 'zh' ? '术语表' : 'Glossary',
      body:
        language === 'zh'
          ? '整理公民考试、移民申请、政府与历史相关的常见英文术语。'
          : 'Common civics, immigration, government, and history terms in one place.',
      articleSlugs: [],
    },
  ];

  const guideCardMeta: Record<string, { icon: keyof typeof MaterialCommunityIcons.glyphMap; iconBg: string; iconColor: string; dotColor: string }> = {
    flow: {
      icon: 'map-marker-path',
      iconBg: '#d6e3ff',
      iconColor: '#002045',
      dotColor: '#7089b3',
    },
    study: {
      icon: 'clipboard-text-outline',
      iconBg: '#ffddb8',
      iconColor: '#684000',
      dotColor: '#ffb95f',
    },
    exceptions: {
      icon: 'help-circle-outline',
      iconBg: '#f0eee6',
      iconColor: '#002045',
      dotColor: '#c4c6cf',
    },
    glossary: {
      icon: 'translate',
      iconBg: '#ffdbcb',
      iconColor: '#341100',
      dotColor: '#ffb692',
    },
  };

  return (
    <ScreenFrame accent="#165a72" bare>
      <ScrollView style={styles.screen} contentContainerStyle={styles.guideHomeScreenContent}>
        <View style={styles.guideHomeContentInner}>
          <View style={styles.guideHero}>
            <Text style={styles.guideHeroTitle}>{stateGuideLabel}</Text>
            <Text style={styles.guideHeroBody}>{t.guideBody}</Text>
          </View>

          <View style={styles.guideCardList}>
            {guideSections.map((section) => {
              const meta = guideCardMeta[section.key];
              const previewItems = section.articleSlugs
                .map((slug) => guideArticles.find((item) => item.slug === slug))
                .filter((item): item is NonNullable<typeof item> => Boolean(item))
                .map((article) => ({
                  key: article.slug,
                  title: language === 'zh' ? article.titleZh : article.titleEn,
                  onPress: () => navigation.navigate('GuideArticle', { slug: article.slug }),
                }));
              const isGlossaryCard = section.key === 'glossary';
              const isExpanded = isGlossaryCard ? false : expandedSections[section.key] ?? true;

              return (
                <Pressable
                  key={section.key}
                  style={styles.guideHomeCard}
                  onPress={() => {
                    if (isGlossaryCard) {
                      navigation.navigate('Glossary');
                      return;
                    }
                    setExpandedSections((current) => ({
                      ...current,
                      [section.key]: !(current[section.key] ?? true),
                    }));
                  }}
                >
                  <View style={styles.guideHomeCardTop}>
                    <View style={styles.guideHomeCardTopLeft}>
                      <View style={[styles.guideHomeCardIconWrap, { backgroundColor: meta.iconBg }]}>
                        <MaterialCommunityIcons name={meta.icon} size={22} color={meta.iconColor} />
                      </View>
                      <View style={styles.guideHomeCardCopy}>
                        <Text style={styles.guideHomeCardTitle}>{section.title}</Text>
                        <Text style={styles.guideHomeCardBody}>{section.body}</Text>
                      </View>
                    </View>
                    <View style={styles.guideHomeCardChevron}>
                      <MaterialCommunityIcons
                        name={isGlossaryCard ? 'chevron-right' : isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#6b6d72"
                      />
                    </View>
                  </View>

                  {!isGlossaryCard && isExpanded ? (
                    <View style={styles.guideHomePreviewList}>
                      {previewItems.map((item) => (
                        <Pressable
                          key={item.key}
                          style={styles.guideHomePreviewRow}
                          onPress={(event) => {
                            event.stopPropagation();
                            item.onPress();
                          }}
                        >
                          <View style={styles.guideHomePreviewLeft}>
                            <View style={[styles.guideHomePreviewDot, { backgroundColor: meta.dotColor }]} />
                            <Text style={styles.guideHomePreviewText}>{item.title}</Text>
                          </View>
                          <MaterialCommunityIcons name="chevron-right" size={14} color="rgba(68, 71, 78, 0.3)" />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.guideFootnoteSection}>
            <View style={styles.guideFootnoteLine} />
            <Text style={styles.guideFootnoteText}>
              {language === 'zh'
                ? '官方资料建议结合本 App 的练习和模拟考试一起使用'
                : 'Official guidance works best when paired with the practice and mock tests in this app.'}
            </Text>
            <View style={styles.guideTipCard}>
              <MaterialCommunityIcons name="lightbulb" size={18} color="#855300" />
              <Text style={styles.guideTipText}>
                {language === 'zh'
                  ? '提示：面试前最后一天一定要再看一遍官方动态答案页。'
                  : 'Tip: recheck the official dynamic-answer page right before your interview.'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function GuideArticleScreen({ route }: any) {
  const language = useAppStore((state) => state.language);
  const guideArticles = useGuideArticles();
  const article = guideArticles.find((item) => item.slug === route.params?.slug) ?? guideArticles[0];

  if (!article) {
    return (
      <ScreenFrame accent="#8d6d2f">
        <Text style={styles.sectionTitle}>{getCopy(language).loadingGuide}</Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame accent="#8d6d2f" bare>
      <ScrollView style={styles.screen} contentContainerStyle={styles.guideArticleScreenContent}>
        <View style={styles.guideArticleContentInner}>
          <View style={styles.guideArticleHero}>
            <Text style={styles.guideArticleTitle}>{language === 'zh' ? article.titleZh : article.titleEn}</Text>
            <Text style={styles.guideArticleSubtitle}>{language === 'zh' ? article.titleEn : article.titleZh}</Text>
          </View>

          <View style={styles.guideArticleSummaryCard}>
            <View style={styles.guideArticleSummaryIcon}>
              <MaterialCommunityIcons name="file-document-outline" size={20} color="#002045" />
            </View>
            <Text style={styles.guideArticleSummaryText}>
              {language === 'zh'
                ? '这页整理的是与当前主题最相关的 USCIS / 官方说明，建议先读中文，再快速扫一遍英文原文。'
                : 'This page summarizes the most relevant USCIS or official guidance for this topic. Read the main language first, then scan the parallel version.'}
            </Text>
          </View>

          <View style={styles.guideArticleBodyCard}>
            <Text style={styles.guideArticleBodyLabel}>{language === 'zh' ? '主要内容' : 'Primary copy'}</Text>
            <Text style={styles.guideArticleBodyText}>{language === 'zh' ? article.contentZh : article.contentEn}</Text>
          </View>

          <View style={styles.guideArticleSecondaryCard}>
            <Text style={styles.guideArticleBodyLabel}>{language === 'zh' ? '对照内容' : 'Parallel copy'}</Text>
            <Text style={styles.guideArticleSecondaryText}>{language === 'zh' ? article.contentEn : article.contentZh}</Text>
          </View>

          {article.officialUrl ? (
            <Pressable
              style={styles.guideArticleLinkButton}
              onPress={() => {
                void Linking.openURL(article.officialUrl!);
              }}
            >
              <MaterialCommunityIcons name="open-in-new" size={17} color="#002045" />
                <Text style={styles.guideArticleLinkButtonText}>
                {language === 'zh' ? '查看官方页面' : 'Open Official Page'}
                </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function GlossaryScreen() {
  const language = useAppStore((state) => state.language);
  const practiceInlineNativeAd = usePracticeInlineNativeAd();
  const t = getCopy(language);
  const glossaryTerms = useGlossaryTerms();
  const [glossaryFilter, setGlossaryFilter] = useState<'all' | 'reading' | 'writing' | 'both'>('all');
  const glossarySourceLabel = (sourceTag?: 'reading' | 'writing' | 'both') => {
    const resolvedSourceTag = sourceTag ?? 'both';
    if (language === 'zh') {
      if (resolvedSourceTag === 'both') {
        return '阅读 + 书写';
      }
      return resolvedSourceTag === 'reading' ? '阅读' : '书写';
    }

    if (resolvedSourceTag === 'both') {
      return 'Reading + Writing';
    }
    return resolvedSourceTag === 'reading' ? 'Reading' : 'Writing';
  };
  const glossaryFilterOptions = [
    { key: 'all' as const, label: language === 'zh' ? '全部' : 'All' },
    { key: 'reading' as const, label: language === 'zh' ? '阅读' : 'Reading' },
    { key: 'writing' as const, label: language === 'zh' ? '书写' : 'Writing' },
    { key: 'both' as const, label: language === 'zh' ? '共用' : 'Shared' },
  ];
  const filteredGlossaryTerms = useMemo(
    () => glossaryTerms.filter((term) => glossaryFilter === 'all' || (term.sourceTag ?? 'both') === glossaryFilter),
    [glossaryFilter, glossaryTerms]
  );

  return (
    <ScreenFrame accent="#2f6f4e" bare>
      <ScrollView style={styles.screen} contentContainerStyle={styles.glossaryScreenContent}>
        <View style={styles.glossaryContentInner}>
          <View style={styles.glossaryHero}>
            <Text style={styles.glossaryTitle}>{t.glossary}</Text>
            <Text style={styles.glossaryBody}>{t.glossaryBody}</Text>
          </View>

          <View style={styles.glossaryInfoCard}>
            <View style={styles.glossaryInfoIcon}>
              <MaterialCommunityIcons name="translate" size={18} color="#2f6f4e" />
            </View>
            <Text style={styles.glossaryInfoText}>
              {language === 'zh'
                ? '刷题时遇到不熟悉的词，可以先回这里快速确认。词条标签会标出它来自 USCIS 官方阅读、书写，或两者共用词表。'
                : 'When a term slows you down during practice, review it here first. Each tag shows whether USCIS uses it in the reading list, writing list, or both.'}
            </Text>
          </View>

          <View style={styles.glossaryFilterWrap}>
            {glossaryFilterOptions.map((option) => {
              const isActive = glossaryFilter === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.glossaryFilterChip, isActive ? styles.glossaryFilterChipActive : null]}
                  onPress={() => setGlossaryFilter(option.key)}
                >
                  <Text style={[styles.glossaryFilterChipText, isActive ? styles.glossaryFilterChipTextActive : null]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.glossaryList}>
            {filteredGlossaryTerms.map((term) => {
              const sourceTag = term.sourceTag ?? 'both';

              return (
                <View key={term.termEn} style={styles.glossaryTermCard}>
                  <View style={styles.glossaryTermHeader}>
                    <Text style={styles.glossaryTermEn}>{term.termEn}</Text>
                    <View style={styles.glossaryTermBadgeRow}>
                      <View style={styles.glossaryTermBadge}>
                        <Text style={styles.glossaryTermBadgeText}>{term.termZh}</Text>
                      </View>
                      <View
                        style={[
                          styles.glossaryTermSourceBadge,
                          sourceTag === 'both'
                            ? styles.glossaryTermSourceBadgeBoth
                            : sourceTag === 'reading'
                              ? styles.glossaryTermSourceBadgeReading
                              : styles.glossaryTermSourceBadgeWriting,
                        ]}
                      >
                        <Text style={styles.glossaryTermSourceBadgeText}>{glossarySourceLabel(sourceTag)}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.glossaryTermDefinition}>{term.definitionZh}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.handbookReaderInlineAd}>
            <PracticeInlineAdSection nativeAd={practiceInlineNativeAd} language={language} />
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function SettingsScreen({ navigation, route }: RootScreenProps<'Settings'>) {
  const db = useDatabase();
  const language = useAppStore((state) => state.language);
  const stateCode = useAppStore((state) => state.stateCode);
  const isPremium = useAppStore((state) => state.isPremium);
  const t = getCopy(language);
  const studyMode = useAppStore((state) => state.studyMode);
  const blindListeningEnabled = useAppStore((state) => state.blindListeningEnabled);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setStateCode = useAppStore((state) => state.setStateCode);
  const setStudyMode = useAppStore((state) => state.setStudyMode);
  const setBlindListeningEnabled = useAppStore((state) => state.setBlindListeningEnabled);
  const setIsPremium = useAppStore((state) => state.setIsPremium);
  const showStateSection = route.params?.entryPoint === 'HomeTab'
    || route.params?.entryPoint === 'PracticeHome'
    || route.params?.entryPoint === 'GuideHome';
  const [availablePremiumProducts, setAvailablePremiumProducts] = useState<PremiumProduct[]>([]);
  const preferredPremiumProduct = useMemo(
    () => pickPreferredPremiumProduct(availablePremiumProducts),
    [availablePremiumProducts]
  );
  const [isLoadingPremiumProducts, setIsLoadingPremiumProducts] = useState(false);
  const [isPurchasingPremium, setIsPurchasingPremium] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const autoPurchaseTriggeredRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({ title: t.settings });
  }, [navigation, t.settings]);

  useEffect(() => {
    let isMounted = true;

    async function loadPremiumProducts() {
      if (!isBillingConfigured()) {
        setAvailablePremiumProducts([]);
        return;
      }

      setIsLoadingPremiumProducts(true);

      try {
        const products = await getPremiumProducts();
        if (isMounted) {
          setAvailablePremiumProducts(products);
        }
      } catch (error) {
        console.warn('Failed to load premium products', error);
        if (isMounted) {
          setAvailablePremiumProducts([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPremiumProducts(false);
        }
      }
    }

    void loadPremiumProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (autoPurchaseTriggeredRef.current || !route.params?.autoPurchasePremium) {
      return;
    }

    if (isPurchasingPremium || isRestoringPurchases || isLoadingPremiumProducts) {
      return;
    }

    autoPurchaseTriggeredRef.current = true;
    void handlePurchasePremium();
    navigation.setParams({ autoPurchasePremium: undefined });
  }, [
    isLoadingPremiumProducts,
    isPurchasingPremium,
    isRestoringPurchases,
    navigation,
    route.params?.autoPurchasePremium,
  ]);

  function getLocalizedPremiumProductName(product: PremiumProduct) {
    const productId = product.id.toLowerCase();
    const packageType = product.packageType.toLowerCase();

    if (productId.includes('lifetime') || productId.includes('forever') || packageType.includes('lifetime')) {
      return language === 'zh' ? 'Citizen Pass 终身会员' : 'Citizen Pass Lifetime';
    }

    if (productId.includes('year') || productId.includes('annual') || packageType.includes('annual')) {
      return language === 'zh' ? 'Citizen Pass 年度会员' : 'Citizen Pass Yearly';
    }

    if (productId.includes('month') || packageType.includes('monthly')) {
      return language === 'zh' ? 'Citizen Pass 月度会员' : 'Citizen Pass Monthly';
    }

    return product.title;
  }

  async function handleLanguageChange(value: 'en' | 'zh') {
    const nextMode: StudyMode = value === 'zh' ? 'zh-first' : 'en-first';
    setLanguage(value);
    setStudyMode(nextMode);
    await savePreference(db, 'language', value);
    await savePreference(db, 'studyMode', nextMode);
  }

  async function handleModeChange(value: StudyMode) {
    setStudyMode(value);
    await savePreference(db, 'studyMode', value);
  }

  async function handleBlindListeningChange(value: boolean) {
    if (value && !canUseBlindListening()) {
      showPremiumUpgradePrompt(language, 'blind-listening');
      return;
    }
    setBlindListeningEnabled(value);
    await savePreference(db, 'blindListeningEnabled', value ? 'true' : 'false');
  }

  async function handleDevPremiumToggle(value: boolean) {
    await persistPremiumAccess(db, value);
  }

  async function handlePurchasePremium() {
    if (!isBillingConfigured()) {
      Alert.alert(
        language === 'zh' ? '还未配置购买环境' : 'Billing not configured yet',
        getBillingSetupInstructions(language)
      );
      return;
    }

    const selectedProduct = preferredPremiumProduct;
    if (!selectedProduct) {
      Alert.alert(
        language === 'zh' ? '暂时无法加载会员商品' : 'Premium product unavailable',
        language === 'zh'
          ? '请先在 RevenueCat 中配置 Offering 和产品，然后重新打开此页面。'
          : 'Set up your RevenueCat offering and products first, then reopen this page.'
      );
      return;
    }

    setIsPurchasingPremium(true);
    try {
      suppressNextAppOpenAd();
      const result = await purchasePremiumProduct(selectedProduct);
      if (result.cancelled) {
        return;
      }

      const syncedPremium = result.isPremium || await getCustomerPremiumStatus();
      await persistPremiumAccess(db, syncedPremium);
      Alert.alert(
        language === 'zh' ? '购买完成' : 'Purchase complete',
        syncedPremium
          ? (language === 'zh' ? '会员已解锁，广告和免费额度限制已关闭。' : 'Premium is unlocked and free-tier limits are now removed.')
          : (language === 'zh' ? '购买已完成，但会员权限还没有同步成功，请尝试恢复购买。' : 'The purchase completed, but Premium has not synced yet. Try Restore Purchases.')
      );
    } catch (error) {
      Alert.alert(
        language === 'zh' ? '购买失败' : 'Purchase failed',
        getBillingErrorMessage(language, error, 'purchase')
      );
    } finally {
      setIsPurchasingPremium(false);
    }
  }

  async function handleRestorePurchases() {
    if (!isBillingConfigured()) {
      Alert.alert(
        language === 'zh' ? '还未配置购买环境' : 'Billing not configured yet',
        getBillingSetupInstructions(language)
      );
      return;
    }

    setIsRestoringPurchases(true);
    try {
      suppressNextAppOpenAd();
      const restoredPremium = await restorePurchases();
      await persistPremiumAccess(db, restoredPremium);
      Alert.alert(
        language === 'zh' ? '恢复完成' : 'Restore complete',
        restoredPremium
          ? (language === 'zh' ? '已恢复会员权限。' : 'Your Premium access has been restored.')
          : (language === 'zh' ? '没有发现可恢复的会员购买记录。' : 'No Premium purchases were found to restore.')
      );
    } catch (error) {
      Alert.alert(
        language === 'zh' ? '恢复失败' : 'Restore failed',
        getBillingErrorMessage(language, error, 'restore')
      );
    } finally {
      setIsRestoringPurchases(false);
    }
  }

  async function handleStateChange(value: StateCode) {
    setStateCode(value);
    await savePreference(db, 'stateCode', value);
  }

  return (
    <ScreenFrame scrollable={false} bare>
      <ScrollView style={styles.screen} contentContainerStyle={styles.settingsScreenContent}>
        <View style={styles.settingsContentInner}>
          {showStateSection ? (
            <View style={styles.settingsSection}>
              <View style={styles.settingsSectionHeader}>
                <Text style={styles.settingsSectionEyebrow}>{language === 'zh' ? '题库版本' : 'Question bank version'}</Text>
                <Text style={styles.settingsSectionBody}>
                  {language === 'zh'
                    ? '切换当前使用的官方题库版本和对应学习内容。'
                    : 'Switch the active official question bank version and matching study content.'}
                </Text>
              </View>
              <View style={styles.settingsOptionGroup}>
                {availableAppStates.map((state) => (
                  <Pressable
                    key={state.code}
                    style={[styles.settingsOptionCard, stateCode === state.code && styles.settingsOptionCardSelected]}
                    onPress={() => void handleStateChange(state.code)}
                  >
                    <View style={styles.settingsOptionCopy}>
                      <Text style={styles.settingsOptionTitle}>{language === 'zh' ? state.nameZh : state.nameEn}</Text>
                      <Text style={styles.settingsOptionDescription}>{getStateContentDescription(state.code, language)}</Text>
                    </View>
                    {stateCode === state.code ? (
                      <View style={styles.settingsOptionCheck}>
                        <MaterialCommunityIcons name="check" size={16} color="#ffffff" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionEyebrow}>{language === 'zh' ? '界面语言' : 'App language'}</Text>
            <View style={styles.settingsOptionGroup}>
              <Pressable
                style={[styles.settingsOptionCard, language === 'zh' && styles.settingsOptionCardSelected]}
                onPress={() => void handleLanguageChange('zh')}
              >
                <View style={styles.settingsOptionCopy}>
                  <Text style={styles.settingsOptionTitle}>{language === 'zh' ? '中文 (简体)' : 'Chinese (Simplified)'}</Text>
                </View>
                {language === 'zh' ? (
                  <View style={styles.settingsOptionCheck}>
                    <MaterialCommunityIcons name="check" size={16} color="#ffffff" />
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                style={[styles.settingsOptionCard, language === 'en' && styles.settingsOptionCardSelected]}
                onPress={() => void handleLanguageChange('en')}
              >
                <View style={styles.settingsOptionCopy}>
                  <Text style={styles.settingsOptionTitle}>English</Text>
                </View>
                {language === 'en' ? (
                  <View style={styles.settingsOptionCheck}>
                    <MaterialCommunityIcons name="check" size={16} color="#ffffff" />
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeader}>
              <Text style={styles.settingsSectionEyebrow}>{language === 'zh' ? '会员权益' : 'Premium'}</Text>
              <Text style={styles.settingsSectionBody}>
                {isPremium
                  ? (language === 'zh' ? '你已解锁终身会员，可长期使用无广告学习、盲听模式、完整答案解析、无限听题和无限模拟考试。' : 'Lifetime Premium is active. You have long-term access to ad-free study, blind listening mode, full answer explanations, unlimited listening, and unlimited mock tests.')
                  : (language === 'zh' ? '免费用户会显示广告，盲听模式、完整答案解析、无限听题和无限模拟考试仅对会员开放。' : 'Free users see ads, while blind listening, full answer explanations, unlimited listening, and unlimited mock tests are available with Premium.')}
              </Text>
            </View>
            <View style={styles.settingsOptionGroup}>
              {isPremium ? (
                <View style={styles.settingsPremiumStatusCard}>
                  <MaterialCommunityIcons name="crown" size={18} color="#7b4f00" />
                  <View style={styles.settingsOptionCopy}>
                    <Text style={styles.settingsPremiumStatusTitle}>
                      {language === 'zh' ? '尊敬的会员，您好' : 'Premium active'}
                    </Text>
                    <Text style={styles.settingsOptionDescription}>
                      {language === 'zh'
                        ? '当前账号已解锁全部会员权益，无需重复购买或恢复。'
                        : 'All Premium benefits are unlocked for this account. No additional purchase or restore is needed.'}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Pressable
                    style={styles.settingsOptionCard}
                    onPress={() => void handlePurchasePremium()}
                    disabled={isPurchasingPremium || isLoadingPremiumProducts || isRestoringPurchases}
                  >
                    <View style={styles.settingsOptionCopy}>
                      <Text style={styles.settingsOptionTitle}>
                        {isPurchasingPremium
                          ? (language === 'zh' ? '正在打开购买...' : 'Opening purchase...')
                          : (language === 'zh' ? '购买会员' : 'Buy Premium')}
                      </Text>
                      <Text style={styles.settingsOptionDescription}>
                        {!isBillingConfigured()
                          ? getBillingSetupInstructions(language)
                          : isLoadingPremiumProducts
                            ? (language === 'zh' ? '正在加载会员商品价格...' : 'Loading Premium pricing...')
                            : preferredPremiumProduct
                              ? `${getLocalizedPremiumProductName(preferredPremiumProduct)} · ${preferredPremiumProduct.priceString}`
                              : (language === 'zh' ? '请先在 RevenueCat 中配置 Offering 和产品。' : 'Configure your RevenueCat offering and product first.')}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={styles.settingsOptionCard}
                    onPress={() => void handleRestorePurchases()}
                    disabled={isRestoringPurchases || isPurchasingPremium}
                  >
                    <View style={styles.settingsOptionCopy}>
                      <Text style={styles.settingsOptionTitle}>
                        {isRestoringPurchases
                          ? (language === 'zh' ? '正在恢复购买...' : 'Restoring purchases...')
                          : (language === 'zh' ? '恢复购买' : 'Restore Purchases')}
                      </Text>
                      <Text style={styles.settingsOptionDescription}>
                        {language === 'zh'
                          ? '用户换设备或重新安装 App 后，可在这里恢复会员权限；恢复购买不会重复扣费。'
                          : 'Use this after reinstalling the app or moving to a new device to restore Premium access. Restoring does not charge again.'}
                      </Text>
                    </View>
                  </Pressable>
                </>
              )}
            </View>
            {__DEV__ ? (
              <View style={styles.settingsOptionGroup}>
                <Pressable
                  style={[styles.settingsOptionCard, isPremium && styles.settingsOptionCardSelected]}
                  onPress={() => void handleDevPremiumToggle(true)}
                >
                  <View style={styles.settingsOptionCopy}>
                    <Text style={styles.settingsOptionTitle}>{language === 'zh' ? '开发环境：模拟会员' : 'Dev: Simulate Premium'}</Text>
                    <Text style={styles.settingsOptionDescription}>
                      {language === 'zh' ? '仅开发环境可见，用来验证会员权限和免费限制。' : 'Visible only in development so we can verify premium access and free-user limits.'}
                    </Text>
                  </View>
                  {isPremium ? (
                    <View style={styles.settingsOptionCheck}>
                      <MaterialCommunityIcons name="check" size={16} color="#ffffff" />
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  style={[styles.settingsOptionCard, !isPremium && styles.settingsOptionCardSelected]}
                  onPress={() => void handleDevPremiumToggle(false)}
                >
                  <View style={styles.settingsOptionCopy}>
                    <Text style={styles.settingsOptionTitle}>{language === 'zh' ? '开发环境：模拟免费版' : 'Dev: Simulate Free'}</Text>
                    <Text style={styles.settingsOptionDescription}>
                      {language === 'zh' ? '切回免费用户视角，检查广告和额度限制是否正常。' : 'Switch back to the free-user view to verify ads and daily/session limits.'}
                    </Text>
                  </View>
                  {!isPremium ? (
                    <View style={styles.settingsOptionCheck}>
                      <MaterialCommunityIcons name="check" size={16} color="#ffffff" />
                    </View>
                  ) : null}
                </Pressable>
              </View>
            ) : null}
            {__DEV__ ? <AdsDebugCard language={language} /> : null}
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeader}>
              <Text style={styles.settingsSectionEyebrow}>{language === 'zh' ? '盲听模式' : 'Blind listening mode'}</Text>
              <Text style={styles.settingsSectionBody}>
                {language === 'zh'
                  ? '进入题目后先隐藏题干并自动朗读，适合练习听题反应。'
                  : 'Hide the prompt first and auto-play the question so learners can practice listening response.'}
              </Text>
            </View>
            <View style={styles.settingsOptionGroup}>
              <Pressable
                style={[
                  styles.settingsOptionCard,
                  !isPremium && styles.settingsOptionCardLocked,
                  !isPremium && styles.settingsOptionCardLockedEmphasis,
                  isPremium && blindListeningEnabled && styles.settingsOptionCardSelected,
                ]}
                onPress={() => {
                  if (!isPremium) {
                    if (isLoadingPremiumProducts) {
                      Alert.alert(
                        language === 'zh' ? '正在加载会员商品' : 'Loading Premium products',
                        language === 'zh'
                          ? '请稍候，商品价格加载完成后再试。'
                          : 'Please wait for product pricing to finish loading, then try again.'
                      );
                      return;
                    }
                    void handlePurchasePremium();
                    return;
                  }
                  void handleBlindListeningChange(true);
                }}
              >
                <View style={styles.settingsOptionCopy}>
                  <Text style={[styles.settingsOptionTitle, !isPremium && styles.settingsOptionTitleLocked]}>
                    {language === 'zh' ? '开启' : 'On'}
                  </Text>
                  <Text style={styles.settingsOptionDescription}>
                    {!isPremium
                      ? (language === 'zh'
                        ? '会员专属功能。升级后可开启盲听模式并进入纯听力训练。'
                        : 'Premium only. Upgrade to enable blind listening and full audio-only training.')
                      : (language === 'zh'
                        ? '题目默认隐藏，一进入自动播放语音，可手动显示文字。'
                        : 'Hide the prompt by default, auto-play the audio, and let the learner reveal the text manually.')}
                  </Text>
                  {!isPremium ? (
                    <Text style={styles.settingsOptionLockedCta}>
                      {language === 'zh' ? '点击立即开通会员' : 'Tap to unlock Premium now'}
                    </Text>
                  ) : null}
                </View>
                {!isPremium ? (
                  <View style={styles.settingsOptionLockPill}>
                    <MaterialCommunityIcons name="lock" size={13} color="#7b4f00" />
                    <Text style={styles.settingsOptionLockPillText}>PRO</Text>
                  </View>
                ) : blindListeningEnabled ? (
                  <View style={styles.settingsOptionCheck}>
                    <MaterialCommunityIcons name="check" size={16} color="#ffffff" />
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                style={[styles.settingsOptionCard, !blindListeningEnabled && styles.settingsOptionCardSelected]}
                onPress={() => void handleBlindListeningChange(false)}
              >
                <View style={styles.settingsOptionCopy}>
                  <Text style={styles.settingsOptionTitle}>{language === 'zh' ? '关闭' : 'Off'}</Text>
                  <Text style={styles.settingsOptionDescription}>
                    {language === 'zh' ? '正常显示题目文字，再按需要播放语音。' : 'Show the question text normally and play audio only when needed.'}
                  </Text>
                </View>
                {!blindListeningEnabled ? (
                  <View style={styles.settingsOptionCheck}>
                    <MaterialCommunityIcons name="check" size={16} color="#ffffff" />
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>

          <View style={styles.settingsActionWrap}>
            <Pressable style={styles.settingsDoneButton} onPress={() => navigation.goBack()}>
              <Text style={styles.settingsDoneButtonText}>{t.done}</Text>
            </Pressable>
          </View>

          <View style={styles.settingsFooter}>
            <Text style={styles.settingsFooterText}>{`Version ${appVersion}`}</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

function ActionCard({
  title,
  subtitle,
  meta,
  accentColor,
  badge,
  iconName,
  cardTone,
  onPress,
}: {
  title: string;
  subtitle: string;
  meta?: string;
  accentColor: string;
  badge: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  cardTone?: string;
  onPress: () => void;
}) {
  const cardBackground = cardTone ?? withAlpha(accentColor, Platform.OS === 'android' ? 0.085 : 0.065);
  const softAccent = withAlpha(accentColor, Platform.OS === 'android' ? 0.14 : 0.1);

  return (
    <Pressable
      style={[
        styles.actionCard,
        {
          backgroundColor: cardBackground,
        },
      ]}
      onPress={onPress}
    >
      <View style={[styles.actionCardCornerOrb, { backgroundColor: withAlpha(accentColor, 0.08) }]} />
      <View style={[styles.actionCardCornerDot, { backgroundColor: withAlpha(accentColor, 0.22) }]} />
      <View style={styles.actionCardBody}>
        <View style={styles.actionCardTopRow}>
          <View style={styles.actionCardTitleGroup}>
            <View
              style={[
                styles.actionCardIconWrap,
                { backgroundColor: softAccent },
              ]}
            >
              <MaterialCommunityIcons name={iconName} size={22} color={accentColor} />
            </View>
            <Text style={styles.actionCardTitle} numberOfLines={2}>{title}</Text>
          </View>
        </View>
        <View style={styles.actionCardContent}>
          <Text style={styles.actionCardSubtitle} numberOfLines={2}>{subtitle}</Text>
        </View>
        <View style={styles.actionCardFooter}>
          <View style={[styles.actionCardBadgePill, { backgroundColor: softAccent }]}>
            <Text style={[styles.actionCardEyebrow, { color: accentColor }]}>{badge}</Text>
          </View>
          <View style={styles.actionCardFooterRight}>
            {meta ? (
              <View style={[styles.actionCardCountPill, { backgroundColor: softAccent }]}>
                <Text style={[styles.actionCardCountText, { color: accentColor }]} numberOfLines={1}>
                  {meta}
                </Text>
              </View>
            ) : null}
            <MaterialCommunityIcons name="chevron-right" size={18} color="#a29380" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function QuestionPreview({ question, badge, onPress }: { question: Question; badge: string; onPress?: () => void }) {
  const language = useAppStore((state) => state.language);

  if (onPress) {
    return (
      <Pressable style={styles.previewCard} onPress={onPress}>
        <Text style={styles.previewBadge}>{badge}</Text>
        <Text style={styles.previewTitle}>{language === 'zh' ? question.questionZh : question.questionEn}</Text>
        <Text style={styles.previewSubtitle}>{language === 'zh' ? question.questionEn : question.questionZh}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewBadge}>{badge}</Text>
      <Text style={styles.previewTitle}>{language === 'zh' ? question.questionZh : question.questionEn}</Text>
      <Text style={styles.previewSubtitle}>{language === 'zh' ? question.questionEn : question.questionZh}</Text>
    </View>
  );
}

function QuestionCard({
  db,
  question,
  questionIndex,
  total,
  mode,
  onModeChange,
  languageOverride,
  hideModeSwitch,
  revealExplanation,
  sourceLabel,
  saved,
  setSaved,
  selectedOption,
  hasChecked,
  primaryActionLabel,
  previousActionLabel,
  onSelectOption,
  isNotebookFlow,
  allowAdvanceWithoutAnswer,
  canGoPrevious,
  canGoNext,
  canExitBackward,
  onPrevious,
  onAdvance,
  roadSignOverride,
  collapsibleRoadSignDescription,
  inlineNativeAd,
  enableBlindListeningAutoPlay = true,
  suppressAnswerReadInBlindListening = false,
  isActive = true,
  previewFocus,
}: {
  db: ReturnType<typeof useDatabase>;
  question: Question;
  questionIndex: number;
  total: number;
  mode: StudyMode;
  onModeChange?: (mode: StudyMode) => void;
  languageOverride?: 'en' | 'zh';
  hideModeSwitch?: boolean;
  revealExplanation?: boolean;
  sourceLabel: string;
  saved?: boolean;
  setSaved?: (value: boolean) => void;
  selectedOption: string | null;
  hasChecked: boolean;
  primaryActionLabel: string;
  previousActionLabel?: string;
  onSelectOption: (optionKey: string) => void;
  isNotebookFlow?: boolean;
  allowAdvanceWithoutAnswer?: boolean;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  canExitBackward?: boolean;
  onPrevious?: () => void;
  onAdvance: () => void;
  roadSignOverride?: RoadSign;
  collapsibleRoadSignDescription?: boolean;
  inlineNativeAd?: NativeAd | null;
  enableBlindListeningAutoPlay?: boolean;
  suppressAnswerReadInBlindListening?: boolean;
  isActive?: boolean;
  previewFocus?: 'answer-review';
}) {
  const isFocused = useIsFocused();
  const appLanguage = useAppStore((state) => state.language);
  const isPremium = useAppStore((state) => state.isPremium);
  const stateCode = useAppStore((state) => state.stateCode);
  const questionDisplayMode = useAppStore((state) => state.questionDisplayMode);
  const setQuestionDisplayMode = useAppStore((state) => state.setQuestionDisplayMode);
  const speechRate = useAppStore((state) => state.speechRate);
  const setSpeechRate = useAppStore((state) => state.setSpeechRate);
  const blindListeningEnabled = useAppStore((state) => state.blindListeningEnabled);
  const language = languageOverride ?? appLanguage;
  const t = getCopy(appLanguage);
  const roadSignId = getRoadSignIdFromQuestionId(question.id) ?? roadSignByQuestionCode[question.id];
  const roadSign = roadSignOverride ?? (roadSignId
    ? roadSigns.find((item) => item.id === roadSignId)
    : undefined);
  const isChinesePrimary = mode === 'zh-first';
  const isBilingualQuestion = questionDisplayMode === 'bilingual';
  const primaryQuestion = question.questionEn;
  const secondaryQuestion = question.questionZh;
  const singleLanguageQuestion = language === 'zh' ? question.questionZh : question.questionEn;
  const questionImage = question.image;
  const [showRoadSignDescription, setShowRoadSignDescription] = useState(!collapsibleRoadSignDescription);
  const [isReadingQuestion, setIsReadingQuestion] = useState(false);
  const [showSpeechRateMenu, setShowSpeechRateMenu] = useState(false);
  const [preferredVoiceId, setPreferredVoiceId] = useState<string | null>(null);
  const [isQuestionTextVisible, setIsQuestionTextVisible] = useState(!blindListeningEnabled);
  const previousButtonLabel = previousActionLabel ?? t.previousQuestion;
  const chapterBadge = sourceLabel
    ? sourceLabel.length > 8
      ? sourceLabel.slice(0, 8).toUpperCase()
      : sourceLabel.toUpperCase()
    : 'CH';
  const displayOptions = useMemo(() => {
    return question.options.map((option) => ({
      primary: option.textEn,
      secondary: isBilingualQuestion ? option.textZh : '',
    }));
  }, [isBilingualQuestion, question.options]);
  const correctOption = useMemo(
    () => question.options.find((option) => option.isCorrect) ?? null,
    [question.options]
  );
  const [lastRecordingError, setLastRecordingError] = useState<string | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    if (status.error) {
      setLastRecordingError(status.error);
    }
    if (status.url && pendingRecordingQuestionIdRef.current === question.id) {
      setRecordedQuestionId(question.id);
      setRecordingUri(status.url);
    }
  });
  const recorderState = useAudioRecorderState(audioRecorder);
  const localSpeechPlayerRef = useRef(createAudioPlayer(null, { keepAudioSessionActive: true }));
  const localSpeechPlayer = localSpeechPlayerRef.current;
  const recordingPlayerRef = useRef(createAudioPlayer(null, { keepAudioSessionActive: true }));
  const recordingPlayer = recordingPlayerRef.current;
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordedQuestionId, setRecordedQuestionId] = useState<string | null>(null);
  const recordingUriRef = useRef<string | null>(null);
  const pendingRecordingQuestionIdRef = useRef<string | null>(null);
  const hasPlayableRecording = isActive && Boolean(recordingUri) && recordedQuestionId === question.id;
  const canUsePracticeReview = !revealExplanation || isPremium || canRevealPracticeExplanations();
  const canUseQuestionAudio = canListenToQuestion(questionIndex);
  const isAnswerReviewPreview = previewFocus === 'answer-review';

  const shouldRevealAnswer = Boolean(revealExplanation) && hasChecked && canUsePracticeReview;
  const shouldUseImmediateAdvance = hideModeSwitch && !revealExplanation;
  const visibleOptions = isAnswerReviewPreview && shouldRevealAnswer
    ? question.options.filter((option) => option.key === selectedOption || option.isCorrect)
    : question.options;

  useEffect(() => {
    setShowRoadSignDescription(!collapsibleRoadSignDescription);
  }, [collapsibleRoadSignDescription, question.id, roadSign?.id]);

  useEffect(() => {
    recordingUriRef.current = recordingUri;
  }, [recordingUri]);

  function clearTemporaryRecording(uriOverride?: string | null) {
    const targetUri = uriOverride ?? recordingUriRef.current;
    recordingUriRef.current = null;
    pendingRecordingQuestionIdRef.current = null;
    setRecordedQuestionId(null);
    setRecordingUri(null);

    if (!targetUri) {
      return;
    }

    try {
      if (recordingPlayer.playing) {
        recordingPlayer.pause();
      }
      new File(targetUri).delete();
    } catch {}
  }

  useEffect(() => {
    return () => {
      void stopAudioPlayer(localSpeechPlayer);
      localSpeechPlayer.remove();
      clearTemporaryRecording(recordingUriRef.current);
      recordingPlayer.remove();
    };
  }, [localSpeechPlayer, recordingPlayer]);

  useEffect(() => {
    setIsQuestionTextVisible(!blindListeningEnabled);
  }, [blindListeningEnabled, question.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadPreferredVoice() {
      if (Platform.OS !== 'ios') {
        return;
      }

      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const preferredVoice = choosePreferredEnglishVoice(voices);

        if (isMounted) {
          setPreferredVoiceId(preferredVoice?.identifier ?? null);
        }
      } catch {
        if (isMounted) {
          setPreferredVoiceId(null);
        }
      }
    }

    void loadPreferredVoice();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setIsReadingQuestion(false);
    setShowSpeechRateMenu(false);
    clearTemporaryRecording(recordingUriRef.current);
    void Speech.stop();
    void stopAudioPlayer(localSpeechPlayer);
    if (recordingPlayer.playing) {
      recordingPlayer.pause();
    }
    if (recorderState.isRecording) {
      void audioRecorder.stop();
    }

    return () => {
      void Speech.stop();
      void stopAudioPlayer(localSpeechPlayer);
      if (recordingPlayer.playing) {
        recordingPlayer.pause();
      }
    };
  }, [localSpeechPlayer, question.id]);

  useEffect(() => {
    if (isActive) {
      return;
    }

    setIsReadingQuestion(false);
    setShowSpeechRateMenu(false);
    clearTemporaryRecording(recordingUriRef.current);
    void Speech.stop();
    void stopAudioPlayer(localSpeechPlayer);

    if (recordingPlayer.playing) {
      recordingPlayer.pause();
    }

    if (recorderState.isRecording) {
      void audioRecorder.stop();
    }
  }, [audioRecorder, isActive, localSpeechPlayer, recorderState.isRecording, recordingPlayer]);

  useEffect(() => {
    if (isFocused) {
      return;
    }

    setIsReadingQuestion(false);
    setShowSpeechRateMenu(false);
    clearTemporaryRecording(recordingUriRef.current);
    void Speech.stop();
    void stopAudioPlayer(localSpeechPlayer);

    if (recordingPlayer.playing) {
      recordingPlayer.pause();
    }

    if (recorderState.isRecording) {
      void audioRecorder.stop();
    }
  }, [audioRecorder, isFocused, localSpeechPlayer, recorderState.isRecording, recordingPlayer]);

  useEffect(() => {
    if (!isFocused || !isActive || !blindListeningEnabled || roadSign || !enableBlindListeningAutoPlay) {
      return;
    }

    const timer = setTimeout(() => {
      setIsReadingQuestion(true);
      void speakText(question.questionEn, getQuestionAudioSource(question.id));
    }, 180);

    return () => {
      clearTimeout(timer);
    };
  }, [blindListeningEnabled, enableBlindListeningAutoPlay, isActive, isFocused, localSpeechPlayer, question.id, roadSign, preferredVoiceId, speechRate]);

  async function speakText(text: string, localSource?: number | null) {
    const normalized = buildTtsReadyEnglish(text);
    if (!normalized) {
      setIsReadingQuestion(false);
      return;
    }

    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      interruptionMode: 'doNotMix',
      shouldRouteThroughEarpiece: false,
    });
    await Speech.stop();
    await stopAudioPlayer(localSpeechPlayer);

    if (localSource != null) {
      try {
        await playLocalAudioSource(localSpeechPlayer, localSource, speechRate);
      } finally {
        setIsReadingQuestion(false);
      }
      return;
    }

    await Speech.speak(normalized, {
      language: 'en-US',
      pitch: 1,
      rate: getTtsRate(speechRate),
      voice: preferredVoiceId ?? undefined,
      onDone: () => setIsReadingQuestion(false),
      onStopped: () => setIsReadingQuestion(false),
      onError: () => setIsReadingQuestion(false),
    });
  }

  async function handleSelectOption(optionKey: string) {
    if (hasChecked) {
      return;
    }
    onSelectOption(optionKey);

    const shouldReadCorrectAnswer = correctOption?.textEn
      && blindListeningEnabled
      && !suppressAnswerReadInBlindListening;

    if (shouldReadCorrectAnswer) {
      setIsReadingQuestion(false);
      setShowSpeechRateMenu(false);
      await speakText(correctOption.textEn, getAnswerAudioSource(question.id));
    }
  }

  function handlePrimaryAction() {
    if (!selectedOption && canExitBackward) {
      onPrevious?.();
      return;
    }

    if (shouldUseImmediateAdvance) {
      onAdvance();
      return;
    }

    onAdvance();
  }

  async function handleToggleSaved() {
    const next = await toggleSavedQuestion(db, stateCode, question.id);
    setSaved?.(next);
  }

  async function handleChangeQuestionDisplay(nextMode: 'english' | 'bilingual') {
    setQuestionDisplayMode(nextMode);
    await savePreference(db, 'questionDisplayMode', nextMode);
  }

  async function handleChangeSpeechRate(nextRate: number) {
    setSpeechRate(nextRate);
    setShowSpeechRateMenu(false);
    await savePreference(db, 'speechRate', String(nextRate));
  }

  async function handleReadQuestion() {
    if (!canUseQuestionAudio) {
      showPremiumUpgradePrompt(language, 'listening-limit');
      return;
    }

    if (isReadingQuestion) {
      setIsReadingQuestion(false);
      await Speech.stop();
      await stopAudioPlayer(localSpeechPlayer);
      return;
    }

    setIsReadingQuestion(true);
    setShowSpeechRateMenu(false);
    await speakText(question.questionEn, getQuestionAudioSource(question.id));
  }

  async function ensureRecordingPermission() {
    const currentPermission = await getRecordingPermissionsAsync();
    const permission = currentPermission.granted
      ? currentPermission
      : await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        language === 'zh' ? '需要麦克风权限' : 'Microphone permission required',
        language === 'zh'
          ? '请先允许美国入籍考试通访问麦克风，这样你才能录音练习发音。'
          : 'Please allow Citizen Pass to access your microphone so you can record pronunciation practice.'
      );
      return false;
    }
    return true;
  }

  async function handleReadCorrectAnswer() {
    if (!canUseQuestionAudio) {
      showPremiumUpgradePrompt(language, 'listening-limit');
      return;
    }

    if (!correctOption?.textEn) {
      return;
    }

    setShowSpeechRateMenu(false);
    await speakText(correctOption.textEn, getAnswerAudioSource(question.id));
  }

  async function openPremiumPurchaseFromPractice() {
    if (!isBillingConfigured()) {
      Alert.alert(
        language === 'zh' ? '还未配置购买环境' : 'Billing not configured yet',
        getBillingSetupInstructions(language)
      );
      return;
    }

    try {
      suppressNextAppOpenAd();
      const products = await getPremiumProducts();
      const selectedProduct = pickPreferredPremiumProduct(products);

      if (!selectedProduct) {
        Alert.alert(
          language === 'zh' ? '暂时无法加载会员商品' : 'Premium product unavailable',
          language === 'zh'
            ? '请先在 RevenueCat 中配置 Offering 和产品，然后重试。'
            : 'Set up your RevenueCat offering and products first, then try again.'
        );
        return;
      }

      const result = await purchasePremiumProduct(selectedProduct);
      if (result.cancelled) {
        return;
      }

      const syncedPremium = result.isPremium || await getCustomerPremiumStatus();
      await persistPremiumAccess(db, syncedPremium);

      if (syncedPremium) {
        Alert.alert(
          language === 'zh' ? '购买完成' : 'Purchase complete',
          language === 'zh' ? '会员已解锁，当前页面会自动开放完整答案与解析。' : 'Premium is unlocked. This page will now show full answers and explanations.'
        );
      } else {
        Alert.alert(
          language === 'zh' ? '购买已完成' : 'Purchase completed',
          language === 'zh' ? '订单已完成，但会员状态还未同步，请点击“恢复购买”。' : 'Purchase completed, but Premium has not synced yet. Please tap Restore Purchases.'
        );
      }
    } catch (error) {
      Alert.alert(
        language === 'zh' ? '购买失败' : 'Purchase failed',
        getBillingErrorMessage(language, error, 'purchase')
      );
    }
  }

  function showRecordingErrorAlert(error: unknown) {
    const rawMessage = error instanceof Error ? error.message : String(error ?? '');
    const detailMessage = (rawMessage || lastRecordingError || '').trim();
    const normalizedMessage = rawMessage.toLowerCase();
    const simulatorHint = normalizedMessage.includes('simulator')
      || normalizedMessage.includes('not available')
      || normalizedMessage.includes('audio session');

    Alert.alert(
      language === 'zh' ? '录音暂时不可用' : 'Recording unavailable',
      `${simulatorHint
        ? (language === 'zh'
            ? '当前环境暂时无法使用麦克风录音。请优先在真机上测试录音功能，或检查系统麦克风权限后再试。'
            : 'Recording is not available in the current environment. Please test on a physical device or verify microphone access and try again.')
        : (language === 'zh'
            ? '录音启动失败，请检查麦克风权限后重试。'
            : 'Unable to start recording. Please verify microphone access and try again.')}${detailMessage
        ? `\n\n${language === 'zh' ? '系统提示：' : 'System message:'} ${detailMessage}`
        : ''}`
    );
  }

  async function handleToggleRecording() {
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        const nextUri = audioRecorder.uri ?? recorderState.url ?? null;
        pendingRecordingQuestionIdRef.current = null;
        setRecordingUri(nextUri);
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          interruptionMode: 'doNotMix',
          shouldRouteThroughEarpiece: false,
        });

        if (!nextUri) {
          setRecordedQuestionId(null);
          Alert.alert(
            language === 'zh' ? '录音未保存' : 'Recording not saved',
            language === 'zh'
              ? '本次录音没有成功保存，请再试一次。'
              : 'The recording could not be saved. Please try again.'
          );
        } else {
          setRecordedQuestionId(question.id);
          recordingPlayer.replace({ uri: nextUri });
          recordingPlayer.setPlaybackRate(1);
        }
        return;
      }

      const hasPermission = await ensureRecordingPermission();
      if (!hasPermission) {
        return;
      }

      setLastRecordingError(null);
      pendingRecordingQuestionIdRef.current = question.id;
      setRecordedQuestionId(null);
      setShowSpeechRateMenu(false);
      setIsReadingQuestion(false);
      await Speech.stop();
      await stopAudioPlayer(localSpeechPlayer);
      if (recordingPlayer.playing) {
        recordingPlayer.pause();
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: 'doNotMix',
        shouldRouteThroughEarpiece: false,
      });
      await audioRecorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      const preparedState = audioRecorder.getStatus();
      if (!preparedState.canRecord) {
        throw new Error(lastRecordingError || 'Recorder did not enter a prepared state.');
      }
      audioRecorder.record();
    } catch (error) {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          interruptionMode: 'doNotMix',
          shouldRouteThroughEarpiece: false,
        });
      } catch {}
      showRecordingErrorAlert(error);
    }
  }

  async function handlePlayRecording() {
    if (!recordingUri || recordedQuestionId !== question.id) {
      return;
    }

    try {
      setShowSpeechRateMenu(false);
      setIsReadingQuestion(false);
      await Speech.stop();
      await stopAudioPlayer(localSpeechPlayer);

      if (recordingPlayer.playing) {
        recordingPlayer.pause();
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        interruptionMode: 'doNotMix',
        shouldRouteThroughEarpiece: false,
      });
      recordingPlayer.replace({ uri: recordingUri });
      recordingPlayer.setPlaybackRate(1);
      await recordingPlayer.seekTo(0);
      recordingPlayer.play();
    } catch (error) {
      Alert.alert(
        language === 'zh' ? '回放失败' : 'Playback failed',
        language === 'zh'
          ? '刚才的录音暂时无法播放，请重新录一遍再试。'
          : 'The recording could not be played back. Please record again and try once more.'
      );
    }
  }

  return (
    <View style={styles.questionCard}>
      <View style={styles.questionHeaderRow}>
        <View style={styles.questionProgressGroup}>
          <Text style={styles.questionNumberTitle}>
            {t.question} {questionIndex}
            <Text style={styles.questionNumberTotal}>/{total}</Text>
          </Text>
          <View style={styles.questionSourceBadge}>
            <Text style={styles.questionSourceBadgeText}>{chapterBadge}</Text>
          </View>
        </View>
        {!isAnswerReviewPreview ? (
          <View style={styles.questionHeaderControls}>
            <View style={styles.modeRow}>
              {(['english', 'bilingual'] as const).map((item) => (
                <Pressable
                  key={item}
                  style={[styles.modeChip, questionDisplayMode === item && styles.modeChipActive]}
                  onPress={() => void handleChangeQuestionDisplay(item)}
                >
                  <Text style={[styles.modeChipText, questionDisplayMode === item && styles.modeChipTextActive]}>
                    {item === 'english'
                      ? (language === 'zh' ? '英文' : 'English')
                      : (language === 'zh' ? '双语' : 'Bilingual')}
                  </Text>
                </Pressable>
              ))}
            </View>
            {setSaved ? (
              <Pressable style={styles.questionSaveIconButton} onPress={() => void handleToggleSaved()}>
                <MaterialCommunityIcons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? '#002045' : 'rgba(0,32,69,0.6)'} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      {roadSign ? (
        <View style={styles.questionSignBlock}>
          <RoadSignVisual sign={roadSign} large />
          {collapsibleRoadSignDescription ? (
            <Pressable
              style={styles.questionSignToggleButton}
              onPress={() => setShowRoadSignDescription((value) => !value)}
            >
              <Text style={styles.questionSignToggleButtonText}>
                {showRoadSignDescription
                  ? (appLanguage === 'zh' ? '收起中英文说明' : 'Hide bilingual label')
                  : (appLanguage === 'zh' ? '显示中英文说明' : 'Show bilingual label')}
              </Text>
            </Pressable>
          ) : null}
          {showRoadSignDescription ? (
            <>
              <Text style={styles.questionSignTitle}>{language === 'zh' ? roadSign.titleZh : roadSign.titleEn}</Text>
              <Text style={styles.questionSignSubtitle}>{language === 'zh' ? roadSign.titleEn : roadSign.titleZh}</Text>
            </>
          ) : null}
        </View>
      ) : null}
      {!roadSign && questionImage ? (
        <View style={styles.questionIllustrationBlock}>
          <Image
            source={{ uri: questionImage.src }}
            style={styles.questionIllustrationImage}
            resizeMode="contain"
          />
        </View>
      ) : null}
      <View style={styles.questionPromptCopy}>
        {!isAnswerReviewPreview ? (
          <View style={styles.questionAudioControls}>
            <Pressable
              style={[styles.questionReadButton, isReadingQuestion && styles.questionReadButtonActive]}
              onPress={() => void handleReadQuestion()}
            >
              <MaterialCommunityIcons
                name={isReadingQuestion ? 'stop-circle-outline' : 'volume-high'}
                size={18}
                color={isReadingQuestion ? '#ffffff' : '#165a72'}
              />
            </Pressable>
            <View style={styles.speechRateWrap}>
              <Pressable
                style={[styles.speechRateButton, showSpeechRateMenu && styles.speechRateButtonActive]}
                onPress={() => setShowSpeechRateMenu((value) => !value)}
              >
                <Text style={[styles.speechRateButtonText, showSpeechRateMenu && styles.speechRateButtonTextActive]}>
                  {speechRate % 1 === 0 ? `${speechRate.toFixed(0)}x` : `${speechRate}x`}
                </Text>
                <MaterialCommunityIcons
                  name={showSpeechRateMenu ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={showSpeechRateMenu ? '#ffffff' : '#165a72'}
                />
              </Pressable>
              {showSpeechRateMenu ? (
                <View style={styles.speechRateMenu}>
                  {[0.5, 0.75, 1, 1.25].map((rate) => {
                    const label = rate % 1 === 0 ? `${rate.toFixed(0)}x` : `${rate}x`;
                    const isSelectedRate = speechRate === rate;
                    return (
                      <Pressable
                        key={rate}
                        style={[styles.speechRateMenuItem, isSelectedRate && styles.speechRateMenuItemActive]}
                        onPress={() => void handleChangeSpeechRate(rate)}
                      >
                        <Text style={[styles.speechRateMenuItemText, isSelectedRate && styles.speechRateMenuItemTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
        {blindListeningEnabled && !isQuestionTextVisible ? (
          <View style={styles.blindListeningCard}>
            <Text style={styles.blindListeningTitle}>
              {language === 'zh' ? '盲听模式已开启' : 'Blind listening mode is on'}
            </Text>
            <Text style={styles.blindListeningBody}>
              {language === 'zh'
                ? '题目文字已隐藏，系统会先自动朗读。需要时可以手动显示题目。'
                : 'The prompt text is hidden first and plays automatically. Reveal it whenever you need to.'}
            </Text>
            <Pressable style={styles.blindListeningRevealButton} onPress={() => setIsQuestionTextVisible(true)}>
              <MaterialCommunityIcons name="eye-outline" size={16} color="#165a72" />
              <Text style={styles.blindListeningRevealButtonText}>
                {language === 'zh' ? '显示题目' : 'Show question'}
              </Text>
            </Pressable>
          </View>
        ) : isBilingualQuestion ? (
          <>
            <Text style={styles.questionTitle}>{primaryQuestion}</Text>
            <Text style={styles.questionSubtitle}>{secondaryQuestion}</Text>
          </>
        ) : (
          <Text style={styles.questionTitle}>{question.questionEn}</Text>
        )}
      </View>
      {visibleOptions.map((option) => {
        const optionText = {
          primary: option.textEn,
          secondary: isBilingualQuestion ? option.textZh : '',
        };
        const isSelected = selectedOption === option.key;
        const isCorrect = option.isCorrect;
        const isWrongSelected = shouldRevealAnswer && isSelected && !isCorrect;
        return (
          <Pressable
            key={option.key}
            style={[
              styles.optionCard,
              isSelected ? styles.optionCardSelected : null,
              shouldRevealAnswer && isCorrect ? styles.optionCardCorrect : null,
              isWrongSelected ? styles.optionCardWrong : null,
            ]}
            onPress={() => void handleSelectOption(option.key)}
          >
            <Text style={styles.optionKey}>{option.key}</Text>
            <View style={styles.optionCopy}>
              <Text style={styles.optionLabel}>{optionText.primary}</Text>
              {optionText.secondary ? <Text style={styles.optionSecondary}>{optionText.secondary}</Text> : null}
            </View>
            {isSelected ? (
              <View style={styles.optionSelectedMark}>
                <MaterialCommunityIcons
                  name={shouldRevealAnswer && isWrongSelected ? 'close' : 'check'}
                  size={14}
                  color="#ffffff"
                />
              </View>
            ) : null}
          </Pressable>
        );
      })}

      {!isAnswerReviewPreview ? (
        <View style={styles.questionActions}>
          {isNotebookFlow && canGoPrevious ? (
            <Pressable style={styles.questionActionSecondary} onPress={() => onPrevious?.()}>
              <MaterialCommunityIcons name="arrow-left" size={14} color="#6b6d72" />
              <Text style={styles.questionActionSecondaryText}>{previousButtonLabel}</Text>
            </Pressable>
          ) : null}
          {((isNotebookFlow && (allowAdvanceWithoutAnswer || hasChecked)) || (!isNotebookFlow && (shouldUseImmediateAdvance || hasChecked))) ? (
            <Pressable style={styles.questionActionPrimary} onPress={handlePrimaryAction}>
              <Text style={styles.questionActionPrimaryText}>{primaryActionLabel}</Text>
              <MaterialCommunityIcons name="arrow-right" size={14} color="#2a1700" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {shouldRevealAnswer ? (
        <>
          {correctOption ? (
            <View style={styles.correctAnswerCard}>
              <View style={styles.correctAnswerHeaderRow}>
                <Text style={styles.correctAnswerTitle}>{language === 'zh' ? '正确答案' : 'Correct Answer'}</Text>
                <View style={styles.correctAnswerActions}>
                  <Pressable style={styles.answerToolButton} onPress={() => void handleReadCorrectAnswer()}>
                    <MaterialCommunityIcons name="volume-high" size={16} color="#2f6f4e" />
                  </Pressable>
                  <Pressable
                    style={[styles.answerToolButton, recorderState.isRecording && styles.answerToolButtonActive]}
                    onPress={() => void handleToggleRecording()}
                  >
                    <MaterialCommunityIcons
                      name={recorderState.isRecording ? 'stop-circle-outline' : 'microphone-outline'}
                      size={16}
                      color={recorderState.isRecording ? '#ffffff' : '#2f6f4e'}
                    />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.answerToolButton,
                      !hasPlayableRecording && styles.answerToolButtonDisabled,
                      recordingPlayer.playing && styles.answerToolButtonActive,
                    ]}
                    onPress={() => void handlePlayRecording()}
                    disabled={!hasPlayableRecording}
                  >
                    <MaterialCommunityIcons
                      name={recordingPlayer.playing ? 'stop-circle-outline' : 'play-circle-outline'}
                      size={16}
                      color={!hasPlayableRecording ? '#9aa8a0' : recordingPlayer.playing ? '#ffffff' : '#2f6f4e'}
                    />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.correctAnswerBody}>{correctOption.textEn}</Text>
              {isBilingualQuestion ? <Text style={styles.correctAnswerSecondary}>{correctOption.textZh}</Text> : null}
              <Text style={styles.correctAnswerHint}>
                {recorderState.isRecording
                  ? (language === 'zh' ? '正在录音，点一次停止并保存。' : 'Recording now. Tap again to stop and save.')
                  : recordingUri
                    ? (language === 'zh' ? '录音已保存，可以回放检查自己的发音。' : 'Recording saved. Play it back to review your pronunciation.')
                    : (language === 'zh' ? '先听标准答案，再录一遍自己的发音。' : 'Listen to the model answer, then record your own pronunciation.')}
              </Text>
            </View>
          ) : null}
          <View style={styles.explanationCard}>
            <View style={styles.explanationHeaderRow}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color="#855300" />
              <Text style={styles.explanationTitle}>{t.explanation}</Text>
            </View>
            {isBilingualQuestion ? (
              <>
                <Text style={styles.copyBlock}>{question.explanationEn}</Text>
                <Text style={styles.copyBlockMuted}>{question.explanationZh}</Text>
              </>
            ) : (
              <Text style={styles.copyBlock}>{question.explanationEn}</Text>
            )}
            {(question.memoryTipEn || question.memoryTipZh) ? (
              <View style={styles.memoryTipCard}>
                <View style={styles.memoryTipHeaderRow}>
                  <MaterialCommunityIcons name="brain" size={16} color="#6d4e11" />
                  <Text style={styles.memoryTipTitle}>{language === 'zh' ? '记忆提示' : 'Memory Tip'}</Text>
                </View>
                {isBilingualQuestion ? (
                  <>
                    {question.memoryTipEn ? <Text style={styles.memoryTipText}>{question.memoryTipEn}</Text> : null}
                    {question.memoryTipZh ? <Text style={styles.memoryTipTextMuted}>{question.memoryTipZh}</Text> : null}
                  </>
                ) : (
                  <Text style={styles.memoryTipText}>{question.memoryTipEn || question.memoryTipZh}</Text>
                )}
              </View>
            ) : null}
          </View>
        </>
      ) : Boolean(revealExplanation) && hasChecked && !canUsePracticeReview ? (
        <>
          <Pressable style={styles.correctAnswerCardLocked} onPress={() => void openPremiumPurchaseFromPractice()}>
            <View style={styles.correctAnswerHeaderRow}>
              <Text style={styles.correctAnswerTitle}>{language === 'zh' ? '正确答案练习' : 'Correct Answer Practice'}</Text>
              <View style={styles.correctAnswerActions}>
                <View style={[styles.answerToolButton, styles.answerToolButtonDisabled]}>
                  <MaterialCommunityIcons name="volume-high" size={16} color="#9aa8a0" />
                </View>
                <View style={[styles.answerToolButton, styles.answerToolButtonDisabled]}>
                  <MaterialCommunityIcons name="microphone-outline" size={16} color="#9aa8a0" />
                </View>
                <View style={[styles.answerToolButton, styles.answerToolButtonDisabled]}>
                  <MaterialCommunityIcons name="play-circle-outline" size={16} color="#9aa8a0" />
                </View>
              </View>
            </View>
            <Text style={styles.correctAnswerBody}>••••••••••••••••••••••••••••••••</Text>
            {isBilingualQuestion ? <Text style={styles.correctAnswerSecondary}>••••••••••••••••••••••••••••</Text> : null}
            <Text style={styles.correctAnswerHint}>
              {language === 'zh'
                ? '这里会显示标准答案文本、语音播放、录音跟读和回放。'
                : 'This area includes model answer text, playback, recording, and replay tools.'}
            </Text>
            <View style={styles.lockedMaskOverlay}>
              <View style={styles.lockedOverlayRow}>
                <MaterialCommunityIcons name="lock" size={14} color="#7b6b4f" />
                <Text style={styles.lockedOverlayText}>
                  {language === 'zh'
                    ? '此区域已锁定，开通会员后可听标准答案并录音跟读。'
                    : 'Locked for Premium: listen to model answers and record your own response.'}
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable style={[styles.explanationCard, styles.explanationCardLocked]} onPress={() => void openPremiumPurchaseFromPractice()}>
            <View style={styles.explanationHeaderRow}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color="#855300" />
              <Text style={styles.explanationTitle}>{t.explanation}</Text>
              <View style={styles.lockedTagPill}>
                <MaterialCommunityIcons name="lock" size={12} color="#7b6b4f" />
                <Text style={styles.lockedTagPillText}>{language === 'zh' ? '会员解锁完整解析' : 'Premium for full explanation'}</Text>
              </View>
            </View>
            <View style={styles.explanationBlockedBody}>
              <View style={styles.lockedBlurLineWide} />
              <View style={styles.lockedBlurLineWide} />
              <View style={styles.lockedBlurLineNarrow} />
              {isBilingualQuestion ? <View style={styles.lockedBlurHintLine} /> : null}
            </View>
            <View style={styles.memoryTipCardLocked}>
              <View style={styles.memoryTipHeaderRow}>
                <MaterialCommunityIcons name="brain" size={16} color="#7b6b4f" />
                <Text style={styles.memoryTipTitle}>{language === 'zh' ? '记忆提示' : 'Memory Tip'}</Text>
                <View style={styles.memoryTipLockPill}>
                  <MaterialCommunityIcons name="lock" size={11} color="#7b6b4f" />
                  <Text style={styles.memoryTipLockPillText}>{language === 'zh' ? '会员可见' : 'Premium only'}</Text>
                </View>
              </View>
              <View style={styles.memoryTipBlockedBody}>
                <View style={styles.lockedBlurLineWide} />
                <View style={styles.lockedBlurLineNarrow} />
              </View>
            </View>
            <Text style={styles.mockResultExplanationText}>
              {language === 'zh'
                ? '解析内容已全部锁定，开通会员后可查看完整解析与答案区。'
                : 'Explanation is fully locked. Upgrade to unlock the complete explanation and answer sections.'}
            </Text>
          </Pressable>
        </>
      ) : null}
      {Boolean(revealExplanation) && hasChecked ? (
        <PracticeInlineAdSection nativeAd={inlineNativeAd ?? null} language={language} />
      ) : null}
    </View>
  );
}

function buildRoadSignQuizItems(signs: RoadSign[]) {
  const pool = signs.slice();

  return pool.map((sign, index) => {
    const distractors = pool
      .filter((item) => item.id !== sign.id && item.category === sign.category)
      .slice(0, 3);

    if (distractors.length < 3) {
      for (const item of pool) {
        if (item.id !== sign.id && !distractors.find((existing) => existing.id === item.id)) {
          distractors.push(item);
        }
        if (distractors.length === 3) {
          break;
        }
      }
    }

    const options = [sign, ...distractors]
      .slice(0, 4)
      .map((item, optionIndex) => ({
        key: (['A', 'B', 'C', 'D'] as const)[optionIndex],
        primaryEn: item.meaningEn,
        primaryZh: item.meaningZh,
        isCorrect: item.id === sign.id,
      }));

    const rotateBy = index % options.length;
    const rotated = options.map((_, optionIndex) => options[(optionIndex + rotateBy) % options.length]);

    return {
      sign,
      options: rotated.map((option, optionIndex) => ({
        ...option,
        key: (['A', 'B', 'C', 'D'] as const)[optionIndex],
      })),
    };
  });
}

function RoadSignLearningCard({ sign }: { sign: RoadSign }) {
  const language = useAppStore((state) => state.language);

  return (
    <View style={styles.signCard}>
      <RoadSignVisual sign={sign} />
      <Text style={styles.signCardTitle}>{language === 'zh' ? sign.titleZh : sign.titleEn}</Text>
      <Text style={styles.signCardSubtitle}>{language === 'zh' ? sign.titleEn : sign.titleZh}</Text>
      <Text style={styles.signCardMeaning}>{language === 'zh' ? sign.meaningZh : sign.meaningEn}</Text>
    </View>
  );
}

function RoadSignVisual({ sign, large }: { sign: RoadSign; large?: boolean }) {
  const stateCode = useAppStore((state) => state.stateCode);
  const scale = large ? 1.3 : 1;
  const baseSize = 78 * scale;
  const text = sign.titleEn;
  const imageSource = getRoadSignAssetSource(stateCode, sign.id) ?? roadSignAssetMap[sign.id as keyof typeof roadSignAssetMap];

  if (imageSource) {
    return (
      <View style={[styles.signVisualWrap, large ? styles.signVisualWrapLarge : null]}>
        <Image
          source={imageSource}
          style={[
            styles.signImage,
            large ? styles.signImageLarge : null,
          ]}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (sign.shape === 'triangle') {
    return (
      <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
        <View
          style={[
            styles.signTriangleOuter,
            {
              borderLeftWidth: 40 * scale,
              borderRightWidth: 40 * scale,
              borderBottomWidth: 70 * scale,
            },
          ]}
        />
        <View
          style={[
            styles.signTriangleInner,
            {
              top: 9 * scale,
              borderLeftWidth: 29 * scale,
              borderRightWidth: 29 * scale,
              borderBottomWidth: 52 * scale,
            },
          ]}
        />
        <Text style={[styles.signTriangleText, { fontSize: 12 * scale }]} numberOfLines={2}>
          {text}
        </Text>
      </View>
    );
  }

  if (sign.shape === 'diamond') {
    return (
      <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
        <View
          style={[
            styles.signDiamond,
            {
              width: baseSize,
              height: baseSize,
            },
          ]}
        />
        <Text style={[styles.signTextDark, { fontSize: 11 * scale, width: 64 * scale }]} numberOfLines={3}>
          {text}
        </Text>
      </View>
    );
  }

  if (sign.shape === 'circle') {
    return (
      <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
        <View style={[styles.signCircle, { width: baseSize, height: baseSize }]} />
        <Text style={[styles.signTextLight, { fontSize: 11 * scale, width: 60 * scale }]} numberOfLines={3}>
          {text}
        </Text>
      </View>
    );
  }

  if (sign.shape === 'circle-slash') {
    return (
      <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
        <View style={[styles.signCircleSlash, { width: baseSize, height: baseSize }]} />
        <View style={[styles.signSlash, { width: 76 * scale }]} />
        <Text style={[styles.signTextDark, { fontSize: 10 * scale, width: 60 * scale }]} numberOfLines={3}>
          {text}
        </Text>
      </View>
    );
  }

  if (sign.shape === 'pentagon') {
    return (
      <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
        <View style={[styles.signPentagon, { width: baseSize, height: 70 * scale }]} />
        <Text style={[styles.signTextDark, { fontSize: 11 * scale, width: 64 * scale }]} numberOfLines={3}>
          {text}
        </Text>
      </View>
    );
  }

  if (sign.shape === 'crossbuck') {
    return (
      <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
        <View style={[styles.signCrossLine, { width: 78 * scale, transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.signCrossLine, { width: 78 * scale, transform: [{ rotate: '-45deg' }] }]} />
        <Text style={[styles.signCrossText, { fontSize: 10 * scale }]} numberOfLines={2}>
          {text}
        </Text>
      </View>
    );
  }

  if (sign.shape === 'curb') {
    return (
      <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
        <View style={[styles.signCurb, sign.colorTheme === 'red' ? styles.signCurbRed : null, sign.colorTheme === 'green' ? styles.signCurbGreen : null, sign.colorTheme === 'yellow' ? styles.signCurbYellow : null, sign.colorTheme === 'blue' ? styles.signCurbBlue : null, sign.colorTheme === 'white' ? styles.signCurbWhite : null, { width: 90 * scale }]} />
        <Text style={[styles.signCurbLabel, { fontSize: 11 * scale }]}>{text}</Text>
      </View>
    );
  }

  if (sign.shape === 'shield') {
    return (
      <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
        <View style={[styles.signShield, { width: 70 * scale, height: 78 * scale }]} />
        <Text style={[styles.signTextLight, { fontSize: 11 * scale, width: 56 * scale }]} numberOfLines={3}>
          {text}
        </Text>
      </View>
    );
  }

  if (sign.shape === 'panel') {
    return (
      <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
        <View style={[styles.signPanel, { width: 94 * scale, minHeight: 54 * scale }]} />
        <Text style={[styles.signTextLight, { fontSize: 11 * scale, width: 76 * scale }]} numberOfLines={3}>
          {text}
        </Text>
      </View>
    );
  }

  if (sign.shape === 'octagon') {
    return (
      <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
        <View style={[styles.signOctagon, { width: baseSize, height: baseSize }]} />
        <Text style={[styles.signTextLight, { fontSize: 12 * scale, width: 58 * scale }]} numberOfLines={2}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.signVisualWrap, { height: 92 * scale }]}>
      <View style={[styles.signRectangle, { width: 98 * scale, minHeight: 58 * scale }]} />
      <Text style={[styles.signTextDark, { fontSize: 10 * scale, width: 78 * scale }]} numberOfLines={3}>
        {text}
      </Text>
    </View>
  );
}

type RootScreenProps<T extends keyof RootStackParamList> = import('@react-navigation/native-stack').NativeStackScreenProps<RootStackParamList, T>;
type TabScreenProps<T extends keyof TabParamList> = import('@react-navigation/bottom-tabs').BottomTabScreenProps<TabParamList, T>;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fbf9f1',
  },
  screenContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
    borderTopWidth: 6,
    borderTopColor: '#f4efe6',
  },
  screenContentBare: {
    flex: 1,
    borderTopWidth: 0,
    padding: 0,
  },
  onboardingContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 18,
    backgroundColor: '#fbf9f1',
    minHeight: '100%',
  },
  onboardingHeader: {
    gap: 10,
    paddingTop: 8,
    marginBottom: 2,
  },
  onboardingStep: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#f6f4ec',
    color: '#8c775d',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  onboardingTitle: {
    fontSize: 30,
    lineHeight: 34,
    color: '#00091b',
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  onboardingDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(68, 71, 78, 0.8)',
    maxWidth: '92%',
  },
  onboardingBody: {
    gap: 14,
  },
  staticScreenContent: {
    flex: 1,
  },
  header: {
    backgroundColor: '#f8f4ec',
  },
  headerTitle: {
    color: '#172126',
    fontWeight: '700',
  },
  stackHeader: {
    backgroundColor: 'rgba(251, 249, 241, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  stackHeaderRow: {
    minHeight: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackHeaderSide: {
    minWidth: 72,
    justifyContent: 'center',
  },
  stackHeaderRight: {
    alignItems: 'flex-end',
  },
  stackHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#172126',
    fontWeight: '800',
    fontSize: 16,
  },
  headerButton: {
    marginRight: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  headerButtonText: {
    color: '#165a72',
    fontWeight: '700',
    fontSize: 14,
  },
  headerBackButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBackButtonText: {
    color: '#172126',
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '500',
  },
  tabBar: {
    backgroundColor: 'rgba(251, 249, 241, 0.94)',
    borderTopWidth: 0,
    height: 64,
    paddingBottom: 6,
    paddingTop: 3,
    paddingHorizontal: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  tabBarItem: {
    flex: 1,
    marginHorizontal: 0,
    marginVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    minWidth: 0,
  },
  tabBarVisual: {
    minWidth: 54,
    minHeight: 44,
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    backgroundColor: 'transparent',
  },
  tabBarVisualWide: {
    minWidth: 66,
    paddingHorizontal: 8,
  },
  tabBarVisualActive: {
    backgroundColor: '#fea619',
    shadowColor: '#fea619',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    transform: [{ scale: 1 }],
  },
  tabBarLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 0.5,
    marginBottom: 0,
    color: '#746755',
    textAlign: 'center',
  },
  tabBarLabelActive: {
    color: '#2a1700',
    fontWeight: '800',
  },
  heroCard: {
    backgroundColor: '#1b3340',
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  onboardingHeroCard: {
    marginTop: 4,
    paddingTop: 28,
    paddingBottom: 32,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 36,
  },
  eyebrow: {
    color: '#f1d6af',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#fff7ea',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  heroBody: {
    color: '#d7e0e4',
    fontSize: 16,
    lineHeight: 23,
  },
  primaryButton: {
    backgroundColor: '#ca4d2f',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff7ea',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#165a72',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#165a72',
    fontSize: 15,
    fontWeight: '700',
  },
  selectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  selectCardSelected: {
    borderColor: '#f0bd63',
    backgroundColor: '#f7f2e7',
  },
  selectCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectCardCopy: {
    flex: 1,
    paddingRight: 12,
  },
  selectCardTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: '#002045',
  },
  selectCardDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#606470',
    marginTop: 4,
  },
  selectCardCheck: {
    width: 28,
    height: 28,
    minWidth: 28,
    borderRadius: 999,
    backgroundColor: '#fea619',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingWelcomeCard: {
    marginTop: 4,
    backgroundColor: '#1b3340',
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    gap: 12,
  },
  onboardingWelcomeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(254, 166, 25, 0.18)',
  },
  onboardingWelcomeBadgeText: {
    color: '#f1d6af',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  onboardingWelcomeTitle: {
    color: '#fff7ea',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  onboardingWelcomeBody: {
    color: '#d7e0e4',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '92%',
  },
  onboardingWelcomeHighlights: {
    gap: 10,
    paddingTop: 4,
    paddingBottom: 2,
  },
  onboardingWelcomeHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  onboardingWelcomeHighlightText: {
    color: '#fff7ea',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  settingsScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#fbf9f1',
  },
  settingsContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 24,
  },
  settingsSection: {
    gap: 8,
  },
  settingsSectionHeader: {
    gap: 4,
    paddingHorizontal: 2,
  },
  settingsSectionEyebrow: {
    color: 'rgba(0, 32, 69, 0.3)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  settingsSectionBody: {
    color: '#606470',
    fontSize: 14,
    lineHeight: 19,
  },
  settingsOptionGroup: {
    gap: 8,
  },
  settingsOptionCard: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#002045',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  settingsDebugCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  settingsDebugButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  settingsDebugButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#f7f2e7',
    borderWidth: 1,
    borderColor: '#f0bd63',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  settingsDebugButtonText: {
    color: '#8a5a00',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  settingsOptionCardSelected: {
    backgroundColor: 'rgba(0, 32, 69, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(254, 166, 25, 0.5)',
    shadowOpacity: 0,
    elevation: 0,
  },
  settingsOptionCardLocked: {
    backgroundColor: '#f9f1e3',
    borderWidth: 1,
    borderColor: '#dcc8a7',
    shadowOpacity: 0,
    elevation: 0,
  },
  settingsOptionCardLockedEmphasis: {
    borderWidth: 2,
    borderColor: '#d2ad73',
  },
  settingsPremiumStatusCard: {
    backgroundColor: '#fff3dc',
    borderWidth: 1,
    borderColor: '#e6c58a',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsPremiumStatusTitle: {
    color: '#7b4f00',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  settingsOptionCopy: {
    flex: 1,
    gap: 3,
  },
  settingsOptionTitle: {
    color: '#002045',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  settingsOptionTitleLocked: {
    color: '#7b4f00',
  },
  settingsOptionDescription: {
    color: '#606470',
    fontSize: 12,
    lineHeight: 16,
  },
  settingsOptionDescriptionMuted: {
    color: '#8a8d95',
  },
  settingsOptionLockedCta: {
    color: '#9f5f00',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  settingsOptionCheck: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#fea619',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fea619',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  settingsOptionLockPill: {
    height: 26,
    borderRadius: 999,
    backgroundColor: '#ffe7bd',
    borderWidth: 1,
    borderColor: '#e0b367',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
  },
  settingsOptionLockPillText: {
    color: '#7b4f00',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  settingsActionWrap: {
    paddingTop: 2,
  },
  settingsDoneButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fea619',
    shadowColor: '#fea619',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  settingsDoneButtonText: {
    color: '#002045',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  settingsFooter: {
    alignItems: 'center',
    opacity: 0.4,
    paddingTop: 2,
  },
  settingsFooterText: {
    color: '#002045',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  practiceCompleteScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#fbf9f1',
  },
  practiceCompleteContentInner: {
    width: '100%',
    alignSelf: 'center',
    minHeight: '100%',
    gap: 16,
  },
  practiceCompleteStatusSection: {
    gap: 8,
    marginBottom: 0,
  },
  practiceCompleteBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fea619',
    color: '#2a1700',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  practiceCompleteHeadingWrap: {
    gap: 2,
  },
  practiceCompleteTitle: {
    color: '#002045',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  practiceCompleteSubtitle: {
    color: 'rgba(0, 32, 69, 0.4)',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  practiceCompleteSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: 'hidden',
    shadowColor: '#002045',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    gap: 12,
  },
  practiceCompleteOrb: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 221, 184, 0.45)',
    top: -40,
    right: -48,
  },
  practiceCompleteSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  practiceCompleteSummaryLabel: {
    color: '#606470',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 3,
  },
  practiceCompleteScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  practiceCompleteScoreValue: {
    color: '#00091b',
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '900',
  },
  practiceCompleteScoreTotal: {
    color: 'rgba(0, 9, 27, 0.25)',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    marginBottom: 5,
  },
  practiceCompleteAccuracyBlock: {
    alignItems: 'flex-end',
  },
  practiceCompleteAccuracyValue: {
    color: '#855300',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  practiceCompleteSummaryNote: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f6f4ec',
  },
  practiceCompleteSummaryNoteText: {
    color: '#1b1c17',
    fontSize: 14,
    lineHeight: 20,
  },
  practiceCompleteActions: {
    marginTop: 4,
    gap: 8,
    paddingBottom: 4,
  },
  practiceCompletePrimaryButton: {
    width: '100%',
    backgroundColor: '#002045',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceCompletePrimaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  practiceCompleteSecondaryButton: {
    width: '100%',
    backgroundColor: '#e4e3db',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceCompleteSecondaryButtonText: {
    color: '#002045',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  practiceCompleteTertiaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  practiceCompleteTertiaryButtonText: {
    color: 'rgba(0, 32, 69, 0.6)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  mockIntroScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: '#fbf9f1',
  },
  mockIntroContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 18,
  },
  mockIntroHero: {
    gap: 10,
    marginBottom: 2,
  },
  mockIntroTitle: {
    color: '#00091b',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  mockIntroBody: {
    color: '#44474e',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 330,
  },
  mockIntroInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 18,
    shadowColor: '#002045',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  mockIntroInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  mockIntroInfoIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#f0eee6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mockIntroInfoCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  mockIntroInfoTitle: {
    color: '#002045',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  mockIntroInfoValue: {
    color: '#44474e',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  mockIntroInfoDescription: {
    color: '#44474e',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  mockIntroPrimaryButton: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: '#fea619',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowColor: '#002045',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  mockIntroPrimaryButtonDisabled: {
    opacity: 0.75,
  },
  mockIntroPrimaryButtonText: {
    color: '#684000',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  highFrequencyIntroScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: '#fbf9f1',
  },
  highFrequencyIntroContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 18,
  },
  highFrequencyIntroHero: {
    gap: 8,
    marginBottom: 2,
  },
  highFrequencyIntroTitle: {
    color: '#00091b',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  highFrequencyIntroBody: {
    color: 'rgba(68, 71, 78, 0.8)',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: '90%',
  },
  highFrequencyIntroFeatureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 18,
    shadowColor: '#002045',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  highFrequencyIntroFeatureTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  highFrequencyIntroFeatureIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#fea619',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  highFrequencyIntroFeatureCopy: {
    gap: 2,
  },
  highFrequencyIntroFeatureLabel: {
    color: 'rgba(68, 71, 78, 0.6)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  highFrequencyIntroFeatureValue: {
    color: '#00091b',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  highFrequencyIntroFeatureUnit: {
    color: 'rgba(68, 71, 78, 0.5)',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  highFrequencyIntroMetaList: {
    gap: 14,
    paddingTop: 2,
  },
  highFrequencyIntroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  highFrequencyIntroMetaDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#fea619',
    flexShrink: 0,
  },
  highFrequencyIntroMetaCopy: {
    flex: 1,
    gap: 1,
  },
  highFrequencyIntroMetaLabel: {
    color: 'rgba(68, 71, 78, 0.6)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  highFrequencyIntroMetaText: {
    color: '#002045',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  highFrequencyIntroPrimaryButton: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: '#002045',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowColor: '#002045',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  highFrequencyIntroPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  highFrequencyIntroBenefits: {
    gap: 16,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  highFrequencyIntroBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  highFrequencyIntroBenefitText: {
    flex: 1,
    color: '#1b1c17',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  highFrequencyIntroNotice: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#f0eee6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  highFrequencyIntroNoticeText: {
    flex: 1,
    color: '#5d605f',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  handbookHomeScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: '#f7f4ed',
  },
  handbookHomeContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 22,
  },
  handbookHero: {
    gap: 8,
    paddingHorizontal: 2,
  },
  handbookHeroEyebrow: {
    color: '#7b6d59',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  handbookHeroTitle: {
    color: '#00091b',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  handbookHeroBody: {
    color: 'rgba(68, 71, 78, 0.82)',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '94%',
  },
  handbookOfficialList: {
    gap: 12,
  },
  handbookOfficialRow: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    shadowColor: '#002045',
    shadowOpacity: 0.03,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  handbookOfficialRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  handbookOfficialRowNumber: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  handbookOfficialRowNumberText: {
    color: '#12314d',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  handbookOfficialRowCopy: {
    flex: 1,
    gap: 6,
  },
  handbookOfficialRowTitle: {
    color: '#00091b',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  handbookOfficialRowSubtitle: {
    color: '#56534d',
    fontSize: 14,
    lineHeight: 20,
  },
  handbookPreviewList: {
    marginLeft: 48,
    borderTopWidth: 1,
    borderTopColor: 'rgba(220, 205, 183, 0.7)',
    paddingTop: 10,
    gap: 4,
  },
  handbookPreviewRow: {
    minHeight: 38,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  handbookPreviewMain: {
    flex: 1,
    gap: 6,
  },
  handbookPreviewText: {
    color: '#45433f',
    fontSize: 14,
    lineHeight: 20,
  },
  handbookLearnedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#edf6ee',
  },
  handbookLearnedBadgeText: {
    color: '#2f6a44',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  handbookSectionCardTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3efe6',
  },
  handbookSectionCardTagText: {
    color: '#665b4b',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  handbookSectionScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: '#f7f4ed',
  },
  handbookSectionContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 18,
  },
  handbookReaderScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: '#f7f4ed',
  },
  handbookReaderShell: {
    width: '100%',
    alignSelf: 'center',
    gap: 16,
    backgroundColor: '#f7f4ed',
  },
  handbookReaderHeader: {
    gap: 8,
  },
  handbookReaderTitle: {
    color: '#0b1421',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  handbookReaderContentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
    shadowColor: '#002045',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  handbookNativeSection: {
    gap: 14,
    marginTop: 8,
  },
  handbookReaderInlineAd: {
    paddingTop: 2,
    backgroundColor: '#f7f4ed',
  },
  handbookNativeParagraph: {
    color: '#253040',
    fontSize: 17,
    lineHeight: 30,
  },
  handbookNativeFirstParagraph: {
    marginTop: -2,
  },
  handbookNativeHeading: {
    color: '#081426',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 10,
  },
  handbookNativeHeadingSmall: {
    fontSize: 22,
    lineHeight: 27,
    marginTop: 6,
  },
  handbookNativeHeadingFirst: {
    marginTop: 0,
  },
  handbookNativeList: {
    gap: 12,
    paddingTop: 2,
  },
  handbookNativeListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  handbookNativeListMarker: {
    width: 22,
    color: '#12314d',
    fontSize: 16,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  handbookNativeListText: {
    flex: 1,
    color: '#253040',
    fontSize: 17,
    lineHeight: 28,
  },
  handbookNativeNote: {
    backgroundColor: '#f3efe5',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  handbookNativeNoteImportant: {
    backgroundColor: '#f7ebdf',
  },
  handbookNativeNoteLabel: {
    color: '#8a5a1f',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  handbookNativeNoteText: {
    color: '#4a4034',
    fontSize: 15,
    lineHeight: 23,
  },
  handbookNativeImageCard: {
    backgroundColor: '#f7f4ed',
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  handbookNativeTableCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e3dacb',
    backgroundColor: '#fffdf8',
  },
  handbookNativeTableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee4d6',
  },
  handbookNativeTableHeaderRow: {
    borderTopWidth: 0,
    backgroundColor: '#f4efe6',
  },
  handbookNativeTableCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#eee4d6',
  },
  handbookNativeTableText: {
    color: '#253040',
    fontSize: 15,
    lineHeight: 22,
  },
  handbookNativeTableHeaderText: {
    color: '#10263c',
    fontWeight: '800',
  },
  handbookNativeImage: {
    width: '100%',
    height: 220,
  },
  handbookNativeCaption: {
    color: '#6a645a',
    fontSize: 14,
    lineHeight: 19,
  },
  handbookNativeLink: {
    color: '#165a72',
    textDecorationLine: 'underline',
  },
  handbookDetailHero: {
    gap: 10,
  },
  handbookDetailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  handbookDetailNumberPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e6edf5',
  },
  handbookDetailNumberPillText: {
    color: '#12314d',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  handbookDetailTitle: {
    color: '#00091b',
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  handbookDetailSubtitle: {
    color: '#5f5a51',
    fontSize: 15,
    lineHeight: 22,
  },
  handbookIntroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8,
  },
  handbookIntroCardLabel: {
    color: '#7b6d59',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  handbookIntroCardText: {
    color: '#48443f',
    fontSize: 14,
    lineHeight: 21,
  },
  handbookTopicList: {
    gap: 12,
  },
  handbookTopicRow: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  handbookTopicRowCopy: {
    flex: 1,
    gap: 8,
  },
  handbookTopicRowLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  handbookTopicRowIndexBadge: {
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handbookTopicRowIndexText: {
    color: '#12314d',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  handbookTopicRowTitle: {
    color: '#0f1520',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  guideHomeScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: '#fbf9f1',
  },
  guideHomeContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 18,
  },
  guideHero: {
    gap: 8,
    marginBottom: 4,
  },
  guideHeroTitle: {
    color: '#00091b',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  guideHeroBody: {
    color: 'rgba(68, 71, 78, 0.8)',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '90%',
  },
  guideCardList: {
    gap: 14,
  },
  guideHomeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#002045',
    shadowOpacity: 0.03,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    gap: 10,
  },
  guideHomeCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  guideHomeCardTopLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 14,
    minWidth: 0,
  },
  guideHomeCardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  guideHomeCardCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  guideHomeCardTitle: {
    color: '#00091b',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  guideHomeCardBody: {
    color: '#44474e',
    fontSize: 14,
    lineHeight: 19,
  },
  guideHomeCardChevron: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#f0eee6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  guideHomePreviewList: {
    gap: 8,
    paddingLeft: 2,
  },
  guideHomePreviewRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  guideHomePreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  guideHomePreviewDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  guideHomePreviewText: {
    flex: 1,
    color: '#1b1c17',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  guideFootnoteSection: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  guideFootnoteLine: {
    width: 48,
    height: 1,
    backgroundColor: 'rgba(116, 119, 127, 0.3)',
  },
  guideFootnoteText: {
    color: '#6b6d72',
    fontSize: 14,
    lineHeight: 19,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  guideTipCard: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#f6f4ec',
    borderWidth: 1,
    borderColor: 'rgba(196, 198, 207, 0.12)',
  },
  guideTipText: {
    flex: 1,
    color: '#002045',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  guideArticleScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: '#fbf9f1',
  },
  guideArticleContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  guideArticleHero: {
    gap: 6,
  },
  guideArticleTitle: {
    color: '#00091b',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  guideArticleSubtitle: {
    color: 'rgba(68, 71, 78, 0.78)',
    fontSize: 15,
    lineHeight: 21,
  },
  guideArticleSummaryCard: {
    backgroundColor: '#f6f4ec',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  guideArticleSummaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#d6e3ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  guideArticleSummaryText: {
    flex: 1,
    color: '#44474e',
    fontSize: 14,
    lineHeight: 20,
  },
  guideArticleBodyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
    shadowColor: '#002045',
    shadowOpacity: 0.03,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  guideArticleSecondaryCard: {
    backgroundColor: '#f6f4ec',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  guideArticleBodyLabel: {
    color: '#8c775d',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  guideArticleBodyText: {
    color: '#1b1c17',
    fontSize: 15,
    lineHeight: 25,
  },
  guideArticleSecondaryText: {
    color: '#5d605f',
    fontSize: 14,
    lineHeight: 23,
  },
  guideArticleLinkButton: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 18,
    backgroundColor: '#fea619',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  guideArticleLinkButtonText: {
    color: '#002045',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  glossaryScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: '#fbf9f1',
  },
  glossaryContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  glossaryHero: {
    gap: 8,
  },
  glossaryTitle: {
    color: '#00091b',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  glossaryBody: {
    color: 'rgba(68, 71, 78, 0.8)',
    fontSize: 15,
    lineHeight: 22,
  },
  glossaryInfoCard: {
    backgroundColor: '#eef7f1',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  glossaryInfoIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#d9efe3',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  glossaryInfoText: {
    flex: 1,
    color: '#355746',
    fontSize: 14,
    lineHeight: 20,
  },
  glossaryList: {
    gap: 12,
  },
  glossaryFilterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  glossaryFilterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#f1efe7',
  },
  glossaryFilterChipActive: {
    backgroundColor: '#2f6f4e',
  },
  glossaryFilterChipText: {
    color: '#5d605f',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  glossaryFilterChipTextActive: {
    color: '#ffffff',
  },
  glossaryTermCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    shadowColor: '#002045',
    shadowOpacity: 0.03,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  glossaryTermHeader: {
    gap: 8,
  },
  glossaryTermBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  glossaryTermEn: {
    color: '#00091b',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  glossaryTermBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#f6f4ec',
  },
  glossaryTermBadgeText: {
    color: '#5d605f',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  glossaryTermSourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  glossaryTermSourceBadgeReading: {
    backgroundColor: '#d9efe3',
  },
  glossaryTermSourceBadgeWriting: {
    backgroundColor: '#ffedd1',
  },
  glossaryTermSourceBadgeBoth: {
    backgroundColor: '#dfe8ff',
  },
  glossaryTermSourceBadgeText: {
    color: '#244438',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  glossaryTermDefinition: {
    color: '#44474e',
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: '#172126',
    fontWeight: '800',
  },
  sectionDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5a5348',
    marginBottom: 8,
  },
  infoBanner: {
    backgroundColor: '#fbf8f1',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dccdb7',
  },
  infoBannerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#172126',
  },
  infoBannerMeta: {
    fontSize: 14,
    color: '#5a5348',
    marginTop: 4,
  },
  panel: {
    backgroundColor: '#fbf8f1',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dccdb7',
    gap: 8,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#172126',
  },
  panelCopy: {
    color: '#5a5348',
    fontSize: 15,
    lineHeight: 22,
  },
  sectionHeading: {
    gap: 4,
    paddingHorizontal: 2,
  },
  sectionHeadingCompact: {
    gap: 3,
  },
  sectionEyebrow: {
    color: '#8c775d',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  sectionHeadingTitle: {
    color: '#002045',
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
  },
  sectionHeadingDescription: {
    color: '#5a5348',
    fontSize: 14,
    lineHeight: 21,
  },
  homeHeroShell: {
    backgroundColor: '#10283a',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
    gap: 11,
    shadowColor: '#002045',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  homeHeroBackdropOrbOne: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: 'rgba(202, 77, 47, 0.18)',
    top: -52,
    right: -28,
  },
  homeHeroBackdropOrbTwo: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(46, 111, 242, 0.14)',
    bottom: -26,
    left: -24,
  },
  homeHeroProgressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  homeHeroProgressLeft: {
    flex: 1,
    gap: 2,
  },
  homeHeroProgressRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  homeHeroProgressLabel: {
    color: 'rgba(222, 236, 250, 0.9)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  homeHeroMainTitle: {
    color: 'rgba(222, 236, 250, 0.9)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  homeHeroProgressMeta: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  homeHeroModeInline: {
    color: '#d7e0e4',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '700',
  },
  homeHeroScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  homeHeroScorePrefix: {
    color: '#fff8ea',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  homeHeroScoreValue: {
    color: '#fff8ea',
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: -1,
  },
  homeHeroProgressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  homeHeroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#fea619',
  },
  homeHeroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  homeHeroStatChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  homeHeroStatChipCompact: {
    minWidth: 0,
  },
  homeHeroStatLabel: {
    color: '#b9c9d3',
    fontSize: 12,
    lineHeight: 16,
  },
  homeHeroStatValue: {
    color: '#fff8ea',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  homeHeroButtons: {
    gap: 5,
  },
  homeSectionHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 0,
  },
  homeSectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef4fb',
    borderWidth: 1,
    borderColor: 'rgba(0, 32, 69, 0.07)',
  },
  homeSectionTitleWrap: {
    gap: 1,
  },
  homeModulesTitle: {
    color: '#002045',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
  },
  homeSectionCaption: {
    color: 'rgba(0, 32, 69, 0.44)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  homeHeroPrimaryButton: {
    backgroundColor: '#fea619',
    marginTop: 0,
    shadowColor: '#fea619',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  homeHeroPrimaryButtonText: {
    color: '#2a1700',
    fontSize: 13,
    fontWeight: '800',
  },
  homeHeroSecondaryButton: {
    marginTop: 0,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  homeHeroSecondaryButtonText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '700',
  },
  debugStatus: {
    color: '#5a5348',
    fontSize: 13,
    lineHeight: 18,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  debugLabel: {
    color: '#6f6556',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  debugValue: {
    color: '#172126',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'right',
    maxWidth: '58%',
  },
  debugValueMultiline: {
    textAlign: 'right',
  },
  debugDivider: {
    height: 1,
    backgroundColor: '#eadcc7',
  },
  statLine: {
    color: '#253238',
    fontSize: 15,
    lineHeight: 22,
  },
  buttonRow: {
    gap: 8,
  },
  moduleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionCard: {
    width: '48%',
    minHeight: 102,
    borderRadius: 24,
    shadowColor: '#002045',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  actionCardCornerOrb: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 999,
    top: -20,
    right: -16,
  },
  actionCardCornerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 999,
    top: 14,
    right: 14,
  },
  actionCardBody: {
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 8,
    flex: 1,
  },
  actionCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionCardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionCardTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionCardContent: {
    minHeight: 24,
    justifyContent: 'flex-start',
  },
  actionCardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 0.1,
  },
  actionCardTitle: {
    flex: 1,
    color: '#002045',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
  },
  actionCardSubtitle: {
    color: '#5a5348',
    fontSize: 12,
    lineHeight: 16,
  },
  actionCardCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
    maxWidth: 112,
  },
  actionCardCountText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  actionCardBadgePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  actionCardFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionCardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeRecommendationSection: {
    gap: 8,
    paddingBottom: 24,
  },
  homeRecommendationSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeRecommendationSectionAccent: {
    width: 4,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#fea619',
  },
  homeRecommendationSectionTitle: {
    color: '#002045',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    paddingHorizontal: 0,
  },
  homeRecommendationCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: '#002045',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(220, 205, 183, 0.72)',
    borderLeftWidth: 4,
    borderLeftColor: '#fea619',
  },
  homeRecommendationMarkerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  homeRecommendationMarkerDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#fea619',
  },
  homeRecommendationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  homeRecommendationContent: {
    flex: 1,
    gap: 6,
  },
  homeRecommendationEyebrow: {
    color: '#855300',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  homeRecommendationTitle: {
    color: '#002045',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  homeRecommendationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  homeRecommendationAlertWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(254, 166, 25, 0.12)',
  },
  homeRecommendationArrowWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#002045',
  },
  homeRecommendationBody: {
    color: '#5a5348',
    fontSize: 12,
    lineHeight: 16,
  },
  homeScreenContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
    backgroundColor: '#fbf9f1',
  },
  homeContentInner: {
    width: '100%',
    gap: 10,
  },
  listeningScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#fbf9f1',
  },
  listeningContentInner: {
    width: '100%',
    gap: 14,
  },
  remoteUpdateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 19, 30, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 999,
  },
  remoteUpdateCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: '#fffaf0',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 32, 69, 0.08)',
    shadowColor: '#002045',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  remoteUpdateTitle: {
    color: '#002045',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  remoteUpdateBody: {
    color: '#5a5348',
    fontSize: 13,
    lineHeight: 18,
  },
  remoteUpdateProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 32, 69, 0.08)',
    overflow: 'hidden',
  },
  remoteUpdateProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#fea619',
  },
  listeningHero: {
    gap: 6,
  },
  listeningHeroEyebrow: {
    color: '#165a72',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  listeningHeroTitle: {
    color: '#002045',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  listeningHeroBody: {
    color: 'rgba(68, 71, 78, 0.78)',
    fontSize: 14,
    lineHeight: 20,
  },
  listeningMetaText: {
    color: '#6b6d72',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  listeningStatusCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#eef4f7',
    borderWidth: 1,
    borderColor: '#d8e5ea',
    gap: 12,
  },
  listeningStatusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  listeningStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7e4e9',
  },
  listeningStatusChipText: {
    color: '#165a72',
    fontSize: 13,
    fontWeight: '700',
  },
  listeningStatusControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  listeningLanguageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ede8dd',
  },
  listeningLanguageLabel: {
    color: '#5b6771',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  listeningStatusTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(22, 90, 114, 0.1)',
    overflow: 'hidden',
  },
  listeningStatusFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#165a72',
  },
  listeningProgressLabel: {
    color: '#002045',
    fontSize: 15,
    fontWeight: '800',
  },
  listeningProgressRate: {
    color: '#5b6771',
    fontSize: 13,
    lineHeight: 18,
  },
  listeningAutoAdvanceInlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8f4ec',
    borderWidth: 1,
    borderColor: '#ede5d9',
  },
  listeningAutoAdvanceInlineLabel: {
    color: '#002045',
    fontSize: 12,
    fontWeight: '800',
  },
  listeningAutoAdvancePill: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4efe6',
    borderWidth: 1,
    borderColor: '#d8d1c4',
  },
  listeningAutoAdvancePillActive: {
    backgroundColor: '#165a72',
    borderColor: '#165a72',
  },
  listeningAutoAdvancePillText: {
    color: '#6f6b63',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  listeningAutoAdvancePillTextActive: {
    color: '#ffffff',
  },
  listeningCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dccdb7',
    gap: 14,
  },
  listeningTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  listeningContentStack: {
    gap: 14,
  },
  listeningPromptBlock: {
    gap: 8,
  },
  listeningDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listeningDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e4ded1',
  },
  listeningDividerDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#165a72',
  },
  listeningAnswerPanel: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f6fbfd',
    borderWidth: 1,
    borderColor: '#dbe8ed',
    gap: 6,
  },
  listeningHintPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  listeningSectionLabel: {
    color: '#165a72',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  listeningQuestionText: {
    color: '#172126',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  listeningQuestionSecondary: {
    color: '#5b6771',
    fontSize: 14,
    lineHeight: 21,
  },
  listeningAnswerText: {
    color: '#2f6f4e',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  listeningAnswerSecondary: {
    color: '#5a5348',
    fontSize: 14,
    lineHeight: 21,
  },
  listeningAnswerHint: {
    color: '#5a5348',
    fontSize: 13,
    lineHeight: 19,
  },
  listeningNavRow: {
    flexDirection: 'row',
    gap: 10,
  },
  listeningNavButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dccdb7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  listeningNavButtonDisabled: {
    backgroundColor: '#f4f1eb',
    borderColor: '#e7dfd1',
  },
  listeningNavButtonText: {
    color: '#5d605f',
    fontSize: 14,
    fontWeight: '700',
  },
  listeningNavButtonTextDisabled: {
    color: '#a8a39a',
  },
  homeBackdropGrid: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    height: 240,
    opacity: 0.32,
    backgroundColor: 'transparent',
  },
  homeTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  homeTopBarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeTopBarBrandIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#002045',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeTopBarTitle: {
    color: '#002045',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  homeTopBarAction: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidModuleCard: {
    width: '48%',
    minHeight: 172,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 0,
  },
  androidModuleCardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    justifyContent: 'space-between',
    gap: 12,
  },
  androidModuleCardTop: {
    gap: 10,
  },
  androidModuleCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  androidModuleCardTitle: {
    flex: 1,
    color: '#172126',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  androidModuleCardMeta: {
    fontSize: 14,
    fontWeight: '700',
  },
  androidModuleCardSubtitle: {
    color: '#5a5348',
    fontSize: 14,
    lineHeight: 19,
    minHeight: 36,
  },
  androidModuleCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  androidModuleCardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  androidModuleCardBadge: {
    fontSize: 14,
    fontWeight: '700',
  },
  listCard: {
    backgroundColor: '#fbf8f1',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dccdb7',
    gap: 4,
  },
  listCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#172126',
  },
  listCardSubtitle: {
    fontSize: 15,
    color: '#5a5348',
  },
  listCardMeta: {
    fontSize: 14,
    color: '#746755',
    marginTop: 6,
  },
  practiceHomeScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#fbf9f1',
  },
  practiceHomeContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 12,
  },
  practiceHeroSection: {
    gap: 4,
    marginTop: 2,
    marginBottom: 2,
  },
  practiceHeroTitle: {
    color: '#002045',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  practiceHeroBody: {
    color: 'rgba(68, 71, 78, 0.78)',
    fontSize: 14,
    lineHeight: 20,
  },
  practiceChapterAccordionWrap: {
    gap: 0,
    marginBottom: 2,
  },
  practiceChapterAccordionTop: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ece7dc',
  },
  practiceChapterAccordionIcon: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#d6e3ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  practiceChapterAccordionCopy: {
    flex: 1,
    gap: 7,
  },
  practiceChapterAccordionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  practiceChapterAccordionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  practiceChapterAccordionTitle: {
    color: '#002045',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  practiceChapterAccordionCountPill: {
    backgroundColor: '#f0eee6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  practiceChapterAccordionCountText: {
    color: '#2e476e',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  practiceChapterAccordionSubtitle: {
    color: '#6b6d72',
    fontSize: 14,
    lineHeight: 17,
  },
  practiceChapterAccordionMetaPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(214, 227, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  practiceChapterAccordionMetaText: {
    color: '#2e476e',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  practiceChapterAccordionList: {
    backgroundColor: 'rgba(240, 238, 230, 0.45)',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(228, 227, 219, 0.5)',
  },
  practiceChapterListItem: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#002045',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  practiceChapterListItemCopy: {
    flex: 1,
    gap: 2,
  },
  practiceChapterListItemTitle: {
    color: '#00091b',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  practiceChapterListItemSubtitle: {
    color: 'rgba(68, 71, 78, 0.6)',
    fontSize: 10,
    lineHeight: 13,
  },
  practiceChapterListItemMeta: {
    color: 'rgba(68, 71, 78, 0.6)',
    fontSize: 10,
    lineHeight: 13,
  },
  practiceChapterListItemPill: {
    backgroundColor: '#f6f4ec',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 0,
  },
  practiceChapterListItemPillText: {
    color: '#855300',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  practiceChapterListItemPillTextMuted: {
    color: 'rgba(68, 71, 78, 0.3)',
  },
  practiceModeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    shadowColor: '#002045',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  practiceModeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  practiceModeIconWrapCentered: {
    alignSelf: 'center',
  },
  practiceModeCopy: {
    flex: 1,
    gap: 4,
  },
  practiceModeTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  practiceModeTitle: {
    flex: 1,
    color: '#002045',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  practiceModeBody: {
    color: '#5d605f',
    fontSize: 14,
    lineHeight: 18,
  },
  practiceModeTopPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  practiceModeTopPillSoft: {
    backgroundColor: 'rgba(255, 219, 203, 0.4)',
  },
  practiceModeTopPillText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  practiceSignsPreviewRow: {
    marginTop: 6,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 219, 203, 0.2)',
  },
  practiceSignsPreviewHeroImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  practiceModeHotPill: {
    backgroundColor: '#ba1a1a',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  practiceModeHotPillText: {
    color: '#ffffff',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  practiceModeMetaEmphasis: {
    marginTop: 6,
    color: '#ba1a1a',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  practiceMockCard: {
    backgroundColor: '#10283a',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8,
    marginBottom: 8,
  },
  practiceMockEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  practiceMockEyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#fea619',
  },
  practiceMockEyebrow: {
    color: '#fea619',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  practiceMockTitle: {
    color: '#fffaf1',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  practiceMockBody: {
    color: 'rgba(222, 233, 241, 0.74)',
    fontSize: 14,
    lineHeight: 18,
  },
  practiceMockButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
    backgroundColor: '#fea619',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  practiceMockButtonText: {
    color: '#2a1700',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  roadSignIntroScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: '#fbf9f1',
  },
  roadSignIntroContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 18,
  },
  roadSignIntroHero: {
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  roadSignIntroTitle: {
    color: '#00091b',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  roadSignIntroBody: {
    color: '#44474e',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: '88%',
  },
  roadSignIntroSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#002045',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    gap: 14,
  },
  roadSignIntroSummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roadSignIntroSummaryIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roadSignIntroSummaryIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  roadSignIntroSummaryIconBubbleOverlap: {
    marginLeft: -8,
  },
  roadSignIntroSummaryCopy: {
    flex: 1,
    gap: 2,
  },
  roadSignIntroSummaryTitle: {
    color: '#002045',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  roadSignIntroSummarySubtitle: {
    color: '#606470',
    fontSize: 13,
    lineHeight: 16,
  },
  roadSignIntroTagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roadSignIntroTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#f6f4ec',
  },
  roadSignIntroTagText: {
    color: '#44474e',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  roadSignIntroStartButton: {
    width: '100%',
    backgroundColor: '#fea619',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#fea619',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  roadSignIntroStartButtonText: {
    color: '#2a1700',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  roadSignIntroBrowseHeader: {
    gap: 4,
    marginTop: 4,
  },
  roadSignIntroBrowseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  roadSignIntroBrowseTitle: {
    color: '#002045',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  roadSignIntroBrowseCount: {
    color: '#855300',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  roadSignIntroBrowseBody: {
    color: '#44474e',
    fontSize: 13,
    lineHeight: 19,
  },
  roadSignIntroGroups: {
    gap: 22,
  },
  roadSignIntroGroup: {
    gap: 12,
  },
  roadSignIntroGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 2,
  },
  roadSignIntroGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  roadSignIntroGroupHeaderCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  roadSignIntroGroupTitle: {
    color: '#002045',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    flexShrink: 1,
  },
  roadSignIntroGroupMeta: {
    color: 'rgba(68, 71, 78, 0.6)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  roadSignIntroCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  roadSignIntroCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    gap: 8,
  },
  roadSignIntroCardVisual: {
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: '#f6f4ec',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  roadSignIntroCardVisualInner: {
    transform: [{ scale: 0.86 }],
  },
  roadSignIntroCardCopy: {
    paddingHorizontal: 4,
    gap: 2,
  },
  roadSignIntroCardLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#855300',
  },
  roadSignIntroCardTitle: {
    color: '#002045',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '800',
  },
  roadSignIntroCardBody: {
    color: '#44474e',
    fontSize: 11,
    lineHeight: 15,
  },
  signGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  signGroup: {
    gap: 10,
    marginTop: 12,
  },
  signGroupTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2a2117',
  },
  signGroupSubtitle: {
    fontSize: 13,
    color: '#7a6b5f',
    marginTop: -4,
  },
  signCard: {
    width: '48%',
    backgroundColor: '#f7f1e7',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e4d7c2',
    gap: 6,
    alignItems: 'center',
  },
  signCardTitle: {
    color: '#172126',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  signCardSubtitle: {
    color: '#5a5348',
    fontSize: 13,
    textAlign: 'center',
  },
  signCardMeaning: {
    color: '#253238',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  signVisualWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  signVisualWrapLarge: {
    minHeight: 168,
  },
  signImage: {
    width: '100%',
    height: 118,
  },
  signImageLarge: {
    height: 168,
  },
  signRectangle: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#1f1f1f',
  },
  signPanel: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: '#2a6c8a',
    borderWidth: 4,
    borderColor: '#19465a',
  },
  signOctagon: {
    position: 'absolute',
    backgroundColor: '#c93d2c',
    borderWidth: 4,
    borderColor: '#ffffff',
    borderRadius: 18,
    transform: [{ rotate: '22.5deg' }],
  },
  signCircle: {
    position: 'absolute',
    backgroundColor: '#d13f2f',
    borderRadius: 999,
    borderWidth: 4,
    borderColor: '#fff',
  },
  signCircleSlash: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 5,
    borderColor: '#ca4d2f',
  },
  signSlash: {
    position: 'absolute',
    height: 6,
    backgroundColor: '#ca4d2f',
    transform: [{ rotate: '-35deg' }],
  },
  signDiamond: {
    position: 'absolute',
    backgroundColor: '#f7cf55',
    borderWidth: 4,
    borderColor: '#1f1f1f',
    transform: [{ rotate: '45deg' }],
  },
  signPentagon: {
    position: 'absolute',
    backgroundColor: '#f7cf55',
    borderWidth: 4,
    borderColor: '#1f1f1f',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  signTriangleOuter: {
    position: 'absolute',
    top: 3,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#c93d2c',
  },
  signTriangleInner: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff8ef',
  },
  signCrossLine: {
    position: 'absolute',
    height: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1f1f1f',
  },
  signCrossText: {
    color: '#1f1f1f',
    fontWeight: '800',
    textAlign: 'center',
    width: 70,
  },
  signShield: {
    position: 'absolute',
    backgroundColor: '#2d6e88',
    borderColor: '#fff',
    borderWidth: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  signCurb: {
    height: 26,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d9d4cb',
    backgroundColor: '#f3f1eb',
  },
  signCurbRed: {
    backgroundColor: '#cf4632',
    borderColor: '#b23825',
  },
  signCurbGreen: {
    backgroundColor: '#4f8d47',
    borderColor: '#3f6f39',
  },
  signCurbYellow: {
    backgroundColor: '#dbbf48',
    borderColor: '#b79c2f',
  },
  signCurbBlue: {
    backgroundColor: '#4f82bd',
    borderColor: '#38689f',
  },
  signCurbWhite: {
    backgroundColor: '#ffffff',
    borderColor: '#b7b2a7',
  },
  signCurbLabel: {
    color: '#172126',
    fontWeight: '800',
    marginTop: 36,
    textAlign: 'center',
  },
  signTextLight: {
    position: 'absolute',
    color: '#fffdf8',
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  signTextDark: {
    position: 'absolute',
    color: '#1f1f1f',
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  signTriangleText: {
    position: 'absolute',
    top: 28,
    color: '#b62d1c',
    fontWeight: '800',
    textAlign: 'center',
    width: 60,
    textTransform: 'uppercase',
  },
  listCardChip: {
    fontSize: 13,
    color: '#165a72',
    fontWeight: '700',
  },
  notebookPagerWrap: {
    flex: 1,
    marginHorizontal: -20,
  },
  notebookPagerPage: {
    flex: 1,
  },
  notebookPagerScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 2,
  },
  questionCard: {
    backgroundColor: '#fbf9f1',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 8,
    borderWidth: 0,
    gap: 10,
  },
  questionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  questionProgressGroup: {
    flex: 1,
  },
  questionMeta: {
    color: '#746755',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    flex: 1,
  },
  questionNumberTitle: {
    color: '#00091b',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  questionNumberTotal: {
    color: 'rgba(0, 32, 69, 0.2)',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  questionSourceBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: 'rgba(254, 166, 25, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  questionSourceBadgeText: {
    color: '#855300',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  questionHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionSignBlock: {
    alignItems: 'center',
    backgroundColor: '#f0eee6',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  questionSignToggleButton: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#fff2d8',
    borderWidth: 1,
    borderColor: '#f2c879',
    marginTop: 4,
    marginBottom: 2,
  },
  questionSignToggleButtonText: {
    color: '#7a4c00',
    fontSize: 13,
    fontWeight: '700',
  },
  questionIllustrationBlock: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f0eee6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e0dbd0',
  },
  questionIllustrationImage: {
    width: '100%',
    height: '100%',
  },
  questionSignTitle: {
    color: '#172126',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  questionSignSubtitle: {
    color: '#5a5348',
    fontSize: 14,
    textAlign: 'center',
  },
  questionTitle: {
    color: '#00091b',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
  },
  questionPromptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  questionPromptCopy: {
    flex: 1,
    gap: 4,
  },
  blindListeningCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d6d8df',
    backgroundColor: '#f7f9fb',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  blindListeningTitle: {
    color: '#002045',
    fontSize: 15,
    fontWeight: '800',
  },
  blindListeningBody: {
    color: '#5d6570',
    fontSize: 13,
    lineHeight: 19,
  },
  blindListeningRevealButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d6d8df',
  },
  blindListeningRevealButtonText: {
    color: '#165a72',
    fontSize: 13,
    fontWeight: '700',
  },
  questionAudioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  speechRateWrap: {
    position: 'relative',
    alignItems: 'flex-end',
  },
  speechRateButton: {
    minWidth: 68,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8d4c8',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  speechRateButtonActive: {
    backgroundColor: '#165a72',
    borderColor: '#165a72',
  },
  speechRateButtonText: {
    color: '#165a72',
    fontSize: 13,
    fontWeight: '700',
  },
  speechRateButtonTextActive: {
    color: '#ffffff',
  },
  speechRateMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    width: 78,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8d4c8',
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    shadowColor: '#00091b',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  speechRateMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  speechRateMenuItemActive: {
    backgroundColor: '#e7eef1',
  },
  speechRateMenuItemText: {
    color: '#23313a',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  speechRateMenuItemTextActive: {
    color: '#165a72',
  },
  questionReadButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8d4c8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  questionReadButtonActive: {
    backgroundColor: '#165a72',
    borderColor: '#165a72',
  },
  questionSubtitle: {
    color: 'rgba(68, 71, 78, 0.7)',
    fontSize: 14,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: '#eae8e0',
    padding: 4,
    borderRadius: 999,
    transform: [{ scale: 0.9 }],
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  modeChipActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#00091b',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  modeChipText: {
    color: '#6b6d72',
    fontSize: 14,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#002045',
  },
  optionCard: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  optionCardSelected: {
    backgroundColor: '#d6e3ff',
    borderColor: 'rgba(0, 32, 69, 0.05)',
  },
  optionCardCorrect: {
    backgroundColor: '#d6e3ff',
    borderColor: 'rgba(0, 32, 69, 0.05)',
  },
  optionCardWrong: {
    borderColor: '#ca4d2f',
    backgroundColor: '#fff1ee',
  },
  optionKey: {
    width: 16,
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(0, 32, 69, 0.2)',
  },
  optionCopy: {
    flex: 1,
    gap: 1,
  },
  optionLabel: {
    color: '#1b1c17',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  optionSecondary: {
    color: '#6b6d72',
    fontSize: 10,
    lineHeight: 13,
  },
  optionSelectedMark: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#002045',
    alignItems: 'center',
    justifyContent: 'center',
  },
  explanationCard: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#f6f4ec',
    gap: 8,
  },
  explanationCardLocked: {
    position: 'relative',
    overflow: 'hidden',
  },
  memoryTipCard: {
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9efe0',
    borderWidth: 1,
    borderColor: '#e5cba5',
    gap: 4,
  },
  memoryTipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memoryTipTitle: {
    color: '#6d4e11',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  memoryTipText: {
    color: '#4b3d26',
    fontSize: 13,
    lineHeight: 19,
  },
  memoryTipTextMuted: {
    color: '#6f6146',
    fontSize: 12,
    lineHeight: 18,
  },
  memoryTipCardLocked: {
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f3ecdf',
    borderWidth: 1,
    borderColor: '#ddd0b9',
    gap: 6,
  },
  memoryTipLockPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#efe8dc',
    borderWidth: 1,
    borderColor: '#ded2bf',
  },
  memoryTipLockPillText: {
    color: '#7b6b4f',
    fontSize: 10,
    fontWeight: '700',
  },
  memoryTipBlockedBody: {
    opacity: 0.38,
    gap: 8,
  },
  explanationBlockedBody: {
    opacity: 0.36,
    gap: 8,
    marginTop: 2,
  },
  explanationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  questionActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eae8e0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  questionActionSecondaryText: {
    color: '#5d605f',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '800',
  },
  questionActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fea619',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  questionActionPrimaryText: {
    color: '#2a1700',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '800',
  },
  questionSaveIconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00091b',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  inlineAdSection: {
    marginTop: 12,
    gap: 10,
  },
  inlineAdHeader: {
    gap: 2,
    paddingHorizontal: 2,
  },
  inlineAdBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineAdBadge: {
    backgroundColor: '#ca4d2f',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inlineAdBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  inlineAdEyebrow: {
    color: '#165a72',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inlineAdTitle: {
    color: '#172126',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  inlineAdCaption: {
    color: '#746755',
    fontSize: 14,
    lineHeight: 19,
  },
  devAdCard: {
    backgroundColor: '#fff8ef',
    borderWidth: 2,
    borderColor: '#e2a074',
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  devAdStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ca4d2f',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  devAdStatusBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  devAdCopy: {
    gap: 6,
  },
  devAdStatusTitle: {
    color: '#172126',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  devAdStatusBody: {
    color: '#5f5648',
    fontSize: 14,
    lineHeight: 21,
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#172126',
  },
  copyBlock: {
    color: '#253238',
    fontSize: 15,
    lineHeight: 24,
  },
  copyBlockMuted: {
    color: '#746755',
    fontSize: 14,
    lineHeight: 22,
  },
  mockResultScreenShell: {
    flex: 1,
    backgroundColor: '#fbf9f1',
  },
  mockResultScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 156,
    backgroundColor: '#fbf9f1',
  },
  mockResultContentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 26,
  },
  mockResultScoreSection: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  mockResultScoreValue: {
    color: '#00091b',
    fontSize: 64,
    lineHeight: 66,
    fontWeight: '800',
    letterSpacing: -2,
    textAlign: 'center',
  },
  mockResultScoreDivider: {
    color: 'rgba(68, 71, 78, 0.2)',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
  },
  mockResultScoreTotal: {
    color: '#00091b',
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
  },
  mockResultScoreCopy: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 300,
  },
  mockResultStatus: {
    color: '#fea619',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    textAlign: 'center',
  },
  mockResultBody: {
    color: '#44474e',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  mockResultSection: {
    gap: 12,
  },
  mockResultSectionEyebrow: {
    color: '#6b6d72',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 2,
  },
  mockResultCategoryGrid: {
    gap: 10,
  },
  mockResultCategoryCard: {
    backgroundColor: '#f6f4ec',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mockResultCategoryLabel: {
    flex: 1,
    color: '#1b1c17',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  mockResultCategoryPill: {
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: 'center',
  },
  mockResultCategoryPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  mockResultCategoryPillStrong: {
    backgroundColor: '#fea619',
  },
  mockResultCategoryPillStrongText: {
    color: '#684000',
  },
  mockResultCategoryPillMedium: {
    backgroundColor: 'rgba(0, 32, 69, 0.05)',
  },
  mockResultCategoryPillMediumText: {
    color: '#002045',
  },
  mockResultCategoryPillWeak: {
    backgroundColor: 'rgba(186, 26, 26, 0.1)',
  },
  mockResultCategoryPillWeakText: {
    color: '#ba1a1a',
  },
  mockResultWrongSection: {
    gap: 18,
    paddingTop: 4,
  },
  mockResultWrongHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(196, 198, 207, 0.18)',
  },
  mockResultWrongTitle: {
    color: '#00091b',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  mockResultWrongCount: {
    color: 'rgba(68, 71, 78, 0.6)',
    fontSize: 14,
    lineHeight: 17,
  },
  mockResultWrongList: {
    gap: 28,
  },
  mockResultWrongItem: {
    gap: 14,
  },
  mockResultWrongQuestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  mockResultWrongQuestionCopy: {
    flex: 1,
    gap: 12,
  },
  mockResultWrongIndex: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#ba1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mockResultWrongIndexText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  mockResultWrongQuestionText: {
    flex: 1,
    color: '#1b1c17',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
  mockResultWrongImageWrap: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f0eee6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e0dbd0',
  },
  mockResultWrongImage: {
    width: '100%',
    height: '100%',
  },
  mockResultWrongBodyWrap: {
    marginLeft: 44,
    gap: 12,
  },
  mockResultCorrectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(196, 198, 207, 0.12)',
  },
  mockResultCorrectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  mockResultCorrectCopy: {
    flex: 1,
    gap: 3,
  },
  mockResultCorrectLabel: {
    color: 'rgba(68, 71, 78, 0.4)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  mockResultCorrectText: {
    color: '#1b1c17',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  mockResultExplanationCard: {
    backgroundColor: 'rgba(0, 32, 69, 0.05)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  mockResultExplanationLabel: {
    color: 'rgba(0, 32, 69, 0.4)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  mockResultExplanationText: {
    color: '#44474e',
    fontSize: 14,
    lineHeight: 22,
  },
  mockResultActionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 24,
    backgroundColor: 'rgba(251, 249, 241, 0.96)',
    gap: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#002045',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 4,
  },
  mockResultPrimaryButton: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: '#fea619',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mockResultPrimaryButtonDisabled: {
    opacity: 0.78,
  },
  mockResultPrimaryButtonText: {
    color: '#002045',
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '800',
  },
  mockResultSecondaryButton: {
    minHeight: 38,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mockResultSecondaryButtonText: {
    color: 'rgba(0, 32, 69, 0.6)',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fbf8f1',
    borderWidth: 1,
    borderColor: '#dccdb7',
  },
  resultLabel: {
    fontSize: 16,
    color: '#172126',
    fontWeight: '600',
  },
  resultValue: {
    fontSize: 16,
    color: '#165a72',
    fontWeight: '800',
  },
  previewCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#f7f1e7',
  },
  previewBadge: {
    color: '#ca4d2f',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  previewTitle: {
    color: '#172126',
    fontSize: 16,
    fontWeight: '700',
  },
  previewSubtitle: {
    color: '#5a5348',
    fontSize: 15,
    marginTop: 2,
  },
  mockReviewCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#f7f1e7',
    borderWidth: 1,
    borderColor: '#e4d7c2',
    gap: 8,
  },
  correctAnswerCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#edf7f1',
    borderWidth: 1,
    borderColor: '#b8d8c3',
    gap: 4,
  },
  correctAnswerCardLocked: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#f6f3ec',
    borderWidth: 1,
    borderColor: '#d9cfbf',
    gap: 8,
    marginTop: 10,
  },
  lockedBlurLineWide: {
    height: 14,
    borderRadius: 999,
    width: '88%',
    backgroundColor: '#aeb7be',
  },
  lockedBlurLineNarrow: {
    height: 12,
    borderRadius: 999,
    width: '72%',
    backgroundColor: '#bcc4ca',
  },
  lockedBlurHintLine: {
    height: 10,
    borderRadius: 999,
    width: '92%',
    backgroundColor: '#c8ced2',
  },
  correctAnswerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  correctAnswerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  correctAnswerTitle: {
    color: '#2f6f4e',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  correctAnswerBody: {
    color: '#172126',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  correctAnswerSecondary: {
    color: '#5a5348',
    fontSize: 14,
    lineHeight: 20,
  },
  correctAnswerHint: {
    color: '#557460',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  answerToolButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#b8d8c3',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerToolButtonActive: {
    backgroundColor: '#2f6f4e',
    borderColor: '#2f6f4e',
  },
  answerToolButtonDisabled: {
    backgroundColor: '#f3f6f4',
    borderColor: '#d7e5dc',
  },
  lockedOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#efe8dc',
    borderWidth: 1,
    borderColor: '#ded2bf',
  },
  lockedOverlayText: {
    flex: 1,
    color: '#6f6049',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  lockedTagPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#efe8dc',
    borderWidth: 1,
    borderColor: '#ded2bf',
  },
  lockedTagPillText: {
    color: '#7b6b4f',
    fontSize: 10,
    fontWeight: '700',
  },
  lockedMaskOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fbf8f1',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dccdb7',
  },
  settingTitle: {
    fontSize: 18,
    color: '#172126',
    fontWeight: '700',
  },
  settingSubtitle: {
    fontSize: 15,
    color: '#746755',
    marginTop: 4,
  },
});
