import { Platform } from 'react-native';

export const revenueCatConfig = {
  entitlementId: process.env.EXPO_PUBLIC_RC_ENTITLEMENT_ID ?? 'premium',
  offeringId: process.env.EXPO_PUBLIC_RC_OFFERING_ID ?? '',
  iosApiKey: process.env.EXPO_PUBLIC_RC_APPLE_API_KEY ?? '',
  androidApiKey: process.env.EXPO_PUBLIC_RC_GOOGLE_API_KEY ?? '',
} as const;

export function getRevenueCatApiKey() {
  if (Platform.OS === 'ios') {
    return revenueCatConfig.iosApiKey.trim();
  }

  if (Platform.OS === 'android') {
    return revenueCatConfig.androidApiKey.trim();
  }

  return '';
}

export function isBillingSupportedPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function isBillingConfigured() {
  return Boolean(getRevenueCatApiKey());
}
