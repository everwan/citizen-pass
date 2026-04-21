import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as cheerio from 'cheerio';
import { createLogger, diffQuestionBanks, flattenQuestions, readJsonOptional } from './lib/sync-logger.mjs';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const OUTPUT_DIR = path.join(rootDir, 'src', 'data', 'question-bank', 'generated');
const JSON_OUTPUT_DIR = path.join(rootDir, 'dist', 'uscis-content');
const CACHE_DIR = path.join(rootDir, '.cache');
const TRANSLATION_CACHE_PATH = path.join(CACHE_DIR, 'uscis-translation-cache.json');
const USCIS_TESTUPDATES_URL = 'https://www.uscis.gov/citizenship/find-study-materials-and-resources/check-for-test-updates';
const logger = await createLogger('build-uscis-question-banks');

const SOURCES = {
  '2008': {
    examVersionCode: '2008',
    questionFileUrl: 'https://www.uscis.gov/sites/default/files/document/questions-and-answers/100q.txt',
    outputFile: path.join(OUTPUT_DIR, 'uscis2008.ts'),
    outputJsonFile: path.join(JSON_OUTPUT_DIR, 'uscis2008.json'),
  },
  '2025': {
    examVersionCode: '2025',
    questionFileUrl: 'https://www.uscis.gov/sites/default/files/document/questions-and-answers/2025-Civics-Test-128-Questions-and-Answers.pdf',
    outputFile: path.join(OUTPUT_DIR, 'uscis2025.ts'),
    outputJsonFile: path.join(JSON_OUTPUT_DIR, 'uscis2025.json'),
  },
};

const SECTION_TITLES_ZH = new Map([
  ['AMERICAN GOVERNMENT', '美国政府'],
  ['AMERICAN HISTORY', '美国历史'],
  ['INTEGRATED CIVICS', '综合公民常识'],
]);

const SUBSECTION_TITLE_OVERRIDES_ZH = new Map([
  ['Principles of American Democracy', '美国民主原则'],
  ['Principles of American Government', '美国政府原则'],
  ['System of Government', '政府体系'],
  ['Rights and Responsibilities', '权利与责任'],
  ['Colonial Period and Independence', '殖民时期与独立'],
  ['1800s', '19世纪'],
  ['Recent American History and Other Important Historical Information', '近代美国历史与重要历史信息'],
  ['1900s and Recent American History', '20世纪与近代美国历史'],
  ['Geography', '地理'],
  ['Symbols', '国家象征'],
  ['Holidays', '节日'],
]);

const USCIS_READING_GLOSSARY_TERMS = new Set([
  'Abraham Lincoln',
  'George Washington',
  'American flag',
  'Bill of Rights',
  'capital',
  'citizen',
  'city',
  'Congress',
  'country',
  'Father of Our Country',
  'government',
  'President',
  'right',
  'Senators',
  'state/states',
  'White House',
  'America',
  'United States',
  'U.S.',
  'Presidents’ Day',
  'Memorial Day',
  'Flag Day',
  'Independence Day',
  'Labor Day',
  'Columbus Day',
  'Thanksgiving',
  'How',
  'What',
  'When',
  'Where',
  'Who',
  'Why',
  'can',
  'come',
  'do/does',
  'elects',
  'have/has',
  'is/are/was/be',
  'lives/lived',
  'meet',
  'name',
  'pay',
  'vote',
  'want',
  'colors',
  'dollar bill',
  'first',
  'largest',
  'many',
  'most',
  'north',
  'one',
  'people',
  'second',
  'south',
]);

const USCIS_WRITING_GLOSSARY_TERMS = new Set([
  'Adams',
  'Lincoln',
  'Washington',
  'American Indians',
  'capital',
  'citizens',
  'Civil War',
  'Congress',
  'Father of Our Country',
  'flag',
  'free',
  'freedom of speech',
  'President',
  'right',
  'Senators',
  'state/states',
  'White House',
  'Alaska',
  'California',
  'Canada',
  'Delaware',
  'Mexico',
  'New York City',
  'United States',
  'Washington, D.C.',
  'February',
  'May',
  'June',
  'July',
  'September',
  'October',
  'November',
  'Presidents’ Day',
  'Memorial Day',
  'Flag Day',
  'Independence Day',
  'Labor Day',
  'Columbus Day',
  'Thanksgiving',
  'can',
  'come',
  'elect',
  'have/has',
  'is/was/be',
  'lives/lived',
  'meets',
  'pay',
  'vote',
  'want',
  'blue',
  'dollar bill',
  'fifty/50',
  'first',
  'largest',
  'most',
  'north',
  'one',
  'one hundred/100',
  'people',
  'red',
  'second',
  'south',
  'taxes',
  'white',
]);

const uscisGlossaryTerms = [
  { termEn: 'Abraham Lincoln', termZh: '亚伯拉罕·林肯', definitionZh: 'USCIS 官方阅读词汇；美国历史人物，常出现在总统、内战和废奴相关句子里。' },
  { termEn: 'Adams', termZh: '亚当斯', definitionZh: 'USCIS 官方书写词汇；美国历史人物姓氏，常用于总统或建国历史句子。' },
  { termEn: 'Alaska', termZh: '阿拉斯加州', definitionZh: 'USCIS 官方书写词汇；美国州名，常见于地图、州和首都相关句子。' },
  { termEn: 'America', termZh: '美国', definitionZh: 'USCIS 官方阅读词汇；常用于国家、人民和历史句子。' },
  { termEn: 'American flag', termZh: '美国国旗', definitionZh: 'USCIS 官方阅读词汇；常见于公民、国家象征和节日句子。' },
  { termEn: 'American Indians', termZh: '美洲原住民', definitionZh: 'USCIS 官方书写词汇；常见于美国早期历史相关句子。' },
  { termEn: 'Bill of Rights', termZh: '权利法案', definitionZh: 'USCIS 官方阅读词汇；美国宪法前十条修正案的统称。' },
  { termEn: 'blue', termZh: '蓝色', definitionZh: 'USCIS 官方书写词汇；常用于国旗和颜色相关句子。' },
  { termEn: 'California', termZh: '加利福尼亚州', definitionZh: 'USCIS 官方书写词汇；美国州名，常见于地点和州政府相关句子。' },
  { termEn: 'can', termZh: '能够 / 可以', definitionZh: 'USCIS 官方 reading / writing 词汇；常见于能力、权利和许可相关句子。' },
  { termEn: 'Canada', termZh: '加拿大', definitionZh: 'USCIS 官方书写词汇；邻国名称，常见于地图或边境相关句子。' },
  { termEn: 'capital', termZh: '首都 / 首府', definitionZh: 'USCIS 官方 reading / writing 词汇；既可指国家首都，也可指州首府。' },
  { termEn: 'citizen', termZh: '公民', definitionZh: 'USCIS 官方阅读词汇；常见于公民身份、权利和责任相关句子。' },
  { termEn: 'citizens', termZh: '公民（复数）', definitionZh: 'USCIS 官方书写词汇；常见于投票、权利和责任相关句子。' },
  { termEn: 'city', termZh: '城市', definitionZh: 'USCIS 官方阅读词汇；地点类基础词。' },
  { termEn: 'Civil War', termZh: '南北战争', definitionZh: 'USCIS 官方书写词汇；美国历史高频词，常与林肯和奴隶制相关。' },
  { termEn: 'colors', termZh: '颜色', definitionZh: 'USCIS 官方阅读词汇；常用于国旗颜色等句子。' },
  { termEn: 'Columbus Day', termZh: '哥伦布日', definitionZh: 'USCIS 官方 reading / writing 节日词汇；官方假日名称。' },
  { termEn: 'come', termZh: '来 / 来到', definitionZh: 'USCIS 官方 reading / writing 动词；常见于移民、开会和到达相关句子。' },
  { termEn: 'Congress', termZh: '国会', definitionZh: 'USCIS 官方 reading / writing 词汇；指美国国会。' },
  { termEn: 'country', termZh: '国家', definitionZh: 'USCIS 官方阅读词汇；常见于国家、祖国和政府相关句子。' },
  { termEn: 'Delaware', termZh: '特拉华州', definitionZh: 'USCIS 官方书写词汇；美国州名。' },
  { termEn: 'dollar bill', termZh: '美元纸币', definitionZh: 'USCIS 官方 reading / writing 词汇；常见于人物头像和货币相关句子。' },
  { termEn: 'elect', termZh: '选举 / 选出', definitionZh: 'USCIS 官方书写动词；常见于总统、参议员等选举句子。' },
  { termEn: 'elects', termZh: '选举 / 选出（第三人称）', definitionZh: 'USCIS 官方阅读动词；常见于谁选出谁的句子。' },
  { termEn: 'Father of Our Country', termZh: '国父', definitionZh: 'USCIS 官方 reading / writing 词汇；常指 George Washington。' },
  { termEn: 'February', termZh: '二月', definitionZh: 'USCIS 官方书写词汇；月份名称。' },
  { termEn: 'fifty/50', termZh: '五十 / 50', definitionZh: 'USCIS 官方书写词汇；常见于州数量或年龄年限规则句子。' },
  { termEn: 'first', termZh: '第一 / 首个', definitionZh: 'USCIS 官方 reading / writing 词汇；常用于总统、修正案或历史顺序。' },
  { termEn: 'flag', termZh: '旗帜 / 国旗', definitionZh: 'USCIS 官方书写词汇；常见于国家象征句子。' },
  { termEn: 'Flag Day', termZh: '国旗日', definitionZh: 'USCIS 官方 reading / writing 节日词汇；官方假日名称。' },
  { termEn: 'free', termZh: '自由的', definitionZh: 'USCIS 官方书写词汇；常见于自由权利相关句子。' },
  { termEn: 'freedom of speech', termZh: '言论自由', definitionZh: 'USCIS 官方书写词汇；《权利法案》中的核心自由之一。' },
  { termEn: 'George Washington', termZh: '乔治·华盛顿', definitionZh: 'USCIS 官方阅读词汇；美国首任总统，也常与“国父”对应。' },
  { termEn: 'government', termZh: '政府', definitionZh: 'USCIS 官方阅读词汇；常见于美国政府结构和职责句子。' },
  { termEn: 'have/has', termZh: '有 / 拥有', definitionZh: 'USCIS 官方 reading / writing 动词；常见于权利、州数和人物相关句子。' },
  { termEn: 'How', termZh: '怎样 / 如何', definitionZh: 'USCIS 官方阅读疑问词；常见于阅读理解和面试提问。' },
  { termEn: 'Independence Day', termZh: '独立日', definitionZh: 'USCIS 官方 reading / writing 节日词汇；对应 7 月 4 日。' },
  { termEn: 'is/are/was/be', termZh: '是 / 在 / 成为', definitionZh: 'USCIS 官方阅读动词；阅读测试里的基础句型高频词。' },
  { termEn: 'is/was/be', termZh: '是 / 曾是 / 成为', definitionZh: 'USCIS 官方书写动词；书写测试里的基础句型高频词。' },
  { termEn: 'July', termZh: '七月', definitionZh: 'USCIS 官方书写词汇；月份名称。' },
  { termEn: 'June', termZh: '六月', definitionZh: 'USCIS 官方书写词汇；月份名称。' },
  { termEn: 'Labor Day', termZh: '劳动节', definitionZh: 'USCIS 官方 reading / writing 节日词汇；官方假日名称。' },
  { termEn: 'largest', termZh: '最大的', definitionZh: 'USCIS 官方 reading / writing 词汇；常见于州、城市和地理句子。' },
  { termEn: 'Lincoln', termZh: '林肯', definitionZh: 'USCIS 官方书写词汇；常指 Abraham Lincoln。' },
  { termEn: 'lives/lived', termZh: '居住 / 曾居住', definitionZh: 'USCIS 官方 reading / writing 动词；常见于居住地和历史人物句子。' },
  { termEn: 'many', termZh: '许多', definitionZh: 'USCIS 官方阅读词汇；常用于数量相关句子。' },
  { termEn: 'May', termZh: '五月', definitionZh: 'USCIS 官方书写词汇；月份名称。' },
  { termEn: 'meet', termZh: '见面 / 开会', definitionZh: 'USCIS 官方阅读动词；常见于 Congress meets 类句子。' },
  { termEn: 'meets', termZh: '开会 / 会面（第三人称）', definitionZh: 'USCIS 官方书写动词；常见于 Congress meets in Washington, D.C. 这类句子。' },
  { termEn: 'Memorial Day', termZh: '阵亡将士纪念日', definitionZh: 'USCIS 官方 reading / writing 节日词汇；官方假日名称。' },
  { termEn: 'Mexico', termZh: '墨西哥', definitionZh: 'USCIS 官方书写词汇；邻国名称。' },
  { termEn: 'most', termZh: '最多 / 大多数', definitionZh: 'USCIS 官方 reading / writing 词汇；常见于数量或比较句子。' },
  { termEn: 'name', termZh: '说出 / 命名', definitionZh: 'USCIS 官方阅读动词；常见于“Name one ...”这类句子。' },
  { termEn: 'New York City', termZh: '纽约市', definitionZh: 'USCIS 官方书写词汇；地点名称。' },
  { termEn: 'north', termZh: '北方 / 北部', definitionZh: 'USCIS 官方 reading / writing 方位词；常见于地图和州位置句子。' },
  { termEn: 'November', termZh: '十一月', definitionZh: 'USCIS 官方书写词汇；月份名称。' },
  { termEn: 'October', termZh: '十月', definitionZh: 'USCIS 官方书写词汇；月份名称。' },
  { termEn: 'one', termZh: '一 / 一个', definitionZh: 'USCIS 官方 reading / writing 数量词；很多题目和句子都用到。' },
  { termEn: 'one hundred/100', termZh: '一百 / 100', definitionZh: 'USCIS 官方书写词汇；常与 100 道 civics 题相关。' },
  { termEn: 'pay', termZh: '支付 / 缴纳', definitionZh: 'USCIS 官方 reading / writing 动词；常见于 taxes 相关句子。' },
  { termEn: 'people', termZh: '人民 / 人们', definitionZh: 'USCIS 官方 reading / writing 词汇；常见于 “We the People” 和人口类句子。' },
  { termEn: 'President', termZh: '总统', definitionZh: 'USCIS 官方 reading / writing 词汇；美国政府职位高频词。' },
  { termEn: 'Presidents’ Day', termZh: '总统日', definitionZh: 'USCIS 官方 reading / writing 节日词汇；官方假日名称。' },
  { termEn: 'red', termZh: '红色', definitionZh: 'USCIS 官方书写词汇；常用于国旗颜色句子。' },
  { termEn: 'right', termZh: '权利', definitionZh: 'USCIS 官方 reading / writing 词汇；常见于公民权利和《权利法案》。' },
  { termEn: 'second', termZh: '第二 / 第二个', definitionZh: 'USCIS 官方 reading / writing 词汇；常用于顺序和修正案句子。' },
  { termEn: 'Senators', termZh: '参议员（复数）', definitionZh: 'USCIS 官方 reading / writing 词汇；常见于国会和州代表句子。' },
  { termEn: 'September', termZh: '九月', definitionZh: 'USCIS 官方书写词汇；月份名称。' },
  { termEn: 'south', termZh: '南方 / 南部', definitionZh: 'USCIS 官方 reading / writing 方位词；常见于地图和历史句子。' },
  { termEn: 'state/states', termZh: '州 / 各州', definitionZh: 'USCIS 官方 reading / writing 词汇；美国联邦体制相关高频词。' },
  { termEn: 'taxes', termZh: '税 / 税款', definitionZh: 'USCIS 官方书写词汇；常见于公民责任句子。' },
  { termEn: 'Thanksgiving', termZh: '感恩节', definitionZh: 'USCIS 官方 reading / writing 节日词汇；官方假日名称。' },
  { termEn: 'U.S.', termZh: '美国（缩写）', definitionZh: 'USCIS 官方阅读词汇；United States 的常见缩写。' },
  { termEn: 'United States', termZh: '美国', definitionZh: 'USCIS 官方 reading / writing 词汇；国家名称。' },
  { termEn: 'vote', termZh: '投票', definitionZh: 'USCIS 官方 reading / writing 动词；公民权利与责任高频词。' },
  { termEn: 'want', termZh: '想要', definitionZh: 'USCIS 官方 reading / writing 动词；基础句型高频词。' },
  { termEn: 'Washington', termZh: '华盛顿', definitionZh: 'USCIS 官方书写词汇；可能指 George Washington、Washington 州或地点语境。' },
  { termEn: 'Washington, D.C.', termZh: '华盛顿特区', definitionZh: 'USCIS 官方书写词汇；美国首都所在地。' },
  { termEn: 'What', termZh: '什么', definitionZh: 'USCIS 官方阅读疑问词；面试和阅读句子高频词。' },
  { termEn: 'When', termZh: '什么时候', definitionZh: 'USCIS 官方阅读疑问词；面试和阅读句子高频词。' },
  { termEn: 'Where', termZh: '哪里 / 在哪里', definitionZh: 'USCIS 官方阅读疑问词；面试和阅读句子高频词。' },
  { termEn: 'white', termZh: '白色', definitionZh: 'USCIS 官方书写词汇；常用于国旗颜色句子。' },
  { termEn: 'White House', termZh: '白宫', definitionZh: 'USCIS 官方 reading / writing 词汇；美国总统官邸。' },
  { termEn: 'Who', termZh: '谁', definitionZh: 'USCIS 官方阅读疑问词；面试和阅读句子高频词。' },
  { termEn: 'Why', termZh: '为什么', definitionZh: 'USCIS 官方阅读疑问词；面试和阅读句子高频词。' },
].map((term) => {
  const inReading = USCIS_READING_GLOSSARY_TERMS.has(term.termEn);
  const inWriting = USCIS_WRITING_GLOSSARY_TERMS.has(term.termEn);

  return {
    ...term,
    sourceTag: inReading && inWriting ? 'both' : inWriting ? 'writing' : 'reading',
  };
});

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripQuestionStar(text) {
  return text.replace(/\s*\*+\s*$/, '').trim();
}

function toCategoryId(sectionTitle, subsectionTitle) {
  const slug = `${sectionTitle}-${subsectionTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug;
}

function sanitizeAnswer(answer) {
  return normalizeWhitespace(
    answer
      .replace(/\s*\(\s*/g, ' (')
      .replace(/\s*\)\s*/g, ') ')
      .replace(/\s*;\s*/g, '; ')
      .replace(/\s*,\s*/g, ', ')
  );
}

function dedupe(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function computeHash(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleDeterministic(items, seedKey) {
  const values = [...items];
  let seed = computeHash(seedKey);
  for (let index = values.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function createQuestionId(examVersionCode, sequenceNumber) {
  return `USCIS-${examVersionCode}-${String(sequenceNumber).padStart(3, '0')}`;
}

async function fetchText(url) {
  await logger.info('Fetching text source', { url });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchPdfText(url) {
  await logger.info('Fetching PDF source', { url });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF ${url}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const parser = new PDFParse({ data: Buffer.from(arrayBuffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function fetchCurrentTestUpdates() {
  await logger.info('Fetching USCIS test updates page', { url: USCIS_TESTUPDATES_URL });
  const response = await fetch(USCIS_TESTUPDATES_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch USCIS test updates page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const reviewedDate = $('div.reviewed-date time.datetime').first().text().trim();
  const updatesByVersion = {
    '2008': [],
    '2025': [],
  };

  $('h4.accordion__header').each((_, headerElement) => {
    const headerText = $(headerElement).text().trim();
    const panel = $(headerElement).next('.accordion__panel');
    if (!panel.length) {
      return;
    }

    const targetVersion = headerText.includes('2008 Version') ? '2008' : headerText.includes('2025 Naturalization') ? '2025' : null;
    if (!targetVersion) {
      return;
    }

    for (const entry of parseCurrentTestUpdateSection($, panel)) {
      updatesByVersion[targetVersion].push(entry);
    }
  });

  return {
    reviewedDate: reviewedDate || null,
    updatesByVersion,
  };
}

function parseCurrentTestUpdateSection($, panel) {
  const entries = [];
  const children = panel.children().toArray();

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.tagName !== 'p') {
      continue;
    }

    const strongText = $(child).find('strong').first().text().trim() || $(child).text().trim();
    const match = /^(\d+)\.\s*(.+)$/.exec(strongText);
    if (!match) {
      continue;
    }

    const questionNumber = Number(match[1]);
    const questionText = stripQuestionStar(normalizeWhitespace(match[2]));
    const nextChild = children[index + 1];
    const answers = [];

    if (nextChild && nextChild.tagName === 'ul') {
      $(nextChild)
        .find('li')
        .each((_, li) => {
          const answerText = sanitizeAnswer($(li).text());
          if (answerText) {
            answers.push(answerText);
          }
        });
    }

    entries.push({
      questionNumber,
      questionText,
      answers: dedupe(answers),
    });
  }

  return entries;
}

function parse2008Questions(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const questions = [];
  let sectionTitle = '';
  let subsectionTitle = '';
  let currentQuestion = null;

  function flushQuestion() {
    if (!currentQuestion) {
      return;
    }

    currentQuestion.answers = dedupe(currentQuestion.answers.map(sanitizeAnswer));
    questions.push(currentQuestion);
    currentQuestion = null;
  }

  for (const line of lines) {
    if (/^[A-Z][A-Z\s]+$/.test(line) && !/^[A-Z]:/.test(line) && !line.startsWith('(rev.')) {
      flushQuestion();
      sectionTitle = line;
      continue;
    }

    const subsectionMatch = /^([A-C]):\s+(.+)$/.exec(line);
    if (subsectionMatch) {
      flushQuestion();
      subsectionTitle = subsectionMatch[2].trim();
      continue;
    }

    const questionMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (questionMatch) {
      flushQuestion();
      const questionText = questionMatch[2].trim();
      currentQuestion = {
        sourceNumber: Number(questionMatch[1]),
        questionEn: stripQuestionStar(questionText),
        isSpecialConsideration: questionText.includes('*'),
        sectionTitle,
        subsectionTitle,
        answers: [],
      };
      continue;
    }

    if (currentQuestion && /^\.\s+/.test(line)) {
      currentQuestion.answers.push(line.replace(/^\.\s+/, ''));
    }
  }

  flushQuestion();
  return questions;
}

function parse2025Questions(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\u0000/g, '')
        .replace(/\u0009/g, ' ')
        .replace(/[–—]/g, '-')
        .trim()
    )
    .filter(Boolean)
    .filter((line) => !/^\d+\s+of\s+\d+\s+uscis\.gov\/citizenship$/i.test(line))
    .filter((line) => !/^--\s+\d+\s+of\s+\d+\s+--$/i.test(line))
    .filter((line) => !/^M-\d+/.test(line))
    .filter((line) => !/^uscis\.gov\/citizenship$/i.test(line));

  const questions = [];
  let sectionTitle = '';
  let subsectionTitle = '';
  let currentQuestion = null;
  let currentAnswerIndex = -1;

  function flushQuestion() {
    if (!currentQuestion) {
      return;
    }

    currentQuestion.answers = dedupe(currentQuestion.answers.map(sanitizeAnswer));
    questions.push(currentQuestion);
    currentQuestion = null;
    currentAnswerIndex = -1;
  }

  for (const line of lines) {
    if (/^[A-Z][A-Z\s]+$/.test(line) && !/^[A-C]:/.test(line) && !line.startsWith('65/20') && !line.startsWith('These ') && !line.startsWith('Listed ') && !line.startsWith('On the ') && !line.startsWith('Although ') && !line.startsWith('If you are ')) {
      flushQuestion();
      sectionTitle = line;
      continue;
    }

    const subsectionMatch = /^([A-C]):\s+(.+)$/.exec(line);
    if (subsectionMatch) {
      flushQuestion();
      subsectionTitle = subsectionMatch[2].trim();
      continue;
    }

    const questionMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (questionMatch) {
      flushQuestion();
      const questionText = questionMatch[2].trim();
      currentQuestion = {
        sourceNumber: Number(questionMatch[1]),
        questionEn: stripQuestionStar(questionText),
        isSpecialConsideration: questionText.includes('*'),
        sectionTitle,
        subsectionTitle,
        answers: [],
      };
      continue;
    }

    if (!currentQuestion) {
      continue;
    }

    if (line.startsWith('•')) {
      currentQuestion.answers.push(line.replace(/^•\s*/, ''));
      currentAnswerIndex = currentQuestion.answers.length - 1;
      continue;
    }

    if (currentAnswerIndex >= 0) {
      currentQuestion.answers[currentAnswerIndex] = `${currentQuestion.answers[currentAnswerIndex]} ${line}`.trim();
    } else {
      currentQuestion.questionEn = `${currentQuestion.questionEn} ${line}`.trim();
      currentQuestion.isSpecialConsideration = currentQuestion.isSpecialConsideration || line.includes('*');
      currentQuestion.questionEn = stripQuestionStar(currentQuestion.questionEn);
    }
  }

  flushQuestion();
  return questions;
}

function applyCurrentTestUpdateAnswers(parsedQuestions, updateEntries, reviewDate) {
  let appliedCount = 0;
  const updatesByNumber = new Map(updateEntries.map((entry) => [entry.questionNumber, entry]));

  for (const question of parsedQuestions) {
    const updateEntry = updatesByNumber.get(question.sourceNumber);
    if (!updateEntry) {
      continue;
    }

    question.answers = dedupe(updateEntry.answers.map(sanitizeAnswer));
    question.currentAnswerReviewDate = reviewDate;
    question.currentAnswerSourceUrl = USCIS_TESTUPDATES_URL;
    appliedCount += 1;
  }

  return appliedCount;
}

function createDynamicAnswerNote(question) {
  if (
    /who is the (current )?(governor|speaker of the house|president|vice president|chief justice)/i.test(question.questionEn) ||
    /name your (u\.s\.)? representative/i.test(question.questionEn) ||
    /what is the capital of your state/i.test(question.questionEn) ||
    /name one of your state'?s senators/i.test(question.questionEn)
  ) {
    const reviewSuffix = question.currentAnswerReviewDate ? ` USCIS reviewed these updates on ${question.currentAnswerReviewDate}.` : '';
    return question.examVersionCode === '2025'
      ? `This answer can change. USCIS says to use the current official serving at the time of your interview.${reviewSuffix}`
      : `This answer can change because of elections or appointments. Use the current answer at the time of your USCIS interview.${reviewSuffix}`;
  }

  return null;
}

function buildCategoryRecords(parsedQuestions) {
  const orderedCategories = [];
  const categoryById = new Map();

  for (const question of parsedQuestions) {
    const categoryId = toCategoryId(question.sectionTitle, question.subsectionTitle);
    if (!categoryById.has(categoryId)) {
      const titleEn = question.subsectionTitle;
      const titleZh = SUBSECTION_TITLE_OVERRIDES_ZH.get(titleEn) ?? titleEn;
      categoryById.set(categoryId, {
        id: categoryId,
        nameEn: titleEn,
        nameZh: titleZh,
        questionCount: 0,
        progress: 0,
        accuracy: 0,
      });
      orderedCategories.push(categoryId);
    }

    categoryById.get(categoryId).questionCount += 1;
  }

  return orderedCategories.map((categoryId) => categoryById.get(categoryId));
}

function buildOptionSets(parsedQuestions) {
  const answersByCategory = new Map();
  const allPrimaryAnswers = [];

  for (const question of parsedQuestions) {
    const categoryId = toCategoryId(question.sectionTitle, question.subsectionTitle);
    const primaryAnswer = question.answers[0];
    allPrimaryAnswers.push(primaryAnswer);

    if (!answersByCategory.has(categoryId)) {
      answersByCategory.set(categoryId, []);
    }
    answersByCategory.get(categoryId).push(primaryAnswer);
  }

  return { answersByCategory, allPrimaryAnswers };
}

function pickDistractors(question, optionSets) {
  const categoryId = toCategoryId(question.sectionTitle, question.subsectionTitle);
  const correctAnswers = new Set(question.answers.map((answer) => answer.toLowerCase()));
  const pools = [
    optionSets.answersByCategory.get(categoryId) ?? [],
    optionSets.allPrimaryAnswers,
  ];

  const distractors = [];
  const seen = new Set(correctAnswers);

  for (const pool of pools) {
    for (const candidate of shuffleDeterministic(pool, `${question.sourceNumber}:${categoryId}:${pool.length}`)) {
      const normalized = candidate.toLowerCase();
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      distractors.push(candidate);
      if (distractors.length === 3) {
        return distractors;
      }
    }
  }

  const fallbacks = [
    'None of the above',
    'A temporary local policy',
    'A state driving rule',
  ];

  for (const fallback of fallbacks) {
    if (distractors.length === 3) {
      break;
    }
    distractors.push(fallback);
  }

  return distractors.slice(0, 3);
}

async function loadTranslationCache() {
  try {
    const raw = await fs.readFile(TRANSLATION_CACHE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveTranslationCache(cache) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(TRANSLATION_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function translateText(input, cache) {
  const normalizedInput = normalizeWhitespace(input);
  if (!normalizedInput) {
    return '';
  }

  if (cache[normalizedInput]) {
    return cache[normalizedInput];
  }

  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'en',
    tl: 'zh-CN',
    dt: 't',
    q: normalizedInput,
  });

  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Translation failed for "${normalizedInput}": ${response.status}`);
      }

      const data = await response.json();
      const translated = (data?.[0] ?? []).map((item) => item?.[0] ?? '').join('').trim();
      cache[normalizedInput] = translated || normalizedInput;
      return cache[normalizedInput];
    } catch (error) {
      if (attempt === maxAttempts) {
        console.warn(`Translation fallback for "${normalizedInput}": ${error.message}`);
        cache[normalizedInput] = normalizedInput;
        return normalizedInput;
      }

      const delayMs = 500 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function translateMany(values, cache) {
  const uniqueValues = dedupe(values);
  const queue = [...uniqueValues];
  const results = new Map();
  const concurrency = 4;

  async function worker() {
    while (queue.length > 0) {
      const value = queue.shift();
      const translated = await translateText(value, cache);
      results.set(value, translated);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

function buildExplanationEn(question, examVersionCode) {
  const base = `Official USCIS acceptable answers: ${question.answers.join('; ')}.`;
  const dynamicQuestion = { ...question, examVersionCode };
  const dynamicNote = createDynamicAnswerNote(dynamicQuestion);
  return dynamicNote ? `${base} ${dynamicNote}` : base;
}

function buildExplanationZh(question, translatedAnswers, examVersionCode) {
  const translated = question.answers
    .map((answer) => translatedAnswers.get(answer) ?? answer)
    .join('；');
  const dynamicQuestion = { ...question, examVersionCode };
  const dynamicNote = createDynamicAnswerNote(dynamicQuestion);
  const zhDynamicNote = dynamicNote ? '这道题的答案可能会变动，面试时请按照当时在任的官员或最新官方信息作答。' : '';
  return `USCIS 官方可接受答案：${translated}。${zhDynamicNote}`.trim();
}

function formatTs(value) {
  return JSON.stringify(value, null, 2);
}

async function buildQuestionBank(examVersionCode, translationCache, currentTestUpdates) {
  await logger.info('Building question bank', { examVersionCode });
  const source = SOURCES[examVersionCode];
  const rawText =
    examVersionCode === '2008'
      ? await fetchText(source.questionFileUrl)
      : await fetchPdfText(source.questionFileUrl);

  const parsedQuestions =
    examVersionCode === '2008' ? parse2008Questions(rawText) : parse2025Questions(rawText);
  const appliedDynamicUpdates = applyCurrentTestUpdateAnswers(
    parsedQuestions,
    currentTestUpdates.updatesByVersion[examVersionCode],
    currentTestUpdates.reviewedDate
  );

  const categories = buildCategoryRecords(parsedQuestions);
  const optionSets = buildOptionSets(parsedQuestions);

  const stringsToTranslate = [
    ...parsedQuestions.map((question) => question.questionEn),
    ...parsedQuestions.flatMap((question) => question.answers),
  ];
  const translations = await translateMany(stringsToTranslate, translationCache);

  const questionsByCategory = {};

  for (const question of parsedQuestions) {
    const categoryId = toCategoryId(question.sectionTitle, question.subsectionTitle);
    const category = categories.find((item) => item.id === categoryId);
    const correctAnswer = question.answers[0];
    const distractors = pickDistractors(question, optionSets);
    const optionTexts = shuffleDeterministic(
      [correctAnswer, ...distractors].slice(0, 4),
      `${examVersionCode}:${question.sourceNumber}:${question.questionEn}`
    );

    const options = optionTexts.map((optionText, index) => ({
      key: ['A', 'B', 'C', 'D'][index],
      textEn: optionText,
      textZh: translations.get(optionText) ?? optionText,
      isCorrect: optionText === correctAnswer,
    }));

    const questionRecord = {
      id: createQuestionId(examVersionCode, question.sourceNumber),
      examVersionCode,
      categoryId,
      categoryLabel: category?.nameEn ?? question.subsectionTitle,
      questionEn: question.questionEn,
      questionZh: translations.get(question.questionEn) ?? question.questionEn,
      explanationEn: buildExplanationEn(question, examVersionCode),
      explanationZh: buildExplanationZh(question, translations, examVersionCode),
      options,
      currentAnswerReviewDate: question.currentAnswerReviewDate ?? null,
      currentAnswerSourceUrl: question.currentAnswerSourceUrl ?? null,
    };

    if (!questionsByCategory[categoryId]) {
      questionsByCategory[categoryId] = [];
    }
    questionsByCategory[categoryId].push(questionRecord);
  }

  const starQuestions = parsedQuestions
    .filter((question) => question.isSpecialConsideration)
    .map((question) => createQuestionId(examVersionCode, question.sourceNumber));

  const allQuestionIds = parsedQuestions.map((question) => createQuestionId(examVersionCode, question.sourceNumber));

  const questionBank = {
    bundleVersion: currentTestUpdates.reviewedDate ?? new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    testUpdatesReviewedDate: currentTestUpdates.reviewedDate ?? null,
    testUpdatesSourceUrl: USCIS_TESTUPDATES_URL,
    categories,
    questionsByCategory,
    guideArticles: [
      {
        slug: 'uscis-test-overview',
        titleEn: examVersionCode === '2008' ? 'How the 2008 civics test works' : 'How the 2025 civics test works',
        titleZh: examVersionCode === '2008' ? '2008 版公民题考试方式' : '2025 版公民题考试方式',
        contentEn:
          examVersionCode === '2008'
            ? 'USCIS gives the 2008 civics test to applicants who filed Form N-400 before Oct. 20, 2025. It is an oral test from a bank of 100 questions: the officer asks up to 10, and you must answer at least 6 correctly. The officer stops once you reach 6 correct answers or 5 wrong answers.'
            : 'USCIS gives the 2025 civics test to applicants who filed Form N-400 on or after Oct. 20, 2025. It is an oral test from a bank of 128 questions: the officer asks up to 20, and you must answer at least 12 correctly. The officer stops once you reach 12 correct answers or 9 wrong answers.',
        contentZh:
          examVersionCode === '2008'
            ? 'USCIS 会把 2008 版公民题考试给在 2025 年 10 月 20 日之前提交 Form N-400 的申请人。它是口试，范围是 100 题官方题库；官员最多提问 10 题，你至少答对 6 题才通过。一旦你已经答对 6 题，或者已经错了 5 题，官员就会停止继续提问。'
            : 'USCIS 会把 2025 版公民题考试给在 2025 年 10 月 20 日或之后提交 Form N-400 的申请人。它是口试，范围是 128 题官方题库；官员最多提问 20 题，你至少答对 12 题才通过。一旦你已经答对 12 题，或者已经错了 9 题，官员就会停止继续提问。',
        officialUrl:
          examVersionCode === '2008'
            ? 'https://www.uscis.gov/civics-questions-and-answers-2008-version'
            : 'https://www.uscis.gov/citizenship-resource-center/naturalization-test-and-study-resources/2025-civics-test',
      },
      {
        slug: 'english-test-and-interview',
        titleEn: 'What happens in the English test and interview',
        titleZh: '英语测试和面试会考什么',
        contentEn:
          'USCIS checks speaking during the naturalization interview itself, using your Form N-400 conversation. For reading, you must read 1 of 3 sentences correctly. For writing, you must write 1 of 3 sentences correctly. USCIS expects basic everyday English, not perfect grammar.',
        contentZh:
          'USCIS 会在入籍面试过程中，结合你对 Form N-400 相关问题的回答，判断你的英语口语和听懂能力。阅读部分需要在 3 句中正确读出 1 句；书写部分需要在 3 句中正确写出 1 句。官方要求的是日常基础英语能力，并不是要求语法完全无误。',
        officialUrl: 'https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test',
      },
      {
        slug: 'study-materials-and-vocabulary',
        titleEn: 'Best official study materials to use first',
        titleZh: '最值得先看的官方备考资料',
        contentEn:
          'Start with the free USCIS study hub. It links to the official civics questions, flash cards, and the English reading and writing vocabulary lists. The text-only resources are especially useful for quick review on a phone, screen readers, or copy-and-paste note making.',
        contentZh:
          '最推荐先从 USCIS 免费学习资源总入口开始。里面集中放了官方公民题、闪卡，以及英语阅读和书写词汇表。纯文本版本尤其适合手机快速复习、读屏工具，或者自己整理笔记时直接复制使用。',
        officialUrl: 'https://www.uscis.gov/citizenship-resource-center/find-study-materials-and-resources/study-for-the-test/citizenship-resources-in-text-only-format',
      },
      {
        slug: 'test-updates-and-dynamic-answers',
        titleEn: 'Check test updates before your interview',
        titleZh: '面试前一定要核对动态答案',
        contentEn:
          'Some civics answers can change because of elections, appointments, or legal updates. USCIS keeps a test-updates page for items such as the President, Vice President, Speaker of the House, Chief Justice, senators, representative, and governor. This page also confirms which test version applies based on your N-400 filing date.',
        contentZh:
          '有些公民题答案会因为选举、人事任命或法律更新而变化。USCIS 专门提供了 test updates 页面，集中更新总统、副总统、众议院议长、首席大法官、参议员、众议员和州长等动态答案。这个页面也会再次确认你应参加哪一个版本的考试，依据是你的 N-400 提交日期。',
        officialUrl: 'https://www.uscis.gov/citizenship/find-study-materials-and-resources/check-for-test-updates',
      },
      {
        slug: 'exceptions-and-accommodations',
        titleEn: 'Who can use exemptions, interpreters, or accommodations',
        titleZh: '哪些人可以用英语豁免、翻译或合理便利',
        contentEn:
          'USCIS offers English-language exemptions for applicants who qualify under the 50/20 or 55/15 rules. Those applicants still take the civics test, but they may take it in the language of their choice with an interpreter. Applicants with a qualifying disability may request an exception with Form N-648, and people who need accommodations should list those needs on Form N-400.',
        contentZh:
          '符合 50/20 或 55/15 条件的申请人，可以获得英语要求豁免。此类申请人仍然需要参加公民题考试，但可以在面试时通过翻译，用自己选择的语言应考。若因身体、发育或精神方面原因无法满足考试要求，申请人可通过 Form N-648 申请豁免；如果只是需要合理便利，也应在 Form N-400 上提前写明需求。',
        officialUrl: 'https://www.uscis.gov/citizenship/exceptions-and-accommodations',
      },
      {
        slug: 'special-consideration-65-20',
        titleEn: 'How 65/20 special consideration works',
        titleZh: '65/20 特别照顾规则怎么用',
        contentEn:
          'If you are 65 or older and have been a lawful permanent resident for at least 20 years when you file Form N-400, USCIS gives special civics consideration. You may take the civics test in the language of your choice, and you only need to study the specially selected set of 20 civics questions for your test version. USCIS still asks 10 civics questions during the interview.',
        contentZh:
          '如果你在提交 Form N-400 时已经年满 65 岁，并且作为永久居民累计满 20 年，就可以适用 65/20 特别照顾规则。你可以用自己选择的语言参加公民题考试，而且只需要复习对应版本里官方特别挑出的 20 道题。面试当天 USCIS 仍然会口头提问 10 道公民题。',
        officialUrl: 'https://www.uscis.gov/citizenship/exceptions-and-accommodations',
      },
      {
        slug: 'multilingual-resources',
        titleEn: 'Where to find USCIS multilingual study help',
        titleZh: '去哪里找 USCIS 多语言学习资料',
        contentEn:
          'USCIS also collects citizenship resources that are available in languages other than English. These materials can help families study together, support interpreters, and help applicants who qualify to take the civics test in another language. Use them as support materials, but always match your actual filing date and test version.',
        contentZh:
          'USCIS 还整理了多语言版本的入籍学习资料。它们很适合家人一起准备、帮助翻译提前熟悉术语，也适合那些本来就有资格用其他语言参加公民题考试的申请人。使用这些资料时，仍要以你自己的 N-400 提交日期和对应考试版本为准。',
        officialUrl: 'https://www.uscis.gov/citizenship/find-study-materials-and-resources/citizenship-multilingual-resources',
      },
    ],
    glossaryTerms: uscisGlossaryTerms,
    highFrequencyQuestionIds: starQuestions.length > 0 ? starQuestions : allQuestionIds.slice(0, 20),
    mockQuestionIds: allQuestionIds.slice(0, Math.min(20, allQuestionIds.length)),
  };

  await logger.info('Question bank built', {
    examVersionCode,
    questionCount: flattenQuestions(questionBank).length,
    categoryCount: questionBank.categories.length,
    appliedDynamicUpdates,
    reviewedDate: currentTestUpdates.reviewedDate ?? null,
  });

  return questionBank;
}

async function writeQuestionBankFile(filePath, exportName, questionBank, jsonPath) {
  const source = `import { defineStateQuestionBank } from '../types';\n\nexport const ${exportName} = defineStateQuestionBank(${formatTs(
    questionBank
  )});\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, source);
  if (jsonPath) {
    await fs.mkdir(path.dirname(jsonPath), { recursive: true });
    await fs.writeFile(jsonPath, `${JSON.stringify(questionBank, null, 2)}\n`);
  }
  await logger.info('Question bank files written', {
    exportName,
    filePath,
    jsonPath: jsonPath ?? null,
  });
}

async function logQuestionBankDiff(examVersionCode, previousBank, nextBank) {
  const diff = diffQuestionBanks(previousBank, nextBank);
  const summary = {
    examVersionCode,
    totalPrevious: diff.totalPrevious,
    totalNext: diff.totalNext,
    added: diff.added,
    removed: diff.removed,
    modified: diff.modified,
  };

  await logger.info('Question bank diff summary', summary);

  for (const change of diff.changes) {
    if (change.type === 'added') {
      await logger.info('Question added', {
        examVersionCode,
        id: change.id,
        questionEn: change.next?.questionEn ?? null,
        options: change.next?.options?.map((option) => ({
          key: option.key,
          textEn: option.textEn,
          isCorrect: option.isCorrect,
        })) ?? [],
      });
      continue;
    }

    if (change.type === 'removed') {
      await logger.warn('Question removed', {
        examVersionCode,
        id: change.id,
        questionEn: change.previous?.questionEn ?? null,
      });
      continue;
    }

    await logger.info('Question modified', {
      examVersionCode,
      id: change.id,
      changedFields: change.changedFields,
      previousQuestionEn: change.previous?.questionEn ?? null,
      nextQuestionEn: change.next?.questionEn ?? null,
      previousCorrectAnswers: extractCorrectAnswers(change.previous),
      nextCorrectAnswers: extractCorrectAnswers(change.next),
      previousReviewDate: change.previous?.currentAnswerReviewDate ?? null,
      nextReviewDate: change.next?.currentAnswerReviewDate ?? null,
    });
  }

  await logger.writeJson(`question-bank-diff-${examVersionCode}.json`, {
    generatedAt: new Date().toISOString(),
    ...summary,
    changes: diff.changes,
  });
}

function extractCorrectAnswers(question) {
  return (question?.options ?? []).filter((option) => option.isCorrect).map((option) => option.textEn);
}

async function main() {
  await logger.step('load-translation-cache', async () => {
    const translationCache = await loadTranslationCache();
    const currentTestUpdates = await fetchCurrentTestUpdates();
    await logger.writeJson('test-updates-summary.json', currentTestUpdates);

    const previous2008 = await readJsonOptional(SOURCES['2008'].outputJsonFile);
    const previous2025 = await readJsonOptional(SOURCES['2025'].outputJsonFile);
    const questionBank2008 = await buildQuestionBank('2008', translationCache, currentTestUpdates);
    const questionBank2025 = await buildQuestionBank('2025', translationCache, currentTestUpdates);

    await logQuestionBankDiff('2008', previous2008, questionBank2008);
    await logQuestionBankDiff('2025', previous2025, questionBank2025);

    await writeQuestionBankFile(SOURCES['2008'].outputFile, 'uscis2008QuestionBank', questionBank2008, SOURCES['2008'].outputJsonFile);
    await writeQuestionBankFile(SOURCES['2025'].outputFile, 'uscis2025QuestionBank', questionBank2025, SOURCES['2025'].outputJsonFile);
    await saveTranslationCache(translationCache);

    const summary = {
      reviewedDate: currentTestUpdates.reviewedDate ?? null,
      banks: {
        '2008': {
          questionCount: flattenQuestions(questionBank2008).length,
          categoryCount: questionBank2008.categories.length,
        },
        '2025': {
          questionCount: flattenQuestions(questionBank2025).length,
          categoryCount: questionBank2025.categories.length,
        },
      },
    };

    await logger.writeJson('question-bank-build-summary.json', summary);

    console.log('Built USCIS question banks:');
    console.log(`- 2008: ${flattenQuestions(questionBank2008).length} questions`);
    console.log(`- 2025: ${flattenQuestions(questionBank2025).length} questions`);
    if (currentTestUpdates.reviewedDate) {
      console.log(`- USCIS test updates reviewed: ${currentTestUpdates.reviewedDate}`);
    }
  });
}

main().catch((error) => {
  logger.error('Question bank build failed', {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  });
  console.error(error);
  process.exitCode = 1;
});
