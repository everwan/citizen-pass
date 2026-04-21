import { useAppStore } from '../store/useAppStore';

export const FREE_LISTENING_QUESTION_LIMIT = 10;
export const FREE_DAILY_MOCK_TEST_LIMIT = 3;

export type PremiumFeature =
  | 'remove_ads'
  | 'blind_listening'
  | 'practice_explanations'
  | 'unlimited_listening'
  | 'unlimited_mock_tests';

export function isPremiumUser() {
  return useAppStore.getState().isPremium;
}

export function hasPremiumFeature(_feature: PremiumFeature) {
  return isPremiumUser();
}

export function shouldShowAds() {
  return !hasPremiumFeature('remove_ads');
}

export function canUseBlindListening() {
  return hasPremiumFeature('blind_listening');
}

export function canRevealPracticeExplanations() {
  return hasPremiumFeature('practice_explanations');
}

export function canUseUnlimitedListening() {
  return hasPremiumFeature('unlimited_listening');
}

export function canListenToQuestion(questionIndex: number) {
  return canUseUnlimitedListening() || questionIndex <= FREE_LISTENING_QUESTION_LIMIT;
}

export function canUseUnlimitedMockTests() {
  return hasPremiumFeature('unlimited_mock_tests');
}
