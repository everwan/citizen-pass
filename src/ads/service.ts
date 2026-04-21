import {
  AdEventType,
  AdsConsent,
  AdsConsentStatus,
  AppOpenAd,
  InterstitialAd,
  MobileAds,
  NativeAd as GoogleNativeAd,
  TestIds,
} from 'react-native-google-mobile-ads';
import { shouldShowAds } from '../billing/entitlements';
import { getAdmobConfig, setUseTestAds, shouldUseTestAds } from './config';

export type NativeAd = GoogleNativeAd | null;

export type AdsDebugState = {
  useTestAds: boolean;
  canRequestAds: boolean;
  consentCanRequestAds: boolean | null;
  trackingStatus: string | null;
  initialized: boolean;
  appOpenLoaded: boolean;
  appOpenShowing: boolean;
  mockInterstitialLoaded: boolean;
  mockInterstitialLoading: boolean;
  mockInterstitialShowing: boolean;
  nativeLastStatus: 'idle' | 'loading' | 'loaded' | 'error';
  lastError: string | null;
};

const debugState: AdsDebugState = {
  useTestAds: shouldUseTestAds(),
  canRequestAds: false,
  consentCanRequestAds: null,
  trackingStatus: null,
  initialized: false,
  appOpenLoaded: false,
  appOpenShowing: false,
  mockInterstitialLoaded: false,
  mockInterstitialLoading: false,
  mockInterstitialShowing: false,
  nativeLastStatus: 'idle',
  lastError: null,
};

const debugListeners = new Set<() => void>();

let didInitialize = false;
let appOpenEnabled = true;
let appOpenAd: AppOpenAd | null = null;
let appOpenUnsubscribeLoaded: (() => void) | null = null;
let appOpenUnsubscribeError: (() => void) | null = null;
let appOpenUnsubscribeOpened: (() => void) | null = null;
let appOpenUnsubscribeClosed: (() => void) | null = null;

let interstitialAd: InterstitialAd | null = null;
let interstitialUnsubscribeLoaded: (() => void) | null = null;
let interstitialUnsubscribeError: (() => void) | null = null;
let interstitialUnsubscribeOpened: (() => void) | null = null;
let interstitialUnsubscribeClosed: (() => void) | null = null;

function notifyDebugListeners() {
  debugListeners.forEach((listener) => listener());
}

function updateDebugState(patch: Partial<AdsDebugState>) {
  Object.assign(debugState, patch);
  notifyDebugListeners();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getInterstitialUnitId() {
  if (shouldUseTestAds()) {
    return TestIds.INTERSTITIAL;
  }

  return getAdmobConfig().units.interstitial;
}

function getAppOpenUnitId() {
  if (shouldUseTestAds()) {
    return TestIds.APP_OPEN;
  }

  return getAdmobConfig().units.appOpen;
}

function getNativeUnitId() {
  if (shouldUseTestAds()) {
    return TestIds.NATIVE;
  }

  return getAdmobConfig().units.native;
}

function detachAppOpenListeners() {
  appOpenUnsubscribeLoaded?.();
  appOpenUnsubscribeError?.();
  appOpenUnsubscribeOpened?.();
  appOpenUnsubscribeClosed?.();

  appOpenUnsubscribeLoaded = null;
  appOpenUnsubscribeError = null;
  appOpenUnsubscribeOpened = null;
  appOpenUnsubscribeClosed = null;
}

function detachInterstitialListeners() {
  interstitialUnsubscribeLoaded?.();
  interstitialUnsubscribeError?.();
  interstitialUnsubscribeOpened?.();
  interstitialUnsubscribeClosed?.();

  interstitialUnsubscribeLoaded = null;
  interstitialUnsubscribeError = null;
  interstitialUnsubscribeOpened = null;
  interstitialUnsubscribeClosed = null;
}

function prepareAppOpenAd() {
  if (!appOpenEnabled || !shouldShowAds()) {
    return;
  }

  detachAppOpenListeners();
  appOpenAd = AppOpenAd.createForAdRequest(getAppOpenUnitId(), {
    requestNonPersonalizedAdsOnly: true,
  });

  updateDebugState({ appOpenLoaded: false, appOpenShowing: false });

  appOpenUnsubscribeLoaded = appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
    updateDebugState({ appOpenLoaded: true, lastError: null });
  });

  appOpenUnsubscribeOpened = appOpenAd.addAdEventListener(AdEventType.OPENED, () => {
    updateDebugState({ appOpenShowing: true });
  });

  appOpenUnsubscribeClosed = appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
    updateDebugState({ appOpenShowing: false, appOpenLoaded: false });
    prepareAppOpenAd();
  });

  appOpenUnsubscribeError = appOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
    updateDebugState({
      appOpenShowing: false,
      appOpenLoaded: false,
      lastError: error.message,
    });
  });

  appOpenAd.load();
}

function prepareInterstitialAdInternal() {
  if (!shouldShowAds()) {
    return;
  }

  detachInterstitialListeners();
  interstitialAd = InterstitialAd.createForAdRequest(getInterstitialUnitId(), {
    requestNonPersonalizedAdsOnly: true,
  });

  updateDebugState({
    mockInterstitialLoaded: false,
    mockInterstitialLoading: true,
    mockInterstitialShowing: false,
  });

  interstitialUnsubscribeLoaded = interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    updateDebugState({
      mockInterstitialLoaded: true,
      mockInterstitialLoading: false,
      lastError: null,
    });
  });

  interstitialUnsubscribeOpened = interstitialAd.addAdEventListener(AdEventType.OPENED, () => {
    updateDebugState({ mockInterstitialShowing: true });
  });

  interstitialUnsubscribeClosed = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    updateDebugState({
      mockInterstitialShowing: false,
      mockInterstitialLoaded: false,
    });
    prepareInterstitialAdInternal();
  });

  interstitialUnsubscribeError = interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
    updateDebugState({
      mockInterstitialLoading: false,
      mockInterstitialLoaded: false,
      mockInterstitialShowing: false,
      lastError: error.message,
    });
  });

  interstitialAd.load();
}

async function gatherConsent() {
  if (shouldUseTestAds()) {
    updateDebugState({
      canRequestAds: true,
      consentCanRequestAds: true,
      trackingStatus: AdsConsentStatus.NOT_REQUIRED,
    });

    return {
      canRequestAds: true,
      status: AdsConsentStatus.NOT_REQUIRED,
    } as const;
  }

  const consentInfo = await AdsConsent.gatherConsent();
  updateDebugState({
    canRequestAds: consentInfo.canRequestAds,
    consentCanRequestAds: consentInfo.canRequestAds,
    trackingStatus: consentInfo.status,
  });

  return consentInfo;
}

export function getAdsDebugState(): AdsDebugState {
  return { ...debugState };
}

export function subscribeToAdsDebug(listener: () => void) {
  debugListeners.add(listener);
  return () => {
    debugListeners.delete(listener);
  };
}

export async function initializeAds(options?: { enableAppOpen?: boolean }) {
  appOpenEnabled = options?.enableAppOpen ?? true;

  if (!shouldShowAds()) {
    updateDebugState({
      initialized: true,
      canRequestAds: false,
      consentCanRequestAds: false,
      trackingStatus: AdsConsentStatus.NOT_REQUIRED,
      appOpenLoaded: false,
      appOpenShowing: false,
      mockInterstitialLoaded: false,
      mockInterstitialLoading: false,
      mockInterstitialShowing: false,
      nativeLastStatus: 'idle',
      lastError: null,
    });
    return;
  }

  setUseTestAds(shouldUseTestAds());
  updateDebugState({ useTestAds: shouldUseTestAds() });

  try {
    const consentInfo = await gatherConsent();
    if (!consentInfo.canRequestAds) {
      return;
    }

    if (!didInitialize) {
      await MobileAds().initialize();
      didInitialize = true;
    }

    updateDebugState({ initialized: true, lastError: null });
    prepareInterstitialAdInternal();
    prepareAppOpenAd();
  } catch (error) {
    updateDebugState({
      initialized: false,
      lastError: getErrorMessage(error),
    });
  }
}

export async function showMockInterstitialAd() {
  if (!shouldShowAds()) {
    return false;
  }

  if (!interstitialAd) {
    prepareInterstitialAdInternal();
    return false;
  }

  try {
    await interstitialAd.show();
    return true;
  } catch (error) {
    updateDebugState({ lastError: getErrorMessage(error) });
    prepareInterstitialAdInternal();
    return false;
  }
}

export async function prepareMockInterstitialAd() {
  if (!shouldShowAds()) {
    return false;
  }

  if (debugState.mockInterstitialLoaded || debugState.mockInterstitialLoading) {
    return debugState.mockInterstitialLoaded;
  }

  prepareInterstitialAdInternal();
  return false;
}

export async function showPreparedMockInterstitialAd() {
  if (!shouldShowAds() || !interstitialAd || !debugState.mockInterstitialLoaded) {
    return false;
  }

  return showMockInterstitialAd();
}

export async function showAppOpenAdIfAvailable() {
  if (!appOpenEnabled || !shouldShowAds() || !appOpenAd || !debugState.appOpenLoaded || debugState.appOpenShowing) {
    return false;
  }

  try {
    await appOpenAd.show();
    return true;
  } catch (error) {
    updateDebugState({ lastError: getErrorMessage(error) });
    prepareAppOpenAd();
    return false;
  }
}

export async function loadPracticeNativeAd(): Promise<NativeAd> {
  if (!shouldShowAds()) {
    return null;
  }

  await initializeAds({ enableAppOpen: appOpenEnabled });

  if (!getAdsDebugState().canRequestAds) {
    return null;
  }

  updateDebugState({ nativeLastStatus: 'loading' });

  try {
    const nativeAd = await Promise.race([
      GoogleNativeAd.createForAdRequest(getNativeUnitId(), {
        requestNonPersonalizedAdsOnly: true,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Native ad request timed out after 4000ms')), 4000);
      }),
    ]);

    updateDebugState({ nativeLastStatus: 'loaded', lastError: null });
    return nativeAd;
  } catch (error) {
    updateDebugState({
      nativeLastStatus: 'error',
      lastError: getErrorMessage(error),
    });
    return null;
  }
}

export async function reinitializeAdsConsent() {
  AdsConsent.reset();
  didInitialize = false;
  await initializeAds({ enableAppOpen: appOpenEnabled });
}
