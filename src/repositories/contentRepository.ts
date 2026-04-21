import { Category, GlossaryTerm, GuideArticle, Question, QuestionOption, StateCode } from '../types';
import { AppDatabase } from '../db/types';
import { getRoadSignQuestionById } from '../data/roadSignQuestions';
import { getQuestionImageById } from '../data/stateContent';

type CategoryRow = {
  exam_version_code: string;
  id: string;
  name_en: string;
  name_zh: string;
  question_count: number;
  progress: number;
  accuracy: number;
};

type QuestionRow = {
  id: string;
  exam_version_code: string;
  category_id: string;
  category_label: string;
  question_en: string;
  question_zh: string;
  explanation_en: string;
  explanation_zh: string;
  memory_tip_en: string;
  memory_tip_zh: string;
};

type OptionRow = {
  option_key: 'A' | 'B' | 'C' | 'D';
  text_en: string;
  text_zh: string;
  is_correct: number;
};

type GuideArticleRow = {
  exam_version_code: string;
  slug: string;
  title_en: string;
  title_zh: string;
  content_en: string;
  content_zh: string;
  official_url: string | null;
};

type GlossaryTermRow = {
  exam_version_code: string;
  term_en: string;
  term_zh: string;
  definition_zh: string;
  source_tag?: 'reading' | 'writing' | 'both';
};

export async function getCategories(db: AppDatabase, stateCode: StateCode): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories WHERE exam_version_code = ? ORDER BY name_en',
    stateCode
  );
  return rows.map((row) => ({
    id: row.id,
    nameEn: row.name_en,
    nameZh: row.name_zh,
    questionCount: row.question_count,
    progress: row.progress,
    accuracy: row.accuracy,
  }));
}

export async function getQuestionsByCategory(
  db: AppDatabase,
  stateCode: StateCode,
  categoryId?: string
): Promise<Question[]> {
  const questionRows = categoryId
    ? await db.getAllAsync<QuestionRow>(
        'SELECT * FROM questions WHERE exam_version_code = ? AND category_id = ? ORDER BY id',
        stateCode,
        categoryId
      )
    : await db.getAllAsync<QuestionRow>(
        'SELECT * FROM questions WHERE exam_version_code = ? ORDER BY id',
        stateCode
      );

  const questions: Question[] = [];

  for (const row of questionRows) {
    const optionRows = await db.getAllAsync<OptionRow>(
      'SELECT option_key, text_en, text_zh, is_correct FROM question_options WHERE question_id = ? ORDER BY option_key',
      row.id
    );

    questions.push({
      id: row.id,
      categoryId: row.category_id,
      categoryLabel: row.category_label,
      questionEn: row.question_en,
      questionZh: row.question_zh,
      explanationEn: row.explanation_en,
      explanationZh: row.explanation_zh,
      memoryTipEn: row.memory_tip_en,
      memoryTipZh: row.memory_tip_zh,
      image: getQuestionImageById(row.id),
      options: optionRows.map<QuestionOption>((option) => ({
        key: option.option_key,
        textEn: option.text_en,
        textZh: option.text_zh,
        isCorrect: option.is_correct === 1,
      })),
    });
  }

  return questions;
}

export async function getQuestionById(db: AppDatabase, stateCode: StateCode, questionId: string): Promise<Question | null> {
  const roadSignQuestion = getRoadSignQuestionById(questionId);
  if (roadSignQuestion) {
    return roadSignQuestion;
  }

  const rows = await getQuestionsByCategory(db, stateCode);
  return rows.find((question) => question.id === questionId) ?? null;
}

export async function getQuestionsByIds(db: AppDatabase, stateCode: StateCode, questionIds: string[]): Promise<Question[]> {
  const rows = await Promise.all(questionIds.map((questionId) => getQuestionById(db, stateCode, questionId)));
  return rows.filter((question): question is Question => Boolean(question));
}

export async function getGuideArticles(db: AppDatabase, stateCode: StateCode): Promise<GuideArticle[]> {
  const rows = await db.getAllAsync<GuideArticleRow>(
    'SELECT * FROM guide_articles WHERE exam_version_code = ? ORDER BY slug',
    stateCode
  );
  return rows.map((row) => ({
    slug: row.slug,
    titleEn: row.title_en,
    titleZh: row.title_zh,
    contentEn: row.content_en,
    contentZh: row.content_zh,
    officialUrl: row.official_url ?? undefined,
  }));
}

export async function getGlossaryTerms(db: AppDatabase, stateCode: StateCode): Promise<GlossaryTerm[]> {
  const rows = await db.getAllAsync<GlossaryTermRow>(
    'SELECT * FROM glossary_terms WHERE exam_version_code = ? ORDER BY term_en',
    stateCode
  );
  return rows.map((row) => ({
    termEn: row.term_en,
    termZh: row.term_zh,
    definitionZh: row.definition_zh,
    sourceTag: row.source_tag ?? 'both',
  }));
}
