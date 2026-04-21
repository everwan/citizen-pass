import { uscisAnswerAudioSources, uscisQuestionAudioSources } from './uscisAudioManifest';

export function getQuestionAudioSource(questionId: string) {
  return uscisQuestionAudioSources[questionId] ?? null;
}

export function getAnswerAudioSource(questionId: string) {
  return uscisAnswerAudioSources[questionId] ?? null;
}
