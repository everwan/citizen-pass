const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");

const ENGLISH_NAME = "DMV Permit Pro";
const CHINESE_NAME = "DMV笔试通";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeStringsXml(filePath, appName) {
  const content = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="app_name">${appName}</string>
</resources>
`;
  fs.writeFileSync(filePath, content, "utf8");
}

module.exports = function withLocalizedAndroidAppName(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (app?.$) {
      app.$["android:label"] = "@string/app_name";
    }
    return mod;
  });

  config = withDangerousMod(config, [
    "android",
    async (mod) => {
      const resDir = path.join(
        mod.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res"
      );

      const valuesDir = path.join(resDir, "values");
      const zhValuesDir = path.join(resDir, "values-zh");

      ensureDir(valuesDir);
      ensureDir(zhValuesDir);

      writeStringsXml(path.join(valuesDir, "strings.xml"), ENGLISH_NAME);
      writeStringsXml(path.join(zhValuesDir, "strings.xml"), CHINESE_NAME);

      return mod;
    },
  ]);

  return config;
};
