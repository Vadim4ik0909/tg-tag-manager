# Changelog — Telegram Tag Distribution Manager (TG Tag Manager PRO)

## [Unreleased]
- Адаптивний дизайн під мобільні пристрої (iOS / Android).

## [1.1.0] - 2026-10-01
### Added
- Вхідна точка `index.html` для коректного деплою на GitHub Pages.
- Інтеграція SheetJS (`xlsx.mini.min.js`) для імпорту баз клієнт-сайд.
- Zero-Leak верифікація: виключення конфіденційних файлів через `.gitignore`.

### Changed
- `DEFAULT_DB` очищено для безпечного публічного коду.
- Логіка зберігання перенесена в `localStorage`.

## [1.0.0] - Initial Architecture
- Базовий функціонал парсингу ID операторів.
- Клієнтська розмітка `index2.html` та скрипт `script2.js`.
