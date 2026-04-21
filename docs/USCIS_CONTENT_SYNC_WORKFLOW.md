# USCIS 内容同步工作流

这条流程是给“题库更新 + 动态答案 + 音频重建 + 本地发布到 `appdata/`”用的。

## 一条命令跑完

```bash
CONTENT_PASSWORD='Citizen@Pass2026!' npm run content:uscis:sync
```

它会做这几步：

1. 抓 USCIS 官方 2008 题库
2. 抓 USCIS 官方 2025 题库
3. 去 USCIS 的 test updates 页面抓动态答案
4. 重新生成本地题库源文件和 JSON
5. 重新生成题目和答案音频
6. 生成远程题库加密包
7. 生成远程音频 manifest
8. 把生成结果写到 `appdata/`

## 你需要准备的环境变量

```env
CONTENT_PASSWORD=你的题库加密密码
CONTENT_BASE_URL=https://raw.githubusercontent.com/everwan/citizen-pass/main/appdata
USCIS_AUDIO_BASE_URL=https://raw.githubusercontent.com/everwan/citizen-pass/main/appdata/audio/uscis
AZURE_SPEECH_KEY=你的 Azure Speech Key
AZURE_SPEECH_REGION=你的 Azure Region
```

## 本地更新后会生成什么

- `dist/uscis-content/uscis2008.json`
- `dist/uscis-content/uscis2025.json`
- `assets/audio/uscis/2008/questions/*.mp3`
- `assets/audio/uscis/2008/answers/*.mp3`
- `assets/audio/uscis/2025/questions/*.mp3`
- `assets/audio/uscis/2025/answers/*.mp3`
- `dist/remote-content/manifest.json`
- `dist/remote-content/question-bank-2008.enc`
- `dist/remote-content/question-bank-2025.enc`
- `dist/remote-audio/manifest.json`

## 每次运行的日志在哪里

每次运行都会生成一个新的日志目录：

- `logs/uscis-sync/<run-id>/`

里面会包含每一步的文本日志：

- `sync-uscis-content.log`
- `build-uscis-question-banks.log`
- `build-uscis-audio-azure.log`
- `build-remote-content.log`
- `build-remote-uscis-audio.log`
- `publish-uscis-content.log`

以及详细的 JSON 报告：

- `test-updates-summary.json`
- `question-bank-diff-2008.json`
- `question-bank-diff-2025.json`
- `question-bank-build-summary.json`
- `audio-generation-report.json`
- `remote-content-report.json`
- `remote-audio-report.json`
- `publish-report.json`

其中 `question-bank-diff-*.json` 会把本次新增、删除、修改的题目全部列出来，包括：

- 题目 ID
- 修改类型
- 具体变更字段
- 旧题干 / 新题干
- 旧正确答案 / 新正确答案
- 动态答案审核日期变化

## 远程发布目录

最终会写到：

- `appdata/manifest.json`
- `appdata/question-bank-2008.enc`
- `appdata/question-bank-2025.enc`
- `appdata/audio/manifest.json`
- `appdata/audio/uscis/2008/...`
- `appdata/audio/uscis/2025/...`

## 本地定时跑

如果你只想本地每天跑一次，用这条命令就够了：

```bash
CONTENT_PASSWORD='Citizen@Pass2026!' npm run content:uscis:sync
```

你可以把它放到本机的：

- `crontab`
- `launchd`

仓库里我也放了一份 macOS `launchd` 模板：

- [uscis-content-sync.launchd.plist](/Users/ever.wan/Documents/CodexProject/CitizenPass/docs/uscis-content-sync.launchd.plist:1)

正式自动运行建议改用：

```bash
npm run content:uscis:sync:scheduled
```

这个调度脚本会：

- 以旧金山时间 `02:00` 为当天首次执行窗口
- 每 30 分钟被系统唤醒一次
- 如果当天 02:00 之后还没成功，就继续补跑
- 一旦成功，当天剩余时间都不再重复执行
- 成功同步后自动把 `appdata/` 推到 GitHub `main` 分支
- 失败时通过本机 `openclaw` 的 Telegram 渠道发错误通知
- 成功时把整包日志压缩后发到 Telegram

如果你只想手动把当前 `appdata/` 推到 GitHub，可以单独运行：

```bash
npm run content:uscis:push
```

调度器自己的状态和日志在：

- `logs/uscis-sync-scheduler/state.json`
- `logs/uscis-sync-scheduler/scheduler.log`
- `logs/uscis-sync-scheduler/launchd.stdout.log`
- `logs/uscis-sync-scheduler/launchd.stderr.log`

如果只是临时手动更新，直接在项目目录里运行上面的命令就行。
