# [SM-1] Часть 1 — Foundation, процессная модель и IPC

- **Статус:** Реализовано
- **Эпик:** [../00-epic.md](00-epic.md)
- **Ответственный:** @evaganov
- **Создано:** 2026-07-01
- **Сложность:** Сложная

## Обзор

Каркас Electron-приложения, на котором строятся все остальные части: процессная модель (main / preload / renderer), система сборки, renderer-стек (Svelte 5 + Skeleton UI), типизированный IPC-контракт, общие доменные модели, персистентный конфиг-store и инфраструктура асинхронных задач с прогрессом. Кода бизнес-логики здесь нет — только фундамент и контракты, которые потребляют части 2–7.

## Пользовательская история

Как разработчик приложения, я хочу единый каркас с типобезопасным IPC и общими моделями, чтобы каждый следующий модуль подключался к готовым контрактам, а не изобретал процессную коммуникацию заново.

## Критерии приемки

- [x] КП1: `npm run dev` запускает Electron-окно с renderer на Svelte 5 + Skeleton UI; `npm run build` собирает `out/`.
- [x] КП2: electron-builder-конфиг производит артефакты для macOS (arm64 + x64), Windows, Linux, с `publish`-провайдером `github` (GitHub Releases).
- [x] КП2а: Автообновление самого приложения через `electron-updater` (провайдер `github`): проверка при запуске, загрузка, событие «доступно обновление приложения» в renderer (UI-флоу — Часть 7). Механизм независим от обновления skills (Часть 6). *(эпик Q-06)*
- [x] КП3: Renderer работает при `contextIsolation: true`, `nodeIntegration: false`; доступ к main — только через `window.api`, объявленный в preload.
- [x] КП4: Определён типизированный IPC-контракт (invoke-каналы + событийные каналы) в одном общем модуле, импортируемом main, preload и renderer.
- [x] КП5: Реализован персистентный `ConfigStore` — чтение/запись JSON-конфигурации в пользовательском каталоге приложения, с версией схемы и миграциями.
- [x] КП6: Реализована инфраструктура асинхронных задач: запуск фоновой операции в main, стрим прогресса и лог-строк в renderer, отмена, таймаут.
- [x] КП7: Определены общие доменные модели (`Skill`, `Source`, `InstalledSkill`, ошибки) в общем модуле.
- [x] КП8: Глобальная модель ошибок и логирование main-процесса.

## Поведение

### Затрагиваемые компоненты / модули

- **`src/main/index`** — инициализация приложения, создание `BrowserWindow`, регистрация IPC-обработчиков, CSP.
- **`src/preload/index`** — `contextBridge.exposeInMainWorld('api', …)`; типизация `Window.api`.
- **`src/renderer`** — точка входа Svelte 5, корневой компонент App Shell (детально — Часть 7).
- **`src/shared/ipc`** — определение имён каналов, типов запросов/ответов и полезных нагрузок событий (единый источник истины для трёх процессов).
- **`src/shared/domain`** — доменные модели и enum-ы (`Skill`, `Source`, `SourceType`, `InstalledSkill`, `UpdateStatus`, `AppError`).
- **`src/main/config`** — `ConfigStore`: загрузка/сохранение конфигурации, схема, миграции.
- **`src/main/jobs`** — реестр асинхронных задач (`JobRunner`): запуск, отмена, прогресс, таймаут, буферизация лог-строк.
- **`src/main/logger`** — логирование main-процесса.
- **`src/main/appUpdater`** — обёртка над `electron-updater` (GitHub-провайдер): проверка/загрузка/применение обновлений приложения, эмиссия событий в renderer.

### IPC-контракт (базовый)

Определяется единый модуль `src/shared/ipc` со следующими семействами (конкретные каналы доменных частей добавляются в соответствующих спецификациях):

- **invoke-каналы** (renderer → main → ответ): именование `<domain>:<action>`, каждый со строго типизированными аргументом и результатом.
- **событийные каналы** (main → renderer, стрим): для прогресса задач — `job:progress`, `job:log`, `job:done`, `job:error`.

Контракт: preload не пропускает произвольные каналы — экспонируется явный набор методов `window.api.<domain>.<method>()` и подписки `window.api.on<Event>(handler)`.

### Инфраструктура задач (`JobRunner`)

- Контракт: принимает описание задачи (тип операции + параметры), возвращает `jobId`; исполняет операцию асинхронно, стримит события прогресса/лога, финализирует `done`/`error`.
- Поддерживает: отмену по `jobId`, таймаут по бездействию (порог настраивается), буферизацию лог-строк с флашем по интервалу (снижает частоту IPC).
- Используется частями Source Manager (индексация/обновление источника), Installer Providers (установка), Update Engine (проверка/обновление).

## Требования к данным и API

### Общие доменные модели

**`Source`** — описание подключённого источника (полная модель детализируется в Части 2):

```json
{
  "id": "string (UUID)",
  "type": "string (enum: official | git | local)",
  "name": "string",
  "enabled": "boolean"
}
```

**`Skill`** — элемент единого каталога (полная модель — в Части 4):

```json
{
  "id": "string (стабильный ключ: sourceId + skillName)",
  "name": "string",
  "description": "string | null",
  "sourceId": "string (UUID источника)"
}
```

**`InstalledSkill`** — запись об установленном skill (полная модель — в Части 4):

```json
{
  "skillId": "string",
  "installedVersion": "string | null",
  "installPath": "string"
}
```

**`AppError`** — единая модель ошибки для передачи в renderer:

```json
{
  "code": "string (enum: SOURCE_UNAVAILABLE | INSTALL_FAILED | UPDATE_FAILED | VERSION_RESOLVE_FAILED | CONFIG_ERROR | INTERNAL)",
  "message": "string",
  "cause": "string | null"
}
```

### `ConfigStore` (схема верхнего уровня)

Персистентный JSON в `app.getPath('userData')`. Секреты в store не хранятся (см. эпик Q-04). Разделы наполняются частями 2/6/7:

```json
{
  "schemaVersion": "number",
  "sources": "Source[] (Часть 2)",
  "update": "UpdateSettings (Часть 6)",
  "install": "InstallSettings (Часть 7 — директория установки, целевые агенты, scope, путь к CLI, npm-registry)",
  "network": "NetworkSettings (Часть 7 — git-режим SSH/HTTPS, прокси)",
  "appUpdate": "AppUpdateSettings (Часть 1/7 — проверка обновлений приложения, авто-загрузка)"
}
```

## Пограничные случаи и обработка ошибок

- **Повреждённый конфиг:** при ошибке парсинга — бэкап файла и старт с дефолтной конфигурацией, уведомление об ошибке (`CONFIG_ERROR`).
- **Несовпадение `schemaVersion`:** выполнить миграцию; при невозможности — бэкап + дефолт.
- **Падение фоновой задачи:** `JobRunner` эмитит `job:error` с `AppError`, задача помечается завершённой, ресурсы освобождаются.
- **Отмена/таймаут задачи:** корректное завершение дочерних процессов (SIGTERM → SIGKILL), очистка временных каталогов.

## Зависимости и риски

- Блокирует: все остальные части.
- Заблокировано: —
- Риски: расхождение типов IPC между процессами — минимизируется единым `src/shared/ipc`. Кроссплатформенная сборка/подпись — на MVP допустимы неподписанные артефакты (см. reference electron-builder.yml).

## Заметки по тестированию

- Unit (node): `ConfigStore` (чтение/запись/миграции/повреждённый файл), `JobRunner` (прогресс/отмена/таймаут/буферизация лога).
- Unit (jsdom): монтирование App Shell, доступность `window.api` через мок IPC.
- Мок IPC-моста для renderer-тестов (по образцу reference `test/mockApi`).

## Открытые вопросы

## Q1-01: Библиотека конфиг-store
**Приоритет:** Среднее
**Вопрос:** Использовать `electron-store` или собственный тонкий JSON-store?
**Допущение:** Собственный тонкий store (полный контроль над схемой/миграциями/бэкапом), без внешней зависимости.
**Статус:** Открыт
**Ответ:**

## Заметки по реализации

**Стек (зафиксированные версии):** Electron 43, electron-vite 5, Vite 7 (не 8 — ограничение electron-vite@5), `@sveltejs/vite-plugin-svelte` 6 (v7 требует Vite 8), Svelte 5.56, Skeleton 4.15 (`@skeletonlabs/skeleton` + `@skeletonlabs/skeleton-svelte`), Tailwind 4, Vitest 3, TypeScript 5.7. Node 26.

**Ключевые решения:**
- **ESM** во всём приложении (`"type": "module"`). Preload собирается в `out/preload/index.mjs`; путь в `main/index.ts` учитывает это.
- **Алиас `@shared`** настроен в трёх пайплайнах electron-vite и в обоих tsconfig — единые доменные модели и IPC-контракт (`src/shared`) для main/preload/renderer.
- **IPC-контракт** (`src/shared/ipc`) — единый источник имён каналов (`IpcInvoke`/`IpcEvent`) и типов (`IpcApi`). Preload экспонирует явный набор методов + типобезопасные подписки на события (без сквозного доступа к произвольным каналам).
- **ConfigStore** — свой тонкий JSON-store (Q1-01: без `electron-store`): атомарная запись (temp→rename), бэкап повреждённого файла, миграции по `schemaVersion`, `get()` возвращает клон.
- **JobRunner** — универсальная инфраструктура задач: `AbortController`-отмена, таймаут по бездействию (по умолчанию 90 с), буферизация лог-строк с флашем по интервалу; события через инъектируемый `JobEmitter` (main подключает к `webContents.send`).
- **AppUpdater** — обёртка `electron-updater` (GitHub), no-op в dev (`!app.isPackaged`).
- **CSP** — renderer `connect-src 'self'` (+ ws в dev); все сетевые вызовы (skills.sh/GitHub/git) вынесены в main.

**Верификация:** typecheck (node+web) — 0 ошибок; тесты — 9 pass (ConfigStore, JobRunner); build — все три бандла собираются; smoke-run — Electron стартует без ошибок и создаёт валидный `config.json` в userData. Prettier — чисто.

**Отложено на следующие части:** доменные IPC-каналы (`source:*`, `catalog:*`, `install:*`, `update:*`, `notifications:*`) добавляются в `src/shared/ipc/channels.ts` + `contract.ts` + `ipc/register.ts` по мере реализации Частей 2–6; `NotificationCenter` — Часть 6; полноценный App Shell/экраны — Часть 7 (сейчас минимальный shell-заглушка).
