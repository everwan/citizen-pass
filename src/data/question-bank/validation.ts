import { StateCode } from '../../types';
import { StateQuestionBank } from './types';

function hasValue(value: string) {
  return value.trim().length > 0;
}

export function validateStateQuestionBank(stateCode: StateCode, questionBank: StateQuestionBank) {
  const categoryIds = new Set(questionBank.categories.map((category) => category.id));
  const questionIds = new Set<string>();
  const errors: string[] = [];

  for (const [categoryId, questions] of Object.entries(questionBank.questionsByCategory)) {
    if (!categoryIds.has(categoryId)) {
      errors.push(`questionsByCategory contains unknown category "${categoryId}"`);
    }

    for (const question of questions) {
      if (questionIds.has(question.id)) {
        errors.push(`duplicate question id "${question.id}"`);
      } else {
        questionIds.add(question.id);
      }

      if (question.categoryId !== categoryId) {
        errors.push(`question "${question.id}" has categoryId "${question.categoryId}" but is stored under "${categoryId}"`);
      }

      if (!hasValue(question.questionEn) || !hasValue(question.questionZh)) {
        errors.push(`question "${question.id}" is missing bilingual question text`);
      }

      if (!hasValue(question.explanationEn) || !hasValue(question.explanationZh)) {
        errors.push(`question "${question.id}" is missing bilingual explanation text`);
      }

      if (question.image && !hasValue(question.image.src)) {
        errors.push(`question "${question.id}" has an image object without a valid src`);
      }

      if (question.options.length < 2) {
        errors.push(`question "${question.id}" must include at least 2 options`);
      }

      const correctOptions = question.options.filter((option) => option.isCorrect);
      if (correctOptions.length !== 1) {
        errors.push(`question "${question.id}" must have exactly 1 correct option`);
      }

      for (const option of question.options) {
        if (!hasValue(option.textEn) || !hasValue(option.textZh)) {
          errors.push(`question "${question.id}" option "${option.key}" is missing bilingual text`);
        }
      }
    }
  }

  for (const category of questionBank.categories) {
    const questions = questionBank.questionsByCategory[category.id] ?? [];
    if (category.questionCount !== questions.length) {
      errors.push(`category "${category.id}" questionCount=${category.questionCount} but actual=${questions.length}`);
    }
  }

  for (const questionId of questionBank.highFrequencyQuestionIds) {
    if (!questionIds.has(questionId)) {
      errors.push(`highFrequencyQuestionIds contains unknown question "${questionId}"`);
    }
  }

  for (const questionId of questionBank.mockQuestionIds) {
    if (!questionIds.has(questionId)) {
      errors.push(`mockQuestionIds contains unknown question "${questionId}"`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      [
        `Invalid question bank for exam version ${stateCode}:`,
        ...errors.map((error) => `- ${error}`),
      ].join('\n')
    );
  }
}
