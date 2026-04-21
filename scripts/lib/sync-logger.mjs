import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const LOG_ROOT = path.join(rootDir, 'logs', 'uscis-sync');

export async function createLogger(scriptName) {
  const runId = process.env.USCIS_SYNC_RUN_ID?.trim() || createRunId();
  const logDir = process.env.USCIS_SYNC_LOG_DIR?.trim() || path.join(LOG_ROOT, runId);

  await fs.mkdir(logDir, { recursive: true });
  const scriptLogPath = path.join(logDir, `${scriptName}.log`);

  const logger = {
    runId,
    logDir,
    scriptName,
    scriptLogPath,
    info: async (message, data) => writeLine('INFO', message, data),
    warn: async (message, data) => writeLine('WARN', message, data),
    error: async (message, data) => writeLine('ERROR', message, data),
    step: async (name, fn) => {
      const startedAt = Date.now();
      await writeLine('STEP', `${name} started`);
      try {
        const result = await fn();
        await writeLine('STEP', `${name} finished`, { durationMs: Date.now() - startedAt });
        return result;
      } catch (error) {
        await writeLine('ERROR', `${name} failed`, {
          durationMs: Date.now() - startedAt,
          error: serializeError(error),
        });
        throw error;
      }
    },
    writeJson: async (fileName, data) => {
      const outputPath = path.join(logDir, fileName);
      await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
      await writeLine('ARTIFACT', `Wrote ${fileName}`);
      return outputPath;
    },
    writeText: async (fileName, contents) => {
      const outputPath = path.join(logDir, fileName);
      await fs.writeFile(outputPath, `${contents}`);
      await writeLine('ARTIFACT', `Wrote ${fileName}`);
      return outputPath;
    },
  };

  await logger.info(`Logger initialized for ${scriptName}`, {
    runId,
    logDir,
  });

  return logger;

  async function writeLine(level, message, data) {
    const timestamp = new Date().toISOString();
    const suffix = data === undefined ? '' : ` ${safeStringify(data)}`;
    const line = `[${timestamp}] [${level}] ${message}${suffix}\n`;
    await fs.appendFile(scriptLogPath, line);
    if (level === 'ERROR') {
      console.error(line.trimEnd());
    } else if (level === 'WARN') {
      console.warn(line.trimEnd());
    } else {
      console.log(line.trimEnd());
    }
  }
}

export function createRunId() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    '-',
    String(now.getMilliseconds()).padStart(3, '0'),
  ];
  return parts.join('');
}

export async function readJsonOptional(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function flattenQuestions(questionBank) {
  return Object.values(questionBank?.questionsByCategory ?? {}).flat();
}

export function diffQuestionBanks(previousBank, nextBank) {
  const previousQuestions = new Map(flattenQuestions(previousBank).map((question) => [question.id, question]));
  const nextQuestions = new Map(flattenQuestions(nextBank).map((question) => [question.id, question]));
  const allIds = new Set([...previousQuestions.keys(), ...nextQuestions.keys()]);
  const changes = [];

  for (const id of [...allIds].sort()) {
    const previousQuestion = previousQuestions.get(id);
    const nextQuestion = nextQuestions.get(id);

    if (!previousQuestion && nextQuestion) {
      changes.push({
        type: 'added',
        id,
        next: nextQuestion,
      });
      continue;
    }

    if (previousQuestion && !nextQuestion) {
      changes.push({
        type: 'removed',
        id,
        previous: previousQuestion,
      });
      continue;
    }

    const changedFields = diffObjects(previousQuestion, nextQuestion);
    if (changedFields.length > 0) {
      changes.push({
        type: 'modified',
        id,
        changedFields,
        previous: previousQuestion,
        next: nextQuestion,
      });
    }
  }

  return {
    totalPrevious: previousQuestions.size,
    totalNext: nextQuestions.size,
    added: changes.filter((item) => item.type === 'added').length,
    removed: changes.filter((item) => item.type === 'removed').length,
    modified: changes.filter((item) => item.type === 'modified').length,
    changes,
  };
}

function diffObjects(previousValue, nextValue, prefix = '') {
  if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) {
    return [];
  }

  if (!isPlainObject(previousValue) || !isPlainObject(nextValue)) {
    return [
      {
        field: prefix || '(root)',
        previous: previousValue,
        next: nextValue,
      },
    ];
  }

  const fields = [];
  const keys = new Set([...Object.keys(previousValue), ...Object.keys(nextValue)]);
  for (const key of [...keys].sort()) {
    const fieldName = prefix ? `${prefix}.${key}` : key;
    const previousField = previousValue[key];
    const nextField = nextValue[key];

    if (JSON.stringify(previousField) === JSON.stringify(nextField)) {
      continue;
    }

    if (isPlainObject(previousField) && isPlainObject(nextField)) {
      fields.push(...diffObjects(previousField, nextField, fieldName));
      continue;
    }

    fields.push({
      field: fieldName,
      previous: previousField,
      next: nextField,
    });
  }

  return fields;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeStringify(data) {
  try {
    return JSON.stringify(data);
  } catch {
    return JSON.stringify({ note: 'Unable to serialize log data.' });
  }
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}
