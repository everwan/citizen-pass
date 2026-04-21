import { Question } from '../types';
import { RoadSign, roadSigns } from './roadSignData';

const ROAD_SIGN_QUESTION_PREFIX = 'road-sign-';

export function buildRoadSignQuestionId(signId: string) {
  return `${ROAD_SIGN_QUESTION_PREFIX}${signId}`;
}

export function isRoadSignQuestionId(questionId: string) {
  return questionId.startsWith(ROAD_SIGN_QUESTION_PREFIX);
}

export function getRoadSignIdFromQuestionId(questionId: string) {
  return isRoadSignQuestionId(questionId) ? questionId.slice(ROAD_SIGN_QUESTION_PREFIX.length) : null;
}

export function buildRoadSignQuestionFromSign(sign: RoadSign, pool: RoadSign[] = roadSigns): Question | null {
  if (!sign) {
    return null;
  }

  const signIndex = pool.findIndex((item) => item.id === sign.id);
  const distractors = pool
    .filter((item) => item.id !== sign.id && item.category === sign.category)
    .slice(0, 3);

  if (distractors.length < 3) {
    for (const item of pool) {
      if (item.id !== sign.id && !distractors.find((existing) => existing.id === item.id)) {
        distractors.push(item);
      }
      if (distractors.length === 3) {
        break;
      }
    }
  }

  const baseOptions = [sign, ...distractors]
    .slice(0, 4)
    .map((item, index) => ({
      key: (['A', 'B', 'C', 'D'] as const)[index],
      textEn: item.meaningEn,
      textZh: item.meaningZh,
      isCorrect: item.id === sign.id,
    }));
  const rotateBy = signIndex >= 0 ? signIndex % baseOptions.length : 0;
  const options = baseOptions.map((_, index) => {
    const option = baseOptions[(index + rotateBy) % baseOptions.length];
    return {
      ...option,
      key: (['A', 'B', 'C', 'D'] as const)[index],
    };
  });

  return {
    id: buildRoadSignQuestionId(sign.id),
    categoryId: 'road-signs',
    categoryLabel: 'Road Signs',
    questionEn: 'What does this sign mean?',
    questionZh: '这个路标表示什么？',
    explanationEn: sign.meaningEn,
    explanationZh: sign.meaningZh,
    options,
  };
}

export function buildRoadSignQuestion(signId: string): Question | null {
  const sign = roadSigns.find((item) => item.id === signId);
  return sign ? buildRoadSignQuestionFromSign(sign) : null;
}

export function getRoadSignQuestionById(questionId: string) {
  const signId = getRoadSignIdFromQuestionId(questionId);
  return signId ? buildRoadSignQuestion(signId) : null;
}
