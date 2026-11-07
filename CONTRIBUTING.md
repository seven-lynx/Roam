# Contributing to Roam

Thanks for your interest in contributing. Roam is a web-discovery platform
(web, browser extension, Android, and Supabase backend) built in a single
public repository.

## Before you start

1. Read [README.md](README.md) for the architecture overview.
2. Check the open issues and [docs/ROADMAP.md](docs/ROADMAP.md) so you don't
   duplicate work that is already in flight.

## How to contribute

- **Report a bug** — open an issue with steps to reproduce, expected vs actual
  behaviour, and the affected platform (web / extension / Android / backend).
- **Propose a feature** — open an issue describing the problem it solves before
  writing code.
- **Fix something** — pick an open issue, then follow the workflow below.

## Development workflow

```bash
git config core.hooksPath .githooks     # once per clone: rejects off-convention branch names
git checkout -b feature/my-thing
# make changes
git commit -m "feat: describe the change"
git push origin feature/my-thing
# open a pull request
```

Branch names are `<type>/<kebab-case>`, where `<type>` is one of `feature`,
`feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `audit`, `build`,
`ci`, or `release`. `scripts/check-rules.mjs` (R11) fails the pull request for
anything else, and the `.githooks/pre-push` hook blocks it before it reaches the
remote. If a tool or worktree session starts you on a generated branch name,
rename it with `git branch -m <type>/<kebab>` **before** the first commit.

Use the [pull request template](.github/pull_request_template.md) for every PR.
Squash-merge to `main` with a Conventional Commits message
(`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).

## Local CI before pushing

Run the project rule checks and test suites before pushing
(`node scripts/check-rules.mjs`, then lint/typecheck/tests for the
platform you touched).

## Contributor licence grant

By submitting a pull request you agree that your contribution is licensed under
the project's [MIT License](LICENSE) (and, where applicable, the
[Commercial License](COMMERCIAL_LICENSE.md) terms), and that you have the right
to grant that licence.

## Code of conduct

Be respectful and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
