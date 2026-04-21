import { Directory, File, Paths } from 'expo-file-system';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, digest, digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { Platform } from 'react-native';
import { isAvailableStateCode } from '../data/stateConfig';
import { AppDatabase } from '../db/types';
import { StateCode } from '../types';
import { remoteContentConfig, isRemoteContentConfigured } from './config';
import { getBuiltinBundleId, getBuiltinContentBundles } from './builtin';
import { applyContentBundle, getAppliedContentBundleVersion } from './importer';
import { AppliedRemoteBundle, RemoteContentBundleManifestItem, RemoteContentUpdateCheckResult } from './types';
import { validateRemoteBundlePayload, validateRemoteManifest } from './validation';

const LAST_MANIFEST_CHECK_KEY = 'remoteContent.lastManifestCheckAt';
const MANIFEST_CHECK_INTERVAL_HOURS_KEY = 'remoteContent.checkIntervalHours';
const tempDirectory = new Directory(Paths.cache, 'remote-content');

export async function seedBuiltinContentBundles(db: AppDatabase) {
  for (const bundle of getBuiltinContentBundles()) {
    const bundleId = getBuiltinBundleId(bundle.type, bundle.targetCode as StateCode);
    const existing = await getAppliedContentBundleVersion(db, bundleId);
    if (
      existing?.status === 'applied' &&
      (existing.source === 'remote' || existing.version === bundle.version)
    ) {
      continue;
    }

    await applyContentBundle(db, bundle, {
      bundleId,
      sha256: 'builtin',
      source: 'builtin',
    });
  }
}

export async function checkForRemoteContentUpdates(
  db: AppDatabase,
  appVersion: string
): Promise<RemoteContentUpdateCheckResult> {
  if (Platform.OS === 'web' || !isRemoteContentConfigured()) {
    return {
      appliedBundles: [],
      recommendedBundles: [],
    };
  }

  const manifest = await fetchRemoteManifest(db);
  if (!manifest) {
    return {
      appliedBundles: [],
      recommendedBundles: [],
    };
  }

  const appliedBundles: AppliedRemoteBundle[] = [];
  const recommendedBundles: RemoteContentBundleManifestItem[] = [];

  for (const bundle of manifest.bundles) {
    if (!shouldConsiderBundle(bundle, appVersion)) {
      continue;
    }

    const existing = await getAppliedContentBundleVersion(db, bundle.id);
    if (!shouldDownloadBundle(existing?.version ?? null, bundle.version)) {
      continue;
    }

    if (bundle.updatePolicy.mode === 'recommended') {
      recommendedBundles.push(bundle);
      continue;
    }

    const appliedBundle = await applyRemoteManifestBundle(db, bundle);
    if (appliedBundle) {
      appliedBundles.push(appliedBundle);
    }
  }

  return {
    appliedBundles,
    recommendedBundles,
  };
}

async function fetchRemoteManifest(db: AppDatabase) {
  const manifestUrl = remoteContentConfig.manifestUrl;
  if (!manifestUrl) {
    return null;
  }

  const response = await fetch(manifestUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch remote content manifest: HTTP ${response.status}`);
  }

  const manifest = validateRemoteManifest(await response.json());
  await db.runAsync(
    'INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)',
    LAST_MANIFEST_CHECK_KEY,
    String(Date.now())
  );
  await db.runAsync(
    'INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?)',
    MANIFEST_CHECK_INTERVAL_HOURS_KEY,
    String(manifest.releaseRules.checkIntervalHours)
  );

  return manifest;
}

function shouldConsiderBundle(bundle: RemoteContentBundleManifestItem, _appVersion: string) {
  if (bundle.updatePolicy.mode === 'disabled') {
    return false;
  }

  return true;
}

export async function applyRemoteManifestBundle(db: AppDatabase, bundle: RemoteContentBundleManifestItem) {
  const payload = await downloadAndDecryptBundle(bundle);
  await applyContentBundle(db, payload, {
    bundleId: bundle.id,
    sha256: bundle.sha256,
    source: 'remote',
  });

  if (!isAvailableStateCode(bundle.targetCode)) {
    return null;
  }

  return {
    bundleId: bundle.id,
    type: bundle.type,
    targetCode: bundle.targetCode,
    version: bundle.version,
  } satisfies AppliedRemoteBundle;
}

function shouldDownloadBundle(
  currentVersion: string | null,
  nextVersion: string,
) {
  if (!currentVersion) {
    return true;
  }

  return compareBundleVersions(nextVersion, currentVersion) > 0;
}

async function downloadAndDecryptBundle(bundle: RemoteContentBundleManifestItem) {
  tempDirectory.create({ idempotent: true, intermediates: true });
  const targetFile = new File(tempDirectory, `${bundle.id}-${bundle.version}.enc`);
  if (targetFile.exists) {
    targetFile.delete();
  }

  const downloadedFile = await File.downloadFileAsync(bundle.url, targetFile, { idempotent: true });

  try {
    const encryptedBytes = await downloadedFile.bytes();
    const fileSha256 = await digestToHex(encryptedBytes);
    if (fileSha256 !== bundle.sha256.toLowerCase()) {
      throw new Error(`Remote bundle hash mismatch for ${bundle.id}`);
    }

    const key = await deriveEncryptionKeyFromPassword(remoteContentConfig.password);
    const sealedData = AESSealedData.fromCombined(encryptedBytes);
    const decryptedBytes = await aesDecryptAsync(sealedData, key);
    const payloadText = new TextDecoder().decode(decryptedBytes);
    const payloadJson = JSON.parse(payloadText) as unknown;

    return validateRemoteBundlePayload(payloadJson, bundle.type, bundle.targetCode, bundle.version);
  } finally {
    if (downloadedFile.exists) {
      downloadedFile.delete();
    }
  }
}

async function digestToHex(data: Uint8Array) {
  const normalizedData = Uint8Array.from(data);
  const digestBuffer = await digest(CryptoDigestAlgorithm.SHA256, normalizedData);
  return Array.from(new Uint8Array(digestBuffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveEncryptionKeyFromPassword(password: string) {
  const derivedKeyHex = await digestStringAsync(CryptoDigestAlgorithm.SHA256, password);
  return AESEncryptionKey.import(derivedKeyHex, 'hex');
}

function compareBundleVersions(left: string, right: string) {
  const leftParts = left.split('.').map((part) => Number(part) || 0);
  const rightParts = right.split('.').map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}
