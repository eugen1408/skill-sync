# Skill Sync 🧠

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

*Read this in other languages: [English](#english), [Русский](#русский).*

---

<h2 id="english">🇬🇧 English</h2>

**Skill Sync** is a centralized installer and updater manager for LLM-agent skills. It allows developers and users to easily synchronize, update, and manage capabilities across different AI agents right from their desktop.

Built on modern web technologies:
- **Electron** for native desktop integration and a lightweight system tray.
- **Svelte 5** and **Vite** for a blazing fast frontend experience.
- **Skeleton UI** & **TailwindCSS 4** for a clean, responsive UI.

### Features
- 🔄 Background auto-updates for your LLM skills.
- ⚡ Quick access via a sleek system tray icon.
- 📦 Centralized skill repository management.
- 🎨 Native macOS-like squircle icon aesthetics.

### Installation

To run this project locally, clone the repository and install the dependencies:

```bash
git clone https://github.com/evaganov/skill-sync.git
cd skill-sync
npm install
```

### Development
Start the application in development mode with HMR:
```bash
npm run dev
```

### Build
Build the project for production:
```bash
npm run build
```

To package the application into a redistributable format (e.g. `.dmg`, `.exe`):
```bash
npm run dist
```

---

<h2 id="русский">🇷🇺 Русский</h2>

**Skill Sync** — это централизованный менеджер для установки и обновления навыков (skills) LLM-агентов. Приложение позволяет разработчикам и пользователям удобно синхронизировать и управлять возможностями своих AI-агентов прямо с рабочего стола.

Проект построен на современных технологиях:
- **Electron** для глубокой интеграции с ОС и удобного системного трея.
- **Svelte 5** и **Vite** для молниеносного интерфейса.
- **Skeleton UI** и **TailwindCSS 4** для красивого и отзывчивого дизайна.

### Ключевые возможности
- 🔄 Фоновое автоматическое обновление навыков LLM.
- ⚡ Быстрый доступ через стильную иконку в трее (System Tray).
- 📦 Централизованное управление репозиториями навыков.
- 🎨 Нативная macOS-подобная эстетика иконок с формой squircle и кастомным графом мозга.

### Установка

Для локального запуска клонируйте репозиторий и установите зависимости:

```bash
git clone https://github.com/evaganov/skill-sync.git
cd skill-sync
npm install
```

### Разработка
Запустите приложение в режиме разработки (HMR):
```bash
npm run dev
```

### Сборка
Сборка проекта:
```bash
npm run build
```

Для сборки готовых дистрибутивов (`.dmg`, `.exe` и т.д.):
```bash
npm run dist
```

---

## License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.
