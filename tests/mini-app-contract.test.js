import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

function htmlIds(source) {
  return new Set([...source.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
}

test('integrated Mini App markup contains every DOM target used by main.js', () => {
  const ids = htmlIds(html);
  const selectors = [...main.matchAll(/\$\(['"]#([A-Za-z][\w-]*)['"]\)/g)].map((match) => match[1]);
  const missing = [...new Set(selectors)].filter((id) => !ids.has(id));
  assert.deepEqual(missing, []);
});

test('board image and client modules are present in the integrated page', async () => {
  assert.match(html, /src="\/assets\/boards\/optimist-ludo-neon\.svg"/);
  assert.match(html, /src="\/src\/main\.js"/);
  assert.match(main, /from '\.\/client\/room-client\.js'/);
  assert.match(main, /from '\.\/board-render\.js'/);
  assert.ok((await stat(new URL('../assets/boards/optimist-ludo-neon.svg', import.meta.url))).size > 10_000);
});

test('interactive pawn and voice-message states have visible styles', () => {
  assert.match(css, /\.pawn\.legal/);
  assert.match(css, /\.pawn-character/);
  assert.match(css, /\.character-option\.selected/);
  assert.match(css, /#boardStage\[data-theme="marble"\]/);
  assert.match(main, /pawn-\$\{position\.color\}/);
  assert.match(css, /--token-color/);
  assert.match(css, /\.voice-button\.recording/);
  assert.match(css, /\.voice-player/);
});


test('all selected playable characters have optimized transparent assets', async () => {
  const { CHARACTERS } = await import('../src/characters.js');
  assert.equal(CHARACTERS.length, 12);
  for (const character of CHARACTERS) {
    const file = new URL(`..${character.src}`, import.meta.url);
    assert.ok((await stat(file)).size > 8_000, `${character.id} asset missing`);
  }
});

test('roll control is a custom six-state die and remains fixed in the bottom play dock', () => {
  assert.match(html, /id="diceCube" data-value="5"/);
  assert.match(html, /class="dice-pips"[\s\S]*?<i><\/i>(?:\s*<i><\/i>){8}/);
  assert.match(html, /id="diceLabel"/);
  assert.match(main, /function setDiceFace\(value = 5\)/);
  assert.match(main, /diceFace\.dataset\.value = String\(normalized\)/);
  for (const value of [1, 2, 3, 4, 5, 6]) {
    assert.match(css, new RegExp(`data-value="${value}"`));
  }
  assert.match(css, /\.game-controls\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(css, /\.dice-button\.rolling \.dice-cube/);
});

 test('room action controls use labelled accessible buttons and mobile icon treatment', () => {
  assert.match(html, /id="soundToggleBtn"[^>]*aria-pressed="true"/);
  assert.match(html, /id="copyCodeBtn"/);
  assert.match(html, /id="chatToggleBtn"/);
  assert.match(css, /\.secondary-button:focus-visible|button:focus-visible/);
  assert.match(css, /\.action-label\s*\{\s*display:\s*none/);
});

test('vector board themes and mobile stack selection are wired', async () => {
  const boards = await Promise.all(['classic','neon','elite','marble'].map((theme) => readFile(new URL(`../assets/boards/optimist-ludo-${theme}.svg`, import.meta.url), 'utf8')));
  assert.doesNotMatch(html, /maximum-scale=1/);
  assert.match(html, /id="boardArt"/);
  assert.match(html, /id="tokenChooser"/);
  assert.match(main, /createStackBadge/);
  assert.match(main, /handleBoardPointerUp/);
  assert.match(html, /id="boardEffectOverlay"/);
  assert.match(css, /\.pawn-overflow-badge/);
  for (const svg of boards) assert.match(svg, /viewBox="0 0 720 720"/);
});

test('mobile secondary controls and chooser close have accessible touch dimensions', () => {
  assert.match(css, /@media\(max-width:680px\)\{\.game-actions \.secondary-button\{width:42px;min-width:42px;min-height:44px/);
  assert.match(css, /\.token-chooser-close\{width:48px;height:48px\}/);
});
