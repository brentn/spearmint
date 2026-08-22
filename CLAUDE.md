## Agent skills

### Issue tracker

Issues live as GitHub issues on `brentn/spearmint`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root (created lazily as decisions get made). See `docs/agents/domain.md`.

## Styling conventions

**Minimum 16px `font-size` on form controls** (inputs, selects, textareas). Below that, iOS Safari
auto-zooms the viewport on focus — see the "16px minimum" comments in `accounts.scss` for existing
examples of the pattern (issue #26).
