import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from './lib/sync-logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const contentOutputDir = path.join(rootDir, 'dist', 'remote-content');
const audioOutputDir = path.join(rootDir, 'dist', 'remote-audio');
const publishRootDir = path.join(rootDir, 'appdata');
const publishAudioRoot = path.join(publishRootDir, 'audio', 'uscis');
const localAudioRoot = path.join(rootDir, 'assets', 'audio', 'uscis');
const logger = await createLogger('publish-uscis-content');
const copiedFiles = [];

await publishRemoteContent();
await publishRemoteAudio();
await logger.writeJson('publish-report.json', {
  generatedAt: new Date().toISOString(),
  publishRootDir,
  copiedFiles,
});
await logger.info('USCIS published content written', {
  publishRootDir,
  copiedFileCount: copiedFiles.length,
});

console.log(`USCIS published content written to ${publishRootDir}`);

async function publishRemoteContent() {
  await fs.mkdir(publishRootDir, { recursive: true });
  for (const fileName of ['manifest.json', 'DEPLOY_FILES.txt', 'question-bank-2008.enc', 'question-bank-2025.enc']) {
    const sourcePath = path.join(contentOutputDir, fileName);
    if (await exists(sourcePath)) {
      await copyFile(sourcePath, path.join(publishRootDir, fileName));
    }
  }
}

async function publishRemoteAudio() {
  await fs.mkdir(path.join(publishRootDir, 'audio'), { recursive: true });
  const manifestSource = path.join(audioOutputDir, 'manifest.json');
  if (await exists(manifestSource)) {
    await copyFile(manifestSource, path.join(publishRootDir, 'audio', 'manifest.json'));
  }

  const deployFilesSource = path.join(audioOutputDir, 'DEPLOY_FILES.txt');
  if (await exists(deployFilesSource)) {
    await copyFile(deployFilesSource, path.join(publishRootDir, 'audio', 'DEPLOY_FILES.txt'));
  }

  const entries = await fs.readdir(localAudioRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d{4}$/.test(entry.name)) {
      continue;
    }

    await fs.cp(path.join(localAudioRoot, entry.name), path.join(publishAudioRoot, entry.name), {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
    copiedFiles.push({
      sourcePath: path.join(localAudioRoot, entry.name),
      targetPath: path.join(publishAudioRoot, entry.name),
      type: 'directory',
    });
    await logger.info('Copied audio directory', {
      sourcePath: path.join(localAudioRoot, entry.name),
      targetPath: path.join(publishAudioRoot, entry.name),
    });
  }
}

async function copyFile(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
  copiedFiles.push({
    sourcePath,
    targetPath,
    type: 'file',
  });
  await logger.info('Copied file', { sourcePath, targetPath });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
