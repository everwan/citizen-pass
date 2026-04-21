import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger, readJsonOptional } from './lib/sync-logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SOURCE_DIR = path.join(rootDir, 'dist', 'uscis-content');
const OUTPUT_DIR = path.join(rootDir, 'dist', 'remote-content');
const BASE_URL = (process.env.CONTENT_BASE_URL ?? 'https://raw.githubusercontent.com/everwan/citizen-pass/main/appdata').replace(/\/$/, '');
const PASSWORD = process.env.CONTENT_PASSWORD ?? '';
const CURRENT_MANIFEST_PATH = path.join(rootDir, 'appdata', 'manifest.json');
const logger = await createLogger('build-remote-content');

if (!PASSWORD) {
  throw new Error('Missing CONTENT_PASSWORD');
}

const sourceFiles = [
  { id: 'question-bank-2008', file: 'uscis2008.json', type: 'question-bank', targetCode: '2008' },
  { id: 'question-bank-2025', file: 'uscis2025.json', type: 'question-bank', targetCode: '2025' },
];

const sourceData = {};
for (const entry of sourceFiles) {
  sourceData[entry.id] = await readJson(path.join(SOURCE_DIR, entry.file));
}

const currentManifest = await readJsonOptional(CURRENT_MANIFEST_PATH);
const manifest = {
  schemaVersion: 1,
  publishedAt: new Date().toISOString(),
  releaseRules: currentManifest?.releaseRules ?? {
    checkIntervalHours: 12,
    maxParallelDownloads: 1,
    fallbackToBuiltinOnFailure: true,
  },
  bundles: [],
};

await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const deploymentFiles = ['manifest.json'];
const currentBundleMap = new Map((currentManifest?.bundles ?? []).map((bundle) => [bundle.id, bundle]));
const bundleReports = [];

for (const entry of sourceFiles) {
  const data = sourceData[entry.id];
  const contentVersion = buildContentVersion(data);
  const payload = {
    ...data,
    type: entry.type,
    targetCode: entry.targetCode,
    version: contentVersion,
  };
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = encryptDeterministic(plaintext, PASSWORD, entry.id, contentVersion);
  const fileName = `${entry.id}.enc`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  await fs.writeFile(filePath, encrypted);

  const sha256 = sha256Hex(encrypted);
  const manifestBundle = currentBundleMap.get(entry.id) ?? {
    id: entry.id,
    type: entry.type,
    targetCode: entry.targetCode,
    updatePolicy: {
      mode: 'recommended',
      wifiOnly: false,
      retryable: true,
      forceReloadAfterApply: true,
    },
  };

  manifest.bundles.push({
    ...manifestBundle,
    version: contentVersion,
    url: `${BASE_URL}/${fileName}`,
    sha256,
  });

  bundleReports.push({
    id: entry.id,
    targetCode: entry.targetCode,
    previousVersion: manifestBundle.version ?? null,
    nextVersion: contentVersion,
    previousSha256: manifestBundle.sha256 ?? null,
    nextSha256: sha256,
    changed: manifestBundle.version !== contentVersion || manifestBundle.sha256 !== sha256,
    sourceFile: entry.file,
    outputFile: fileName,
  });

  deploymentFiles.push(fileName);
}

for (const bundle of currentManifest?.bundles ?? []) {
  if (bundle.id === 'question-bank-2008' || bundle.id === 'question-bank-2025') {
    continue;
  }

  manifest.bundles.push(bundle);
}

await fs.writeFile(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(OUTPUT_DIR, 'DEPLOY_FILES.txt'), `${deploymentFiles.join('\n')}\n`);
await logger.writeJson('remote-content-report.json', {
  generatedAt: new Date().toISOString(),
  outputDir: OUTPUT_DIR,
  deploymentFiles,
  bundles: bundleReports,
});
await logger.info('Remote content manifest built', {
  outputDir: OUTPUT_DIR,
  deploymentFilesCount: deploymentFiles.length,
  changedBundles: bundleReports.filter((bundle) => bundle.changed).map((bundle) => bundle.id),
});

console.log(`Remote content written to ${OUTPUT_DIR}`);
console.log('Deploy these files:');
for (const file of deploymentFiles) {
  console.log(`- ${file}`);
}

function buildContentVersion(data) {
  const base = data.testUpdatesReviewedDate ?? data.bundleVersion ?? new Date().toISOString().slice(0, 10);
  const comparable = {
    ...data,
  };
  delete comparable.generatedAt;
  delete comparable.bundleVersion;
  delete comparable.testUpdatesReviewedDate;
  delete comparable.testUpdatesSourceUrl;
  const hash = sha256Hex(Buffer.from(JSON.stringify(comparable), 'utf8')).slice(0, 8);
  return `${base}-${hash}`;
}

function encryptDeterministic(plaintext, password, bundleId, version) {
  const key = crypto.createHash('sha256').update(password, 'utf8').digest();
  const iv = crypto
    .createHash('sha256')
    .update(`${password}|${bundleId}|${version}|${plaintext.toString('base64')}`)
    .digest()
    .subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]);
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}
