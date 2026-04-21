import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const syncLogsRoot = path.join(rootDir, 'logs', 'uscis-sync');
const schedulerRoot = path.join(rootDir, 'logs', 'uscis-sync-scheduler');
const openclawMediaDir = path.join(process.env.HOME ?? '', '.openclaw', 'media', 'inbound');
const statePath = path.join(schedulerRoot, 'state.json');
const lockPath = path.join(schedulerRoot, 'run.lock');
const summaryLogPath = path.join(schedulerRoot, 'scheduler.log');
const launchdOutPath = path.join(schedulerRoot, 'launchd.stdout.log');
const launchdErrPath = path.join(schedulerRoot, 'launchd.stderr.log');
const timezone = 'America/Los_Angeles';
const targetHour = 2;
const targetMinute = 0;
const fallbackTelegramTarget = '7115828655';

await fs.mkdir(syncLogsRoot, { recursive: true });
await fs.mkdir(schedulerRoot, { recursive: true });
await fs.mkdir(openclawMediaDir, { recursive: true });

const now = new Date();
const zoned = getZonedParts(now, timezone);
const todayKey = `${zoned.year}-${zoned.month}-${zoned.day}`;
const currentMinuteOfDay = Number(zoned.hour) * 60 + Number(zoned.minute);
const targetMinuteOfDay = targetHour * 60 + targetMinute;

await logLine('Scheduler wakeup', {
  todayKey,
  timezone,
  currentTime: `${zoned.hour}:${zoned.minute}:${zoned.second}`,
});

if (currentMinuteOfDay < targetMinuteOfDay) {
  await logLine('Skipping run before daily window', {
    todayKey,
    currentMinuteOfDay,
    targetMinuteOfDay,
  });
  process.exit(0);
}

const state = (await readJsonOptional(statePath)) ?? {};
if (state.lastSuccessDate === todayKey) {
  await logLine('Skipping run because today already succeeded', {
    todayKey,
    lastSuccessAt: state.lastSuccessAt ?? null,
  });
  process.exit(0);
}

if (!(await acquireLock())) {
  await logLine('Skipping run because another scheduler process is active');
  process.exit(0);
}

let syncRunLogPath = null;
let syncLogDir = null;

try {
  const mergedEnv = await loadRuntimeEnv();
  const contentPassword = mergedEnv.CONTENT_PASSWORD?.trim() || mergedEnv.EXPO_PUBLIC_CONTENT_PASSWORD?.trim();
  if (!contentPassword) {
    throw new Error('Missing CONTENT_PASSWORD / EXPO_PUBLIC_CONTENT_PASSWORD for scheduled sync.');
  }
  mergedEnv.CONTENT_PASSWORD = contentPassword;

  const runRecord = {
    todayKey,
    startedAt: now.toISOString(),
    timezone,
    status: 'running',
  };
  await fs.writeFile(statePath, `${JSON.stringify({ ...state, ...runRecord }, null, 2)}\n`);

  syncRunLogPath = path.join(schedulerRoot, `sync-run-${formatTimestamp(now)}.log`);
  const runResult = await runSyncCommand(mergedEnv, syncRunLogPath);
  syncLogDir = runResult.syncLogDir ?? null;

  if (runResult.exitCode !== 0) {
    throw new Error(`Scheduled sync exited with code ${runResult.exitCode}`);
  }

  const publishResult = await runPublishCommand(path.join(schedulerRoot, `publish-run-${formatTimestamp(new Date())}.log`));
  if (publishResult.exitCode !== 0) {
    throw new Error(`GitHub appdata publish exited with code ${publishResult.exitCode}`);
  }

  const archivePath = syncLogDir ? await zipLogDirectory(syncLogDir) : null;
  const successSummary = syncLogDir ? await buildChineseSuccessSummary(syncLogDir, todayKey, publishResult.commitLine) : null;
  const successState = {
    ...state,
    lastStatus: 'success',
    lastAttemptAt: new Date().toISOString(),
    lastSuccessAt: new Date().toISOString(),
    lastSuccessDate: todayKey,
    lastSyncLogDir: syncLogDir,
    lastSyncRunLogPath: syncRunLogPath,
  };
  await fs.writeFile(statePath, `${JSON.stringify(successState, null, 2)}\n`);

  const successMessage = successSummary ?? [
    'CitizenPass USCIS 同步成功。',
    `日期（旧金山时间）：${todayKey}`,
    syncLogDir ? `日志目录：${syncLogDir}` : null,
  ].filter(Boolean).join('\n');

  await sendTelegramSafely(successMessage, archivePath, 'success');
  await logLine('Scheduled sync finished successfully', {
    todayKey,
    syncLogDir,
    archivePath,
  });
} catch (error) {
  const failureState = {
    ...state,
    lastStatus: 'failure',
    lastAttemptAt: new Date().toISOString(),
    lastFailureAt: new Date().toISOString(),
    lastFailureDate: todayKey,
    lastSyncLogDir: syncLogDir,
    lastSyncRunLogPath: syncRunLogPath,
    lastError: error instanceof Error ? error.message : String(error),
  };
  await fs.writeFile(statePath, `${JSON.stringify(failureState, null, 2)}\n`);

  const failureMessage = [
    'CitizenPass USCIS sync failed.',
    `Date (SF): ${todayKey}`,
    `Error: ${error instanceof Error ? error.message : String(error)}`,
    syncRunLogPath ? `Run log: ${syncRunLogPath}` : null,
    syncLogDir ? `Sync log dir: ${syncLogDir}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  await sendTelegramSafely(failureMessage, syncRunLogPath, 'failure');
  await logLine('Scheduled sync failed', {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    syncRunLogPath,
    syncLogDir,
  });
  process.exitCode = 1;
} finally {
  await fs.rm(lockPath, { force: true });
}

async function runSyncCommand(env, outputPath) {
  await logLine('Starting production sync command', { outputPath });
  await fs.writeFile(outputPath, '');

  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'content:uscis:sync'], {
      cwd: rootDir,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let combined = '';
    const writeChunk = async (chunk) => {
      const text = chunk.toString();
      combined += text;
      process.stdout.write(text);
      await fs.appendFile(outputPath, text);
    };

    child.stdout.on('data', (chunk) => {
      void writeChunk(chunk);
    });
    child.stderr.on('data', (chunk) => {
      void writeChunk(chunk);
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      const match = combined.match(/USCIS sync finished\. Logs:\s+(.+)$/m);
      resolve({
        exitCode: code ?? 1,
        syncLogDir: match?.[1]?.trim() ?? null,
      });
    });
  });
}

async function runPublishCommand(outputPath) {
  await logLine('Starting GitHub appdata publish command', { outputPath });
  await fs.writeFile(outputPath, '');

  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'content:uscis:push'], {
      cwd: rootDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let combined = '';
    const writeChunk = async (chunk) => {
      const text = chunk.toString();
      combined += text;
      process.stdout.write(text);
      await fs.appendFile(outputPath, text);
    };

    child.stdout.on('data', (chunk) => {
      void writeChunk(chunk);
    });
    child.stderr.on('data', (chunk) => {
      void writeChunk(chunk);
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      const commitLine = combined
        .split(/\r?\n/)
        .find((line) => line.includes('Published appdata to GitHub with commit:'))?.trim() ?? null;
      resolve({
        exitCode: code ?? 1,
        commitLine,
      });
    });
  });
}

async function sendTelegram(message, mediaPath) {
  const target = process.env.OPENCLAW_TELEGRAM_TARGET?.trim() || fallbackTelegramTarget;
  if (!target) {
    await logLine('Telegram target missing, skip notification');
    return;
  }

  await logLine('Sending Telegram notification', {
    target,
    hasMedia: Boolean(mediaPath),
  });

  await runCommand('openclaw', [
    'message',
    'send',
    '--channel',
    'telegram',
    '--target',
    target,
    '--message',
    message,
  ]);

  if (mediaPath) {
    const preparedMediaPath = await prepareMediaForOpenClaw(mediaPath);
    await runCommand('openclaw', [
      'message',
      'send',
      '--channel',
      'telegram',
      '--target',
      target,
      '--message',
      `CitizenPass USCIS sync logs: ${path.basename(preparedMediaPath)}`,
      '--media',
      preparedMediaPath,
      '--force-document',
    ]);
  }
}

async function sendTelegramSafely(message, mediaPath, contextLabel) {
  try {
    await sendTelegram(message, mediaPath);
  } catch (error) {
    await logLine('Telegram notification failed, downgrading to text-only', {
      contextLabel,
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      await sendTelegram(`${message}\n\nAttachment delivery failed; text-only fallback sent.`, null);
    } catch (fallbackError) {
      await logLine('Telegram text-only fallback also failed', {
        contextLabel,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
    }
  }
}

async function buildChineseSuccessSummary(syncLogDir, todayKey, commitLine) {
  const diff2008 = await readJsonOptional(path.join(syncLogDir, 'question-bank-diff-2008.json'));
  const diff2025 = await readJsonOptional(path.join(syncLogDir, 'question-bank-diff-2025.json'));
  const audioReport = await readJsonOptional(path.join(syncLogDir, 'audio-generation-report.json'));
  const remoteContentReport = await readJsonOptional(path.join(syncLogDir, 'remote-content-report.json'));

  const lines = [
    'CitizenPass USCIS 同步成功',
    `日期（旧金山时间）：${todayKey}`,
  ];

  if (diff2008 || diff2025) {
    const totalAdded = (diff2008?.added ?? 0) + (diff2025?.added ?? 0);
    const totalRemoved = (diff2008?.removed ?? 0) + (diff2025?.removed ?? 0);
    const totalModified = (diff2008?.modified ?? 0) + (diff2025?.modified ?? 0);
    lines.push(`题库变更：新增 ${totalAdded} 题，删除 ${totalRemoved} 题，修改 ${totalModified} 题`);

    appendQuestionDiff(lines, '2008', diff2008);
    appendQuestionDiff(lines, '2025', diff2025);
  }

  if (audioReport) {
    const generatedCount = audioReport.generatedCount ?? 0;
    const skippedCount = (audioReport.actions ?? []).filter((item) => item.action === 'skipped').length;
    lines.push(`音频处理：新生成 ${generatedCount} 个，跳过未变化 ${skippedCount} 个`);
  }

  if (remoteContentReport?.bundles?.length) {
    const changedBundles = remoteContentReport.bundles
      .filter((bundle) => bundle.changed)
      .map((bundle) => `${bundle.id} -> ${bundle.nextVersion}`);
    if (changedBundles.length > 0) {
      lines.push(`远程内容包：${changedBundles.join('；')}`);
    } else {
      lines.push('远程内容包：版本无变化，已完成校验与发布');
    }
  }

  if (commitLine) {
    lines.push(`GitHub：${commitLine.replace('Published appdata to GitHub with commit: ', '')}`);
  }

  lines.push(`日志目录：${syncLogDir}`);
  return lines.join('\n');
}

function appendQuestionDiff(lines, label, diff) {
  if (!diff) {
    return;
  }

  if ((diff.added ?? 0) === 0 && (diff.removed ?? 0) === 0 && (diff.modified ?? 0) === 0) {
    lines.push(`${label} 题库：无题目内容变化`);
    return;
  }

  const changedQuestions = (diff.changes ?? []).slice(0, 8).map((change) => {
    if (change.type === 'added') {
      return `${change.id}（新增）`;
    }
    if (change.type === 'removed') {
      return `${change.id}（删除）`;
    }
    const fields = (change.changedFields ?? []).map((field) => field.field).slice(0, 4).join('、');
    return `${change.id}（修改：${fields || '内容变更'}）`;
  });

  lines.push(
    `${label} 题库：新增 ${diff.added ?? 0}，删除 ${diff.removed ?? 0}，修改 ${diff.modified ?? 0}`
  );
  if (changedQuestions.length > 0) {
    lines.push(`变更题目：${changedQuestions.join('；')}`);
  }
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stderr = '';
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function zipLogDirectory(logDir) {
  const archiveDir = path.join(syncLogsRoot, 'archives');
  await fs.mkdir(archiveDir, { recursive: true });
  const archivePath = path.join(archiveDir, `${path.basename(logDir)}.zip`);
  await runCommand('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', logDir, archivePath]);
  return archivePath;
}

async function prepareMediaForOpenClaw(sourcePath) {
  const fileName = path.basename(sourcePath);
  const targetPath = path.join(openclawMediaDir, fileName);
  await fs.copyFile(sourcePath, targetPath);
  return targetPath;
}

async function acquireLock() {
  try {
    const existing = await readJsonOptional(lockPath);
    if (existing?.startedAt) {
      const ageMs = Date.now() - new Date(existing.startedAt).getTime();
      if (Number.isFinite(ageMs) && ageMs < 3 * 60 * 60 * 1000) {
        return false;
      }
    }
  } catch {}

  await fs.writeFile(
    lockPath,
    `${JSON.stringify(
      {
        pid: process.pid,
        startedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`
  );
  return true;
}

async function loadRuntimeEnv() {
  const env = {};
  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(rootDir, fileName);
    const parsed = await parseEnvFile(filePath);
    Object.assign(env, parsed);
  }
  return env;
}

async function parseEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const result = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

async function readJsonOptional(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatTimestamp(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');
}

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

async function logLine(message, data) {
  const line = `[${new Date().toISOString()}] ${message}${data ? ` ${JSON.stringify(data)}` : ''}\n`;
  await fs.appendFile(summaryLogPath, line);
  process.stdout.write(line);
}

await fs.mkdir(path.dirname(launchdOutPath), { recursive: true });
await fs.mkdir(path.dirname(launchdErrPath), { recursive: true });
