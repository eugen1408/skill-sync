# [SM-1] Часть 3 — Version Resolver

- **Статус:** Реализовано
- **Эпик:** [../00-epic.md](00-epic.md)
- **Ответственный:** @evaganov
- **Создано:** 2026-07-01
- **Сложность:** Сложная

## Обзор

Version Resolver — самостоятельный компонент определения текущей (установленной) и последней доступной версии skill. Работает через набор расширяемых стратегий с приоритетом; добавление новой стратегии не должно менять остальную логику. На MVP поддерживаются 4 стратегии: `skillFolderHash` из `.skill-lock.json`, Git tags, Git commit SHA, `CHANGELOG.md`.

## Пользовательская история

Как система, я хочу единообразно определять «есть ли обновление» для любого skill из любого источника, чтобы Update Engine и каталог показывали корректный статус независимо от механизма версионирования источника.

## Критерии приемки

- [x] КП1: Определён интерфейс стратегии `VersionStrategy` и реестр стратегий с приоритетом.
- [x] КП2: Resolver возвращает для skill: установленную версию, последнюю доступную версию, признак наличия обновления, использованную стратегию.
- [x] КП3: Реализована стратегия `SkillFolderHashStrategy` — сравнение `skillFolderHash` из `.skill-lock.json` (GitHub tree SHA) с актуальным хэшем папки skill в источнике.
- [x] КП4: Реализована стратегия `GitTagStrategy` — версия по последнему семантическому тегу репозитория.
- [x] КП5: Реализована стратегия `GitCommitShaStrategy` — версия по SHA коммита, затрагивающего папку skill.
- [x] КП6: Реализована стратегия `ChangelogStrategy` — версия по верхней записи `CHANGELOG.md`.
- [x] КП7: Приоритет стратегий конфигурируем и расширяем; новая стратегия добавляется регистрацией без изменения потребителей.
- [x] КП8: При невозможности определить версию всеми применимыми стратегиями возвращается «версия неизвестна» без падения (`VERSION_RESOLVE_FAILED` только при явной ошибке доступа).

## Поведение

### Затрагиваемые компоненты / модули

- **`src/main/version/VersionResolver`** — фасад: принимает контекст skill, перебирает применимые стратегии по приоритету, возвращает `VersionInfo`.
- **`src/main/version/strategies`** — `SkillFolderHashStrategy`, `GitTagStrategy`, `GitCommitShaStrategy`, `ChangelogStrategy`; общий интерфейс `VersionStrategy`.
- **`src/main/version/registry`** — реестр стратегий с приоритетом (по умолчанию: hash → tag → sha → changelog).

### `VersionStrategy` (контракт)

- `id` — идентификатор стратегии.
- `isApplicable(context)` — применима ли к данному skill/источнику (например, `SkillFolderHashStrategy` применима, если есть `.skill-lock.json` с записью; `GitTagStrategy` — если источник Git с тегами).
- `resolveInstalled(context)` — определить установленную версию (может быть null).
- `resolveLatest(context)` — определить последнюю доступную версию.
- `compare(installed, latest)` — есть ли обновление.

Resolver перебирает стратегии по приоритету, использует первую применимую, вернувшую валидный результат для `resolveLatest`. `installed` и `latest` могут определяться разными стратегиями с приведением к общему сравнимому виду через `compare`.

### Логика стратегий (текстом, без кода)

- **SkillFolderHash:** установленная версия — `skillFolderHash` из `.skill-lock.json` (`~/.agents/.skill-lock.json` глобально или `skills-lock.json` в проекте); последняя — GitHub tree SHA папки skill через `GET /repos/{owner}/{repo}/git/trees/{ref}?recursive=1` и извлечение SHA поддерева по `skillPath`. Обновление есть, если хэши различаются. Для локальных источников установленная версия — вычисляемый SHA-256 содержимого папки (аналог `computedHash` CLI).
- **GitTag:** последняя версия — максимальный semver-тег; установленная — тег/ref, зафиксированный при установке.
- **GitCommitSha:** версия — SHA последнего коммита, затрагивающего путь skill (`git log -1 -- <path>`); обновление — если SHA изменился.
- **Changelog:** версия — верхняя (первая) версия из `CHANGELOG.md`; сравнение semver.

## Требования к данным и API

### `VersionInfo` (результат Resolver)

```json
{
  "installedVersion": "string | null",
  "latestVersion": "string | null",
  "hasUpdate": "boolean",
  "resolvedBy": "string (id стратегии, определившей latest) | null",
  "unknown": "boolean (true, если ни одна стратегия не смогла определить)"
}
```

### `ResolveContext` (вход Resolver)

```json
{
  "skillId": "string",
  "sourceType": "string (official | git | local)",
  "installPath": "string | null",
  "lockEntry": "object | null (запись из .skill-lock.json/skills-lock.json)",
  "repo": { "url": "string | null", "ref": "string | null", "skillPath": "string | null" },
  "localPath": "string | null"
}
```

### `.skill-lock.json` / `skills-lock.json` — читаемые поля

- Глобальный `~/.agents/.skill-lock.json`: `skills[name] = { source, sourceType, sourceUrl, ref?, skillPath?, skillFolderHash, installedAt, updatedAt }`.
- Локальный `skills-lock.json`: `skills[name] = { source, sourceType, ref?, skillPath?, computedHash }`.
- GitHub tree API для latest hash — та же логика, что в CLI (`getSkillFolderHashFromTree`: удалить суффикс `/SKILL.md`, найти запись `type === 'tree' && path === folderPath`, вернуть её `sha`).

## Пограничные случаи и обработка ошибок

- **Нет `.skill-lock.json`:** стратегия неприменима — переход к следующей.
- **Rate limit GitHub API (403, x-ratelimit-remaining: 0):** ленивое получение токена (эпик Q-04); при отсутствии токена — пометить latest как «неизвестно», не падать.
- **Репозиторий без тегов / без CHANGELOG:** соответствующие стратегии неприменимы.
- **Локальный источник:** hash-стратегия работает по `computedHash`; tag/changelog применимы, если это git-каталог/есть CHANGELOG.
- **Несравнимые версии** (hash vs semver): `hasUpdate` определяется в рамках одной стратегии; смешение не допускается — `compare` работает внутри стратегии, определившей и installed, и latest.

## Зависимости и риски

- Блокирует: Часть 4 (каталог показывает версии), Часть 6 (Update Engine).
- Заблокировано: Часть 1 (Foundation). Может реализовываться параллельно с Частью 2.
- Риски: лимиты GitHub API; неоднородность схем версионирования между источниками.

## Заметки по тестированию

- Unit (node) на каждую стратегию: fixtures с `.skill-lock.json`, git-fixture с тегами/коммитами, `CHANGELOG.md` разных форматов.
- Проверить порядок приоритета и переключение на следующую стратегию при неприменимости.
- Проверить добавление фиктивной стратегии без изменения Resolver/потребителей (расширяемость).
- Мок GitHub trees API; сценарий rate-limit → «неизвестно».

## Открытые вопросы

## Q3-01: Формат сравнения при смешанных стратегиях для installed/latest
**Приоритет:** Среднее
**Вопрос:** Разрешать ли определять installed одной стратегией, а latest другой (например, installed — hash из lock, latest — git tag)?
**Допущение:** Нет. Для консистентности сравнения installed и latest определяются одной стратегией; кросс-стратегийное сравнение запрещено (см. пограничные случаи).
**Статус:** Открыт
**Ответ:**

## Заметки по реализации

**Расположение:** `src/main/version/` — чистый main-компонент, IPC/preload/renderer не трогает (потребляется Частями 4 и 6 через `createDefaultVersionResolver()`).

**Структура:** `types.ts` (`VersionStrategy`, `ResolveContext`, `VersionPorts`, `LockEntry`), `registry.ts` (`StrategyRegistry` с числовым приоритетом), `VersionResolver.ts` (фасад), `strategies/` (4 стратегии), `semver.ts`, `parseRepo.ts`, `lock.ts` (чтение `.skill-lock.json`/`skills-lock.json`), `ports.ts` (реальные реализации), `index.ts` (фабрика + экспорты).

**Ключевые решения:**
- **Инъекция зависимостей через `VersionPorts`** (github/git/files) — стратегии тестируются с фейками без сети и git. Реальные порты: GitHub trees API (`fetch`, токен из `GITHUB_TOKEN`/`GH_TOKEN`, 403/лимит → `null` без падения), git `ls-remote`/`log` через `execFile`, `computeFolderHash` (SHA-256 по отсортированным файлам, скип `.git`/`node_modules`), `readChangelogTopVersion` (regex верхней версии).
- **Приоритет по умолчанию:** skillFolderHash(10) → gitTag(20) → gitCommitSha(30) → changelog(40). Расширяемость подтверждена тестом (кастомная стратегия с приоритетом 1 побеждает).
- **Q3-01:** installed и latest определяются одной стратегией — фасад берёт первую применимую с ненулевым latest и у неё же спрашивает installed; `compare` работает внутри стратегии.
- **SHA-сравнение** в `GitCommitShaStrategy` — по общему префиксу (7 vs 40 hex).
- `ResolveContext.repo.localDir` (опционально) — использует локальный клон (Часть 2) для path-scoped `git log` и чтения CHANGELOG источника; иначе gitCommitSha падает на `ls-remote HEAD`.

**Верификация:** typecheck (node) — 0 ошибок; тесты — 8 новых (semver, parseRepo, SkillFolderHash, GitTag, приоритет/switch, unknown, расширяемость), суммарно 17/17 pass; prettier — чисто.
