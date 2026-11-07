export const CHARACTERS = [
  { id: 'optimist', name: 'OPTIMIST', subtitle: 'Фирменный герой', src: '/assets/boards/characters/optimist.webp', kind: 'hero' },
  { id: 'lilya-detective', name: 'ЛИЛЯ', subtitle: 'Detective', src: '/assets/boards/characters/lilya-detective.webp', kind: 'hero' },
  { id: 'natalie', name: 'NATALIE', subtitle: 'Ночной стиль', src: '/assets/boards/characters/natalie.webp', kind: 'hero' },
  { id: 'nikita', name: 'НИКИТА', subtitle: 'Король стола', src: '/assets/boards/characters/nikita.webp', kind: 'hero' },
  { id: 'poison', name: 'POISON', subtitle: 'Ядовитая корона', src: '/assets/boards/characters/poison.webp', kind: 'hero' },
  { id: 'lena', name: 'ЛЕНА', subtitle: 'Красный бархат', src: '/assets/boards/characters/lena.webp', kind: 'hero' },
  { id: 'elvina', name: 'ЭЛЬВИНА', subtitle: 'Ruby queen', src: '/assets/boards/characters/elvina.webp', kind: 'hero' },
  { id: 'ksyusha', name: 'КСЮША', subtitle: 'Velvet lady', src: '/assets/boards/characters/ksyusha.webp', kind: 'hero' },
  { id: 'cat', name: 'КОТ-КОРОЛЬ', subtitle: 'Синий жетон', src: '/assets/boards/characters/cat.webp', kind: 'pet' },
  { id: 'owl', name: 'СОВА', subtitle: 'Красный жетон', src: '/assets/boards/characters/owl.webp', kind: 'pet' },
  { id: 'husky', name: 'ХАСКИ', subtitle: 'Зелёный жетон', src: '/assets/boards/characters/husky.webp', kind: 'pet' },
  { id: 'raccoon', name: 'ЕНОТ', subtitle: 'Золотой жетон', src: '/assets/boards/characters/raccoon.webp', kind: 'pet' },
];

export const DEFAULT_CHARACTER_ID = 'optimist';
const CHARACTER_IDS = new Set(CHARACTERS.map((character) => character.id));
export function isCharacterId(value) { return typeof value === 'string' && CHARACTER_IDS.has(value); }
export function getCharacter(characterId) { return CHARACTERS.find((character) => character.id === characterId) || CHARACTERS[0]; }
