# Contributing to flatmark

Thanks for taking the time to contribute. This guide covers everything you need to get started.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Issues](#reporting-issues)
- [Code Style](#code-style)

---

## Getting Started

**Prerequisites:** Node.js 18+, npm 9+

```bash
git clone https://github.com/omarchouman/flatmark.git
cd flatmark
npm install
```

Verify everything works:

```bash
npm test
npm run build
```

All 60 tests should pass and the build should complete without errors.

---

## Project Structure

```
src/
  index.ts          # Public API — re-exports only
  types.ts          # Shared TypeScript types
  errors.ts         # Custom error classes
  Parser.ts         # Parses a .md file into a FlatRecord
  Collection.ts     # Per-directory index + CRUD operations
  QueryBuilder.ts   # Chainable in-memory query accumulator
  FlatMark.ts       # Top-level registry, load(), close()
tests/
  Parser.test.ts
  Collection.test.ts
  QueryBuilder.test.ts
  FlatMark.test.ts
```

The architecture is intentionally layered:

```
FlatMark → Collection → QueryBuilder
```

Each layer has a single responsibility and no upward dependency. Keep it that way.

---

## Development Workflow

**Run tests in watch mode:**

```bash
npm run test -- --watch
```

**Type-check without building:**

```bash
npx tsc --noEmit
```

**Build:**

```bash
npm run build
```

Output goes to `dist/` — ESM (`.js`), CJS (`.cjs`), and TypeScript declarations (`.d.ts`, `.d.cts`).

---

## Testing

Tests live in `tests/` and use [Vitest](https://vitest.dev).

- Each source file has a corresponding test file
- Tests use real temporary directories (`fs.mkdtempSync`) — no mocks for file I/O
- Aim for one assertion per test where possible
- Test the public API surface, not internals

When adding a new feature, write the test first. The test suite is the spec.

**Running a single test file:**

```bash
npm run test -- tests/QueryBuilder.test.ts
```

**Running a single test by name:**

```bash
npm run test -- -t "where filter"
```

---

## Submitting a Pull Request

1. **Fork** the repo and create a branch from `main`
2. **Write tests** for your change before implementing
3. **Make sure all tests pass:** `npm test`
4. **Make sure the build passes:** `npm run build`
5. **Keep the diff focused** — one feature or fix per PR
6. **Write a clear PR description** — what changed and why

For significant changes (new operators, new API methods, breaking changes), open an issue first to discuss before writing code.

### Commit messages

Use plain imperative sentences:

```
add $startsWith filter operator
fix count() ignoring where filters
update README with pagination example
```

No conventional commit prefixes required.

---

## Reporting Issues

Open an issue on [GitHub](https://github.com/omarchouman/flatmark/issues) with:

- **flatmark version** (`npm list flatmark`)
- **Node.js version** (`node --version`)
- **What you expected to happen**
- **What actually happened**
- **A minimal reproduction** — the smaller the better

---

## Code Style

- TypeScript strict mode is enforced — no `any`, no type assertions without justification
- No comments unless the *why* is non-obvious
- Prefer explicit over clever
- `async`/`await` over raw Promises
- Throw errors, don't return them

There is no linter config yet. Use common sense and follow the patterns already in the codebase.

---

## Questions?

Open a [GitHub Discussion](https://github.com/omarchouman/flatmark/discussions) or file an issue.
