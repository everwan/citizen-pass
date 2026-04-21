import { LanguageCode, StateCode } from '../types';
import { RoadSign, RoadSignCategory, roadSigns } from './roadSignData';
import { coreRoadSignIds } from './roadSignCore';

export const nyOfficialRoadSignIds = [
  'lane-ends-merge-left',
  'yield-sign',
  'merging-traffic',
  'stop-sign',
  'railroad-crossbuck',
  'traffic-signal-ahead',
  'school-xing',
  'keep-right',
  'slippery-road',
  'no-left-turn',
  'divided-highway',
  'do-not-enter',
  'two-way-traffic',
  'nine-percent-grade',
  'no-u-turn',
  'hospital',
] as const;

export const nyHandbookRoadSignIds = [
  'ny-no-right-turn',
  'ny-do-not-pass',
  'ny-no-turn-on-red',
  'ny-speed-limit-55',
  'ny-warning-narrow-bridge',
  'ny-warning-divided-highway',
  'ny-warning-winding-road',
  'ny-warning-pedestrian-crossing',
  'ny-signal-traffic-light-red',
  'ny-signal-flashing-red',
  'ny-signal-flashing-yellow',
  'ny-signal-green',
  'ny-signal-green-arrow',
  'ny-lane-use-lights',
  'ny-marking-edge-and-lane-lines',
  'ny-marking-broken-line',
  'ny-marking-solid-and-broken',
  'ny-marking-double-solid',
  'ny-marking-solid-line',
  'ny-marking-stop-line',
  'ny-marking-crosswalk',
  'ny-marking-arrow-lane',
  'ny-marking-hov-diamond',
  'ny-work-roadwork-1000ft',
  'ny-work-flagger-ahead',
  'ny-work-construction-ahead',
  'ny-work-flag-stop',
  'ny-work-flag-proceed',
  'ny-work-flag-slow',
  'ny-route-state-60',
  'ny-route-us-20',
  'ny-route-interstate-84',
  'ny-destination-example',
  'ny-service-gas',
  'ny-service-camping',
] as const;

export const nyRoadSignIds = [...nyOfficialRoadSignIds, ...nyHandbookRoadSignIds] as const;

const nySignGroupDefinitions = [
  {
    id: 'official-focus',
    labelEn: 'Official Focus Signs',
    labelZh: '官网重点路标',
    descriptionEn: 'The 16 signs NY DMV highlights for permit prep.',
    descriptionZh: '纽约 DMV 明确点名的 16 个重点路标。',
    signIds: nyOfficialRoadSignIds,
  },
  {
    id: 'regulatory',
    labelEn: 'Regulatory Signs',
    labelZh: '禁令标志',
    descriptionEn: 'Turn, passing, and speed-limit rules from Chapter 4.',
    descriptionZh: 'Chapter 4 里的转向、超车和限速规则标志。',
    signIds: ['ny-no-right-turn', 'ny-do-not-pass', 'ny-no-turn-on-red', 'ny-speed-limit-55'] as const,
  },
  {
    id: 'warning',
    labelEn: 'Warning Signs',
    labelZh: '警告标志',
    descriptionEn: 'Common bridge, divider, curve, and crossing warnings.',
    descriptionZh: '常见的桥梁、分隔、公路弯道和过街警告标志。',
    signIds: ['ny-warning-narrow-bridge', 'ny-warning-divided-highway', 'ny-warning-winding-road', 'ny-warning-pedestrian-crossing'] as const,
  },
  {
    id: 'signals',
    labelEn: 'Traffic Signals',
    labelZh: '交通信号',
    descriptionEn: 'Traffic lights, flashing lights, arrows, and lane-use lights.',
    descriptionZh: '交通灯、闪灯、箭头灯和车道使用信号。',
    signIds: ['ny-signal-traffic-light-red', 'ny-signal-flashing-red', 'ny-signal-flashing-yellow', 'ny-signal-green', 'ny-signal-green-arrow', 'ny-lane-use-lights'] as const,
  },
  {
    id: 'markings',
    labelEn: 'Pavement Markings',
    labelZh: '路面标线',
    descriptionEn: 'Lane lines, stop lines, crosswalks, arrows, and HOV markings.',
    descriptionZh: '车道线、停止线、人行横道、箭头和 HOV 菱形标记。',
    signIds: ['ny-marking-edge-and-lane-lines', 'ny-marking-broken-line', 'ny-marking-solid-and-broken', 'ny-marking-double-solid', 'ny-marking-solid-line', 'ny-marking-stop-line', 'ny-marking-crosswalk', 'ny-marking-arrow-lane', 'ny-marking-hov-diamond'] as const,
  },
  {
    id: 'construction',
    labelEn: 'Work Zones',
    labelZh: '施工路段',
    descriptionEn: 'Construction warnings and flag-person control signals.',
    descriptionZh: '施工警告标志和旗手交通指挥信号。',
    signIds: ['ny-work-roadwork-1000ft', 'ny-work-flagger-ahead', 'ny-work-construction-ahead', 'ny-work-flag-stop', 'ny-work-flag-proceed', 'ny-work-flag-slow'] as const,
  },
  {
    id: 'guide',
    labelEn: 'Guide & Service Signs',
    labelZh: '指路与服务标志',
    descriptionEn: 'Route shields, destination signs, gas, and camping services.',
    descriptionZh: '路线盾牌、目的地指示牌、加油站和露营服务标志。',
    signIds: ['ny-route-state-60', 'ny-route-us-20', 'ny-route-interstate-84', 'ny-destination-example', 'ny-service-gas', 'ny-service-camping'] as const,
  },
] as const;

const roadSignIdsByState: Record<StateCode, readonly string[]> = {
  '2008': coreRoadSignIds,
  '2025': nyRoadSignIds,
  CA: coreRoadSignIds,
  NY: nyRoadSignIds,
};

const roadSignCategoryLabels: Record<RoadSignCategory, { en: string; zh: string }> = {
  warning: { en: 'Warning', zh: '警告标志' },
  regulatory: { en: 'Regulatory', zh: '禁令标志' },
  regulatory_continued: { en: 'Regulatory (Continued)', zh: '禁令标志(续)' },
  construction: { en: 'Construction', zh: '施工标志' },
  guide: { en: 'Guide', zh: '指路标志' },
};

const nyHandbookRoadSigns: RoadSign[] = [
  {
    id: 'ny-no-right-turn',
    titleEn: 'NO RIGHT TURN',
    titleZh: '禁止右转',
    category: 'regulatory',
    shape: 'circle-slash',
    colorTheme: 'red-white',
    meaningEn: 'Right turns are prohibited here.',
    meaningZh: '此处禁止右转。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-no-right-turn.png',
  },
  {
    id: 'ny-do-not-pass',
    titleEn: 'DO NOT PASS',
    titleZh: '禁止超车',
    category: 'regulatory',
    shape: 'rectangle',
    colorTheme: 'white',
    meaningEn: 'Passing other vehicles is not allowed.',
    meaningZh: '禁止超越前车。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-do-not-pass.png',
  },
  {
    id: 'ny-no-turn-on-red',
    titleEn: 'NO TURN ON RED',
    titleZh: '红灯禁止转弯',
    category: 'regulatory',
    shape: 'rectangle',
    colorTheme: 'white',
    meaningEn: 'Do not turn on red after stopping.',
    meaningZh: '即使停车后，也禁止在红灯时转弯。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-no-turn-on-red.png',
  },
  {
    id: 'ny-speed-limit-55',
    titleEn: 'SPEED LIMIT 55',
    titleZh: '限速 55',
    category: 'regulatory',
    shape: 'rectangle',
    colorTheme: 'white',
    meaningEn: 'Maximum speed limit is 55 mph.',
    meaningZh: '最高限速为 55 英里/小时。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-speed-limit-55.png',
  },
  {
    id: 'ny-warning-narrow-bridge',
    titleEn: 'NARROW BRIDGE',
    titleZh: '窄桥',
    category: 'warning',
    shape: 'diamond',
    colorTheme: 'yellow',
    meaningEn: 'Bridge ahead is narrower than the road.',
    meaningZh: '前方桥面比路面更窄。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-warning-narrow-bridge.png',
  },
  {
    id: 'ny-warning-divided-highway',
    titleEn: 'DIVIDED HIGHWAY',
    titleZh: '分隔公路',
    category: 'warning',
    shape: 'diamond',
    colorTheme: 'yellow',
    meaningEn: 'The road ahead is divided by a median or barrier.',
    meaningZh: '前方道路由中央分隔带或障碍物分隔。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-warning-divided-highway.png',
  },
  {
    id: 'ny-warning-winding-road',
    titleEn: 'WINDING ROAD',
    titleZh: '连续弯道',
    category: 'warning',
    shape: 'diamond',
    colorTheme: 'yellow',
    meaningEn: 'Road ahead has several curves.',
    meaningZh: '前方道路连续弯曲。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-warning-winding-road.png',
  },
  {
    id: 'ny-warning-pedestrian-crossing',
    titleEn: 'PEDESTRIAN CROSSING',
    titleZh: '行人横穿',
    category: 'warning',
    shape: 'pentagon',
    colorTheme: 'yellow',
    meaningEn: 'Watch for pedestrians crossing.',
    meaningZh: '注意行人横穿道路。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-warning-pedestrian-crossing.png',
  },
  {
    id: 'ny-work-roadwork-1000ft',
    titleEn: 'ROAD WORK 1000 FT',
    titleZh: '前方 1000 英尺施工',
    category: 'construction',
    shape: 'diamond',
    colorTheme: 'orange',
    meaningEn: 'Road work area ahead.',
    meaningZh: '前方道路施工区域。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-work-roadwork-1000ft.png',
  },
  {
    id: 'ny-work-flagger-ahead',
    titleEn: 'FLAGGER AHEAD',
    titleZh: '前方旗手指挥',
    category: 'construction',
    shape: 'diamond',
    colorTheme: 'orange',
    meaningEn: 'A flag person is ahead controlling traffic.',
    meaningZh: '前方有旗手指挥交通。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-work-flagger-ahead.png',
  },
  {
    id: 'ny-work-construction-ahead',
    titleEn: 'CONSTRUCTION AHEAD',
    titleZh: '前方施工',
    category: 'construction',
    shape: 'diamond',
    colorTheme: 'orange',
    meaningEn: 'Construction zone ahead.',
    meaningZh: '前方进入施工区域。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-work-construction-ahead.png',
  },
  {
    id: 'ny-route-state-60',
    titleEn: 'STATE ROUTE',
    titleZh: '州道路线',
    category: 'guide',
    shape: 'shield',
    colorTheme: 'black-white',
    meaningEn: 'State route sign.',
    meaningZh: '州道路编号标志。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-route-state-60.png',
  },
  {
    id: 'ny-route-us-20',
    titleEn: 'U.S. ROUTE',
    titleZh: '美国国道',
    category: 'guide',
    shape: 'shield',
    colorTheme: 'black-white',
    meaningEn: 'U.S. route sign.',
    meaningZh: '美国国道编号标志。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-route-us-20.png',
  },
  {
    id: 'ny-route-interstate-84',
    titleEn: 'INTERSTATE',
    titleZh: '州际公路',
    category: 'guide',
    shape: 'shield',
    colorTheme: 'red-blue-white',
    meaningEn: 'Interstate route sign.',
    meaningZh: '州际公路编号标志。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-route-interstate-84.png',
  },
  {
    id: 'ny-service-gas',
    titleEn: 'GAS',
    titleZh: '加油站',
    category: 'guide',
    shape: 'panel',
    colorTheme: 'blue',
    meaningEn: 'Gas available.',
    meaningZh: '前方有加油站服务。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-service-gas.png',
  },
  {
    id: 'ny-service-camping',
    titleEn: 'CAMPING',
    titleZh: '露营地',
    category: 'guide',
    shape: 'panel',
    colorTheme: 'blue',
    meaningEn: 'Camping available.',
    meaningZh: '前方有露营地服务。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-service-camping.png',
  },
  {
    id: 'ny-destination-example',
    titleEn: 'DESTINATION SIGN',
    titleZh: '目的地指示牌',
    category: 'guide',
    shape: 'panel',
    colorTheme: 'green',
    meaningEn: 'Shows directions and distances to destinations.',
    meaningZh: '显示目的地方向与距离。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-destination-example.png',
  },
  {
    id: 'ny-signal-traffic-light-red',
    titleEn: 'TRAFFIC LIGHT (RED)',
    titleZh: '交通信号灯（红灯）',
    category: 'regulatory_continued',
    shape: 'signal',
    colorTheme: 'signal',
    meaningEn: 'Red means stop.',
    meaningZh: '红灯表示必须停车。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-signal-traffic-light-red.png',
  },
  {
    id: 'ny-signal-flashing-red',
    titleEn: 'FLASHING RED',
    titleZh: '闪烁红灯',
    category: 'regulatory_continued',
    shape: 'signal',
    colorTheme: 'signal',
    meaningEn: 'Stop, then proceed when safe (like a STOP sign).',
    meaningZh: '先停车，再在安全时通行（相当于停车标志）。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-signal-flashing-red.png',
  },
  {
    id: 'ny-signal-flashing-yellow',
    titleEn: 'FLASHING YELLOW',
    titleZh: '闪烁黄灯',
    category: 'regulatory_continued',
    shape: 'signal',
    colorTheme: 'signal',
    meaningEn: 'Slow down and proceed with caution.',
    meaningZh: '减速并谨慎通行。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-signal-flashing-yellow.png',
  },
  {
    id: 'ny-signal-green',
    titleEn: 'GREEN LIGHT',
    titleZh: '绿灯',
    category: 'regulatory_continued',
    shape: 'signal',
    colorTheme: 'signal',
    meaningEn: 'Proceed if the intersection is clear.',
    meaningZh: '确认路口安全后通行。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-signal-green.png',
  },
  {
    id: 'ny-signal-green-arrow',
    titleEn: 'GREEN ARROW',
    titleZh: '绿箭头',
    category: 'regulatory_continued',
    shape: 'signal',
    colorTheme: 'signal',
    meaningEn: 'You may proceed in the direction of the arrow.',
    meaningZh: '可按箭头方向通行。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-dmv-signal-green-arrow.png',
  },
  {
    id: 'ny-lane-use-lights',
    titleEn: 'LANE USE LIGHTS',
    titleZh: '车道使用信号灯',
    category: 'regulatory_continued',
    shape: 'panel',
    colorTheme: 'signal',
    meaningEn: 'Lane control signals show which lanes are open or closed.',
    meaningZh: '车道控制信号提示哪些车道可通行、哪些车道关闭。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-lanelights.png',
  },
  {
    id: 'ny-marking-edge-and-lane-lines',
    titleEn: 'EDGE & LANE LINES',
    titleZh: '路缘线与车道线',
    category: 'regulatory_continued',
    shape: 'panel',
    colorTheme: 'marking',
    meaningEn: 'Edge lines and lane lines guide traffic and indicate lane boundaries.',
    meaningZh: '路缘线与车道线用于引导交通并标示车道边界。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-edgemarks.png',
  },
  {
    id: 'ny-marking-broken-line',
    titleEn: 'BROKEN LINE',
    titleZh: '虚线',
    category: 'regulatory_continued',
    shape: 'panel',
    colorTheme: 'marking',
    meaningEn: 'You may cross a broken line when it is safe.',
    meaningZh: '在安全情况下可越过虚线。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-brokenline.png',
  },
  {
    id: 'ny-marking-solid-and-broken',
    titleEn: 'SOLID & BROKEN LINE',
    titleZh: '实线与虚线组合',
    category: 'regulatory_continued',
    shape: 'panel',
    colorTheme: 'marking',
    meaningEn: 'Passing rules depend on which side has the broken line.',
    meaningZh: '是否可超车取决于你这一侧是虚线还是实线。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-solidbrokenline.png',
  },
  {
    id: 'ny-marking-double-solid',
    titleEn: 'DOUBLE SOLID LINES',
    titleZh: '双实线',
    category: 'regulatory_continued',
    shape: 'panel',
    colorTheme: 'marking',
    meaningEn: 'Do not cross double solid lines.',
    meaningZh: '不得越过双实线。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-doublesolidline.png',
  },
  {
    id: 'ny-marking-solid-line',
    titleEn: 'SOLID LINE',
    titleZh: '实线',
    category: 'regulatory_continued',
    shape: 'panel',
    colorTheme: 'marking',
    meaningEn: 'A solid line discourages lane changes; do not cross when prohibited.',
    meaningZh: '实线表示不应随意变道；在禁止情况下不得越线。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-solidline.png',
  },
  {
    id: 'ny-marking-stop-line',
    titleEn: 'STOP LINE',
    titleZh: '停止线',
    category: 'regulatory_continued',
    shape: 'panel',
    colorTheme: 'marking',
    meaningEn: 'Stop before the stop line when required.',
    meaningZh: '需要停车时，应在停止线前停车。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-stopline.png',
  },
  {
    id: 'ny-marking-crosswalk',
    titleEn: 'CROSSWALK',
    titleZh: '人行横道线',
    category: 'regulatory_continued',
    shape: 'panel',
    colorTheme: 'marking',
    meaningEn: 'Crosswalk lines mark where pedestrians cross.',
    meaningZh: '人行横道线标示行人过街区域。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-crosswalk.png',
  },
  {
    id: 'ny-marking-arrow-lane',
    titleEn: 'ARROW MARKINGS',
    titleZh: '箭头路面标线',
    category: 'regulatory_continued',
    shape: 'panel',
    colorTheme: 'marking',
    meaningEn: 'Arrows show which lane you must use for a turn.',
    meaningZh: '箭头提示你应使用哪条车道转弯或直行。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-arrows.png',
  },
  {
    id: 'ny-marking-hov-diamond',
    titleEn: 'DIAMOND SYMBOL (HOV/BUS)',
    titleZh: '菱形标记（专用车道）',
    category: 'regulatory_continued',
    shape: 'panel',
    colorTheme: 'marking',
    meaningEn: 'Diamond symbols indicate reserved lanes (bus/HOV/bike) when posted.',
    meaningZh: '菱形标记表示按标志规定的专用车道（公交/HOV/自行车等）。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-hovlane.png',
  },
  {
    id: 'ny-work-flag-stop',
    titleEn: 'FLAG PERSON: STOP',
    titleZh: '旗手：停车',
    category: 'construction',
    shape: 'panel',
    colorTheme: 'workzone',
    meaningEn: 'A flag person is directing traffic to stop.',
    meaningZh: '旗手指挥交通停车。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-flag-stop.png',
  },
  {
    id: 'ny-work-flag-proceed',
    titleEn: 'FLAG PERSON: PROCEED',
    titleZh: '旗手：通行',
    category: 'construction',
    shape: 'panel',
    colorTheme: 'workzone',
    meaningEn: 'A flag person is directing traffic to proceed.',
    meaningZh: '旗手指挥交通通行。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-flag-proceed.png',
  },
  {
    id: 'ny-work-flag-slow',
    titleEn: 'FLAG PERSON: SLOW',
    titleZh: '旗手：减速',
    category: 'construction',
    shape: 'panel',
    colorTheme: 'workzone',
    meaningEn: 'A flag person is directing traffic to slow down.',
    meaningZh: '旗手指挥交通减速。',
    relatedQuestionCodes: [],
    imageAsset: 'signs/ny-ch4-flag-slow.png',
  },
];

const nyRoadSignOverrides: Partial<Record<(typeof nyOfficialRoadSignIds)[number], Partial<RoadSign>>> = {
  'lane-ends-merge-left': {
    titleEn: 'RIGHT LANE ENDS',
    titleZh: '右侧车道结束',
    meaningEn: 'Right lane ends ahead. Stay to the left.',
    meaningZh: '前方右侧车道结束，请保持在左侧车道行驶。',
  },
  'merging-traffic': {
    titleEn: 'MERGING TRAFFIC',
    titleZh: '右侧并入交通',
    meaningEn: 'Traffic will merge from the right.',
    meaningZh: '前方有车辆从右侧并入。',
  },
  'railroad-crossbuck': {
    titleEn: 'RAILROAD CROSSING',
    titleZh: '铁路道口',
    meaningEn: 'A railroad crossing is ahead.',
    meaningZh: '前方有铁路道口。',
  },
  'school-xing': {
    titleEn: 'SCHOOL CROSSING',
    titleZh: '学校过街',
    meaningEn: 'Watch for children crossing near a school.',
    meaningZh: '注意学校附近有儿童过街。',
  },
  'slippery-road': {
    titleEn: 'SLIPPERY WHEN WET',
    titleZh: '湿滑路面',
    meaningEn: 'Road is slippery when wet.',
    meaningZh: '路面在潮湿时容易打滑。',
  },
  'divided-highway': {
    titleEn: 'DIVIDED HIGHWAY ENDS',
    titleZh: '分隔公路结束',
    meaningEn: 'The divided highway ends ahead. Prepare for two-way traffic.',
    meaningZh: '前方分隔公路结束，请准备进入双向通行路段。',
  },
  'do-not-enter': {
    titleEn: 'DO NOT ENTER',
    titleZh: '单行道禁止驶入',
    meaningEn: 'Do not enter from this direction.',
    meaningZh: '禁止从该方向驶入。',
  },
  'two-way-traffic': {
    titleEn: 'TWO WAY TRAFFIC',
    titleZh: '双向通行',
    meaningEn: 'Traffic ahead moves in both directions.',
    meaningZh: '前方道路为双向通行。',
  },
  'nine-percent-grade': {
    titleEn: 'HILL AHEAD',
    titleZh: '前方陡坡',
    meaningEn: 'A steep hill is ahead.',
    meaningZh: '前方有陡坡。',
  },
  'hospital': {
    titleEn: 'HOSPITAL TO THE RIGHT',
    titleZh: '右侧医院',
    meaningEn: 'Hospital is to the right.',
    meaningZh: '医院在右侧。',
  },
};

export function getRoadSignIdsForState(stateCode: StateCode) {
  return roadSignIdsByState[stateCode] ?? coreRoadSignIds;
}

export function getRoadSignsForState(stateCode: StateCode) {
  const selectedIds = getRoadSignIdsForState(stateCode);
  const pool = stateCode === 'NY' ? roadSigns.concat(nyHandbookRoadSigns) : roadSigns;
  const signById = new Map(pool.map((sign) => [sign.id, sign] as const));

  return selectedIds
    .map((id) => signById.get(id))
    .filter((sign): sign is RoadSign => Boolean(sign))
    .map((sign) => {
      if (stateCode !== 'NY') {
        return sign;
      }

      const override = nyRoadSignOverrides[sign.id as keyof typeof nyRoadSignOverrides];
      return override ? { ...sign, ...override } : sign;
    });
}

export function getRoadSignPackHomeSubtitle(stateCode: StateCode, language: LanguageCode) {
  if (stateCode === 'NY') {
    return language === 'zh' ? '纽约 DMV 路标专项（官网重点 + 手册补充）' : 'NY DMV road signs (focus + handbook)';
  }

  return language === 'zh' ? '全美通用路标深度解析' : 'Image-first road sign drill';
}

export function getRoadSignPackPracticeBody(stateCode: StateCode, language: LanguageCode) {
  if (stateCode === 'NY') {
    return language === 'zh' ? '官网重点优先，手册路标补齐覆盖面' : 'Start with focus signs, then handbook set';
  }

  return language === 'zh' ? '看图识义与路标卡片' : 'Sign meaning drills and visual cards';
}

export function getRoadSignPackIntroBody(stateCode: StateCode, language: LanguageCode) {
  if (stateCode === 'NY') {
    return language === 'zh'
      ? '先刷纽约 DMV 官网明确点名的重点路标，再用手册章节的常见路标补齐覆盖面。'
      : 'Start with NY DMV focus signs, then continue with the handbook sign set for broader coverage.';
  }

  return language === 'zh'
    ? '集中练习常见路标标题、路缘颜色和信号含义，适合先把高频识别题吃透。'
    : 'Focus on common sign titles, curb colors, and signal meanings before full drills.';
}

export function getRoadSignPackSummaryTitle(stateCode: StateCode, language: LanguageCode) {
  if (stateCode === 'NY') {
    return language === 'zh' ? '纽约专项题包：重点路标 + 手册补充' : 'Pack: focus + handbook';
  }

  return language === 'zh' ? '专项题包：看图识义 + 路标卡片' : 'Pack: sign meaning + flash cards';
}

export function getRoadSignTagLabels(categories: RoadSignCategory[], language: LanguageCode) {
  return Array.from(new Set(categories))
    .map((category) => roadSignCategoryLabels[category][language])
    .slice(0, 4);
}

export function getRoadSignGroupsForState(stateCode: StateCode, language: LanguageCode, signs: RoadSign[]) {
  if (stateCode !== 'NY') {
    return Object.entries(roadSignCategoryLabels)
      .map(([category, labels]) => ({
        id: category,
        title: labels[language],
        subtitle: language === 'zh' ? labels.en : labels.zh,
        signs: signs.filter((sign) => sign.category === category),
      }))
      .filter((group) => group.signs.length > 0);
  }

  const signById = new Map(signs.map((sign) => [sign.id, sign] as const));
  return nySignGroupDefinitions
    .map((group) => ({
      id: group.id,
      title: language === 'zh' ? group.labelZh : group.labelEn,
      subtitle: language === 'zh' ? group.descriptionZh : group.descriptionEn,
      signs: group.signIds
        .map((signId) => signById.get(signId))
        .filter((sign): sign is RoadSign => Boolean(sign)),
    }))
    .filter((group) => group.signs.length > 0);
}
