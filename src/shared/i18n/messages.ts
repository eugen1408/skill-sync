export type Locale = 'en' | 'ru'

/** Предпочтение языка: `system` — по локали ОС, иначе конкретный язык. */
export type LocalePref = 'system' | Locale

const en = {
  // Навигация
  'nav.catalog': 'Catalog',
  'nav.sources': 'Sources',
  'nav.notifications': 'Notifications',
  'nav.settings': 'Settings',

  // Общее
  'common.clear': 'Clear',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.remove': 'Remove',
  'common.error': 'Error',
  'common.dash': '—',

  // Баннер обновления приложения
  'app.updateBanner': 'App update {version} is ready to install',
  'app.updateManualBanner': 'App update {version} is available for download',
  'app.download': 'Download',
  'app.restart': 'Restart',
  'app.githubRateLimitBanner': 'GitHub API rate limit exceeded. Updates may be incomplete.',
  'app.configureToken': 'Set token',

  // Тосты / события
  'toast.copied': 'Copied',
  'toast.copyFailed': 'Failed to copy',
  'toast.deeplinkParseFailed': 'Failed to parse link: {url}',
  'toast.sourceAdded': 'Source {name} added',
  'toast.addFailed': 'Add failed: {error}',
  'toast.installed': 'Skill {name} installed: {version}',
  'toast.installedGeneric': 'Skill {name} installed',
  'toast.updated': 'Skill {name} updated: {version}',
  'toast.updatedGeneric': 'Skill {name} updated',
  'toast.updatesAvailable': '{count} update(s) available',

  // Диплинк
  'deeplink.confirmMessage': 'Add source and open catalog?',
  'deeplink.confirmDetail': 'Name: {name}\nURL: {url}\nMode: {mode}',
  'deeplink.confirmAdd': 'Add',

  // Каталог
  'catalog.searchPlaceholder': 'Search skills…',
  'catalog.refresh': 'Refresh',
  'catalog.refreshTitle': 'Reinitialize the list (as on startup)',
  'catalog.groupBySource': 'Group by sources',
  'catalog.installWordOne': 'install',
  'catalog.total': 'Total: {count}',
  'catalog.empty': 'Nothing found. Add your own skill sources or use search.',
  'catalog.filterStatus': 'Status',
  'catalog.filterSources': 'Sources',

  // Сортировка
  'sort.updateFirst': 'Updates first',
  'sort.popular': 'Popular (skills.sh)',
  'sort.nameAsc': 'Name A–Z',
  'sort.nameDesc': 'Name Z–A',

  // Статус-фильтры
  'statusFilter.installed': 'Installed',
  'statusFilter.not_installed': 'Not installed',
  'statusFilter.update_available': 'Update available',

  // Действия со skill
  'action.install': 'Install',
  'action.update': 'Update',
  'action.reinstall': 'Reinstall',
  'action.remove': 'Remove',
  'action.hide': 'Hide',
  'action.restoreHidden': 'Restore hidden',

  // Карточка skill
  'detail.source': 'Source',
  'detail.installs': 'Installs (skills.sh)',
  'detail.status': 'Status',
  'detail.installedVersion': 'Installed version',
  'detail.latestVersion': 'Latest version',
  'detail.checked': 'Checked',
  'detail.checkedOn': 'Checked: {date}',
  'detail.openOnSkillsSh': 'Open on skills.sh',
  'detail.openRepo': 'Open repository',
  'detail.openPageTitle': 'Open page on skills.sh',
  'detail.security': 'Security',
  'detail.fullResults': 'Full results on skills.sh',
  'detail.auditData': 'Audit data: skills.sh',
  'detail.readme': 'README.md / SKILL.md',
  'detail.showFull': 'Show full',
  'detail.collapse': 'Collapse',
  'detail.descriptionFrom': 'Description: skills.sh',
  'detail.installedForAgents': 'Installed for agents',
  'detail.primary': 'Primary',
  'detail.symlink': 'symlink',
  'detail.copyTitle': 'Copy: {value}',
  'detail.openInVscode': 'Open in VS Code',

  // Статус версии
  'updateStatus.up_to_date': 'Up to date',
  'updateStatus.update_available': 'Update available',
  'updateStatus.not_installed': 'Not installed',
  'updateStatus.unknown': 'Unknown',
  // Пояснения к статусу (tooltip)
  'statusHint.up_to_date': 'The latest available version is installed.',
  'statusHint.update_available': 'A newer version is available.',
  'statusHint.not_installed': 'The skill is not installed.',
  'statusHint.unknown.official': 'skills.sh does not report a version for this skill.',
  'statusHint.unknown.orphan':
    'Installed, but its source is unknown — the version cannot be determined.',
  'statusHint.unknown.notChecked': 'Updates have not been checked yet.',
  'statusHint.unknown.generic': 'This source cannot determine the latest version.',

  // Тип источника
  'sourceType.official': 'skills.sh',
  'sourceType.git': 'Git',
  'sourceType.local': 'Local',

  'source.indexingProgress': 'Indexing {name}…',
  'source.indexingNotFinished': 'Indexing not finished',
  'source.noGitUrl': 'Git repository URL is missing',
  'source.notGitUrl': 'URL does not look like a Git repository',
  'source.officialLive': 'Official catalog is live — no indexing required',
  'source.defaultLocalName': 'Local directory',
  'source.defaultGitName': 'Git repository',

  // Статус источника
  'sourceStatus.ok': 'Ready',
  'sourceStatus.indexing': 'Indexing',
  'sourceStatus.error': 'Error',
  'sourceStatus.disabled': 'Disabled',

  // Риск аудита
  'risk.safe': 'Safe',
  'risk.low': 'Low risk',
  'risk.medium': 'Medium risk',
  'risk.high': 'High risk',
  'risk.critical': 'Critical risk',
  'risk.unknown': 'No data',

  // Типы уведомлений
  'notifType.update_available': 'New version',
  'notifType.update_success': 'Updated',
  'notifType.install_error': 'Install error',
  'notifType.update_error': 'Update error',
  'notifType.source_unavailable': 'Source unavailable',

  // Источники
  'sources.empty': 'No sources connected. Add the first source on the right.',
  'sources.refresh': 'Refresh',
  'sources.enable': 'Enable',
  'sources.disable': 'Disable',
  'sources.remove': 'Remove',
  'sources.openRepo': 'Open repository',
  'sources.confirmRemove': 'Remove source {name}?',
  'sources.confirmRemoveDetail':
    'All installed skills from this source will remain, but will no longer receive updates.',
  'error.sourceRefresh': 'Failed to refresh source',
  'error.sourceToggle': 'Failed to change source',
  'error.sourceRemove': 'Failed to remove source',

  // Форма добавления источника
  'addSource.title': 'Add source',
  'addSource.git': 'Git',
  'addSource.local': 'Local',
  'addSource.gitPlaceholder': 'Paste a repository link (HTTPS, SSH or owner/repo)',
  'addSource.name': 'Name',
  'addSource.url': 'URL',
  'addSource.auth': 'Auth',
  'addSource.ref': 'ref',
  'addSource.subpath': 'subpath',
  'addSource.parseError': 'Could not recognize the repository link.',
  'addSource.noFolder': 'No folder selected',
  'addSource.browse': 'Browse…',
  'addSource.nameLabel': 'Name:',
  'addSource.adding': 'Adding…',
  'addSource.add': 'Add',
  'addSource.parseErrorThrow': 'Failed to parse repository link',
  'addSource.selectFolder': 'Select a folder',

  // Уведомления
  'notifications.title': 'Notifications',
  'notifications.markAllRead': 'Mark all read',
  'notifications.clear': 'Clear',
  'notifications.empty': 'No notifications.',

  // Панель событий
  'jobs.events': 'Events',
  'jobs.clearFinished': 'Clear finished',
  'jobs.clearAll': 'Clear all',
  'jobs.logs': 'Logs',
  'jobs.cancel': 'Cancel',
  'jobs.dismiss': 'Dismiss',
  'jobs.resizeLabel': 'Resize events panel',
  'jobs.kind.source.index': 'Indexing',
  'jobs.kind.source.refresh': 'Refreshing source',
  'jobs.kind.install': 'Install',
  'jobs.kind.install.uninstall': 'Remove',
  'jobs.kind.install.reconcileAgents': 'Agent reconciliation',
  'jobs.kind.update.check': 'Checking updates',
  'jobs.kind.update.run': 'Updating',
  'jobs.status.done': 'Done',
  'jobs.status.error': 'Error',
  'jobs.status.cancelled': 'Cancelled',
  'jobs.diagnostics': 'Diagnostics',
  'jobs.diag.skill': 'Skill',
  'jobs.diag.source': 'Source',
  'jobs.diag.command': 'Command',
  'jobs.diag.exitCode': 'Exit code',
  'jobs.diag.expectedPath': 'Expected path',
  'jobs.diag.stderr': 'Error output',
  'jobs.diag.suggestion': 'What to do',

  // Настройки
  'settings.appearance': 'Appearance',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'settings.language': 'Language',
  'lang.system': 'System',
  'lang.en': 'English',
  'lang.ru': 'Русский',
  'settings.targetAgents': 'Target agents',
  'settings.targetAgentsHint':
    'When the set changes, symlinks of installed skills are reconciled automatically.',
  'settings.uninstalledAgents': 'Not installed ({count})',
  'settings.universalAgentsTitle': 'Shared folder',
  'settings.universalAgentsHint': 'The following agents automatically read skills from the folder',
  'settings.installScope': 'Install scope',
  'scope.global': 'Global',
  'scope.project': 'Project',
  'settings.updates': 'Skill Updates',
  'settings.update.autoUpdate': 'Auto-update',
  'settings.autoUpdateHint': 'Auto-update can be enabled for individual sources.',
  'settings.autoUpdateLink': 'Manage in Sources',
  'settings.checkOnLaunch': 'Check on launch',
  'settings.checkSchedule': 'Check on schedule',
  'interval.hourly': 'Every hour',
  'interval.6h': 'Every 6 hours',
  'interval.daily': 'Once a day',
  'settings.customInterval': 'Custom interval, minutes',
  'settings.watchLocal': 'Watch local sources',
  'settings.checkNow': 'Check for updates now',
  'settings.cliNetwork': 'CLI and network',
  'settings.cliPathLabel': 'Path to the skills executable',
  'settings.cliPathHint':
    'Expects the path to the “skills” binary itself (e.g. /opt/homebrew/bin/skills), not to npx. Leave empty to auto-detect npx/skills in PATH.',
  'settings.cliPathPlaceholder': 'Path to skills executable (optional)',
  'settings.npmRegistryPlaceholder': 'NPM registry URL (e.g. https://registry.npmjs.org)',
  'settings.proxyPlaceholder': 'HTTP/HTTPS proxy URL (e.g. http://127.0.0.1:8080) (optional)',
  'settings.saved': 'Saved',
  'settings.githubToken': 'GitHub token',
  'settings.githubTokenHint':
    'For GitHub API limits (version checks) and private repositories. Stored in the system keychain (safeStorage), not in the config.',
  'settings.createGithubToken': 'Create new token',
  'settings.confirmDeleteToken': 'Remove GitHub Token?',
  'settings.confirmDeleteTokenDetail':
    'You will no longer be able to use the token for GitHub API requests.',
  'settings.secretsUnavailable':
    'Secure storage is unavailable — the token will not persist between launches.',
  'settings.tokenSet': 'Set',
  'settings.tokenNotSet': 'Not set',
  'settings.newToken': 'New token',
  'settings.appUpdate': 'App update',
  'settings.appUpdateStatus': 'Status: {state}',
  'appUpdateState.checking': 'Checking...',
  'appUpdateState.available': 'Update available',
  'appUpdateState.not-available': 'Up to date',
  'appUpdateState.downloading': 'Downloading...',
  'appUpdateState.downloaded': 'Ready to install',
  'appUpdateState.error': 'Error',
  'appUpdateState.manual-download': 'Manual download required',
  'settings.checkAppUpdate': 'Check for app updates',
  'settings.restartUpdate': 'Restart and update',
  'settings.reset': 'Reset app',
  'settings.resetHint':
    'Deletes all persistent app data (config, secrets, source cache). Currently installed skills are not affected.',
  'settings.resetButton': 'Reset app settings and cache',
  'error.checkStart': 'Failed to start check',
  'error.saveToken': 'Failed to save token',
  'error.saveSettings': 'Failed to save settings',
  'error.deleteToken': 'Failed to delete token',

  // Реконсиляция агентов
  'reconcile.confirmMessage': 'Changing the agent set affects {count} installed skills.',
  'reconcile.confirmDetail': 'Will: {parts}.',
  'reconcile.createLinks': 'create {n} symlink(s)',
  'reconcile.removeLinks': 'remove {n} symlink(s)',
  'reconcile.apply': 'Apply',
  'reconcile.opsHeader': 'Operations:',
  'reconcile.opLink': '+ {skill} → {path}',
  'reconcile.opUnlink': '− {skill} (remove link {path})',
  'reconcile.andMore': '…and {n} more',
  'error.applyAgents': 'Failed to apply the agent set',

  // Сброс приложения
  'reset.confirmMessage': 'Reset all app settings and cache?',
  'reset.confirmDetail':
    'All persistent data (sources, config, tokens) will be deleted. Currently installed skills are not affected. The app will restart.',
  'reset.confirmButton': 'Reset',

  // Установка / удаление
  'install.auditWarning': '“{name}”: security warnings ({risk}).',
  'install.auditDetail': '{detail}\n\nInstall anyway?',
  'install.installConfirm': 'Install',
  'install.structureWarning': '“{name}”: this will change the file structure.',
  'install.structureCanonical': 'Main copy will live at:\n{path}',
  'install.structureReplaceHeader':
    'These real folders will be replaced by symlinks to the main copy:',
  'install.structureReplaceLine': '• {path}',
  'install.structureConfirm': 'Continue',
  'install.willInstallFor': 'Will install for: {agents}',
  'install.changeAgents': 'change',
  'error.installStart': 'Failed to start installation',
  'uninstall.confirmMessage': 'Remove “{name}”?',
  'uninstall.confirmDetailAgents': 'The skill will be removed from agents: {agents}.',
  'uninstall.confirmDetailAll': 'The skill will be removed from all directories.',
  'uninstall.confirmButton': 'Remove',
  'error.uninstallStart': 'Failed to start removal',
  'error.updateStart': 'Failed to start update',

  // Меню трея (main-процесс)
  'tray.open': 'Open Skill Sync',
  'tray.checkUpdates': 'Check for updates',
  'tray.updates': 'Updates',
  'tray.noUpdates': 'No updates',
  'tray.updateAll': 'Update all',
  'tray.more': 'And {n} more… (open app)',
  'tray.quit': 'Quit',
  'tray.tooltip': 'Skill Sync',
  'tray.tooltipCount': 'Skill Sync ({count} {word})',
  'tray.updWordOne': 'update',
  'tray.updWordFew': 'updates',
  'tray.updWordMany': 'updates',

  // Навигация — помощь
  'nav.help': 'Help',

  // Глоссарий/подсказки (контекстные «?» и раздел Help)
  'help.term.source.title': 'Source',
  'help.term.source.body':
    'Where skills come from: a local folder, a Git repository, or skills.sh. A source is not the same as an installed skill — it just lists what is available to install.',
  'help.term.installed.title': 'Installed skill',
  'help.term.installed.body':
    'A skill that has been placed on disk for your agents. The catalog shows both available (from sources) and installed skills.',
  'help.term.canonical.title': 'Main copy',
  'help.term.canonical.body':
    'The real skill files live once in ~/.agents/skills/<name>. This is the single source of truth.',
  'help.term.symlink.title': 'Symlink',
  'help.term.symlink.body':
    'A link, not a copy. Each agent folder (e.g. ~/.claude/skills, ~/.codex/skills) contains a link pointing to the main copy — that is why one install can touch several folders.',
  'help.term.agent.title': 'Target agent',
  'help.term.agent.body':
    'Which tools (Claude Code, Codex, Cursor…) a skill is installed for. Installing creates a link in each selected agent’s folder.',
  'help.tip.catalog.title': 'Catalog',
  'help.tip.catalog.body':
    'All skills from your sources plus skills.sh. Statuses show whether a skill is installed, has an update, or is not installed yet.',
  'help.tip.installedForAgents.title': 'Installed for agents',
  'help.tip.installedForAgents.body':
    'The main copy lives in ~/.agents/skills. Each agent gets a symlink to it — so editing the skill in one place affects every agent.',

  // Онбординг первого запуска
  'onboarding.title': 'Getting started with Skill Sync',
  'onboarding.intro': 'A quick tour of how skills, sources and agents fit together.',
  'onboarding.step.source.title': '1. Add a source',
  'onboarding.step.source.body':
    'Connect a local folder, a Git repo, or use skills.sh — this is where skills come from.',
  'onboarding.step.catalog.title': '2. Browse the catalog',
  'onboarding.step.catalog.body':
    'See available and installed skills, search, and open a skill for details.',
  'onboarding.step.install.title': '3. Install a skill',
  'onboarding.step.install.body':
    'Before installing you’ll see which agents it targets and any file changes.',
  'onboarding.step.agents.title': '4. Pick target agents',
  'onboarding.step.agents.body':
    'In Settings, choose which agents (Claude Code, Codex…) receive skills.',
  'onboarding.fileModel.title': 'Where files live',
  'onboarding.fileModel.body':
    'Source (folder / Git / skills.sh)\n   ↓ install\n~/.agents/skills/<name>   ← the real files (main copy)\n   ↓ symlinks\n~/.claude/skills/<name>, ~/.codex/skills/<name>   ← links for each agent',
  'onboarding.openGuide': 'Open full guide',
  'onboarding.dismiss': 'Got it',

  // Раздел Help
  'help.title': 'Help',
  'help.gettingStartedTitle': 'Getting started',
  'help.glossaryTitle': 'Glossary',
  'help.fileModelTitle': 'Where files live',

  // Карточка: оригинал vs симлинк
  'detail.original': 'original',
  'detail.linkBadge': 'symlink',

  // Пустые состояния (действия)
  'sources.emptyHint':
    'Sources are where skills come from — a local folder, a Git repo, or skills.sh. Add your first source using the form.',
  'catalog.emptyHint': 'The catalog fills up once you connect a source.',
  'catalog.goToSources': 'Add a source',

  // Проверка CLI
  'settings.cliCheck': 'Test',
  'settings.cliChecking': 'Checking…',
  'settings.cliOk': 'Works: {version}',
  'settings.cliFailed': 'Not working',
  'error.cliCheck': 'Failed to check the CLI'
}

const ru: Record<keyof typeof en, string> = {
  'nav.catalog': 'Каталог',
  'nav.sources': 'Источники',
  'nav.notifications': 'Уведомления',
  'nav.settings': 'Настройки',

  'common.clear': 'Очистить',
  'common.close': 'Закрыть',
  'common.save': 'Сохранить',
  'common.remove': 'Удалить',
  'common.error': 'Ошибка',
  'common.dash': '—',

  'app.updateBanner': 'Обновление {version} готово к установке',
  'app.updateManualBanner': 'Доступно обновление {version}',
  'app.download': 'Скачать',
  'app.restart': 'Перезапустить',
  'app.githubRateLimitBanner': 'Исчерпан лимит GitHub API. Проверка обновлений ограничена.',
  'app.configureToken': 'Указать токен',

  'toast.copied': 'Скопировано',
  'toast.copyFailed': 'Не удалось скопировать',
  'toast.deeplinkParseFailed': 'Не удалось разобрать ссылку: {url}',
  'toast.sourceAdded': 'Источник {name} добавлен',
  'toast.addFailed': 'Ошибка добавления: {error}',
  'toast.installed': 'Skill {name} установлен: {version}',
  'toast.installedGeneric': 'Skill {name} установлен',
  'toast.updated': 'Skill {name} обновлен: {version}',
  'toast.updatedGeneric': 'Skill {name} обновлен',
  'toast.updatesAvailable': 'Доступно обновлений: {count}',

  'deeplink.confirmMessage': 'Добавить источник и открыть каталог?',
  'deeplink.confirmDetail': 'Название: {name}\nURL: {url}\nРежим: {mode}',
  'deeplink.confirmAdd': 'Добавить',

  'catalog.searchPlaceholder': 'Поиск skills…',
  'catalog.refresh': 'Обновить',
  'catalog.refreshTitle': 'Переинициализировать список (как при запуске)',
  'catalog.groupBySource': 'Группировать по источникам',
  'catalog.installWordOne': 'установка',
  'catalog.total': 'Всего: {count}',
  'catalog.empty': 'Ничего не найдено. Добавьте свои источники скилов или воспользуйтесь поиском.',
  'catalog.filterStatus': 'Статус',
  'catalog.filterSources': 'Источники',

  'sort.updateFirst': 'Сначала обновления',
  'sort.popular': 'Популярные (skills.sh)',
  'sort.nameAsc': 'Имя А–Я',
  'sort.nameDesc': 'Имя Я–А',

  'statusFilter.installed': 'Установлены',
  'statusFilter.not_installed': 'Не установлены',
  'statusFilter.update_available': 'Есть обновление',

  'action.install': 'Установить',
  'action.update': 'Обновить',
  'action.reinstall': 'Переустановить',
  'action.remove': 'Удалить',
  'action.hide': 'Скрыть',
  'action.restoreHidden': 'Восстановить скрытые',

  'detail.source': 'Источник',
  'detail.installs': 'Установок (skills.sh)',
  'detail.status': 'Статус',
  'detail.installedVersion': 'Установленная версия',
  'detail.latestVersion': 'Последняя версия',
  'detail.checked': 'Обновление проверено',
  'detail.checkedOn': 'Обновление проверено: {date}',
  'detail.openOnSkillsSh': 'Открыть на skills.sh',
  'detail.openRepo': 'Открыть репозиторий',
  'detail.openPageTitle': 'Открыть страницу на skills.sh',
  'detail.security': 'Безопасность',
  'detail.fullResults': 'Полные результаты на skills.sh',
  'detail.auditData': 'Данные аудита: skills.sh',
  'detail.readme': 'README.md / SKILL.md',
  'detail.showFull': 'Показать полностью',
  'detail.collapse': 'Свернуть',
  'detail.descriptionFrom': 'Описание: skills.sh',
  'detail.installedForAgents': 'Установлен для агентов',
  'detail.primary': 'Основные',
  'detail.symlink': 'symlink',
  'detail.copyTitle': 'Скопировать: {value}',
  'detail.openInVscode': 'Открыть в VS Code',

  'updateStatus.up_to_date': 'Актуально',
  'updateStatus.update_available': 'Есть обновление',
  'updateStatus.not_installed': 'Не установлен',
  'updateStatus.unknown': 'Неизвестно',
  'statusHint.up_to_date': 'Установлена последняя доступная версия.',
  'statusHint.update_available': 'Доступна новая версия.',
  'statusHint.not_installed': 'Skill не установлен.',
  'statusHint.unknown.official': 'skills.sh не сообщает версию для этого skill.',
  'statusHint.unknown.orphan': 'Установлен, но источник неизвестен — версию определить нельзя.',
  'statusHint.unknown.notChecked': 'Проверка обновлений ещё не выполнялась.',
  'statusHint.unknown.generic': 'Этот источник не умеет определять последнюю версию.',

  'sourceType.official': 'skills.sh',
  'sourceType.git': 'Git',
  'sourceType.local': 'Локальный',

  'source.indexingProgress': 'Индексация {name}…',
  'source.indexingNotFinished': 'Индексация не завершена',
  'source.noGitUrl': 'Не задан URL Git-репозитория',
  'source.notGitUrl': 'URL не похож на Git-репозиторий',
  'source.officialLive': 'Официальный каталог живой — индексация отсутствует.',
  'source.defaultLocalName': 'Локальный каталог',
  'source.defaultGitName': 'Git-репозиторий',

  'sourceStatus.ok': 'Готов',
  'sourceStatus.indexing': 'Индексация',
  'sourceStatus.error': 'Ошибка',
  'sourceStatus.disabled': 'Отключён',

  'risk.safe': 'Безопасно',
  'risk.low': 'Низкий риск',
  'risk.medium': 'Средний риск',
  'risk.high': 'Высокий риск',
  'risk.critical': 'Критический риск',
  'risk.unknown': 'Нет данных',

  'notifType.update_available': 'Новая версия',
  'notifType.update_success': 'Обновлено',
  'notifType.install_error': 'Ошибка установки',
  'notifType.update_error': 'Ошибка обновления',
  'notifType.source_unavailable': 'Источник недоступен',

  'sources.empty': 'Источники не подключены. Добавьте первый источник справа.',
  'sources.refresh': 'Обновить',
  'sources.enable': 'Включить',
  'sources.disable': 'Отключить',
  'sources.remove': 'Удалить',
  'sources.openRepo': 'Открыть репозиторий',
  'sources.confirmRemove': 'Удалить источник {name}?',
  'sources.confirmRemoveDetail':
    'Установленные из него скилы останутся, но перестанут обновляться.',
  'error.sourceRefresh': 'Ошибка обновления источника',
  'error.sourceToggle': 'Не удалось изменить источник',
  'error.sourceRemove': 'Не удалось удалить источник',

  'addSource.title': 'Добавить источник',
  'addSource.git': 'Git',
  'addSource.local': 'Локальный',
  'addSource.gitPlaceholder': 'Вставьте ссылку на репозиторий (HTTPS, SSH или owner/repo)',
  'addSource.name': 'Название',
  'addSource.url': 'URL',
  'addSource.auth': 'Авторизация',
  'addSource.ref': 'ref',
  'addSource.subpath': 'subpath',
  'addSource.parseError': 'Не удалось распознать ссылку на репозиторий.',
  'addSource.noFolder': 'Каталог не выбран',
  'addSource.browse': 'Обзор…',
  'addSource.nameLabel': 'Название:',
  'addSource.adding': 'Добавление…',
  'addSource.add': 'Добавить',
  'addSource.parseErrorThrow': 'Не удалось разобрать ссылку на репозиторий',
  'addSource.selectFolder': 'Выберите каталог',

  'notifications.title': 'Уведомления',
  'notifications.markAllRead': 'Прочитать все',
  'notifications.clear': 'Очистить',
  'notifications.empty': 'Уведомлений нет.',

  'jobs.events': 'События',
  'jobs.clearFinished': 'Очистить завершённые',
  'jobs.clearAll': 'Очистить все',
  'jobs.logs': 'Логи',
  'jobs.cancel': 'Отмена',
  'jobs.dismiss': 'Убрать',
  'jobs.resizeLabel': 'Изменить высоту панели событий',
  'jobs.kind.source.index': 'Индексация',
  'jobs.kind.source.refresh': 'Обновление источника',
  'jobs.kind.install': 'Установка',
  'jobs.kind.install.uninstall': 'Удаление',
  'jobs.kind.install.reconcileAgents': 'Реконсиляция агентов',
  'jobs.kind.update.check': 'Проверка обновлений',
  'jobs.kind.update.run': 'Обновление',
  'jobs.status.done': 'Готово',
  'jobs.status.error': 'Ошибка',
  'jobs.status.cancelled': 'Отменено',
  'jobs.diagnostics': 'Диагностика',
  'jobs.diag.skill': 'Skill',
  'jobs.diag.source': 'Источник',
  'jobs.diag.command': 'Команда',
  'jobs.diag.exitCode': 'Код выхода',
  'jobs.diag.expectedPath': 'Ожидаемый путь',
  'jobs.diag.stderr': 'Вывод ошибки',
  'jobs.diag.suggestion': 'Что делать',

  'settings.appearance': 'Оформление',
  'theme.system': 'Как в системе',
  'theme.light': 'Светлая',
  'theme.dark': 'Тёмная',
  'settings.language': 'Язык',
  'lang.system': 'Как в системе',
  'lang.en': 'English',
  'lang.ru': 'Русский',
  'settings.targetAgents': 'Целевые агенты',
  'settings.targetAgentsHint':
    'При изменении набора симлинки установленных skills автоматически приводятся в соответствие.',
  'settings.uninstalledAgents': 'Не установленные ({count})',
  'settings.universalAgentsTitle': 'Общая папка',
  'settings.universalAgentsHint':
    'Следующие агенты по умолчанию автоматически читают скилы из папки',
  'settings.installScope': 'Область установки',
  'scope.global': 'Глобально',
  'scope.project': 'Проект',
  'settings.updates': 'Обновления скилов',
  'settings.update.autoUpdate': 'Автообновление',
  'settings.autoUpdateHint': 'Автообновление можно включить для отдельных источников.',
  'settings.autoUpdateLink': 'Настроить в Источниках',
  'settings.checkOnLaunch': 'Проверять при запуске',
  'settings.checkSchedule': 'Проверять по расписанию',
  'interval.hourly': 'Каждый час',
  'interval.6h': 'Каждые 6 часов',
  'interval.daily': 'Раз в день',
  'settings.customInterval': 'Свой интервал, минут',
  'settings.watchLocal': 'Следить за локальными источниками',
  'settings.checkNow': 'Проверить обновления сейчас',
  'settings.cliNetwork': 'CLI и сеть',
  'settings.cliPathLabel': 'Путь к исполняемому файлу skills',
  'settings.cliPathHint':
    'Ожидается путь к самому бинарю «skills» (напр. /opt/homebrew/bin/skills), а не к npx. Оставьте пустым — npx/skills будут найдены в PATH автоматически.',
  'settings.cliPathPlaceholder': 'Путь к исполняемому файлу skills (опционально)',
  'settings.npmRegistryPlaceholder': 'NPM registry URL (напр. https://registry.npmjs.org)',
  'settings.proxyPlaceholder': 'HTTP/HTTPS прокси (напр. http://127.0.0.1:8080) (необязательно)',
  'settings.saved': 'Сохранено',
  'settings.githubToken': 'GitHub-токен',
  'settings.githubTokenHint':
    'Для лимитов GitHub API (проверка версий) и приватных репозиториев. Хранится в системном хранилище (safeStorage), не в конфигурации.',
  'settings.createGithubToken': 'Создать новый токен',
  'settings.confirmDeleteToken': 'Удалить GitHub-токен?',
  'settings.confirmDeleteTokenDetail':
    'Приложение больше не сможет использовать его для запросов к GitHub API.',
  'settings.secretsUnavailable':
    'Защищённое хранилище недоступно — токен не будет сохранён между запусками.',
  'settings.tokenSet': 'Задан',
  'settings.tokenNotSet': 'Не задан',
  'settings.newToken': 'Новый токен',
  'settings.appUpdate': 'Обновление приложения',
  'settings.appUpdateStatus': 'Статус: {state}',
  'appUpdateState.checking': 'Проверка...',
  'appUpdateState.available': 'Доступно обновление',
  'appUpdateState.not-available': 'Нет обновлений',
  'appUpdateState.downloading': 'Загрузка...',
  'appUpdateState.downloaded': 'Готово к установке',
  'appUpdateState.error': 'Ошибка',
  'appUpdateState.manual-download': 'Скачайте обновление вручную',
  'settings.checkAppUpdate': 'Проверить обновления приложения',
  'settings.restartUpdate': 'Перезапустить и обновить',
  'settings.reset': 'Сброс приложения',
  'settings.resetHint':
    'Удаляет всю персистентную информацию приложения (конфигурацию, секреты, кэш источников). Текущие установленные skills не будут затронуты.',
  'settings.resetButton': 'Сбросить настройки и кэш приложения',
  'error.checkStart': 'Не удалось запустить проверку',
  'error.saveToken': 'Не удалось сохранить токен',
  'error.saveSettings': 'Не удалось сохранить настройки',
  'error.deleteToken': 'Не удалось удалить токен',

  'reconcile.confirmMessage': 'Изменение набора агентов затронет {count} установленных skills.',
  'reconcile.confirmDetail': 'Будет: {parts}.',
  'reconcile.createLinks': 'создать {n} симлинк(ов)',
  'reconcile.removeLinks': 'удалить {n} симлинк(ов)',
  'reconcile.apply': 'Применить',
  'reconcile.opsHeader': 'Операции:',
  'reconcile.opLink': '+ {skill} → {path}',
  'reconcile.opUnlink': '− {skill} (снять ссылку {path})',
  'reconcile.andMore': '…и ещё {n}',
  'error.applyAgents': 'Не удалось применить набор агентов',

  'reset.confirmMessage': 'Сбросить все настройки и кэш приложения?',
  'reset.confirmDetail':
    'Будет удалена вся персистентная информация (источники, конфигурация, токены). Текущие установленные skills затронуты не будут. Приложение перезапустится.',
  'reset.confirmButton': 'Сбросить',

  'install.auditWarning': '«{name}»: предупреждения безопасности ({risk}).',
  'install.auditDetail': '{detail}\n\nВсё равно установить?',
  'install.installConfirm': 'Установить',
  'install.structureWarning': '«{name}»: изменится структура файлов.',
  'install.structureCanonical': 'Основная копия будет здесь:\n{path}',
  'install.structureReplaceHeader':
    'Эти реальные папки будут заменены симлинками на основную копию:',
  'install.structureReplaceLine': '• {path}',
  'install.structureConfirm': 'Продолжить',
  'install.willInstallFor': 'Будет установлено для: {agents}',
  'install.changeAgents': 'изменить',
  'error.installStart': 'Не удалось запустить установку',
  'uninstall.confirmMessage': 'Удалить «{name}»?',
  'uninstall.confirmDetailAgents': 'Skill будет удалён у агентов: {agents}.',
  'uninstall.confirmDetailAll': 'Skill будет удалён из всех каталогов.',
  'uninstall.confirmButton': 'Удалить',
  'error.uninstallStart': 'Не удалось запустить удаление',
  'error.updateStart': 'Не удалось запустить обновление',

  'tray.open': 'Открыть Skill Sync',
  'tray.checkUpdates': 'Проверить обновления',
  'tray.updates': 'Обновления',
  'tray.noUpdates': 'Нет обновлений',
  'tray.updateAll': 'Обновить все',
  'tray.more': 'И ещё {n}… (открыть приложение)',
  'tray.quit': 'Выход',
  'tray.tooltip': 'Skill Sync',
  'tray.tooltipCount': 'Skill Sync ({count} {word})',
  'tray.updWordOne': 'обновление',
  'tray.updWordFew': 'обновления',
  'tray.updWordMany': 'обновлений',

  // Навигация — помощь
  'nav.help': 'Помощь',

  // Глоссарий/подсказки
  'help.term.source.title': 'Источник',
  'help.term.source.body':
    'Откуда берутся skills: локальная папка, Git-репозиторий или skills.sh. Источник — это не то же самое, что установленный skill: он лишь показывает, что доступно для установки.',
  'help.term.installed.title': 'Установленный skill',
  'help.term.installed.body':
    'Skill, размещённый на диске для ваших агентов. В каталоге видны и доступные (из источников), и установленные skills.',
  'help.term.canonical.title': 'Основная копия',
  'help.term.canonical.body':
    'Реальные файлы skill лежат один раз в ~/.agents/skills/<имя>. Это единый источник истины.',
  'help.term.symlink.title': 'Симлинк',
  'help.term.symlink.body':
    'Ссылка вместо копии. В каталоге каждого агента (напр. ~/.claude/skills, ~/.codex/skills) лежит ссылка на основную копию — поэтому одна установка затрагивает несколько папок.',
  'help.term.agent.title': 'Целевой агент',
  'help.term.agent.body':
    'Для каких инструментов (Claude Code, Codex, Cursor…) устанавливается skill. При установке в папке каждого выбранного агента создаётся ссылка.',
  'help.tip.catalog.title': 'Каталог',
  'help.tip.catalog.body':
    'Все skills из ваших источников плюс skills.sh. Статусы показывают, установлен ли skill, есть ли обновление или он ещё не установлен.',
  'help.tip.installedForAgents.title': 'Установлен для агентов',
  'help.tip.installedForAgents.body':
    'Основная копия лежит в ~/.agents/skills. Каждому агенту создаётся симлинк на неё — поэтому правка skill в одном месте действует для всех агентов.',

  // Онбординг первого запуска
  'onboarding.title': 'Знакомство со Skill Sync',
  'onboarding.intro': 'Короткий обзор: как связаны skills, источники и агенты.',
  'onboarding.step.source.title': '1. Добавьте источник',
  'onboarding.step.source.body':
    'Подключите локальную папку, Git-репозиторий или используйте skills.sh — отсюда берутся skills.',
  'onboarding.step.catalog.title': '2. Откройте каталог',
  'onboarding.step.catalog.body':
    'Смотрите доступные и установленные skills, ищите и открывайте карточку skill.',
  'onboarding.step.install.title': '3. Установите skill',
  'onboarding.step.install.body':
    'Перед установкой вы увидите, для каких агентов он ставится и какие изменения в файлах произойдут.',
  'onboarding.step.agents.title': '4. Выберите целевых агентов',
  'onboarding.step.agents.body':
    'В Настройках выберите, каким агентам (Claude Code, Codex…) достаются skills.',
  'onboarding.fileModel.title': 'Где лежат файлы',
  'onboarding.fileModel.body':
    'Источник (папка / Git / skills.sh)\n   ↓ установка\n~/.agents/skills/<имя>   ← реальные файлы (основная копия)\n   ↓ симлинки\n~/.claude/skills/<имя>, ~/.codex/skills/<имя>   ← ссылки для каждого агента',
  'onboarding.openGuide': 'Открыть полный гайд',
  'onboarding.dismiss': 'Понятно',

  // Раздел Help
  'help.title': 'Помощь',
  'help.gettingStartedTitle': 'С чего начать',
  'help.glossaryTitle': 'Глоссарий',
  'help.fileModelTitle': 'Где лежат файлы',

  // Карточка: оригинал vs ссылка
  'detail.original': 'оригинал',
  'detail.linkBadge': 'симлинк',

  // Пустые состояния (действия)
  'sources.emptyHint':
    'Источники — это откуда берутся skills: локальная папка, Git-репозиторий или skills.sh. Добавьте первый источник через форму.',
  'catalog.emptyHint': 'Каталог заполнится, как только вы подключите источник.',
  'catalog.goToSources': 'Добавить источник',

  // Проверка CLI
  'settings.cliCheck': 'Проверить',
  'settings.cliChecking': 'Проверка…',
  'settings.cliOk': 'Работает: {version}',
  'settings.cliFailed': 'Не работает',
  'error.cliCheck': 'Не удалось проверить CLI'
}

export type MessageKey = keyof typeof en

export const messages: Record<Locale, Record<MessageKey, string>> = { en, ru }
