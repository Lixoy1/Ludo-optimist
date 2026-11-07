const characterAsset = (file) => new URL(`../assets/boards/characters/${file}`, import.meta.url).href;

export const CHARACTERS = [
  { id: 'optimist', name: 'OPTIMIST', subtitle: 'Фирменный герой', src: characterAsset('optimist.webp'), kind: 'hero' },
  { id: 'lilya-detective', name: 'ЛИЛЯ', subtitle: 'Detective', src: characterAsset('lilya-detective.webp'), kind: 'hero' },
  { id: 'natalie', name: 'NATALIE', subtitle: 'Ночной стиль', src: characterAsset('natalie.webp'), kind: 'hero' },
  { id: 'nikita', name: 'НИКИТА', subtitle: 'Король стола', src: characterAsset('nikita.webp'), kind: 'hero' },
  { id: 'poison', name: 'POISON', subtitle: 'Ядовитая корона', src: characterAsset('poison.webp'), kind: 'hero' },
  { id: 'lena', name: 'ЛЕНА', subtitle: 'Красный бархат', src: characterAsset('lena.webp'), kind: 'hero' },
  { id: 'elvina', name: 'ЭЛЬВИНА', subtitle: 'Ruby queen', src: characterAsset('elvina.webp'), kind: 'hero' },
  { id: 'ksyusha', name: 'КСЮША', subtitle: 'Velvet lady', src: characterAsset('ksyusha.webp'), kind: 'hero' },
  { id: 'cat', name: 'КОТ-КОРОЛЬ', subtitle: 'Синий жетон', src: characterAsset('cat.webp'), kind: 'pet' },
  { id: 'owl', name: 'СОВА', subtitle: 'Красный жетон', src: characterAsset('owl.webp'), kind: 'pet' },
  { id: 'husky', name: 'ХАСКИ', subtitle: 'Зелёный жетон', src: characterAsset('husky.webp'), kind: 'pet' },
  { id: 'raccoon', name: 'ЕНОТ', subtitle: 'Золотой жетон', src: characterAsset('raccoon.webp'), kind: 'pet' },
];

export const DEFAULT_CHARACTER_ID = 'optimist';
const CHARACTER_IDS = new Set(CHARACTERS.map((character) => character.id));
export function isCharacterId(value) { return typeof value === 'string' && CHARACTER_IDS.has(value); }
export function getCharacter(characterId) { return CHARACTERS.find((character) => character.id === characterId) || CHARACTERS[0]; }
