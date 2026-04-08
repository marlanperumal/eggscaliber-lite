# Biome — Linting & Formatting

Biome replaces ESLint + Prettier in this project. Config lives at `biome.json` in the repo root.

## Running Biome

Always run via `just` recipes:

```bash
just lint          # biome check src/ (read-only)
just format        # biome format --write src/
just format-check  # biome check --formatter-enabled=true src/ (CI)
```

Direct commands when needed:
```bash
pnpm biome check --write src/           # lint + format + fix
pnpm biome check --write --unsafe src/  # also apply unsafe fixes
pnpm biome ci src/                      # CI mode (no writes, non-zero exit on issues)
```

## Fix Types

- **Safe fixes** (`--write`): guaranteed not to change semantics — always apply
- **Unsafe fixes** (`--write --unsafe`): may change semantics — review before applying

## Rule Categories (priority order)

1. **Correctness** — code that is guaranteed incorrect or useless (errors)
2. **Suspicious** — code likely incorrect or useless (errors/warnings)
3. **Security** — potential security vulnerabilities (errors)
4. **Accessibility** — a11y issues (errors)
5. **Performance** — efficiency improvements (warnings)
6. **Style** — consistent patterns (warnings by default)
7. **Complexity** — simplification opportunities (warnings)
8. **Nursery** — experimental, opt-in only

## Project Configuration (`biome.json`)

Current project settings:
- Line width: 100
- Indent: 2 spaces
- Semicolons: as-needed (omit)
- Quotes: double
- Trailing commas: all

## Disabling Rules

Suppress inline with a comment:
```ts
// biome-ignore lint/suspicious/noExplicitAny: third-party type mismatch
const value: any = external.getValue()
```

Disable in config for a specific file pattern:
```json
{
  "overrides": [
    {
      "include": ["**/*.test.ts"],
      "linter": {
        "rules": {
          "suspicious": { "noExplicitAny": "off" }
        }
      }
    }
  ]
}
```

## Domains

Enable React-specific rules by adding `"domains": ["react"]` to the linter config. This enables rules like detecting missing `key` props in JSX lists.

## Migrating ESLint Disable Comments

When converting from ESLint, replace:
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// → biome-ignore lint/suspicious/noExplicitAny: reason
```

## Gotchas

- `biome check` combines lint + format + import organisation in one pass — prefer it over running separately
- Use `biome ci` in CI pipelines, not `biome check` — it's optimised for non-interactive environments
- Biome does not read `.eslintrc` or `.prettierrc` — all config is in `biome.json`
- Pin exact Biome version in `package.json` (no `^`) to prevent formatting drift across machines
