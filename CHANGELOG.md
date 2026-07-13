# Changelog

## v0.8.0

- **Updates**: Update check now waits for `git fetch` to finish for each repository and handles network/access errors correctly (skips the check if the source is unavailable).
- **Jobs**: Removed the 5-item limit for completed tasks in the Jobs panel. All results are now displayed until manually cleared.

## v0.7.0

- **Git Cache**: Resolved `.git/index.lock` blocking issues when updating multiple skills from the same repository by queuing operations by source ID.
- **Versioning**: Improved version resolution strategy and cache handling without redundant network requests.
- **UI**: Added detailed information in the skill card and fixed status displays.

## v0.6.1

- **UI/UX**: Minor interface fixes in the Add Source form and the registry.

## v0.6.0

- **Interface**: Added Onboarding screen and Help section.
- **CLI**: Implemented checking for the `skills` console utility version and installation paths.
- **Localization**: Expanded translations (messages.ts) and fixed tooltips.

## v0.5.0 and earlier

- Basic application implementation: Source Manager, Version Resolver, Skill Registry, Installer Providers, and Update Engine.
