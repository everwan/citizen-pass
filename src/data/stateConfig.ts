import { LanguageCode, StateCode } from '../types';

export type AppStateDefinition = {
  code: StateCode;
  nameEn: string;
  nameZh: string;
  isAvailable: boolean;
};

export const appStates: AppStateDefinition[] = [
  {
    code: '2008',
    nameEn: '2008 Civics Test',
    nameZh: '2008 版题库',
    isAvailable: true,
  },
  {
    code: '2025',
    nameEn: '2025 Civics Test',
    nameZh: '2025 版题库',
    isAvailable: true,
  },
];

export const availableAppStates = appStates.filter((state) => state.isAvailable);

export const defaultStateCode: StateCode = availableAppStates[1]?.code ?? availableAppStates[0]?.code ?? '2025';

export function isStateCode(value: string | null | undefined): value is StateCode {
  return appStates.some((state) => state.code === value);
}

export function isAvailableStateCode(value: string | null | undefined): value is StateCode {
  return availableAppStates.some((state) => state.code === value);
}

export function getStateDefinition(stateCode: StateCode) {
  return appStates.find((state) => state.code === stateCode) ?? appStates[0];
}

export function getStateDisplayName(stateCode: StateCode, language: LanguageCode) {
  const state = getStateDefinition(stateCode);
  return language === 'zh' ? state.nameZh : state.nameEn;
}

export function getStateDmvLabel(stateCode: StateCode, language: LanguageCode) {
  const name = getStateDisplayName(stateCode, language);
  return name;
}

export function getStateGuideLabel(stateCode: StateCode, language: LanguageCode) {
  const name = getStateDisplayName(stateCode, language);
  return language === 'zh' ? `${name} 指南` : `${name} Guide`;
}
