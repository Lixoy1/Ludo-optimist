import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const THEMES = ['classic', 'neon'];
const readBoard = (theme) => readFile(resolve('assets/boards', `optimist-ludo-${theme}.svg`), 'utf8');
const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'));

test('authored vector boards keep the 720x720 contract and are validated without regeneration', async () => {
  assert.equal(packageJson.scripts['validate:classic-boards'], 'node scripts/validate-classic-boards.mjs');
  assert.equal(packageJson.scripts['build:boards'], undefined);
  assert.equal(packageJson.scripts.pretest, undefined);
  assert.equal(packageJson.scripts.prestart, undefined);
  const svgs = await Promise.all(THEMES.map(readBoard));
  for (const [index, svg] of svgs.entries()) {
    assert.match(svg, /width="720" height="720" viewBox="0 0 720 720"/);
    assert.match(svg, new RegExp(`OPTIMIST LUDO ${THEMES[index].toUpperCase()} board`));
    assert.equal((svg.match(/data-cell=/g) || []).length, 72);
    assert.equal((svg.match(/data-safe-index=/g) || []).length, 4);
  }
});

test('both authored board themes preserve the same logical cell set', async () => {
  const svgs = await Promise.all(THEMES.map(readBoard));
  const cells = (svg) => [...svg.matchAll(/data-cell="([^"]+)"/g)].map((match) => match[1]).sort();
  const canonical = cells(svgs[0]);
  assert.equal(new Set(canonical).size, 72);
  for (const svg of svgs.slice(1)) assert.deepEqual(cells(svg), canonical);
});

test('obsolete PENTA and legacy HEX SVGs are not shipped with the two-board release', async () => {
  const files = await readdir(resolve('assets/boards'));
  const legacy = files.filter((name) => /^optimist-ludo-(?:penta|hex)-/i.test(name));
  assert.deepEqual(legacy, []);
});
