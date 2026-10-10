# Contributing to Roam

Thanks for your interest in contributing. Roam is a web-discovery platform
(web, browser extension, Android, and Supabase backend) built in a single
public repository.

## Before you start

1. Read [RULES.md](RULES.md) — it is the project rulebook and is CI-enforced.
2. Read [README.md](README.md) for the architecture overview.
3. Check the open issues and [docs/ROADMAP.md](docs/ROADMAP.md) so you don't
   duplicate work that is already in flight.

## How to contribute

- **Report a bug** — open an issue with steps to reproduce, expected vs actual
  behaviour, and the affected platform (web / extension / Android / backend).
- **Propose a feature** — open an issue describing the problem it solves before
  writing code.
- **Fix something** — pick an open issue, then follow the workflow below.

## Development workflow

```bash
git checkout -b feature/my-thing
# make changes
git commit -m "feat: describe the change"
git push origin feature/my-thing
# open a pull request
```

Use the [pull request template](.github/pull_request_template.md) for every PR.
Squash-merge to `main` with a Conventional Commits message
(`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).

## Local CI before pushing

Run the project rule checks and test suites before pushing — see
[RULES.md](RULES.md) §2.2 for the exact order.

## Contributor licence grant

By submitting a pull request you agree that your contribution is licensed under
the project's [MIT License](LICENSE) (and, where applicable, the
[Commercial License](COMMERCIAL_LICENSE.md) terms), and that you have the right
to grant that licence.

## Code of conduct

Be respectful and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
