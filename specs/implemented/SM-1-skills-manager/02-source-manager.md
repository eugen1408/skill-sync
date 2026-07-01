# [SM-1] Часть 2 — Source Manager

- **Статус:** Реализовано
- **Эпик:** [../00-epic.md](00-epic.md)
- **Ответственный:** @evaganov
- **Создано:** 2026-07-01
- **Сложность:** Сложная

## Обзор

Source Manager управляет подключёнными источниками skills трёх типов: официальный каталог `skills.sh`, Git-репозитории (в т.ч. корпоративные), локальные каталоги. Для каждого источника: добавить, удалить, временно отключить, обновить содержимое, получить список доступных skills. Для локальных источников — watch-режим с автообновлением индекса. Результаты индексации Source Manager передаёт в Skill Registry (Часть 4).

## Пользовательская история

Как пользователь, я хочу подключать несколько источников skills разных типов и управлять ими (вкл/выкл/обновить/удалить), чтобы работать с корпоративными и локальными репозиториями наравне с официальным каталогом.

## Критерии приемки

- [x] КП1: Пользователь может добавить источник типа `official`, `git`, `local` с валидацией параметров.
- [x] КП2: Пользователь может удалить источник (с подтверждением). *(подтверждение — на стороне UI, Часть 7; API `source:remove` реализован)*
- [x] КП3: Пользователь может временно отключить/включить источник (`enabled`); отключённый не участвует в индексации (`refresh` → null) и проверке обновлений.
- [x] КП4: Пользователь может запустить «обновить содержимое» источника (переиндексация) — асинхронно через `JobRunner` с прогрессом.
- [x] КП5: Для каждого источника доступен список доступных skills (имя, описание при наличии) — `source:listSkills`.
- [x] КП6: Официальный источник получает каталог skills.sh через его API (`/api/search`).
- [x] КП7: Git-источник получает список skills клонированием/обновлением репозитория (кэш клонов) и обнаружением `SKILL.md`.
- [x] КП8: Локальный источник получает список skills сканированием указанного каталога на `SKILL.md`.
- [x] КП9: Локальный источник в watch-режиме автоматически инициирует переиндексацию при изменении файлов (chokidar + дебаунс → `refresh`).
- [x] КП10: Недоступность источника (сеть/путь/auth) не роняет приложение — фиксируется статус `error` + `lastError`, эмитится `source:indexed` с ошибкой. *(нативное уведомление `SOURCE_UNAVAILABLE` подключается в Части 6 — NotificationCenter)*

## Поведение

### Затрагиваемые компоненты / модули

- **`src/main/sources/SourceManager`** — CRUD источников, персист в `ConfigStore`, оркестрация индексации, watch.
- **`src/main/sources/adapters`** — адаптер на тип источника: `OfficialSourceAdapter`, `GitSourceAdapter`, `LocalSourceAdapter`. Общий интерфейс `SourceAdapter` (см. ниже).
- **`src/main/sources/skillDiscovery`** — обнаружение и парсинг `SKILL.md` (frontmatter: name, description) в файловом дереве (для Git/Local).
- **`src/main/sources/localWatcher`** — файловый watch локальных каталогов с дебаунсом.
- **IPC:** каналы `source:list`, `source:add`, `source:remove`, `source:setEnabled`, `source:refresh`, `source:listSkills`; событие `source:indexed` (source refreshed).

### `SourceAdapter` (общий контракт)

Каждый адаптер реализует интерфейс:

- `validate(config)` — проверка параметров источника (URL/путь достижим, формат корректен).
- `listSkills()` — вернуть список доступных skills источника (`RawSkill[]`: name, description, относительный путь/идентификатор, ref при наличии), стримя прогресс.
- `supportsWatch` — флаг (true только для Local).

Выбор адаптера по `Source.type`. Архитектура допускает добавление новых типов источников без изменения UI (только регистрация нового адаптера).

### Логика по типам

- **Official (`skills.sh`):** индексация через API каталога (см. Требования к данным). Установленность/версии считаются на стороне Registry/Resolver, не адаптером.
- **Git:** shallow-clone во временный каталог (или `git fetch` при повторном обновлении закэшированного клона), обнаружение `SKILL.md`. Учитываются `ref` (branch/tag) и `subpath`. Аутентификация — согласно эпик Q-04.
- **Local:** сканирование каталога на `SKILL.md`; watch с дебаунсом → `source:indexed`.

## Требования к данным и API

### `Source` (полная модель)

```json
{
  "id": "string (UUID)",
  "type": "string (enum: official | git | local)",
  "name": "string",
  "enabled": "boolean",
  "config": {
    "url": "string | null (git: URL репозитория; official: базовый URL, по умолчанию https://skills.sh)",
    "ref": "string | null (git: branch/tag)",
    "subpath": "string | null (git: путь внутри репозитория)",
    "authMode": "string | null (enum: ssh | https | none)",
    "localPath": "string | null (local: абсолютный путь)",
    "watch": "boolean (local: включён ли watch)"
  },
  "lastIndexedAt": "string | null (ISO-8601)",
  "status": "string (enum: ok | indexing | error | disabled)",
  "lastError": "string | null"
}
```

### `RawSkill` (результат `listSkills` адаптера)

```json
{
  "name": "string",
  "description": "string | null",
  "sourceRef": "string (идентификатор внутри источника: owner/repo@skill | относительный путь | slug каталога)",
  "ref": "string | null (git branch/tag/sha, если применимо)"
}
```

### API официального каталога (skills.sh)

- **GET** `https://skills.sh/api/search?q=<query>&limit=<n>&owner=<owner>` — поиск/листинг. Ответ: `{ skills: [{ id, name, slug, description, source, installs }] }`.
- Заголовок `Accept: application/json`. Ошибки сети/HTTP → `SOURCE_UNAVAILABLE`.
- Кэширование ответов каталога (TTL + лимит записей) — на стороне адаптера/Registry.

## Пограничные случаи и обработка ошибок

- **Недоступный Git-репозиторий / отказ auth:** статус `error`, `lastError`, уведомление; предыдущий индекс сохраняется.
- **Локальный путь удалён/недоступен:** статус `error`, watch приостановлен; при восстановлении — авто-переиндексация.
- **Дубликат источника** (тот же URL+ref или тот же путь): предупреждение, запрет добавления дубля.
- **Пустой источник** (нет `SKILL.md`): валидный, но пустой список; отражается в UI.
- **Частые изменения в watch:** дебаунс, чтобы не запускать индексацию на каждый файловый ивент.
- **Rate limit API каталога:** backoff, кэш; сообщение пользователю.

## Зависимости и риски

- Блокирует: Часть 4 (Registry потребляет результаты индексации), Часть 5 (тип источника → провайдер).
- Заблокировано: Часть 1 (Foundation).
- Риски: разнообразие форматов Git-URL и auth в корпоративной среде; кроссплатформенный file-watch (нативные лимиты дескрипторов при десятках источников).

## Заметки по тестированию

- Unit (node): парсинг `SKILL.md` frontmatter; выбор адаптера по типу; дедуп источников; дебаунс watcher; маппинг ошибок в `SOURCE_UNAVAILABLE`.
- Моки: локальный fixture-каталог со skills; мок HTTP для API каталога; мок git (локальный bare-repo как fixture).
- Проверить: отключённый источник исключается из индексации.

## Открытые вопросы

## Q2-01: Кэш Git-клонов между обновлениями
**Приоритет:** Высокое
**Вопрос:** Держать постоянный локальный клон каждого Git-источника (и делать `fetch` при обновлении) или каждый раз клонировать заново во временный каталог?
**Варианты:** 1. Постоянный кэш клонов в userData (быстрее обновления, экономит трафик). 2. Каждый раз временный shallow-clone (проще, меньше состояния).
**Допущение:** Вариант 1 — постоянный кэш клонов, `fetch` при обновлении; полезно для десятков репозиториев и корпоративной сети.
**Статус:** Открыт
**Ответ:**

## Q2-02: Библиотека file-watch
**Приоритет:** Среднее
**Вопрос:** `chokidar` или нативный `fs.watch`?
**Допущение:** `chokidar` (стабильнее кроссплатформенно, встроенный дебаунс), при условии приемлемого размера зависимости.
**Статус:** Открыт
**Ответ:**

## Заметки по реализации

**Расположение:** `src/main/sources/`. IPC: `source:*` (invoke) + событие `source:indexed`; preload/contract расширены.

**Структура:** `types.ts` (`SourceAdapter`, `IndexContext`), `skillDiscovery.ts` (обход дерева + парсинг frontmatter `SKILL.md`), `adapters/{official,git,local}.ts`, `gitCache.ts` (постоянные клоны, Q2-01), `localWatcher.ts` (chokidar, Q2-02), `SourceManager.ts` (оркестратор), `index.ts` (фабрика `createSourceManager`).

**Ключевые решения:**
- **`SourceAdapter`** — общий интерфейс; выбор по `Source.type`; новый тип источника = регистрация адаптера в фабрике, без изменений UI/оркестратора.
- **Official** — витрина по seed-запросам к `/api/search` (как reference-installer), `fetch` инъектируется для тестов, дедуп по `sourceRef`.
- **Git** — `GitCache` держит постоянный клон (`shallow clone` → далее `fetch` + `reset --hard FETCH_HEAD`), учитывает `ref`/`subpath`; auth опирается на системный git/ssh (Q-04). Отмена через `AbortSignal` из `JobRunner`.
- **Local** — сканирование каталога; `LocalWatcher` (chokidar, дебаунс 800 мс, игнор `.git`/`node_modules`) → авто-`refresh` (КП9). Watchers переживают вкл/выкл через `syncWatch`.
- **Индексация** идёт через `JobRunner` (прогресс/лог/отмена/таймаут). Результат — в память (`skillsCache`) + рассылка подписчикам `onIndexed` (in-process, для Registry Части 4) + IPC-событие `source:indexed` (для UI). Persist списков skills — задача Registry (Часть 4).
- **Дедуп** источников: local по пути, git по url+ref, official по url. Валидация — через адаптер (`validate`) до записи в конфиг.

**Верификация:** typecheck (node+web) — 0 ошибок; тесты — 8 новых (parseFrontmatter, discoverSkills со скипом `node_modules`, SourceManager: add/dedup/validate-fail/refresh→onIndexed/disabled/remove), суммарно 25/25 pass; build — все бандлы; smoke-boot — приложение стартует с chokidar/SourceManager без ошибок; prettier — чисто.
