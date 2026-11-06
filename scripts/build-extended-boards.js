import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EXTENDED_GEOMETRIES, EXTENDED_THEMES, renderExtendedBoardSvg } from '../src/extended-geometries.js';

const output = join(process.cwd(), 'assets', 'boards');
await mkdir(output, { recursive: true });
for (const geometry of Object.values(EXTENDED_GEOMETRIES)) {
  for (const theme of Object.keys(EXTENDED_THEMES)) {
    const file = 'optimist-ludo-' + geometry.id + '-' + theme + '.svg';
    await writeFile(join(output, file), renderExtendedBoardSvg(geometry, theme), 'utf8');
    process.stdout.write('Built ' + file + '\n');
  }
}
