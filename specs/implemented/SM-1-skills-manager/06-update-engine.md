# [SM-1] Часть 6 — Update Engine и уведомления

- **Статус:** Реализовано
- **Эпик:** [../00-epic.md](00-epic.md)
- **Ответственный:** @evaganov
- **Создано:** 2026-07-01
- **Сложность:** Сложная

## Обзор

Update Engine отвечает за проверку и применение обновлений skills. Поддерживает режимы проверки: вручную, при запуске приложения, по расписанию, автоматически при изменении локального источника. Обновляет отдельный skill или все сразу. Оркеструет Version Resolver (Часть 3), Skill Registry (Часть 4) и Installer Providers (Часть 5). Генерирует уведомления (FR8) обо всех значимых событиях.

## Пользовательская история

Как пользователь, я хочу, чтобы приложение само отслеживало новые версии установленных skills и уведомляло меня, а я мог обновить один или все skills в один клик, чтобы не проверять репозитории вручную.

## Критерии приемки

- [x] КП1: Проверка обновлений вручную (кнопка «Проверить обновления») — асинхронно с прогрессом.
- [x] КП2: Проверка при запуске приложения (если включено в настройках).
- [x] КП3: Проверка по расписанию (интервал/cron из настроек).
- [x] КП4: Автоматическая проверка при изменении локального источника (по событию `source:indexed` watch, Часть 2).
- [x] КП5: Обновление отдельного skill.
- [x] КП6: Обновление всех skills с доступным обновлением (пакетно, с прогрессом и итоговой сводкой).
- [x] КП7: Результаты проверки пишутся в Registry (`hasUpdate`, `latestVersion`, `lastCheckedAt`, `updateStatus`).
- [x] КП8: Уведомления генерируются: новая версия доступна; успешное обновление; ошибка установки; ошибка обновления; недоступность источника.
- [x] КП9: Уведомления доступны в in-app центре уведомлений и (для фоновых событий) как нативные OS-уведомления (эпик Q-05).

## Поведение

### Затрагиваемые компоненты / модули

- **`src/main/update/UpdateEngine`** — планирование и выполнение проверок; применение обновлений через провайдеры.
- **`src/main/update/scheduler`** — расписание (интервал/cron), триггер при запуске, подписка на `source:indexed`.
- **`src/main/update/CheckRun`** — прогон проверки: для каждого установленного skill вызвать Version Resolver, собрать дельту.
- **`src/main/notifications/NotificationCenter`** — реестр/история уведомлений, эмиссия в renderer + нативные OS-уведомления.
- **IPC:** `update:checkAll`, `update:checkOne`, `update:runOne`, `update:runAll`, `update:getSettings`, `update:setSettings`; `notifications:list`, `notifications:markRead`, `notifications:clear`; события `update:checkProgress`, `update:checked`, `notification:new`.

### Логика проверки

- Источник списка установленных — Registry (Часть 4).
- Для каждого установленного skill: `VersionResolver.resolve(context)` → `VersionInfo`; при `hasUpdate` — пометить в Registry и создать уведомление «доступна новая версия» (дедуп: не спамить одним и тем же обновлением при каждой проверке).
- Проверка выполняется через `JobRunner` с прогрессом; параллелизм ограничен (пул), чтобы не превышать лимиты API.

### Логика обновления

- Обновление = повторная установка через соответствующий Installer Provider (Часть 5) с фиксацией новой версии в lock и Registry.
- «Обновить все» — пакетно с ограничением параллелизма и итоговой сводкой (ok/failed/skipped).
- По завершении — уведомления об успехе/ошибке; обновление статусов в Registry.

### Режимы проверки (настройки — Часть 7 / ConfigStore)

- `manual` — только по действию пользователя.
- `onLaunch` — однократно при старте приложения.
- `scheduled` — по интервалу (например, каждые N часов) / cron-выражению.
- `onLocalChange` — по событию watch локального источника (дебаунс).

## Требования к данным и API

### `UpdateSettings` (раздел ConfigStore)

```json
{
  "checkOnLaunch": "boolean",
  "scheduleEnabled": "boolean",
  "scheduleIntervalMinutes": "number | null",
  "scheduleCron": "string | null",
  "watchLocalSources": "boolean",
  "autoInstallUpdates": "boolean (авто-применять или только уведомлять)"
}
```

### `UpdateCheckResult`

```json
{
  "checkedAt": "string (ISO-8601)",
  "updatesAvailable": "number",
  "entries": [
    {
      "skillId": "string",
      "installedVersion": "string | null",
      "latestVersion": "string | null",
      "hasUpdate": "boolean",
      "resolvedBy": "string | null"
    }
  ]
}
```

### `Notification`

```json
{
  "id": "string (UUID)",
  "type": "string (enum: update_available | update_success | install_error | update_error | source_unavailable)",
  "title": "string",
  "message": "string",
  "skillId": "string | null",
  "sourceId": "string | null",
  "createdAt": "string (ISO-8601)",
  "read": "boolean"
}
```

## Пограничные случаи и обработка ошибок

- **Нет установленных skills:** проверка завершается без изменений; уведомлений нет.
- **Часть источников недоступна:** проверка продолжается по доступным; по недоступным — `source_unavailable`, статус в Registry.
- **Дубли уведомлений:** не создавать повторное `update_available` для той же пары (skill, latestVersion), если уже есть непрочитанное/актуальное.
- **Параллельные запуски проверки:** повторный запуск не стартует, если проверка уже идёт (или ставится в очередь).
- **Расписание при закрытом приложении:** проверка только при запущенном приложении (фоновый сервис/трей — эпик Q-06/вне рамок MVP).
- **`autoInstallUpdates` конфликтует с ручным контролем:** по умолчанию выключено — только уведомлять.
- **Частичный провал «обновить все»:** сводка с перечнем ошибок; успешные применяются, неуспешные не откатывают остальные.

## Зависимости и риски

- Блокирует: Часть 7 (UI использует проверку/обновление/уведомления).
- Заблокировано: Часть 3 (Resolver), Часть 4 (Registry), Часть 5 (Providers).
- Риски: лимиты API при массовой проверке (батчинг/бэкофф); поведение расписания при закрытом приложении.

## Заметки по тестированию

- Unit (node): планировщик (интервал/cron/onLaunch/onLocalChange); дедуп уведомлений; сводка пакетного обновления; запись статусов в Registry.
- Интеграция: полный цикл «проверка → уведомление → обновление → новая версия в Registry» на fixtures.
- Моки: Resolver/Registry/Providers; нативные OS-уведомления замоканы.

## Открытые вопросы

## Q6-01: Планировщик при закрытом приложении (трей/автозапуск)
**Приоритет:** Среднее
**Вопрос:** Нужен ли фоновой режим (иконка в трее / автозапуск) для проверок при закрытом окне, или проверки только при активном приложении?
**Допущение:** Только при активном приложении на MVP; трей/автозапуск — future (связано с эпик Q-06).
**Статус:** Открыт
**Ответ:**

## Q6-02: Библиотека расписания
**Приоритет:** Низкое
**Вопрос:** Простой интервал (`setInterval`) или cron-выражения (`node-cron`)?
**Допущение:** Поддержать оба поля в настройках; на MVP — интервал через таймер, cron — опционально через `node-cron`.
**Статус:** Открыт
**Ответ:**

## Заметки по реализации

**Расположение:** `src/main/update/` + `src/main/notifications/NotificationCenter.ts`. IPC: `update:*` / `notifications:*` + события `update:checked`, `notification:new`.

**Структура:** `NotificationCenter.ts` (история в памяти + дедуп + emit + инъектируемый nativeNotify), `resolveContext.ts` (`CatalogEntry` → `ResolveContext`), `UpdateEngine.ts` (проверка/обновление/планировщик), `index.ts` (фабрика).

**Ключевые решения:**
- **Режимы (FR6):** `checkOnLaunch` (при старте), `scheduled` (интервал через `setInterval`; cron-поле в настройках зарезервировано — Q6-02, на MVP интервал), `onLocalChange` (подписка на `SourceManager.onIndexed` при `watchLocalSources`), ручной (`update:checkAll`/`checkOne`).
- **Проверка** батчами (concurrency 6) через `VersionResolver`; результат пишется в Registry (`applyVersion`) и эмитится `update:checked`; при `hasUpdate` — уведомление `update_available` с дедупом по `latestVersion` (не спамит одинаковыми).
- **Обновление** = переустановка с `force` через `InstallerService.startInstall` (awaitable); сводка ok/failed/skipped + уведомления `update_success`/`update_error`.
- **NotificationCenter** электрон-независим (native инъектируется из `main` через `electron.Notification`) — поэтому тестируется в node. In-app центр + OS-уведомления (Q-05).
- **Проводка уведомлений в main:** ошибки индексации источника → `source_unavailable`; проваленная установка (`onResult`) → `install_error`.
- **`autoInstallUpdates`** — по умолчанию выключен (только уведомлять); авто-применение подключается в UI/настройках (Часть 7).
- **Планировщик при закрытом приложении** (трей/автозапуск, Q6-01) — вне MVP: проверки идут только при запущенном приложении.

**Верификация:** typecheck (node+web) 0 ошибок; тесты — 6 новых (NotificationCenter add/emit/native/unread/dedup, buildResolveContext git+local, UpdateEngine checkAll→applyVersion+уведомление+onChecked, runAll→success+summary), суммарно **42/42**; build ок; smoke-boot без ошибок; prettier чисто.
