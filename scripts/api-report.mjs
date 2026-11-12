#!/usr/bin/env node
/*
 * The public types of Primavista, as api-extractor reports them: one file per
 * entry in api/. This is the contract with extension authors. A change to a
 * signature, an export or a doc tag shows up in the diff of these files.
 *
 *   node scripts/api-report.mjs          fails when a report differs from api/
 *   node scripts/api-report.mjs --local  writes the reports, commit the result
 *
 * Needs `pnpm build` first.
 */
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = process.argv.includes('--local');

const entries = [
  { name: 'core', pkg: 'packages/core', dts: 'dist/index.d.ts' },
  { name: 'core-testing', pkg: 'packages/core', dts: 'dist/testing.d.ts' },
  { name: 'react', pkg: 'packages/react', dts: 'dist/index.d.ts' },
  { name: 'sulu', pkg: 'packages/sulu', dts: 'dist/index.d.ts' },
];

let failed = false;
for (const { name, pkg, dts } of entries) {
  const packageJsonFullPath = join(root, pkg, 'package.json');
  const config = ExtractorConfig.prepare({
    configObject: {
      projectFolder: join(root, pkg),
      mainEntryPointFilePath: join(root, pkg, dts),
      compiler: { tsconfigFilePath: join(root, pkg, 'tsconfig.json') },
      apiReport: { enabled: true, reportFileName: `${name}.api.md`, reportFolder: join(root, 'api'), reportTempFolder: join(root, 'node_modules/.cache/api-report') },
      newlineKind: 'lf',
      docModel: { enabled: false },
      dtsRollup: { enabled: false },
      tsdocMetadata: { enabled: false },
      messages: {
        compilerMessageReporting: { default: { logLevel: 'none' } },
        extractorMessageReporting: { default: { logLevel: 'none', addToApiReportFile: false }, 'ae-missing-release-tag': { logLevel: 'none' } },
        tsdocMessageReporting: { default: { logLevel: 'none' } },
      },
    },
    configObjectFullPath: join(root, pkg, 'api-extractor.json'),
    packageJsonFullPath,
  });
  const result = Extractor.invoke(config, { localBuild: local, showVerboseMessages: false });
  if (!result.succeeded) {
    console.error(`api-report: ${name} differs from api/${name}.api.md. Run \`node scripts/api-report.mjs --local\` and commit the result.`);
    failed = true;
  } else {
    console.log(`api-report: ${name} ok`);
  }
}
process.exit(failed ? 1 : 0);
