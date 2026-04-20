# Selector Health Check

CI canary that loads `https://x.com/jack/status/20` in a headless Chromium, captures every JavaScript bundle served during the page load, and greps them for proxy identifiers tied to the selectors the userscripts depend on. Public CDN bundles require no authentication, so this runs cleanly in GitHub Actions with no secrets.

If any critical or high-priority proxy falls below its minimum occurrence count, the check exits non-zero and CI opens (or updates) a rolling GitHub issue.

## What this catches vs what it misses

**Catches (strong signal):** Twitter renaming or removing a feature. Example: if `QuoteTweet` stops appearing in the bundle, the quote tweet component was removed or renamed, and our quote-hotkey script is about to break.

**Misses (blind spot):** A silent `data-testid` rename where the underlying component keeps its name but the attribute value changes (e.g., `data-testid="caret"` → `data-testid="moreMenu"`). Most React components don't embed their `data-testid` values as string literals in the bundle -- those are set dynamically via props -- so bundle grep can't see them.

This is an early-warning canary for structural changes, not a full integration test. A full test would require a logged-in session in CI, which we've chosen not to do. The canary is the automation we get for free; pairing it with user-reported breakage remains necessary.

## Run locally

```
cd tools/selector-health
npm ci
npx playwright install chromium
npm run check
```

Writes `report.json` next to the script.

## Updating the selector list

`selectors.json` mirrors the "Twitter/X DOM Patterns" section of the root `CLAUDE.md`. When you add a new selector to a userscript, update both files in the same commit.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All critical/high selectors present (medium misses are logged but non-blocking) |
| 1 | At least one critical or high selector is missing from the live bundles |
| 2 | No bundles captured (network failure, Cloudflare block, etc.) |
