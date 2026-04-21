import { LanguageCode, StudyMode } from './types';

type CopyTree = {
  appName: string;
  loadingSetup: string;
  settings: string;
  home: string;
  practice: string;
  review: string;
  records: string;
  handbook: string;
  guide: string;
  welcomeEyebrow: string;
  welcomeTitle: string;
  welcomeBody: string;
  getStarted: string;
  chooseLanguage: string;
  languageHint: string;
  englishOptionTitle: string;
  englishOptionBody: string;
  chineseOptionTitle: string;
  chineseOptionBody: string;
  continue: string;
  chooseStudyMode: string;
  studyModeHint: string;
  examModeTitle: string;
  examModeBody: string;
  bilingualModeTitle: string;
  bilingualModeBody: string;
  supportModeTitle: string;
  supportModeBody: string;
  chooseState: string;
  stateHint: string;
  californiaBody: string;
  startLearning: string;
  california: string;
  modeLabel: string;
  uiLabel: string;
  todayMomentum: string;
  questionsAnswered: string;
  accuracy: string;
  lastChapter: string;
  continuePractice: string;
  startMockTest: string;
  chapterPractice: string;
  structuredByTopic: string;
  mistakes: string;
  toReview: string;
  saved: string;
  bookmarked: string;
  mistakeNotebookBody: string;
  savedNotebookBody: string;
  guideCard: string;
  guideCardBody: string;
  recommendedFocus: string;
  focusBody: string;
  practiceRoadSigns: string;
  roadSignsSpecial: string;
  roadSignsSpecialBody: string;
  startRoadSignsSpecial: string;
  browseRoadSigns: string;
  roadSignLibraryBody: string;
  practiceByChapter: string;
  practiceHint: string;
  questions: string;
  randomPractice: string;
  randomPracticeBody: string;
  startRandomSet: string;
  highFrequencyPack: string;
  highFrequencyPackBody: string;
  startHighFrequencyPack: string;
  mockTest: string;
  mockBody: string;
  openMockTest: string;
  questionCount: string;
  progress: string;
  startPractice: string;
  reviewMistakes: string;
  noQuestionsYet: string;
  loadingChapter: string;
  practiceComplete: string;
  correct: string;
  practiceCompleteBody: string;
  practiceAgain: string;
  nextChapterPrompt: string;
  finalChapterPrompt: string;
  goToNextChapter: string;
  goToRoadSignsSpecial: string;
  backToPractice: string;
  backToList: string;
  mockIntroBody: string;
  questionSet: string;
  timer: string;
  optionalNextIteration: string;
  explanations: string;
  hiddenDuringTest: string;
  loadingMockTest: string;
  specialSet: string;
  nextQuestion: string;
  previousQuestion: string;
  submitTest: string;
  results: string;
  passed: string;
  keepPracticing: string;
  score: string;
  resultBody: string;
  retakeMockTest: string;
  goToReview: string;
  reviewBody: string;
  activeWrongQuestions: string;
  bookmarkedQuestions: string;
  mockTestsTaken: string;
  recordsBody: string;
  handbookBody: string;
  openHandbook: string;
  recentActivity: string;
  openMistakes: string;
  openSaved: string;
  californiaGuide: string;
  guideBody: string;
  openGlossary: string;
  glossary: string;
  glossaryBody: string;
  settingsBody: string;
  appLanguage: string;
  studyMode: string;
  loadingGuide: string;
  dailyReminder: string;
  dailyReminderBody: string;
  done: string;
  mistake: string;
  question: string;
  checkAnswer: string;
  saveQuestion: string;
  savedDone: string;
  explanation: string;
};

const copy: Record<LanguageCode, CopyTree> = {
  en: {
    appName: 'Citizen Pass',
    loadingSetup: 'Loading your study setup...',
    settings: 'Settings',
    home: 'Home',
    practice: 'Practice',
    review: 'Review',
    records: 'Progress',
    handbook: 'Resources',
    guide: 'Guide',
    welcomeEyebrow: 'USCIS',
    welcomeTitle: 'Prepare for the civics test with an English-first bilingual flow.',
    welcomeBody:
      'English-first practice with Chinese support for new immigrants, students, and anyone who wants a calmer way to prep.',
    getStarted: 'Get Started',
    chooseLanguage: 'Choose language',
    languageHint: 'You can change this anytime in Settings.',
    englishOptionTitle: 'English',
    englishOptionBody: 'Use English for UI labels and guidance.',
    chineseOptionTitle: '中文',
    chineseOptionBody: 'Use Chinese for UI labels and guidance.',
    continue: 'Continue',
    chooseStudyMode: 'Choose practice display',
    studyModeHint: 'This only affects practice. Mock tests follow your current app language.',
    examModeTitle: 'Chinese-first',
    examModeBody: 'Show Chinese first, with English as the supporting line.',
    bilingualModeTitle: 'English-first',
    bilingualModeBody: 'Show English first, with Chinese as the supporting line.',
    supportModeTitle: '',
    supportModeBody: '',
    chooseState: 'Choose your question bank',
    stateHint: 'Pick the official civics test version that matches your filing date.',
    californiaBody: 'Study with the official 2008 or 2025 civics question bank, plus bilingual practice, mock tests, and guides.',
    startLearning: 'Start Learning',
    california: '2025 Civics Test',
    modeLabel: 'Mode',
    uiLabel: 'UI',
    todayMomentum: "Today's momentum",
    questionsAnswered: 'Questions answered',
    accuracy: 'Accuracy',
    lastChapter: 'Last chapter',
    continuePractice: 'Continue Practice',
    startMockTest: 'Start Mock Test',
    chapterPractice: 'Chapter Practice',
    structuredByTopic: 'Structured by topic',
    mistakes: 'Mistakes',
    toReview: 'to review',
    saved: 'Saved',
    bookmarked: 'bookmarked',
    mistakeNotebookBody: 'Questions you got wrong, collected automatically for focused correction.',
    savedNotebookBody: 'Questions you marked yourself for later review or exam-day refresh.',
    guideCard: 'Guide',
    guideCardBody: 'Application steps and FAQ',
    recommendedFocus: 'Recommended focus',
    focusBody: 'Your weakest chapter is still worth another short review. A quick 10-question pass can raise confidence fast.',
    practiceRoadSigns: 'Practice Road Signs',
    roadSignsSpecial: 'Road Sign Drill',
    roadSignsSpecialBody: 'Focus on common sign titles, curb colors, and signal meanings in one dedicated review set.',
    startRoadSignsSpecial: 'Start Sign Drill',
    browseRoadSigns: 'Browse Sign Cards',
    roadSignLibraryBody: 'Learn the sign image first, then connect it to the meaning and the test question.',
    practiceByChapter: 'Practice by chapter',
    practiceHint: 'Start with a topic, or mix everything together for a quick confidence check.',
    questions: 'questions',
    randomPractice: 'Random Practice',
    randomPracticeBody: 'Mix questions from all categories for a faster daily study loop.',
    startRandomSet: 'Start Random Set',
    highFrequencyPack: 'High-Frequency Mistakes',
    highFrequencyPackBody: 'A focused pack built around the civics questions learners confuse most often.',
    startHighFrequencyPack: 'Start Mistake Pack',
    mockTest: 'Mock Test',
    mockBody: 'Take a real-exam style session with no explanations until you submit.',
    openMockTest: 'Open Mock Test',
    questionCount: 'Question count',
    progress: 'Progress',
    startPractice: 'Start Practice',
    reviewMistakes: 'Review Mistakes',
    noQuestionsYet: 'No questions yet',
    loadingChapter: 'Loading chapter...',
    practiceComplete: 'Practice Complete',
    correct: 'correct',
    practiceCompleteBody: 'Your wrong answers have been saved into Mistakes automatically, so the next pass can stay focused.',
    practiceAgain: 'Practice Again',
    nextChapterPrompt: 'This chapter is done. Do you want to continue into the next chapter now?',
    finalChapterPrompt: 'You finished the last chapter. Do you want to continue into a mock test next?',
    goToNextChapter: 'Next Chapter',
    goToRoadSignsSpecial: 'Start Mock Test',
    backToPractice: 'Back to Practice',
    backToList: 'Back to List',
    mockIntroBody: '36-question style flow, results at the end, and chapter-level feedback after submission.',
    questionSet: 'Question set',
    timer: 'Timer',
    optionalNextIteration: 'Optional in next iteration',
    explanations: 'Explanations',
    hiddenDuringTest: 'Hidden during the test',
    loadingMockTest: 'Loading mock test...',
    specialSet: 'Special Set',
    nextQuestion: 'Next Question',
    previousQuestion: 'Previous Question',
    submitTest: 'Submit Test',
    results: 'Results',
    passed: 'Passed',
    keepPracticing: 'Keep Practicing',
    score: 'Score',
    resultBody: 'Mock test explanations stayed hidden during the session, which makes this result a cleaner signal of exam readiness.',
    retakeMockTest: 'Retake Mock Test',
    goToReview: 'Open Review',
    reviewBody: 'Keep mistakes and saved questions separate so the review loop feels intentional.',
    activeWrongQuestions: 'active wrong questions',
    bookmarkedQuestions: 'bookmarked questions',
    mockTestsTaken: 'Mock tests taken',
    recordsBody: 'Track your progress, recent performance, and mock test history in one place.',
    handbookBody: 'Browse official study resources and supporting materials in a cleaner mobile structure.',
    openHandbook: 'Open Resources',
    recentActivity: 'Recent Progress',
    openMistakes: 'Open Mistakes',
    openSaved: 'Open Saved',
    californiaGuide: 'Exam Guide',
    guideBody: 'Keep trustworthy bilingual guidance next to practice so the path to the civics test feels clearer.',
    openGlossary: 'Open Glossary',
    glossary: 'Glossary',
    glossaryBody: 'A lightweight bilingual civics term bank helps users remember the government and history words that repeat in the exam.',
    settingsBody: 'Adjust language and practice display in one place.',
    loadingGuide: 'Loading guide...',
    appLanguage: 'App Language',
    studyMode: 'Practice Display',
    dailyReminder: 'Daily reminder',
    dailyReminderBody: 'Get a gentle reminder to return to practice.',
    done: 'Done',
    mistake: 'Mistake',
    question: 'Question',
    checkAnswer: 'Check Answer',
    saveQuestion: 'Save Question',
    savedDone: 'Saved ✓',
    explanation: 'Explanation',
  },
  zh: {
    appName: '美国入籍考试通',
    loadingSetup: '正在加载学习设置...',
    settings: '设置',
    home: '首页',
    practice: '练习',
    review: '复习',
    records: '进度',
    handbook: '资料',
    guide: '指南',
    welcomeEyebrow: 'USCIS',
    welcomeTitle: '用英文主学习流，更稳准备美国公民考试。',
    welcomeBody: '以英文考试场景为主，用中文辅助理解，适合华人、新移民、留学生以及想更稳准备考试的用户。',
    getStarted: '开始',
    chooseLanguage: '选择语言',
    languageHint: '可在设置中随时修改。',
    englishOptionTitle: 'English',
    englishOptionBody: '使用英文界面和引导文案。',
    chineseOptionTitle: '中文',
    chineseOptionBody: '使用中文界面和引导文案。',
    continue: '继续',
    chooseStudyMode: '选择练习展示方式',
    studyModeHint: '这个设置只影响练习。模拟考试会直接跟随当前 App 语言。',
    examModeTitle: '中英对照',
    examModeBody: '中文主显示，英文辅助显示。',
    bilingualModeTitle: '英中对照',
    bilingualModeBody: '英文主显示，中文辅助显示。',
    supportModeTitle: '',
    supportModeBody: '',
    chooseState: '选择题库版本',
    stateHint: '按你的 N-400 提交时间选择对应的官方题库版本。',
    californiaBody: '包含 2008 / 2025 官方公民题库、双语练习、模拟考试和考试指南。',
    startLearning: '开始学习',
    california: '2025 版题库',
    modeLabel: '模式',
    uiLabel: '界面',
    todayMomentum: '今日学习进度',
    questionsAnswered: '已做题数',
    accuracy: '正确率',
    lastChapter: '上次学习章节',
    continuePractice: '继续练习',
    startMockTest: '开始模拟考试',
    chapterPractice: '章节练习',
    structuredByTopic: '按知识点分类练习',
    mistakes: '错题本',
    toReview: '题待复习',
    saved: '收藏题',
    bookmarked: '已收藏',
    mistakeNotebookBody: '自动收录做错的题，方便集中纠错和反复复习。',
    savedNotebookBody: '你主动标记想回看的题，适合考前集中回顾。',
    guideCard: '考试指南',
    guideCardBody: '考试流程与常见问题',
    recommendedFocus: '推荐复习',
    focusBody: '你当前最薄弱的章节值得再刷一轮。先做一组 10 题，会比盲目重复更有效。',
    practiceRoadSigns: '练习交通标志',
    roadSignsSpecial: '路标专项',
    roadSignsSpecialBody: '集中练习常见路标标题、路缘颜色和信号含义，适合先把高频识别题吃透。',
    startRoadSignsSpecial: '开始路标专项',
    browseRoadSigns: '查看路标卡片',
    roadSignLibraryBody: '先看图，再记住含义和考试考点，这样更接近真正的路标识别训练。',
    practiceByChapter: '按章节练习',
    practiceHint: '可以按主题系统学习，也可以混合刷题做日常巩固。',
    questions: '题',
    randomPractice: '随机练习',
    randomPracticeBody: '从所有章节混合抽题，更适合碎片化刷题。',
    startRandomSet: '开始随机练习',
    highFrequencyPack: '高频易错题',
    highFrequencyPackBody: '围绕最常混淆、最容易做错的规则整理出的冲刺题包，适合考前复习。',
    startHighFrequencyPack: '开始易错题包',
    mockTest: '模拟考试',
    mockBody: '模拟真实考试流程，交卷前不展示解析。',
    openMockTest: '进入模拟考试',
    questionCount: '题目数量',
    progress: '进度',
    startPractice: '开始练习',
    reviewMistakes: '复习错题',
    noQuestionsYet: '暂时还没有题目',
    loadingChapter: '正在加载章节...',
    practiceComplete: '练习完成',
    correct: '题答对',
    practiceCompleteBody: '答错的题已经自动加入错题本，下一轮复习会更聚焦。',
    practiceAgain: '再练一轮',
    nextChapterPrompt: '这一章节已经完成，要继续进入下一章节吗？',
    finalChapterPrompt: '你已经完成最后一个章节，要继续进入模拟考试吗？',
    goToNextChapter: '下一章节',
    goToRoadSignsSpecial: '开始模拟考试',
    backToPractice: '返回练习页',
    backToList: '返回列表',
    mockIntroBody: '模拟考试会按考试节奏出题，完成后给出分数和章节表现。',
    questionSet: '题目组',
    timer: '计时',
    optionalNextIteration: '下一版可选',
    explanations: '解析',
    hiddenDuringTest: '考试过程中隐藏',
    loadingMockTest: '正在加载模拟考试...',
    specialSet: '专项题包',
    nextQuestion: '下一题',
    previousQuestion: '上一题',
    submitTest: '提交试卷',
    results: '成绩结果',
    passed: '通过',
    keepPracticing: '继续练习',
    score: '得分',
    resultBody: '模拟考试过程中不展示解析，所以这次成绩更接近真实考试表现。',
    retakeMockTest: '重新模拟',
    goToReview: '查看复习',
    reviewBody: '把错题和收藏分开管理，复习目标会更清晰。',
    activeWrongQuestions: '道活跃错题',
    bookmarkedQuestions: '道收藏题',
    mockTestsTaken: '模拟考试次数',
    recordsBody: '这里集中查看学习进度、近期表现和模拟考试记录。',
    handbookBody: '按官方资料整理，做成更适合手机阅读的在线学习资料。',
    openHandbook: '打开资料',
    recentActivity: '最近进展',
    openMistakes: '进入错题本',
    openSaved: '进入收藏题',
    californiaGuide: '考试指南',
    guideBody: '把可靠的双语说明放在刷题旁边，能明显降低考试前的不确定感。',
    openGlossary: '打开术语表',
    glossary: '术语表',
    glossaryBody: '把高频公民题、政府和历史术语放在一起，方便用户边做题边记忆。',
    settingsBody: '在这里调整界面语言和练习展示方式。',
    loadingGuide: '正在加载指南...',
    appLanguage: '界面语言',
    studyMode: '练习展示方式',
    dailyReminder: '每日提醒',
    dailyReminderBody: '在合适的时候提醒你继续学习。',
    done: '完成',
    mistake: '错题',
    question: '题目',
    checkAnswer: '检查答案',
    saveQuestion: '收藏题目',
    savedDone: '已收藏 ✓',
    explanation: '解析',
  },
};

export function getCopy(language: LanguageCode) {
  return copy[language];
}

export function getModeLabel(mode: StudyMode, language: LanguageCode) {
  if (language === 'zh') {
    if (mode === 'zh-first') return '中英对照';
    return '英中对照';
  }

  if (mode === 'zh-first') return 'Chinese-first';
  return 'English-first';
}
