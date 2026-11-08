import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EXTENDED_GEOMETRIES, BOARD_THEMES, renderExtendedBoardSvg } from '../src/extended-geometries.js';

const output = join(process.cwd(), 'assets', 'boards');
await mkdir(output, { recursive: true });

for (const geometry of Object.values(EXTENDED_GEOMETRIES)) {
  for (const theme of Object.keys(BOARD_THEMES)) {
    const file = 'optimist-ludo-' + geometry.id + '-' + theme + '.svg';
    const svg = renderExtendedBoardSvg(geometry, theme);
    await writeFile(join(output, file), svg, 'utf8');
    process.stdout.write('Built ' + file + ' with empty pawn wells\n');
  }
}
