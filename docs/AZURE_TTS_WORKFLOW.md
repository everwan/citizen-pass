# Azure USCIS 语音工作流

当前音频是按 USCIS 题库生成的题目和正确答案音频，供 App 离线播放。

## 本地环境变量

```env
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=...
USCIS_AZURE_TTS_LANGUAGE_CODE=en-US
USCIS_AZURE_TTS_VOICE_NAME=en-US-JennyNeural
USCIS_AZURE_TTS_OUTPUT_FORMAT=audio-24khz-96kbitrate-mono-mp3
USCIS_AZURE_TTS_RATE=-6.00%
USCIS_AZURE_TTS_PITCH=+0.00Hz
```

## 生成音频

```bash
npm run audio:uscis
```

## 生成远程音频 manifest

```bash
npm run audio:uscis:remote
```

## 发布到 `appdata/`

```bash
npm run content:uscis:publish
```

## 说明

- 本地音频写到 `assets/audio/uscis/`
- 远程音频 manifest 写到 `dist/remote-audio/manifest.json`
- 最终发布到 GitHub 的路径是 `appdata/audio/uscis/`
