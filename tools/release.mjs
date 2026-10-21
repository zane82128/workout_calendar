import { execFileSync } from 'node:child_process';
import { buildRelease, releaseArgument, root } from './build.mjs';
import { checkRelease } from './check-release.mjs';

const { info } = await buildRelease(releaseArgument());
await checkRelease();
execFileSync(process.execPath, ['--test', 'tests/records.test.mjs', 'tests/training.test.mjs', 'tests/feedback-service.test.mjs'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, ['tests/product.test.mjs'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, ['tests/update.test.mjs'], { cwd: root, stdio: 'inherit' });
console.log(`Release candidate ready: ${info.releaseId}. 未 commit、push 或部署。`);
