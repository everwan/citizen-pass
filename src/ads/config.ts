import { Platform } from 'react-native';
import * as Device from 'expo-device';

const TestIds = {
  NATIVE: 'ca-app-pub-3940256099942544/3986624511',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/4411468910',
  APP_OPEN: 'ca-app-pub-3940256099942544/5575463023',
} as const;

const FORCE_TEST_ADS_ON_DEVICE = false;

function getDefaultUseTestAds() {
  return __DEV__ || !Device.isDevice || FORCE_TEST_ADS_ON_DEVICE;
}

let useTestAds: boolean = getDefaultUseTestAds();

const IOS_ADMOB_IDS = {
  appId: 'ca-app-pub-7590040796933885~2901545443',
  units: {
    native: 'ca-app-pub-7590040796933885/9539708620',
    interstitial: 'ca-app-pub-7590040796933885/4708077981',
    appOpen: 'ca-app-pub-7590040796933885/1318451135',
  },
} as const;

const ANDROID_ADMOB_IDS = {
  appId: 'ca-app-pub-7590040796933885~9821994860',
  units: {
    native: 'ca-app-pub-7590040796933885/9715452570',
    interstitial: 'ca-app-pub-7590040796933885/3853851883',
    appOpen: 'ca-app-pub-7590040796933885/8034705245',
  },
} as const;

function getPlatformIds() {
  return Platform.OS === 'android' ? ANDROID_ADMOB_IDS : IOS_ADMOB_IDS;
}

function resolveUnitId(testId: string, productionId: string) {
  return useTestAds ? testId : productionId;
}

export function setUseTestAds(value: boolean) {
  useTestAds = value;
}

export function shouldUseTestAds() {
  return useTestAds;
}

export function getAdmobConfig() {
  const platformIds = getPlatformIds();

  return {
    useTestAds,
    platform: Platform.OS,
    appId: platformIds.appId,
    units: {
      native: resolveUnitId(TestIds.NATIVE, platformIds.units.native),
      interstitial: resolveUnitId(TestIds.INTERSTITIAL, platformIds.units.interstitial),
      appOpen: resolveUnitId(TestIds.APP_OPEN, platformIds.units.appOpen),
    },
    nativeBreakInterval: 8,
    trackingDescription:
      'We use your data to support ads and keep Citizen Pass study content available for free.',
  } as const;
}
