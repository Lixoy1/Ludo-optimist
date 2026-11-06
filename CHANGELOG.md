# Changelog

## 0.5.0 — OPTIMIST Signature Dice Dock

- Заменён символ Unicode на фирменный кубик с точной раскладкой точек для значений 1–6.
- Добавлены объёмная грань, внутренний кант, блик, тень, свечение и анимация броска.
- Основная кнопка броска закреплена по центру нижней части экрана; добавлена поддержка safe-area и компактная мобильная компоновка.
- Вторичные действия получили единую тактильную стилистику и иконографику.
- Добавлены автоматические проверки разметки кубика, шести значений и нижнего игрового дока.


## 0.6.0 — Responsive vector boards
- Добавлены четыре самостоятельных SVG-поля с единой точной сеткой 720×720.
- Маршрут, домашние дорожки, базы, safe cells и финиш выводятся из той же геометрии, что использует движок.
- Добавлено увеличение зоны выбора клетки, окно выбора конкретной фишки и бейдж переполнения для стеков 5+.
- Снято ограничение браузерного zoom для доступности на телефонах.


## 2026-11-06 — Board artwork and responsive alignment
- Added four full-resolution vector board themes (CLASSIC, NEON, ELITE, MARBLE) with a shared 720×720 coordinate contract.
- Matched every one of the 52 route cells, 20 home-lane cells, 16 base wells and four finish wells to the game renderer.
- Reduced pawn art footprint and tuned 2/3/4-token stack scale and offsets; preserved 48px touch hit targets.
- Added automated asset-coordinate and stack-layout tests.
