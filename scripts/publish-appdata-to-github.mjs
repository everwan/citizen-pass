import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const appdataDir = path.join(rootDir, 'appdata');

await removeDsStore(appdataDir);

const statusBefore = await runGit(['status', '--porcelain', '--', 'appdata'], { capture: true });
if (!statusBefore.stdout.trim()) {
  console.log('No appdata changes to publish.');
  process.exit(0);
}

const versionSummary = await readManifestSummary();
const commitMessage = buildCommitMessage(versionSummary);

await runGit(['add', '-A', '--', 'appdata']);
const stagedStatus = await runGit(['diff', '--cached', '--name-only', '--', 'appdata'], { capture: true });
if (!stagedStatus.stdout.trim()) {
  console.log('No staged appdata changes to publish.');
  process.exit(0);
}

await runGit(['commit', '--only', '-m', commitMessage, '--', 'appdata']);
await runGit(['push', 'origin', 'HEAD:main']);

console.log(`Published appdata to GitHub with commit: ${commitMessage}`);

async function readManifestSummary() {
  try {
    const raw = await fs.readFile(path.join(appdataDir, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw);
    const bundles = (manifest.bundles ?? []).map((bundle) => ({
      id: bundle.id,
      version: bundle.version,
    }));
    return { bundles };
  } catch {
    return { bundles: [] };
  }
}

function buildCommitMessage(summary) {
  const questionBankVersions = summary.bundles.filter((bundle) => bundle.id?.startsWith('question-bank-'));
  const suffix = questionBankVersions.length > 0
    ? questionBankVersions.map((bundle) => `${bundle.id}:${bundle.version}`).join(', ')
    : new Date().toISOString();
  return `chore(appdata): update remote content ${suffix}`;
}

async function removeDsStore(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await removeDsStore(entryPath);
      continue;
    }
    if (entry.name === '.DS_Store') {
      await fs.rm(entryPath, { force: true });
    }
  }
}

async function runGit(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: rootDir,
      env: process.env,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    if (options.capture) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`git ${args.join(' ')} failed with code ${code}: ${stderr || stdout}`));
    });
  });
}
