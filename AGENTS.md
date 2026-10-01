# TG Tag Manager PRO — Agent Rules & System Directive

## 1. Architecture & Tech Stack
- **Frontend**: Pure Vanilla HTML5 / CSS3 / JavaScript (no frameworks or bundlers).
- **Libraries**: SheetJS (`xlsx.mini.min.js`) via CDN for client-side Excel/JSON parsing.
- **Storage**: Client-side `localStorage` (`opsDB` / `operator_db`). Air-gapped (no backend / network calls).
- **Entry Point**: `index.html` (single official entry point for development and GitHub Pages).

## 2. Zero-Leak Security Policy (Absolute Priority)
- **Zero Sensitive Data in Code**: `DEFAULT_DB = {}` in `script2.js` must ALWAYS remain empty.
- **Strict Git Ignore**: Never track `*.xlsx`, `*.xls`, `*.csv`, `opsDB*.json`, or any employee lists.
- **Client-Side Only**: All imported records stay strictly in the user's browser `localStorage`.

## 3. Strict Git Push Policy
- **Rule**: `git push` is **STRICTLY FORBIDDEN** by default.
- All testing, staging, and commits must remain strictly local.
- `git push origin main` may ONLY be executed when the user explicitly sends the trigger: `"пуш"` or `"push"`.

## 4. Versioning & Changelog Automation
- **Automatic Patch Increment**: При кожному новому функціональному коміті агент зобов'язаний автоматично піднімати patch-версію (наприклад, 1.4.0 ➔ 1.4.1).
- **Синхронізація документації**: Записувати зміни у `CHANGELOG.md`.
- **Синхронізація в коді та UI**: Оновлювати бейдж версії в `index.html` (`#appVersionBadge`), футер модального вікна та додавати відповідний запис у масив `APP_CHANGELOG` у `script2.js`.

