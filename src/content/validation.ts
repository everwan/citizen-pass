import { validateStateQuestionBank } from '../data/question-bank';
import { isAvailableStateCode } from '../data/stateConfig';
import { StateQuestionBank } from '../data/question-bank/types';
import { StateCode } from '../types';
import {
  RemoteBundlePayload,
  RemoteContentBundleManifestItem,
  RemoteContentManifest,
  RemoteGlossaryBundle,
  RemoteGuideBundle,
  RemoteQuestionBankBundle,
  RemoteUpdateMode,
} from './types';

const allowedBundleTypes = new Set(['question-bank', 'guide', 'glossary']);
const allowedUpdateModes = new Set<RemoteUpdateMode>(['silent', 'recommended', 'required', 'disabled']);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validateRemoteManifest(input: unknown): RemoteContentManifest {
  if (!input || typeof input !== 'object') {
    throw new Error('Remote manifest must be an object');
  }

  const manifest = input as Partial<RemoteContentManifest>;

  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported remote manifest schemaVersion: ${String(manifest.schemaVersion)}`);
  }

  if (typeof manifest.publishedAt !== 'string' || manifest.publishedAt.length === 0) {
    throw new Error('Remote manifest is missing publishedAt');
  }

  if (!manifest.releaseRules || typeof manifest.releaseRules !== 'object') {
    throw new Error('Remote manifest is missing releaseRules');
  }

  if (!Array.isArray(manifest.bundles)) {
    throw new Error('Remote manifest bundles must be an array');
  }

  return {
    schemaVersion: manifest.schemaVersion,
    publishedAt: manifest.publishedAt,
    releaseRules: {
      checkIntervalHours: Number(manifest.releaseRules.checkIntervalHours) || 12,
      maxParallelDownloads: Number(manifest.releaseRules.maxParallelDownloads) || 1,
      fallbackToBuiltinOnFailure: manifest.releaseRules.fallbackToBuiltinOnFailure !== false,
    },
    bundles: manifest.bundles.map(validateRemoteManifestBundle),
  };
}

export function validateRemoteManifestBundle(input: unknown): RemoteContentBundleManifestItem {
  if (!input || typeof input !== 'object') {
    throw new Error('Remote bundle manifest item must be an object');
  }

  const bundle = input as Partial<RemoteContentBundleManifestItem>;

  if (typeof bundle.id !== 'string' || bundle.id.length === 0) {
    throw new Error('Remote bundle is missing id');
  }

  if (typeof bundle.type !== 'string' || !allowedBundleTypes.has(bundle.type)) {
    throw new Error(`Remote bundle "${bundle.id}" has unsupported type "${String(bundle.type)}"`);
  }

  if (typeof bundle.targetCode !== 'string' || !isAvailableStateCode(bundle.targetCode)) {
    throw new Error(`Remote bundle "${bundle.id}" has unsupported targetCode "${String(bundle.targetCode)}"`);
  }

  if (typeof bundle.version !== 'string' || bundle.version.length === 0) {
    throw new Error(`Remote bundle "${bundle.id}" is missing version`);
  }

  if (typeof bundle.url !== 'string' || bundle.url.length === 0) {
    throw new Error(`Remote bundle "${bundle.id}" is missing url`);
  }

  if (typeof bundle.sha256 !== 'string' || bundle.sha256.length === 0) {
    throw new Error(`Remote bundle "${bundle.id}" is missing sha256`);
  }

  const mode = bundle.updatePolicy?.mode;
  if (!mode || !allowedUpdateModes.has(mode)) {
    throw new Error(`Remote bundle "${bundle.id}" has unsupported update mode "${String(mode)}"`);
  }

  return {
    id: bundle.id,
    type: bundle.type,
    targetCode: bundle.targetCode,
    version: bundle.version,
    url: bundle.url,
    sha256: bundle.sha256.toLowerCase(),
    updatePolicy: {
      mode,
      wifiOnly: bundle.updatePolicy?.wifiOnly ?? false,
      retryable: bundle.updatePolicy?.retryable ?? true,
      forceReloadAfterApply: bundle.updatePolicy?.forceReloadAfterApply ?? (bundle.type === 'question-bank'),
    },
  };
}

export function validateRemoteBundlePayload(
  input: unknown,
  expectedType: RemoteContentBundleManifestItem['type'],
  expectedTargetCode: string,
  expectedVersion: string
): RemoteBundlePayload {
  if (!input || typeof input !== 'object') {
    throw new Error('Remote bundle payload must be an object');
  }

  const payload = input as Partial<RemoteBundlePayload>;

  if (payload.type !== expectedType) {
    throw new Error(`Remote bundle type mismatch: expected ${expectedType}, received ${String(payload.type)}`);
  }

  if (payload.targetCode !== expectedTargetCode) {
    throw new Error(`Remote bundle targetCode mismatch: expected ${expectedTargetCode}, received ${String(payload.targetCode)}`);
  }

  if (payload.version !== expectedVersion) {
    throw new Error(`Remote bundle version mismatch: expected ${expectedVersion}, received ${String(payload.version)}`);
  }

  if (payload.type === 'question-bank') {
    return validateRemoteQuestionBankBundle(payload);
  }

  if (payload.type === 'guide') {
    return validateRemoteGuideBundle(payload as Partial<RemoteGuideBundle>);
  }

  return validateRemoteGlossaryBundle(payload as Partial<RemoteGlossaryBundle>);
}

function validateRemoteQuestionBankBundle(input: Partial<RemoteQuestionBankBundle>): RemoteQuestionBankBundle {
  if (!Array.isArray(input.categories) || !input.questionsByCategory || typeof input.questionsByCategory !== 'object') {
    throw new Error('Remote question-bank payload is missing categories/questionsByCategory');
  }

  if (!isStringArray(input.highFrequencyQuestionIds) || !isStringArray(input.mockQuestionIds)) {
    throw new Error('Remote question-bank payload is missing question sets');
  }

  validateStateQuestionBank(input.targetCode as StateCode, input as StateQuestionBank);
  return input as RemoteQuestionBankBundle;
}

function validateRemoteGuideBundle(input: Partial<RemoteGuideBundle>): RemoteGuideBundle {
  if (!Array.isArray(input.guideArticles)) {
    throw new Error('Remote guide payload is missing guideArticles');
  }

  return input as RemoteGuideBundle;
}

function validateRemoteGlossaryBundle(input: Partial<RemoteGlossaryBundle>): RemoteGlossaryBundle {
  if (!Array.isArray(input.glossaryTerms)) {
    throw new Error('Remote glossary payload is missing glossaryTerms');
  }

  return input as RemoteGlossaryBundle;
}
