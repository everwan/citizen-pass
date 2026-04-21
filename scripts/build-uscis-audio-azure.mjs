import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from './lib/sync-logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const INPUT_DIR = path.join(rootDir, 'dist', 'uscis-content');
const OUTPUT_DIR = path.join(rootDir, 'assets', 'audio', 'uscis');
const HASH_MANIFEST_PATH = path.join(OUTPUT_DIR, '_meta', 'azure-audio-hashes.json');
const logger = await createLogger('build-uscis-audio-azure');

await loadEnvLocal();

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY?.trim();
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION?.trim();
const AZURE_LANGUAGE_CODE = process.env.USCIS_AZURE_TTS_LANGUAGE_CODE?.trim() || 'en-US';
const AZURE_VOICE_NAME = process.env.USCIS_AZURE_TTS_VOICE_NAME?.trim() || 'en-US-JennyNeural';
const AZURE_OUTPUT_FORMAT = process.env.USCIS_AZURE_TTS_OUTPUT_FORMAT?.trim() || 'audio-24khz-96kbitrate-mono-mp3';
const AZURE_RATE = process.env.USCIS_AZURE_TTS_RATE?.trim() || '-6.00%';
const AZURE_PITCH = process.env.USCIS_AZURE_TTS_PITCH?.trim() || '+0.00Hz';
const AZURE_STYLE = process.env.USCIS_AZURE_TTS_STYLE?.trim() || '';
const AZURE_STYLE_DEGREE = process.env.USCIS_AZURE_TTS_STYLE_DEGREE?.trim() || '';
const AZURE_ROLE = process.env.USCIS_AZURE_TTS_ROLE?.trim() || '';
const FORCE = process.argv.includes('--force');
const PRUNE = process.argv.includes('--prune');
const LIMIT = readLimit(process.argv.slice(2));

if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
  throw new Error('Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION');
}

const questionBanks = [
  { versionCode: '2008', file: path.join(INPUT_DIR, 'uscis2008.json') },
  { versionCode: '2025', file: path.join(INPUT_DIR, 'uscis2025.json') },
];

const hashManifest = await loadHashManifest();
const entries = [];
const audioActions = [];

for (const bank of questionBanks) {
  const questionBank = await readJson(bank.file);
  const questions = Object.values(questionBank.questionsByCategory ?? {}).flat();

  for (const question of questions) {
    const correctOption = question.options.find((option) => option.isCorrect);
    if (!correctOption) {
      throw new Error(`Question ${question.id} is missing a correct answer.`);
    }

    const questionText = normalizeSpeechText(question.questionEn);
    const answerText = normalizeSpeechText(correctOption.textEn);
    const questionHash = hashContent(`question|${questionText}`);
    const answerHash = hashContent(`answer|${answerText}`);

    entries.push({
      id: question.id,
      versionCode: bank.versionCode,
      questionText,
      answerText,
      questionHash,
      answerHash,
      questionFile: `${question.id}-question.mp3`,
      answerFile: `${question.id}-answer.mp3`,
    });
  }
}

await fs.mkdir(path.join(OUTPUT_DIR, '_meta'), { recursive: true });
await fs.mkdir(path.join(OUTPUT_DIR, '2008', 'questions'), { recursive: true });
await fs.mkdir(path.join(OUTPUT_DIR, '2008', 'answers'), { recursive: true });
await fs.mkdir(path.join(OUTPUT_DIR, '2025', 'questions'), { recursive: true });
await fs.mkdir(path.join(OUTPUT_DIR, '2025', 'answers'), { recursive: true });

let generated = 0;
for (const entry of entries) {
  generated += await ensureAudioFile(entry, 'question', entry.questionText, entry.questionHash, hashManifest, FORCE);
  if (LIMIT && generated >= LIMIT) {
    break;
  }
  generated += await ensureAudioFile(entry, 'answer', entry.answerText, entry.answerHash, hashManifest, FORCE);
  if (LIMIT && generated >= LIMIT) {
    break;
  }
}

if (PRUNE) {
  await pruneStaleFiles(entries);
}

await fs.writeFile(HASH_MANIFEST_PATH, `${JSON.stringify(buildHashManifest(entries), null, 2)}\n`);
await logger.writeJson('audio-generation-report.json', {
  generatedAt: new Date().toISOString(),
  generatedCount: generated,
  totalEntries: entries.length,
  force: FORCE,
  prune: PRUNE,
  limit: LIMIT,
  actions: audioActions,
});
await logger.info('Audio generation finished', {
  generatedCount: generated,
  totalEntries: entries.length,
  hashManifestPath: HASH_MANIFEST_PATH,
});

console.log(`Generated ${generated} audio files`);
console.log(`Audio hash manifest written to ${HASH_MANIFEST_PATH}`);

async function ensureAudioFile(entry, kind, text, hash, manifest, force) {
  const filePath = path.join(OUTPUT_DIR, entry.versionCode, kind === 'question' ? 'questions' : 'answers', kind === 'question' ? entry.questionFile : entry.answerFile);
  const existing = manifest.entries?.[entry.id];
  const existingHash = kind === 'question' ? existing?.questionHash : existing?.answerHash;
  const targetFile = kind === 'question' ? entry.questionFile : entry.answerFile;
  const existsAlready = await fileExists(filePath);
  let reason = 'content_changed';

  if (!force && existingHash === hash && (await fileExists(filePath))) {
    audioActions.push({
      action: 'skipped',
      reason: 'unchanged',
      questionId: entry.id,
      versionCode: entry.versionCode,
      kind,
      file: targetFile,
      hash,
    });
    return 0;
  }

  if (force) {
    reason = 'force';
  } else if (!existsAlready) {
    reason = 'missing_file';
  } else if (!existingHash) {
    reason = 'missing_hash';
  }

  const ssml = buildSsml(text);
  const audioBytes = await synthesizeToBuffer(ssml);
  await fs.writeFile(filePath, audioBytes);
  audioActions.push({
    action: 'generated',
    reason,
    questionId: entry.id,
    versionCode: entry.versionCode,
    kind,
    file: targetFile,
    previousHash: existingHash ?? null,
    nextHash: hash,
    textPreview: text.slice(0, 120),
  });
  await logger.info('Audio file generated', {
    questionId: entry.id,
    versionCode: entry.versionCode,
    kind,
    file: targetFile,
    reason,
  });
  return 1;
}

async function synthesizeToBuffer(ssml) {
  const endpoint = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
      'User-Agent': 'CitizenPass-USCIS-Audio',
    },
    body: ssml,
  });

  if (!response.ok) {
    throw new Error(`Azure TTS failed: HTTP ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function normalizeSpeechText(text) {
  return text
    .replace(/\bUSCIS\b/gi, 'U S C I S')
    .replace(/\bU\.S\.\b/g, 'United States')
    .replace(/\bU\.S\b/g, 'United States')
    .replace(/\bN[-\s]?400\b/gi, 'N 400')
    .replace(/\bN[-\s]?6\b/gi, 'N 6')
    .replace(/\s*\/\s*/g, ' or ')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\((.*?)\)/g, ', $1, ')
    .replace(/[:;]+/g, '. ')
    .replace(/[–—]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSsml(text) {
  const safeText = escapeXml(text);
  const openingStyleTag = AZURE_STYLE
    ? [
        `<mstts:express-as style="${AZURE_STYLE}"`,
        AZURE_STYLE_DEGREE ? ` styledegree="${AZURE_STYLE_DEGREE}"` : '',
        AZURE_ROLE ? ` role="${AZURE_ROLE}"` : '',
        '>',
      ].join('')
    : '';
  const closingStyleTag = AZURE_STYLE ? '</mstts:express-as>' : '';

  return [
    `<speak version="1.0" xml:lang="${AZURE_LANGUAGE_CODE}" xmlns:mstts="https://www.w3.org/2001/mstts">`,
    `  <voice name="${AZURE_VOICE_NAME}">`,
    openingStyleTag ? `    ${openingStyleTag}` : '',
    `      <prosody rate="${AZURE_RATE}" pitch="${AZURE_PITCH}">`,
    `        ${safeText}`,
    '      </prosody>',
    closingStyleTag ? `    ${closingStyleTag}` : '',
    '  </voice>',
    '</speak>',
  ]
    .filter(Boolean)
    .join('\n');
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function buildHashManifest(entries) {
  const manifestEntries = {};
  for (const entry of entries) {
    manifestEntries[entry.id] = {
      versionCode: entry.versionCode,
      questionText: entry.questionText,
      answerText: entry.answerText,
      questionHash: entry.questionHash,
      answerHash: entry.answerHash,
      questionFile: entry.questionFile,
      answerFile: entry.answerFile,
    };
  }

  return {
    generator: 'azure-tts',
    voice: AZURE_VOICE_NAME,
    languageCode: AZURE_LANGUAGE_CODE,
    outputFormat: AZURE_OUTPUT_FORMAT,
    rate: AZURE_RATE,
    pitch: AZURE_PITCH,
    style: AZURE_STYLE,
    styleDegree: AZURE_STYLE_DEGREE,
    role: AZURE_ROLE,
    entries: manifestEntries,
  };
}

async function loadHashManifest() {
  try {
    return await readJson(HASH_MANIFEST_PATH);
  } catch {
    return { entries: {} };
  }
}

async function pruneStaleFiles(entries) {
  const keep = new Set(entries.flatMap((entry) => [
    path.join(OUTPUT_DIR, entry.versionCode, 'questions', entry.questionFile),
    path.join(OUTPUT_DIR, entry.versionCode, 'answers', entry.answerFile),
  ]));

  const versions = ['2008', '2025'];
  for (const version of versions) {
    for (const kind of ['questions', 'answers']) {
      const dir = path.join(OUTPUT_DIR, version, kind);
      const files = await fs.readdir(dir).catch(() => []);
      for (const fileName of files) {
        const filePath = path.join(dir, fileName);
        if (!keep.has(filePath)) {
          await fs.rm(filePath, { force: true });
          audioActions.push({
            action: 'pruned',
            versionCode: version,
            kind,
            file: fileName,
          });
        }
      }
    }
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadEnvLocal() {
  try {
    const raw = await fs.readFile(path.join(rootDir, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // no .env.local
  }
}

function readLimit(argv) {
  const limitArg = argv.find((arg) => arg.startsWith('--limit='));
  if (limitArg) {
    const parsed = Number(limitArg.slice('--limit='.length));
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
  }

  const index = argv.indexOf('--limit');
  if (index !== -1 && argv[index + 1]) {
    const parsed = Number(argv[index + 1]);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
  }

  return null;
}
