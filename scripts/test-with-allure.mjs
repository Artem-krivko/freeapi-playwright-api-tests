import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function run(cli, args) {
  const result = spawnSync(process.execPath, [require.resolve(cli), ...args], {
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error);
  return result.status ?? 1;
}

rmSync('allure-results', { recursive: true, force: true });
const testStatus = run('@playwright/test/cli', ['test', ...process.argv.slice(2)]);
const reportStatus = run('allure-commandline/bin/allure', [
  'generate', 'allure-results', '--clean', '-o', 'allure-report',
]);

// Generate the report even when tests fail, then preserve the test exit code.
process.exitCode = testStatus || reportStatus;
