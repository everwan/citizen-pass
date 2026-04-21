import { setQuestionSetOverrides } from '../data/stateContent';
import { AppDatabase } from '../db/types';
import { saveContentSetPreference } from '../repositories/userRepository';
import { StateCode } from '../types';
import { RemoteBundlePayload, RemoteBundleType } from './types';

type ApplyBundleOptions = {
  bundleId: string;
  sha256: string;
  source: 'builtin' | 'remote';
};

export async function getAppliedContentBundleVersion(db: AppDatabase, bundleId: string) {
  return db.getFirstAsync<{ version: string; sha256: string; status: string; source: string }>(
    'SELECT version, sha256, status, source FROM content_bundles WHERE bundle_id = ?',
    bundleId
  );
}

export async function applyContentBundle(
  db: AppDatabase,
  bundle: RemoteBundlePayload,
  options: ApplyBundleOptions
) {
  await db.execAsync('BEGIN TRANSACTION;');

  try {
    if (bundle.type === 'question-bank') {
      await replaceQuestionBankBundle(db, bundle);
    } else if (bundle.type === 'guide') {
      await replaceGuideBundle(db, bundle);
    } else {
      await replaceGlossaryBundle(db, bundle);
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO content_bundles (bundle_id, type, target_code, version, sha256, status, applied_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      options.bundleId,
      bundle.type,
      bundle.targetCode,
      bundle.version,
      options.sha256,
      'applied',
      new Date().toISOString(),
      options.source
    );

    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

async function replaceQuestionBankBundle(
  db: AppDatabase,
  bundle: Extract<RemoteBundlePayload, { type: 'question-bank' }>
) {
  await clearBundleTables(db, 'question-bank', bundle.targetCode);

  for (const category of bundle.categories) {
    await db.runAsync(
      `INSERT INTO categories (exam_version_code, id, name_en, name_zh, question_count, progress, accuracy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      bundle.targetCode,
      category.id,
      category.nameEn,
      category.nameZh,
      category.questionCount,
      category.progress,
      category.accuracy
    );
  }

  for (const question of Object.values(bundle.questionsByCategory).flat()) {
    await db.runAsync(
      `INSERT INTO questions (
        id, exam_version_code, category_id, category_label, question_en, question_zh, explanation_en, explanation_zh, memory_tip_en, memory_tip_zh
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      question.id,
      bundle.targetCode,
      question.categoryId,
      question.categoryLabel,
      question.questionEn,
      question.questionZh,
      question.explanationEn,
      question.explanationZh,
      question.memoryTipEn ?? '',
      question.memoryTipZh ?? ''
    );

    for (const option of question.options) {
      await db.runAsync(
        `INSERT INTO question_options (question_id, option_key, text_en, text_zh, is_correct)
         VALUES (?, ?, ?, ?, ?)`,
        question.id,
        option.key,
        option.textEn,
        option.textZh,
        option.isCorrect ? 1 : 0
      );
    }
  }

  await saveContentSetPreference(db, bundle.targetCode as StateCode, 'highFrequency', bundle.highFrequencyQuestionIds);
  await saveContentSetPreference(db, bundle.targetCode as StateCode, 'mock', bundle.mockQuestionIds);

  setQuestionSetOverrides(bundle.targetCode as StateCode, {
    highFrequencyQuestionIds: bundle.highFrequencyQuestionIds,
    mockQuestionIds: bundle.mockQuestionIds,
  });
}

async function replaceGuideBundle(
  db: AppDatabase,
  bundle: Extract<RemoteBundlePayload, { type: 'guide' }>
) {
  await clearBundleTables(db, 'guide', bundle.targetCode);

  for (const article of bundle.guideArticles) {
    await db.runAsync(
      `INSERT INTO guide_articles (exam_version_code, slug, title_en, title_zh, content_en, content_zh, official_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      bundle.targetCode,
      article.slug,
      article.titleEn,
      article.titleZh,
      article.contentEn,
      article.contentZh,
      article.officialUrl ?? null
    );
  }
}

async function replaceGlossaryBundle(
  db: AppDatabase,
  bundle: Extract<RemoteBundlePayload, { type: 'glossary' }>
) {
  await clearBundleTables(db, 'glossary', bundle.targetCode);

  for (const term of bundle.glossaryTerms) {
    await db.runAsync(
      `INSERT INTO glossary_terms (exam_version_code, term_en, term_zh, definition_zh, source_tag)
       VALUES (?, ?, ?, ?, ?)`,
      bundle.targetCode,
      term.termEn,
      term.termZh,
      term.definitionZh,
      term.sourceTag ?? 'both'
    );
  }
}

async function clearBundleTables(db: AppDatabase, type: RemoteBundleType, targetCode: string) {
  if (type === 'question-bank') {
    await db.runAsync(
      'DELETE FROM question_options WHERE question_id IN (SELECT id FROM questions WHERE exam_version_code = ?)',
      targetCode
    );
    await db.runAsync('DELETE FROM questions WHERE exam_version_code = ?', targetCode);
    await db.runAsync('DELETE FROM categories WHERE exam_version_code = ?', targetCode);
    return;
  }

  if (type === 'guide') {
    await db.runAsync('DELETE FROM guide_articles WHERE exam_version_code = ?', targetCode);
    return;
  }

  await db.runAsync('DELETE FROM glossary_terms WHERE exam_version_code = ?', targetCode);
}
