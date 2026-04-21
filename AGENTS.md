# CitizenPass Workspace Rules

These rules apply to all Codex threads working in this repository.

## Git safety

- Commit locally only by default.
- Never push source code, project configuration, native app code, scripts, or general workspace files to GitHub or any other remote unless the user explicitly asks for that push in the current thread.
- Content publishing is the only standing exception: files inside a user-designated remote content directory such as `appdata/` may be synced to GitHub when the task is clearly about publishing remote content updates for the app.
- Never create pull requests unless the user explicitly asks.
- Treat remotes as read-only unless the user clearly authorizes a write action.

## Local code safety

- Never delete local codebases, project folders, or source files unless the user explicitly asks.
- Never use destructive git commands such as `git reset --hard`, `git clean -fd`, `git checkout --`, or force-push unless the user explicitly asks.
- Never overwrite or revert local work just to "clean things up".
- If a risky operation is needed, make a backup copy first when possible.

## Recovery and caution

- If repository state is unclear, inspect first and preserve existing files.
- If there are multiple local copies of a project, do not assume which one is authoritative without checking.
- When asked to restore an older version, do not destroy the current local version. Recover into a separate location first unless the user explicitly asks to replace it.

## Default behavior

- Prefer the least destructive path.
- Preserve user data, generated assets, logs, scripts, and local-only changes unless the user explicitly asks otherwise.
- When in doubt, treat GitHub writes as forbidden, except for explicit remote content publishing to directories like `appdata/`.
