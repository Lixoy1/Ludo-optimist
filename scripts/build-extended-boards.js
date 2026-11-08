import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BOARD_AVATARS, EXTENDED_GEOMETRIES, BOARD_THEMES, renderExtendedBoardSvg } from '../src/extended-geometries.js';

const output = join(process.cwd(), 'assets', 'boards');
const avatarDirectory = join(output, 'characters', 'board');
await mkdir(output, { recursive: true });

async function embedBoardAvatars(svg, boardType) {
  const avatarIds = [...new Set(Object.values(BOARD_AVATARS[boardType]))];
  const definitions = await Promise.all(avatarIds.map(async (avatarId) => {
    const buffer = await readFile(join(avatarDirectory, avatarId + '.webp'));
    const encoded = buffer.toString('base64');
    const uri = 'data:image/webp;base64,' + encoded;
    return `<image id="avatar-${avatarId}" width="96" height="96" href="${uri}" xlink:href="${uri}" preserveAspectRatio="xMidYMax meet"/>`;
  }));
  return svg.replace('</defs>', definitions.join('') + '</defs>');
}

for (const geometry of Object.values(EXTENDED_GEOMETRIES)) {
  for (const theme of Object.keys(BOARD_THEMES)) {
    const file = 'optimist-ludo-' + geometry.id + '-' + theme + '.svg';
    const svg = await embedBoardAvatars(renderExtendedBoardSvg(geometry, theme), geometry.id);
    await writeFile(join(output, file), svg, 'utf8');
    process.stdout.write('Built ' + file + ' with embedded character art\n');
  }
}
