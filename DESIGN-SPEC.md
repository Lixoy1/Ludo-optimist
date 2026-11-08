# OPTIMIST LUDO — Board Geometry & Token Placement

## 1. Логическая геометрия Classic

- Поле описывается логической сеткой 15×15.
- Внешний маршрут содержит 52 уникальные клетки и задаётся массивом `MAIN_TRACK`.
- Для каждого из четырёх цветов есть отдельная точка старта.
- У каждого цвета есть пять клеток домашнего коридора; центральная финишная зона является общей целью.
- В каждой стартовой базе предусмотрено четыре посадочных места.
- Защищённые клетки перечислены в `SAFE_TRACK_INDICES`; они не вычисляются из визуальной темы.


## 1.1. Утверждённые геометрии 2.0

Геометрия выбирается отдельно от визуальной темы. В актуальном релизе используются ровно три режима:

- **CLASSIC** — 4 игрока, 52 внешние клетки, 5 домашних клеток на игрока.
- **HEXA** — 6 игроков, 72 внешние клетки, 6 домашних клеток на игрока.
- **ROYAL** — 4 игрока, 68 внешних клеток, 7 домашних клеток на игрока.

Все три режима используют единый формат прогресса `stepProgress`. PENTA, прежний HEX и DIAMOND не являются игровыми режимами OPTIMIST LUDO 2.0.

## 2. Центр

Центральная область — одна логическая финишная зона, визуально занимающая центральные 3×3 ячейки сетки. Внутри неё предусмотрены четыре посадочных места 2×2 для четырёх фишек одного победившего игрока.

Название OPTIMIST и главный логотип находятся вне маршрута, в верхней шапке игрового интерфейса. В центре поля допускается только небольшой декоративный знак, который не перекрывает фишки и клетки.

## 3. Совместное размещение

Один объект клетки содержит массив фишек, а не одну ссылку на фишку:

```ts
interface CellOccupancy {
  cellId: string;
  tokenIds: string[];
}
```

Рендерер получает массив и вызывает общий алгоритм `getStackLayout(count, cellSize)`:

| Число фишек | Расстановка |
|---:|---|
| 1 | По центру |
| 2 | Рядом по горизонтали |
| 3 | Компактный треугольник |
| 4 | Квадрат 2×2 |
| 5+ | Четыре видимых миниатюры + счётчик переполнения; полный состав доступен по нажатию |

Позиции нормализованы относительно размера клетки, поэтому одинаково работают в CLASSIC, NEON и ELITE.

## 4. Важное разделение правил и отображения

- Защищённая клетка может одновременно отображать фишки нескольких игроков, когда это разрешено выбранным набором правил.
- Обычная клетка может визуально получить несколько фишек, но серверный движок обязан отдельно решить, разрешено ли это правилами или должно произойти выбивание.
- Нельзя определять захват, безопасность или право хода по цвету картинки или числу нарисованных фигурок.
- На сервере хранятся идентификаторы фишек и состояние хода. Клиент получает авторитетное состояние и только отображает его.

## 5. Mini Pop ассеты

На этапе прототипа используются временные маркеры. В production каждая фигурка будет отдельным оптимизированным ассетом с единым pivot, масштабом, форматом и правилами освещения. Для стека используются уменьшенные варианты модели; при этом силуэт и цвет подставки должны оставаться различимыми.

## 6. Темы

- CLASSIC: натуральное дерево, бумажно-кремовые клетки, традиционные цветные базы.
- NEON: графит/чёрный хром, электрическое свечение, цветные брызги, яркие дорожки.
- ELITE: тёмный орех, золочёная резьба, металл, бархатные цветовые панели.
- MARBLE: холодный мрамор, прожилки камня, хромированные детали и сдержанное ледяное свечение.

Темы не меняют 15×15 сетку, координаты пути, идентификаторы клеток и правила.

## 7. Персональная кастомизация

- Тема доски — локальная настройка зрителя: разные игроки одной партии могут видеть разные темы.
- Логический цвет игрока назначается сервером один раз на партию; предпочтительный цвет учитывается при распределении свободных цветов. Два игрока не могут получить один логический цвет в одной четырёхместной партии.
- Поворот доски — только визуальная трансформация координат на клиенте; он не меняет логические координаты и идентификаторы клеток.
- Персонаж и внешний вид кубика принадлежат игроку и видны участникам партии.
- Все темы, кубики и персонажи доступны всем бесплатно.

## 8. Социальные функции и бесплатный сервер

- В MVP есть комнатный и общий текстовый чат, а также асинхронные голосовые сообщения. Постоянных голосовых комнат нет.
- Голосовые сообщения реализуются через MediaRecorder и бинарные HTTP endpoints по проверенному шаблону OPTIMIST DURAK; WebSocket передаёт только метаданные и chat event.
- Размер, длительность, число файлов, объём RAM и TTL ограничиваются сервером. Подробности: `VOICE-MESSAGES.md`.
- Бесплатное размещение и его ограничения описаны в `FREE-HOSTING.md`. Восстановление после разрыва WebSocket и восстановление после полного перезапуска процесса — разные гарантии.


## 1.2. Vector board artwork contract

Every active geometry has four SVG material themes in `assets/boards/`: CLASSIC uses `optimist-ludo-{classic,neon,elite,marble}.svg`; HEXA uses `optimist-ludo-hexa-{classic,neon,elite,marble}.svg`; ROYAL uses `optimist-ludo-royal-{classic,neon,elite,marble}.svg`. All use the 720×720 viewBox.

- CLASSIC: 52 route cells, 20 home cells, 16 base sockets and four finish sockets.
- HEXA: 72 route cells and six six-cell home lanes, generated from `src/extended-geometries.js`.
- ROYAL: 68 route cells and four seven-cell home lanes, generated from `src/extended-geometries.js`.
- Classic artwork is authored vector art and is validated read-only; HEXA and ROYAL SVGs are regenerated from their canonical geometry.
- `npm run build` validates CLASSIC, regenerates extended SVGs, and exports `Coordinates_Map.json`.

Changing table material never changes a route cell, token anchor, hit target or game rule.

## 1.3. Mobile scale and selection

The board is square and scales to the available width (maximum 650 CSS px). Pawn art is 6.2% of board width. Stacks use separated layouts at 48%, 46% and 44% for two, three and four tokens. When a stack exceeds four, four figures stay visible and a +N badge reports the overflow; all tokens remain available in the selection sheet.

Taps resolve to the nearest legal cell center, not to the tiny transparent edge of a pawn. The chooser buttons are at least 52px high. Keyboard and screen-reader activation use the same action path. Browser zoom remains enabled. This design follows Android's 48dp touch guidance, Apple's 44pt control guidance and WCAG 2.2 target-size criteria.
