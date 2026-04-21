import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger, createRunId } from './lib/sync-logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const skipQuestionBank = args.has('--skip-question-bank');
const skipAudio = args.has('--skip-audio');
const skipRemotePublish = args.has('--skip-remote-publish');
const runId = createRunId();
const logDir = path.join(rootDir, 'logs', 'uscis-sync', runId);
const logger = await createLogger('sync-uscis-content');

async function run(command, commandArgs) {
  await logger.info('Running command', { command, commandArgs });
  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        USCIS_SYNC_RUN_ID: runId,
        USCIS_SYNC_LOG_DIR: logDir,
      },
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`${command} ${commandArgs.join(' ')} exited with code ${code}`));
    });
  });
}

async function main() {
  await logger.info('USCIS sync started', {
    skipQuestionBank,
    skipAudio,
    skipRemotePublish,
    runId,
    logDir,
  });

  if (!skipQuestionBank) {
    await logger.step('build-question-banks', async () => run('node', ['./scripts/build-uscis-question-banks.mjs']));
  }

  if (!skipAudio) {
    await logger.step('build-audio', async () => run('node', ['./scripts/build-uscis-audio-azure.mjs']));
    await logger.step('build-remote-audio-manifest', async () => run('node', ['./scripts/build-remote-uscis-audio.mjs']));
  }

  if (!skipRemotePublish) {
    await logger.step('build-remote-content', async () => run('node', ['./scripts/build-remote-content.mjs']));
    await logger.step('publish-appdata', async () => run('node', ['./scripts/publish-uscis-content.mjs']));
  }

  await logger.info('USCIS sync finished successfully');
  console.log(`USCIS sync finished. Logs: ${logDir}`);
}

main().catch((error) => {
  logger.error('USCIS sync failed', { error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
});
