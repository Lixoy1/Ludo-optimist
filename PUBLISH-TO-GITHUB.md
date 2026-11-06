# Как опубликовать полный исходный код в GitHub

Этот архив — полная папка проекта. В текущем GitHub-подключении можно записывать текстовые файлы, но нельзя передать бинарные WebP-ресурсы как файлы проекта, поэтому публикация всего дерева требует обычного `git push` с компьютера.

1. Распакуй архив в отдельную папку.
2. Открой терминал в распакованной папке и клонируй свой репозиторий рядом:

   ```bash
   git clone https://github.com/Lixoy1/Ludo-optimist.git ../Ludo-optimist-github
   ```

3. Скопируй **всё содержимое** распакованной папки в `../Ludo-optimist-github`, согласившись заменить `README.md` при запросе. Скрытые файлы `.env.example` и `.gitignore` тоже должны попасть в репозиторий. Не копируй `.env` с секретами.
4. Перейди в клон и отправь изменения:

   ```bash
   cd ../Ludo-optimist-github
   git add -A
   git commit -m "feat: add OPTIMIST LUDO Classic MVP source"
   git push origin main
   ```

После push на GitHub должны появиться `apps/`, `src/`, `assets/`, `tests/`, `scripts/`, `package.json`, `index.html` и документация.
