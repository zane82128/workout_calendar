import { execFileSync } from 'node:child_process';
import { buildRelease, releaseArgument, root } from './build.mjs';
import { checkRelease } from './check-release.mjs';

const { info } = await buildRelease(releaseArgument());
await checkRelease();
execFileSync(process.execPath, ['tools/test-update.mjs'], { cwd: root, stdio: 'inherit' });
console.log(`Release candidate ready: ${info.releaseId}. 未 commit、push 或部署。`);
