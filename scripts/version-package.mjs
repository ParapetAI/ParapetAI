import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const [packagePath, bumpType] = process.argv.slice(2);

if (!packagePath || !bumpType) {
  console.error('Usage: node version-package.mjs <package-path> <patch|minor|major>');
  process.exit(1);
}

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Bump type must be one of: patch, minor, major');
  process.exit(1);
}

const packageJsonPath = resolve(__dirname, '..', packagePath, 'package.json');

try {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const [major, minor, patch] = packageJson.version.split('.').map(Number);

  let newVersion;
  if (bumpType === 'patch') {
    newVersion = `${major}.${minor}.${patch + 1}`;
  } else if (bumpType === 'minor') {
    newVersion = `${major}.${minor + 1}.0`;
  } else {
    newVersion = `${major + 1}.0.0`;
  }

  packageJson.version = newVersion;
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(newVersion);
} catch (error) {
  console.error(`Error updating version: ${error.message}`);
  process.exit(1);
}

