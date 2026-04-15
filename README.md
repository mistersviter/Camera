# Camera

Мобильное веб-приложение на React + Vite для запуска камеры, управления вспышкой, настройки итогового размера снимка и быстрой проверки скачивания фото.

## Скрипты

- `npm run dev` — локальная разработка
- `npm run build` — production-сборка
- `npm run lint` — проверка ESLint
- `npm run preview` — локальный просмотр production-сборки

## GitHub Actions

- `CI` запускает `lint` и `build` на каждом push в `main` и на pull request
- `Deploy to GitHub Pages` публикует содержимое `dist` в GitHub Pages из ветки `main`

## GitHub Pages

Для публикации включите Pages в настройках репозитория и выберите источник `GitHub Actions`.
