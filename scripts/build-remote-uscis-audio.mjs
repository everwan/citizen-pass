import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger, readJsonOptional } from './lib/sync-logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const HASH_MANIFEST_PATH = path.join(rootDir, 'assets', 'audio', 'uscis', '_meta', 'azure-audio-hashes.json');
const OUTPUT_DIR = path.join(rootDir, 'dist', 'remote-audio');
const BASE_URL = (process.env.USCIS_AUDIO_BASE_URL ?? 'https://raw.githubusercontent.com/everwan/citizen-pass/main/appdata/audio/uscis').replace(/\/$/, '');
const CURRENT_MANIFEST_PATH = path.join(rootDir, 'appdata', 'audio', 'manifest.json');
const logger = await createLogger('build-remote-uscis-audio');

const hashManifest = await readJson(HASH_MANIFEST_PATH);
const currentManifest = await readJsonOptional(CURRENT_MANIFEST_PATH);
const outputManifest = {
  schemaVersion: 1,
  publishedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  generator: hashManifest.generator || 'azure-tts',
  files: [],
};

const deploymentFiles = ['manifest.json'];
const currentFileMap = new Map((currentManifest?.files ?? []).map((file) => [file.key, file]));
const fileReports = [];

for (const [questionId, entry] of Object.entries(hashManifest.entries ?? {})) {
  const questionPath = path.join(rootDir, 'assets', 'audio', 'uscis', entry.versionCode, 'questions', entry.questionFile);
  const answerPath = path.join(rootDir, 'assets', 'audio', 'uscis', entry.versionCode, 'answers', entry.answerFile);
  if (!(await exists(questionPath)) || !(await exists(answerPath))) {
    continue;
  }

  const questionFile = {
    key: `question:${questionId}`,
    questionId,
    kind: 'question',
    targetCode: entry.versionCode,
    file: `${entry.versionCode}/questions/${entry.questionFile}`,
    url: `${BASE_URL}/${entry.versionCode}/questions/${entry.questionFile}`,
    sha256: await fileSha256(questionPath),
  };
  const answerFile = {
    key: `answer:${questionId}`,
    questionId,
    kind: 'answer',
    targetCode: entry.versionCode,
    file: `${entry.versionCode}/answers/${entry.answerFile}`,
    url: `${BASE_URL}/${entry.versionCode}/answers/${entry.answerFile}`,
    sha256: await fileSha256(answerPath),
  };

  outputManifest.files.push(questionFile, answerFile);
  deploymentFiles.push(questionFile.file, answerFile.file);

  for (const file of [questionFile, answerFile]) {
    const previous = currentFileMap.get(file.key);
    fileReports.push({
      key: file.key,
      questionId,
      kind: file.kind,
      previousSha256: previous?.sha256 ?? null,
      nextSha256: file.sha256,
      changed: previous?.sha256 !== file.sha256,
      file: file.file,
    });
  }
}

await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });
await fs.writeFile(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(outputManifest, null, 2)}\n`);
await fs.writeFile(path.join(OUTPUT_DIR, 'DEPLOY_FILES.txt'), `${deploymentFiles.join('\n')}\n`);
await logger.writeJson('remote-audio-report.json', {
  generatedAt: new Date().toISOString(),
  outputDir: OUTPUT_DIR,
  deploymentFiles,
  files: fileReports,
});
await logger.info('Remote audio manifest built', {
  outputDir: OUTPUT_DIR,
  totalFiles: outputManifest.files.length,
  changedFiles: fileReports.filter((file) => file.changed).length,
});

console.log(`Remote audio written to ${OUTPUT_DIR}`);
console.log('Deploy these files:');
for (const file of deploymentFiles) {
  console.log(`- ${file}`);
}

async function fileSha256(filePath) {
  const data = await fs.readFile(filePath);
  return cryptoHash(data);
}

function cryptoHash(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
