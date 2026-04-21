export type RoadSignCategory = 'warning' | 'regulatory' | 'regulatory_continued' | 'construction' | 'guide';

export type RoadSign = {
  id: string;
  titleEn: string;
  titleZh: string;
  category: RoadSignCategory;
  shape: string;
  colorTheme: string;
  meaningEn: string;
  meaningZh: string;
  relatedQuestionCodes: string[];
  imageAsset: string;
};

export const roadSigns: RoadSign[] = [
  {
    "id": "lane-ends",
    "titleEn": "LANE ENDS",
    "titleZh": "车道结束",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "Your lane ends ahead. Merge safely.",
    "meaningZh": "前方车道结束，请安全并线。",
    "relatedQuestionCodes": [
      "CA-LN-014"
    ],
    "imageAsset": "signs/lane-ends.png"
  },
  {
    "id": "crossroad",
    "titleEn": "CROSSROAD",
    "titleZh": "十字路口",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "Another road crosses ahead.",
    "meaningZh": "前方有十字路口。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/crossroad.png"
  },
  {
    "id": "divided-highway",
    "titleEn": "DIVIDED HIGHWAY",
    "titleZh": "分隔公路",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The road ahead is divided by a median or barrier.",
    "meaningZh": "前方道路由中央分隔带或障碍物分隔。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/divided-highway.png"
  },
  {
    "id": "two-way-traffic",
    "titleEn": "TWO WAY TRAFFIC",
    "titleZh": "双向交通",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "Traffic ahead moves in both directions.",
    "meaningZh": "前方为双向通行道路。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/two-way-traffic.png"
  },
  {
    "id": "end-freeway-half-mile",
    "titleEn": "END FREEWAY 1/2 MI",
    "titleZh": "前方半英里高速结束",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The freeway ends ahead. Prepare to exit or merge.",
    "meaningZh": "前方半英里高速结束，请准备驶离或并入。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/end-freeway-half-mile.png"
  },
  {
    "id": "winding-road",
    "titleEn": "WINDING ROAD",
    "titleZh": "弯曲道路",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The road ahead has several curves.",
    "meaningZh": "前方道路连续弯曲。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/winding-road.png"
  },
  {
    "id": "right-turn-25",
    "titleEn": "RIGHT TURN 25",
    "titleZh": "前方右转建议25英里",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "A sharp right turn is ahead. Slow to the advisory speed.",
    "meaningZh": "前方急右转，请降至建议速度。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/right-turn-25.png"
  },
  {
    "id": "stop-ahead",
    "titleEn": "STOP AHEAD",
    "titleZh": "前方停车标志",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "A stop sign is ahead. Prepare to stop.",
    "meaningZh": "前方有停车标志，请准备停车。",
    "relatedQuestionCodes": [
      "CA-RS-029"
    ],
    "imageAsset": "signs/stop-ahead.png"
  },
  {
    "id": "yield-ahead",
    "titleEn": "YIELD AHEAD",
    "titleZh": "前方让行标志",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "A yield sign is ahead. Prepare to slow and yield.",
    "meaningZh": "前方有让行标志，请准备减速让行。",
    "relatedQuestionCodes": [
      "CA-RS-030"
    ],
    "imageAsset": "signs/yield-ahead.png"
  },
  {
    "id": "railroad-crossing-round",
    "titleEn": "RAILROAD CROSSING",
    "titleZh": "铁路道口",
    "category": "warning",
    "shape": "circle",
    "colorTheme": "yellow",
    "meaningEn": "A railroad crossing is ahead.",
    "meaningZh": "前方有铁路道口。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/railroad-crossing-round.png"
  },
  {
    "id": "four-tracks",
    "titleEn": "4 TRACKS",
    "titleZh": "四股铁轨",
    "category": "warning",
    "shape": "panel",
    "colorTheme": "yellow",
    "meaningEn": "There are four tracks at the railroad crossing ahead.",
    "meaningZh": "前方铁路道口有四股铁轨。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/four-tracks.png"
  },
  {
    "id": "slippery-road",
    "titleEn": "SLIPPERY ROAD",
    "titleZh": "路滑",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The road can be slippery when wet.",
    "meaningZh": "前方路面湿滑。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/slippery-road.png"
  },
  {
    "id": "no-passing-zone",
    "titleEn": "NO PASSING ZONE",
    "titleZh": "禁止超车区",
    "category": "warning",
    "shape": "triangle",
    "colorTheme": "yellow",
    "meaningEn": "Passing is not allowed in this area.",
    "meaningZh": "该路段禁止超车。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/no-passing-zone.png"
  },
  {
    "id": "added-lane",
    "titleEn": "ADDED LANE",
    "titleZh": "增加车道",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "An extra lane begins ahead.",
    "meaningZh": "前方将增加一条车道。",
    "relatedQuestionCodes": [
      "CA-RS-031"
    ],
    "imageAsset": "signs/added-lane.png"
  },
  {
    "id": "thru-traffic-merge-left",
    "titleEn": "THRU TRAFFIC MERGE LEFT",
    "titleZh": "直行车辆向左并线",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "Traffic in your lane must merge left.",
    "meaningZh": "本车道车辆需向左并线。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/thru-traffic-merge-left.png"
  },
  {
    "id": "lane-ends-merge-left",
    "titleEn": "LANE ENDS MERGE LEFT",
    "titleZh": "车道结束向左并线",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The right lane ends. Merge left safely.",
    "meaningZh": "右侧车道结束，请安全向左并线。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/lane-ends-merge-left.png"
  },
  {
    "id": "traffic-signal-ahead",
    "titleEn": "TRAFFIC SIGNAL AHEAD",
    "titleZh": "前方信号灯",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "A traffic signal is ahead.",
    "meaningZh": "前方有交通信号灯。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/traffic-signal-ahead.png"
  },
  {
    "id": "bicycle-crossing",
    "titleEn": "BICYCLE CROSSING",
    "titleZh": "自行车穿越",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "Watch for bicycles crossing ahead.",
    "meaningZh": "前方注意自行车穿越。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/bicycle-crossing.png"
  },
  {
    "id": "school-bus-stop-400ft",
    "titleEn": "SCHOOL BUS STOP 400 FT",
    "titleZh": "前方400英尺校车停靠",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "A school bus stop is ahead.",
    "meaningZh": "前方有校车停靠点。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/school-bus-stop-400ft.png"
  },
  {
    "id": "pedestrian-crossing",
    "titleEn": "PEDESTRIAN CROSSING",
    "titleZh": "行人穿越",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "Watch for pedestrians crossing ahead.",
    "meaningZh": "前方注意行人穿越。",
    "relatedQuestionCodes": [
      "CA-RS-032"
    ],
    "imageAsset": "signs/pedestrian-crossing.png"
  },
  {
    "id": "road-narrows",
    "titleEn": "ROAD NARROWS",
    "titleZh": "道路变窄",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The road becomes narrower ahead.",
    "meaningZh": "前方道路变窄。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/road-narrows.png"
  },
  {
    "id": "pavement-ends",
    "titleEn": "PAVEMENT ENDS",
    "titleZh": "铺装路面结束",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The paved surface ends ahead.",
    "meaningZh": "前方铺装路面结束。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/pavement-ends.png"
  },
  {
    "id": "soft-shoulder",
    "titleEn": "SOFT SHOULDER",
    "titleZh": "松软路肩",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The shoulder is soft and may not support a vehicle.",
    "meaningZh": "前方路肩松软，可能无法支撑车辆。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/soft-shoulder.png"
  },
  {
    "id": "slide-area",
    "titleEn": "SLIDE AREA",
    "titleZh": "落石/滑坡区域",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "Watch for falling rocks or slides.",
    "meaningZh": "前方可能有落石或滑坡。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/slide-area.png"
  },
  {
    "id": "narrow-bridge",
    "titleEn": "NARROW BRIDGE",
    "titleZh": "窄桥",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The bridge ahead is narrower than the road.",
    "meaningZh": "前方桥面比道路更窄。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/narrow-bridge.png"
  },
  {
    "id": "flooded",
    "titleEn": "FLOODED",
    "titleZh": "易积水",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The roadway may flood when wet.",
    "meaningZh": "道路在潮湿时可能积水。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/flooded.png"
  },
  {
    "id": "cross-traffic-ahead",
    "titleEn": "CROSS TRAFFIC AHEAD",
    "titleZh": "前方横向来车",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "Traffic may cross your path ahead.",
    "meaningZh": "前方可能有横向来车。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/cross-traffic-ahead.png"
  },
  {
    "id": "rough-road",
    "titleEn": "ROUGH ROAD",
    "titleZh": "颠簸路面",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "The road surface is rough ahead.",
    "meaningZh": "前方路面颠簸。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/rough-road.png"
  },
  {
    "id": "nine-percent-grade",
    "titleEn": "9% GRADE",
    "titleZh": "9%陡坡",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "A steep downgrade or upgrade is ahead.",
    "meaningZh": "前方为9%坡度的陡坡。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/nine-percent-grade.png"
  },
  {
    "id": "school-xing",
    "titleEn": "SCHOOL XING",
    "titleZh": "学校穿越",
    "category": "warning",
    "shape": "pentagon",
    "colorTheme": "yellow",
    "meaningEn": "Watch for children crossing near a school.",
    "meaningZh": "前方学校区域有儿童穿越。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/school-xing.png"
  },
  {
    "id": "directional-arrow",
    "titleEn": "DIRECTIONAL ARROW",
    "titleZh": "方向箭头",
    "category": "warning",
    "shape": "panel",
    "colorTheme": "yellow",
    "meaningEn": "The road changes direction sharply.",
    "meaningZh": "道路前方急转变向。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/directional-arrow.png"
  },
  {
    "id": "truck-rollover-reduce-speed",
    "titleEn": "TRUCK ROLLOVER REDUCE SPEED",
    "titleZh": "卡车易侧翻 请减速",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "A sharp curve is especially dangerous for trucks.",
    "meaningZh": "前方急弯对卡车尤其危险，请减速。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/truck-rollover-reduce-speed.png"
  },
  {
    "id": "merging-traffic",
    "titleEn": "MERGING TRAFFIC",
    "titleZh": "并入交通",
    "category": "warning",
    "shape": "diamond",
    "colorTheme": "yellow",
    "meaningEn": "Traffic will merge into your lane.",
    "meaningZh": "前方有车辆并入本车道。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/merging-traffic.png"
  },
  {
    "id": "t-intersection",
    "titleEn": "T INTERSECTION",
    "titleZh": "丁字路口",
    "category": "warning",
    "shape": "panel",
    "colorTheme": "yellow",
    "meaningEn": "The road ends at a T intersection ahead.",
    "meaningZh": "前方为丁字路口。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/t-intersection.png"
  },
  {
    "id": "signal-ahead",
    "titleEn": "SIGNAL AHEAD",
    "titleZh": "前方信号提示",
    "category": "warning",
    "shape": "panel",
    "colorTheme": "yellow",
    "meaningEn": "A signal-controlled intersection is ahead.",
    "meaningZh": "前方有信号控制路口。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/signal-ahead.png"
  },
  {
    "id": "stop-sign",
    "titleEn": "STOP",
    "titleZh": "停车",
    "category": "regulatory",
    "shape": "octagon",
    "colorTheme": "red",
    "meaningEn": "Come to a complete stop before entering.",
    "meaningZh": "进入前必须完全停车。",
    "relatedQuestionCodes": [
      "CA-RS-006"
    ],
    "imageAsset": "signs/stop-sign.png"
  },
  {
    "id": "yield-sign",
    "titleEn": "YIELD",
    "titleZh": "让行",
    "category": "regulatory",
    "shape": "triangle",
    "colorTheme": "red-white",
    "meaningEn": "Slow down and give right-of-way when necessary.",
    "meaningZh": "减速，并在必要时让其他道路使用者先行。",
    "relatedQuestionCodes": [
      "CA-RS-007"
    ],
    "imageAsset": "signs/yield-sign.png"
  },
  {
    "id": "wrong-way",
    "titleEn": "WRONG WAY",
    "titleZh": "方向错误",
    "category": "regulatory",
    "shape": "rectangle",
    "colorTheme": "red-white",
    "meaningEn": "You are going the wrong way. Turn around safely.",
    "meaningZh": "你正逆向行驶，应尽快安全改向。",
    "relatedQuestionCodes": [
      "CA-RS-009"
    ],
    "imageAsset": "signs/wrong-way.png"
  },
  {
    "id": "do-not-enter",
    "titleEn": "DO NOT ENTER",
    "titleZh": "禁止驶入",
    "category": "regulatory",
    "shape": "circle",
    "colorTheme": "red-white",
    "meaningEn": "Do not enter from this direction.",
    "meaningZh": "禁止从这个方向进入。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/do-not-enter.png"
  },
  {
    "id": "no-left-turn",
    "titleEn": "NO LEFT TURN",
    "titleZh": "禁止左转",
    "category": "regulatory",
    "shape": "circle-slash",
    "colorTheme": "red-white",
    "meaningEn": "Left turns are prohibited here.",
    "meaningZh": "此处禁止左转。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/no-left-turn.png"
  },
  {
    "id": "no-parking",
    "titleEn": "NO PARKING",
    "titleZh": "禁止停车",
    "category": "regulatory",
    "shape": "circle-slash",
    "colorTheme": "red-white",
    "meaningEn": "Parking is not allowed here.",
    "meaningZh": "此处禁止停车。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/no-parking.png"
  },
  {
    "id": "no-u-turn",
    "titleEn": "NO U-TURN",
    "titleZh": "禁止掉头",
    "category": "regulatory",
    "shape": "circle-slash",
    "colorTheme": "red-white",
    "meaningEn": "U-turns are prohibited here.",
    "meaningZh": "此处禁止掉头。",
    "relatedQuestionCodes": [
      "CA-RS-033"
    ],
    "imageAsset": "signs/no-u-turn.png"
  },
  {
    "id": "no-parking-any-time",
    "titleEn": "NO PARKING ANY TIME",
    "titleZh": "任何时候禁止停车",
    "category": "regulatory",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Parking is prohibited at all times.",
    "meaningZh": "任何时候都禁止停车。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/no-parking-any-time.png"
  },
  {
    "id": "do-not-pass",
    "titleEn": "DO NOT PASS",
    "titleZh": "禁止超车",
    "category": "regulatory",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Passing is prohibited here.",
    "meaningZh": "此处禁止超车。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/do-not-pass.png"
  },
  {
    "id": "right-turn-only",
    "titleEn": "RIGHT TURN ONLY",
    "titleZh": "只许右转",
    "category": "regulatory",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "This lane or approach may only turn right.",
    "meaningZh": "该车道或路口只允许右转。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/right-turn-only.png"
  },
  {
    "id": "keep-right",
    "titleEn": "KEEP RIGHT",
    "titleZh": "靠右行驶",
    "category": "regulatory",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Keep to the right of a divider or obstruction.",
    "meaningZh": "请从分隔物或障碍物右侧通过。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/keep-right.png"
  },
  {
    "id": "keep-left",
    "titleEn": "KEEP LEFT",
    "titleZh": "靠左通过",
    "category": "regulatory",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Keep to the left of the obstruction.",
    "meaningZh": "请从障碍物左侧通过。",
    "relatedQuestionCodes": [
      "CA-RS-034"
    ],
    "imageAsset": "signs/keep-left.png"
  },
  {
    "id": "two-way-left-turn",
    "titleEn": "TWO WAY LEFT TURN",
    "titleZh": "双向左转车道",
    "category": "regulatory",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "This center lane is for left turns from either direction.",
    "meaningZh": "中间车道供两个方向车辆左转使用。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/two-way-left-turn.png"
  },
  {
    "id": "slower-traffic-keep-right",
    "titleEn": "SLOWER TRAFFIC KEEP RIGHT",
    "titleZh": "慢车靠右",
    "category": "regulatory",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Drivers moving slower than traffic should stay right.",
    "meaningZh": "低于车流速度的车辆应靠右。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/slower-traffic-keep-right.png"
  },
  {
    "id": "two-way-traffic-ahead",
    "titleEn": "TWO WAY TRAFFIC AHEAD",
    "titleZh": "前方双向交通",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Two-way traffic begins ahead.",
    "meaningZh": "前方开始双向交通。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/two-way-traffic-ahead.png"
  },
  {
    "id": "no-turn-on-red",
    "titleEn": "NO TURN ON RED",
    "titleZh": "红灯禁止转弯",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Do not turn on red when this sign is posted.",
    "meaningZh": "有此标志时红灯不得转弯。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/no-turn-on-red.png"
  },
  {
    "id": "left-turn-yield-on-green",
    "titleEn": "LEFT TURN YIELD ON GREEN",
    "titleZh": "绿灯左转需让行",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "On a green light, left-turning traffic must yield.",
    "meaningZh": "绿灯左转时仍须让行。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/left-turn-yield-on-green.png"
  },
  {
    "id": "speed-limit-50",
    "titleEn": "SPEED LIMIT 50",
    "titleZh": "限速50",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Maximum lawful speed is 50 mph under ideal conditions.",
    "meaningZh": "理想条件下最高法定车速为50英里。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/speed-limit-50.png"
  },
  {
    "id": "turning-traffic-must-yield-pedestrians",
    "titleEn": "TURNING TRAFFIC MUST YIELD TO PEDESTRIANS",
    "titleZh": "转弯车辆必须礼让行人",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Turning vehicles must yield to pedestrians.",
    "meaningZh": "转弯车辆必须礼让行人。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/turning-traffic-must-yield-pedestrians.png"
  },
  {
    "id": "push-button-for",
    "titleEn": "PUSH BUTTON FOR",
    "titleZh": "按键过街",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Push the button to activate the pedestrian signal.",
    "meaningZh": "按按钮以启动行人信号。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/push-button-for.png"
  },
  {
    "id": "railroad-crossbuck",
    "titleEn": "RAILROAD CROSSING",
    "titleZh": "铁路道口交叉牌",
    "category": "regulatory_continued",
    "shape": "crossbuck",
    "colorTheme": "white",
    "meaningEn": "A railroad crossing is at the intersection ahead.",
    "meaningZh": "前方为铁路道口。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/railroad-crossbuck.png"
  },
  {
    "id": "only-no-u-turn",
    "titleEn": "ONLY / NO U TURN",
    "titleZh": "仅限车道 禁止掉头",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Follow the lane arrows and do not make a U-turn.",
    "meaningZh": "按车道箭头行驶，不得掉头。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/only-no-u-turn.png"
  },
  {
    "id": "left-or-u-turn",
    "titleEn": "LEFT OR U-TURN",
    "titleZh": "左转或掉头",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "This lane allows a left turn or a U-turn where legal.",
    "meaningZh": "该车道可左转或在合法情况下掉头。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/left-or-u-turn.png"
  },
  {
    "id": "turn-options-only",
    "titleEn": "ONLY",
    "titleZh": "仅限指定转向",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "This lane may only move in the directions shown by the arrows.",
    "meaningZh": "该车道仅可按箭头方向通行。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/turn-options-only.png"
  },
  {
    "id": "no-turns",
    "titleEn": "NO TURNS",
    "titleZh": "禁止转弯",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "No right or left turns are allowed here.",
    "meaningZh": "此处禁止左右转弯。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/no-turns.png"
  },
  {
    "id": "right-lane-must-turn-right",
    "titleEn": "RIGHT LANE MUST TURN RIGHT",
    "titleZh": "右侧车道必须右转",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Vehicles in the right lane must turn right.",
    "meaningZh": "右侧车道车辆必须右转。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/right-lane-must-turn-right.png"
  },
  {
    "id": "slower-traffic-use-turnouts",
    "titleEn": "SLOWER TRAFFIC USE TURNOUTS",
    "titleZh": "慢车请用会车道",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Slower traffic should use turnouts to let others pass.",
    "meaningZh": "慢车应使用会车道让后车通过。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/slower-traffic-use-turnouts.png"
  },
  {
    "id": "emergency-parking-only",
    "titleEn": "EMERGENCY PARKING ONLY",
    "titleZh": "仅限紧急停车",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Stop here only in an emergency.",
    "meaningZh": "仅在紧急情况下可在此停车。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/emergency-parking-only.png"
  },
  {
    "id": "yield-to-uphill-traffic",
    "titleEn": "YIELD TO UPHILL TRAFFIC",
    "titleZh": "下坡让上坡",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "Yield to vehicles traveling uphill on narrow roads.",
    "meaningZh": "狭窄道路上应让上坡来车先行。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/yield-to-uphill-traffic.png"
  },
  {
    "id": "right-lane-must-exit",
    "titleEn": "RIGHT LANE MUST EXIT",
    "titleZh": "右侧车道必须驶离",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "The right lane exits the roadway ahead.",
    "meaningZh": "右侧车道前方必须驶离。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/right-lane-must-exit.png"
  },
  {
    "id": "turnout-quarter-mile",
    "titleEn": "TURNOUT 1/4 MILE",
    "titleZh": "前方1/4英里会车道",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "A turnout is ahead in one-quarter mile.",
    "meaningZh": "前方四分之一英里有会车道。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/turnout-quarter-mile.png"
  },
  {
    "id": "bike-lane",
    "titleEn": "BIKE LANE",
    "titleZh": "自行车道",
    "category": "regulatory_continued",
    "shape": "rectangle",
    "colorTheme": "white",
    "meaningEn": "This lane is reserved for bicycles.",
    "meaningZh": "该车道为自行车专用。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/bike-lane.png"
  },
  {
    "id": "bus-carpool-lane-ahead",
    "titleEn": "BUS CARPOOL LANE AHEAD",
    "titleZh": "前方公交/拼车车道",
    "category": "regulatory_continued",
    "shape": "panel",
    "colorTheme": "black",
    "meaningEn": "A bus or carpool lane begins ahead.",
    "meaningZh": "前方为公交/拼车车道。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/bus-carpool-lane-ahead.png"
  },
  {
    "id": "hov-fine",
    "titleEn": "CARPOOL VIOLATION MINIMUM FINE $",
    "titleZh": "拼车违规最低罚款",
    "category": "regulatory_continued",
    "shape": "panel",
    "colorTheme": "black",
    "meaningEn": "Carpool lane violations carry a minimum fine.",
    "meaningZh": "违规使用拼车车道将面临最低罚款。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/hov-fine.png"
  },
  {
    "id": "one-way",
    "titleEn": "ONE WAY",
    "titleZh": "单行道",
    "category": "regulatory_continued",
    "shape": "panel",
    "colorTheme": "black",
    "meaningEn": "Traffic moves only in the direction of the arrow.",
    "meaningZh": "车辆只能沿箭头方向行驶。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/one-way.png"
  },
  {
    "id": "road-work-ahead",
    "titleEn": "ROAD WORK AHEAD",
    "titleZh": "前方施工",
    "category": "construction",
    "shape": "diamond",
    "colorTheme": "orange",
    "meaningEn": "Road work is ahead. Slow down and be alert.",
    "meaningZh": "前方道路施工，请减速并提高警觉。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/road-work-ahead.png"
  },
  {
    "id": "road-closed-ahead",
    "titleEn": "ROAD CLOSED AHEAD",
    "titleZh": "前方道路封闭",
    "category": "construction",
    "shape": "diamond",
    "colorTheme": "orange",
    "meaningEn": "The road ahead is closed.",
    "meaningZh": "前方道路封闭。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/road-closed-ahead.png"
  },
  {
    "id": "no-shoulder",
    "titleEn": "NO SHOULDER",
    "titleZh": "无路肩",
    "category": "construction",
    "shape": "diamond",
    "colorTheme": "orange",
    "meaningEn": "The shoulder is unavailable ahead.",
    "meaningZh": "前方没有路肩。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/no-shoulder.png"
  },
  {
    "id": "one-lane-road-ahead",
    "titleEn": "ONE LANE ROAD AHEAD",
    "titleZh": "前方单车道通行",
    "category": "construction",
    "shape": "diamond",
    "colorTheme": "orange",
    "meaningEn": "Traffic narrows to one lane ahead.",
    "meaningZh": "前方收窄为单车道通行。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/one-lane-road-ahead.png"
  },
  {
    "id": "lane-closed",
    "titleEn": "LANE CLOSED",
    "titleZh": "车道封闭",
    "category": "construction",
    "shape": "diamond",
    "colorTheme": "orange",
    "meaningEn": "A lane is closed ahead. Merge safely.",
    "meaningZh": "前方有车道封闭，请安全并线。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/lane-closed.png"
  },
  {
    "id": "loose-gravel",
    "titleEn": "LOOSE GRAVEL",
    "titleZh": "松散碎石",
    "category": "construction",
    "shape": "diamond",
    "colorTheme": "orange",
    "meaningEn": "Loose gravel may reduce traction.",
    "meaningZh": "前方有碎石，抓地力会降低。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/loose-gravel.png"
  },
  {
    "id": "shoulder-work-ahead",
    "titleEn": "SHOULDER WORK AHEAD",
    "titleZh": "前方路肩施工",
    "category": "construction",
    "shape": "diamond",
    "colorTheme": "orange",
    "meaningEn": "Construction is taking place on the shoulder ahead.",
    "meaningZh": "前方路肩正在施工。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/shoulder-work-ahead.png"
  },
  {
    "id": "workers",
    "titleEn": "WORKERS",
    "titleZh": "施工人员",
    "category": "construction",
    "shape": "diamond",
    "colorTheme": "orange",
    "meaningEn": "Workers may be on or near the roadway.",
    "meaningZh": "前方道路附近有施工人员。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/workers.png"
  },
  {
    "id": "ramp-closed",
    "titleEn": "RAMP CLOSED",
    "titleZh": "匝道封闭",
    "category": "construction",
    "shape": "panel",
    "colorTheme": "orange",
    "meaningEn": "The entrance or exit ramp is closed.",
    "meaningZh": "匝道封闭。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/ramp-closed.png"
  },
  {
    "id": "flagman-ahead",
    "titleEn": "FLAGMAN AHEAD",
    "titleZh": "前方旗手指挥",
    "category": "construction",
    "shape": "diamond",
    "colorTheme": "orange",
    "meaningEn": "A flagger controls traffic ahead.",
    "meaningZh": "前方有旗手指挥交通。",
    "relatedQuestionCodes": [
      "CA-RS-035"
    ],
    "imageAsset": "signs/flagman-ahead.png"
  },
  {
    "id": "slow-moving-vehicle",
    "titleEn": "SLOW MOVING VEHICLE",
    "titleZh": "慢速车辆",
    "category": "construction",
    "shape": "triangle",
    "colorTheme": "orange",
    "meaningEn": "A slow-moving vehicle may be ahead.",
    "meaningZh": "前方可能有慢速车辆。",
    "relatedQuestionCodes": [
      "CA-RS-036"
    ],
    "imageAsset": "signs/slow-moving-vehicle.png"
  },
  {
    "id": "use-next-exit",
    "titleEn": "USE NEXT EXIT",
    "titleZh": "请用下一个出口",
    "category": "construction",
    "shape": "panel",
    "colorTheme": "orange",
    "meaningEn": "You must leave the roadway at the next exit.",
    "meaningZh": "请从下一个出口驶离。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/use-next-exit.png"
  },
  {
    "id": "road-work-next-5-miles",
    "titleEn": "ROAD WORK NEXT 5 MILES",
    "titleZh": "未来5英里施工",
    "category": "construction",
    "shape": "panel",
    "colorTheme": "orange",
    "meaningEn": "Construction continues for the next five miles.",
    "meaningZh": "接下来5英里均有施工。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/road-work-next-5-miles.png"
  },
  {
    "id": "detour",
    "titleEn": "DETOUR",
    "titleZh": "绕行",
    "category": "construction",
    "shape": "panel",
    "colorTheme": "orange-black",
    "meaningEn": "Follow the detour route shown by the arrow.",
    "meaningZh": "请按箭头所示绕行。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/detour.png"
  },
  {
    "id": "trolley",
    "titleEn": "TROLLEY",
    "titleZh": "电车",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "green",
    "meaningEn": "This sign points to trolley service.",
    "meaningZh": "此标志指向电车服务。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/trolley.png"
  },
  {
    "id": "airport",
    "titleEn": "AIRPORT",
    "titleZh": "机场",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "green",
    "meaningEn": "This sign points to an airport.",
    "meaningZh": "此标志指向机场。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/airport.png"
  },
  {
    "id": "route-12",
    "titleEn": "NORTH / SOUTH 12",
    "titleZh": "12号公路",
    "category": "guide",
    "shape": "shield",
    "colorTheme": "green",
    "meaningEn": "This route marker identifies Highway 12.",
    "meaningZh": "该路线牌表示12号公路。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/route-12.png"
  },
  {
    "id": "carpool-lane-entrance",
    "titleEn": "CARPOOL LANE ENTRANCE",
    "titleZh": "拼车车道入口",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "green",
    "meaningEn": "The entrance to the carpool lane is ahead.",
    "meaningZh": "前方为拼车车道入口。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/carpool-lane-entrance.png"
  },
  {
    "id": "exit",
    "titleEn": "EXIT",
    "titleZh": "出口",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "green",
    "meaningEn": "This sign marks an exit.",
    "meaningZh": "该标志表示出口。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/exit.png"
  },
  {
    "id": "bike-route",
    "titleEn": "BIKE ROUTE",
    "titleZh": "自行车路线",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "green",
    "meaningEn": "This route is designated for bicycles.",
    "meaningZh": "这是一条指定自行车路线。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/bike-route.png"
  },
  {
    "id": "divided-road-2-miles-ahead",
    "titleEn": "DIVIDED ROAD 2 MILES AHEAD",
    "titleZh": "前方2英里分隔道路",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "green",
    "meaningEn": "A divided roadway begins in two miles.",
    "meaningZh": "前方两英里开始为分隔道路。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/divided-road-2-miles-ahead.png"
  },
  {
    "id": "park-and-ride",
    "titleEn": "PARK & RIDE",
    "titleZh": "停车换乘",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "green",
    "meaningEn": "Parking and transit transfer facilities are available.",
    "meaningZh": "这里可停车并换乘。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/park-and-ride.png"
  },
  {
    "id": "disabled",
    "titleEn": "DISABLED",
    "titleZh": "无障碍停车/设施",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "blue",
    "meaningEn": "This sign indicates disabled parking or services.",
    "meaningZh": "该标志表示无障碍停车或服务。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/disabled.png"
  },
  {
    "id": "telephone",
    "titleEn": "TELEPHONE",
    "titleZh": "电话",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "blue",
    "meaningEn": "Telephone service is available.",
    "meaningZh": "此处提供电话服务。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/telephone.png"
  },
  {
    "id": "electric-vehicle-charging",
    "titleEn": "ELECTRIC VEHICLE CHARGING STATION",
    "titleZh": "电动车充电站",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "blue",
    "meaningEn": "An electric vehicle charging station is available.",
    "meaningZh": "此处有电动车充电站。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/electric-vehicle-charging.png"
  },
  {
    "id": "services",
    "titleEn": "EMERGENCY CALL / REST AREA / NEXT SERVICES",
    "titleZh": "紧急电话 / 休息区 / 下个服务区",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "blue",
    "meaningEn": "This service sign points to emergency call, rest area, or next services.",
    "meaningZh": "该服务牌指向紧急电话、休息区或下个服务区。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/services.png"
  },
  {
    "id": "hospital",
    "titleEn": "HOSPITAL",
    "titleZh": "医院",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "blue",
    "meaningEn": "This sign points to a hospital.",
    "meaningZh": "此标志指向医院。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/hospital.png"
  },
  {
    "id": "camping",
    "titleEn": "CAMPING",
    "titleZh": "露营地",
    "category": "guide",
    "shape": "panel",
    "colorTheme": "brown",
    "meaningEn": "This sign points to a camping area.",
    "meaningZh": "此标志指向露营区。",
    "relatedQuestionCodes": [],
    "imageAsset": "signs/camping.png"
  }
];

export const roadSignByQuestionCode: Record<string, string> = Object.fromEntries(
  roadSigns.flatMap((sign) => sign.relatedQuestionCodes.map((code) => [code, sign.id] as const))
);

export const roadSignSectionMeta = {
  warning: { labelEn: 'Warning Signs', labelZh: '警告标志' },
  regulatory: { labelEn: 'Regulatory Signs', labelZh: '管制标志' },
  regulatory_continued: { labelEn: 'Regulatory Signs (Continued)', labelZh: '管制标志（续）' },
  construction: { labelEn: 'Highway Construction and Maintenance Signs', labelZh: '道路施工与养护标志' },
  guide: { labelEn: 'Guide Signs', labelZh: '指路与服务标志' },
} as const;
