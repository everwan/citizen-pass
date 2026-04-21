import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  CustomerInfoUpdateListener,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
  PURCHASES_ERROR_CODE,
  PurchasesError,
} from 'react-native-purchases';
import { isBillingConfigured, isBillingSupportedPlatform, revenueCatConfig, getRevenueCatApiKey } from './config';

export type PremiumProduct = {
  id: string;
  title: string;
  description: string;
  priceString: string;
  packageType: string;
  rcPackage: PurchasesPackage;
};

export type BillingErrorCode =
  | 'network'
  | 'store-unavailable'
  | 'purchase-not-allowed'
  | 'already-owned'
  | 'invalid-offering'
  | 'configuration'
  | 'unknown';

let didConfigureBilling = false;

function isCancellationError(error: unknown) {
  const purchasesError = error as PurchasesError | undefined;
  return purchasesError?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || purchasesError?.userCancelled === true;
}

export function classifyBillingError(error: unknown): BillingErrorCode {
  const purchasesError = error as PurchasesError | undefined;

  switch (purchasesError?.code) {
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
      return 'network';
    case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
      return 'store-unavailable';
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
      return 'purchase-not-allowed';
    case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
    case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
      return 'already-owned';
    case PURCHASES_ERROR_CODE.CONFIGURATION_ERROR:
      return 'configuration';
    case PURCHASES_ERROR_CODE.INVALID_RECEIPT_ERROR:
      return 'invalid-offering';
    default:
      return 'unknown';
  }
}

function scorePremiumProduct(product: PremiumProduct) {
  const packageType = product.packageType.trim().toLowerCase();
  const id = product.id.trim().toLowerCase();
  const title = product.title.trim().toLowerCase();

  if (
    packageType.includes('lifetime')
    || packageType.includes('lifetime')
    || id.includes('lifetime')
    || id.includes('forever')
    || id.includes('one_time')
    || title.includes('lifetime')
    || title.includes('终身')
  ) {
    return 300;
  }

  if (packageType.includes('annual') || packageType.includes('year') || id.includes('year') || id.includes('annual')) {
    return 200;
  }

  if (packageType.includes('monthly') || packageType.includes('month') || id.includes('month')) {
    return 100;
  }

  return 0;
}

export function pickPreferredPremiumProduct(products: PremiumProduct[]) {
  if (products.length === 0) {
    return null;
  }

  return [...products]
    .sort((left, right) => scorePremiumProduct(right) - scorePremiumProduct(left))[0];
}

export function customerInfoHasPremium(customerInfo: CustomerInfo | null | undefined) {
  if (!customerInfo) {
    return false;
  }

  return typeof customerInfo.entitlements.active[revenueCatConfig.entitlementId] !== 'undefined';
}

export async function initializeBilling() {
  if (!isBillingSupportedPlatform() || !isBillingConfigured()) {
    return false;
  }

  if (didConfigureBilling) {
    return true;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
  Purchases.configure({
    apiKey: getRevenueCatApiKey(),
  });
  didConfigureBilling = true;
  return true;
}

export async function getCustomerPremiumStatus() {
  if (!(await initializeBilling())) {
    return false;
  }

  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfoHasPremium(customerInfo);
}

function mapOfferingToPremiumProducts(offering: PurchasesOffering | null): PremiumProduct[] {
  if (!offering) {
    return [];
  }

  return offering.availablePackages.map((pkg) => ({
    id: pkg.identifier,
    title: pkg.product.title,
    description: pkg.product.description,
    priceString: pkg.product.priceString,
    packageType: pkg.packageType,
    rcPackage: pkg,
  }));
}

export async function getPremiumProducts() {
  if (!(await initializeBilling())) {
    return [];
  }

  const offerings = await Purchases.getOfferings();
  const configuredOffering = revenueCatConfig.offeringId.trim()
    ? offerings.all[revenueCatConfig.offeringId.trim()] ?? null
    : offerings.current;

  return mapOfferingToPremiumProducts(configuredOffering ?? offerings.current)
    .sort((left, right) => scorePremiumProduct(right) - scorePremiumProduct(left));
}

export async function purchasePremiumProduct(product: PremiumProduct) {
  if (!(await initializeBilling())) {
    throw new Error('Billing is not configured.');
  }

  try {
    const result = await Purchases.purchasePackage(product.rcPackage);
    return {
      isPremium: customerInfoHasPremium(result.customerInfo),
      cancelled: false,
    };
  } catch (error) {
    if (isCancellationError(error)) {
      return {
        isPremium: false,
        cancelled: true,
      };
    }
    throw error;
  }
}

export async function restorePurchases() {
  if (!(await initializeBilling())) {
    throw new Error('Billing is not configured.');
  }

  const customerInfo = await Purchases.restorePurchases();
  return customerInfoHasPremium(customerInfo);
}

export async function subscribeToBillingUpdates(listener: (isPremium: boolean) => void) {
  if (!(await initializeBilling())) {
    return () => {};
  }

  const updateListener: CustomerInfoUpdateListener = (customerInfo) => {
    listener(customerInfoHasPremium(customerInfo));
  };

  Purchases.addCustomerInfoUpdateListener(updateListener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(updateListener);
  };
}

export function getBillingSetupInstructions(language: 'en' | 'zh') {
  const platformLabel = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'mobile';

  return language === 'zh'
    ? `请先配置 RevenueCat 的 ${platformLabel} Public SDK Key，并在环境变量中设置 EXPO_PUBLIC_RC_APPLE_API_KEY / EXPO_PUBLIC_RC_GOOGLE_API_KEY。`
    : `Add your RevenueCat ${platformLabel} public SDK key first by setting EXPO_PUBLIC_RC_APPLE_API_KEY / EXPO_PUBLIC_RC_GOOGLE_API_KEY.`;
}
