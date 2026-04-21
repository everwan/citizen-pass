import { create } from 'zustand';
import * as Localization from 'expo-localization';
import i18n from '../i18n';
import { LanguageCode, QuestionDisplayMode, StateCode, StudyMode } from '../types';
import { defaultStateCode } from '../data/stateConfig';

export type AppState = {
  hasCompletedOnboarding: boolean;
  isPremium: boolean;
  language: LanguageCode;
  stateCode: StateCode;
  contentRevision: number;
  studyMode: StudyMode;
  questionDisplayMode: QuestionDisplayMode;
  speechRate: number;
  blindListeningEnabled: boolean;
  remindersEnabled: boolean;
  setLanguage: (language: LanguageCode) => void;
  setStateCode: (stateCode: StateCode) => void;
  setStudyMode: (mode: StudyMode) => void;
  setQuestionDisplayMode: (mode: QuestionDisplayMode) => void;
  setSpeechRate: (value: number) => void;
  setBlindListeningEnabled: (value: boolean) => void;
  setRemindersEnabled: (value: boolean) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  setIsPremium: (value: boolean) => void;
  bumpContentRevision: () => void;
  completeOnboarding: () => void;
};

const deviceLanguage = Localization.getLocales()[0]?.languageCode === 'zh' ? 'zh' : 'en';
const defaultStudyMode: StudyMode = deviceLanguage === 'zh' ? 'zh-first' : 'en-first';

export const useAppStore = create<AppState>((set) => ({
  hasCompletedOnboarding: false,
  isPremium: false,
  language: deviceLanguage,
  stateCode: defaultStateCode,
  contentRevision: 0,
  studyMode: defaultStudyMode,
  questionDisplayMode: 'english',
  speechRate: 1,
  blindListeningEnabled: false,
  remindersEnabled: true,
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    set({ language });
  },
  setStateCode: (stateCode) => set({ stateCode }),
  setStudyMode: (studyMode) => set({ studyMode }),
  setQuestionDisplayMode: (questionDisplayMode) => set({ questionDisplayMode }),
  setSpeechRate: (speechRate) => set({ speechRate }),
  setBlindListeningEnabled: (blindListeningEnabled) => set({ blindListeningEnabled }),
  setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
  setHasCompletedOnboarding: (hasCompletedOnboarding) => set({ hasCompletedOnboarding }),
  setIsPremium: (isPremium) => set({ isPremium }),
  bumpContentRevision: () => set((state) => ({ contentRevision: state.contentRevision + 1 })),
  completeOnboarding: () => set({ hasCompletedOnboarding: true }),
}));
