# Project Guidelines

## Version Bumping
**ALWAYS bump the `@version` in the userscript header when modifying any `.user.js` file.** This is required for userscript managers (Tampermonkey etc.) to detect updates. Use major.minor.bug format: bump bug for fixes, minor for features, major for breaking changes.

## Userscript Conventions
- All scripts are self-contained IIFEs with `'use strict'`
- Use `@grant none` (runs in page context)
- Match both `https://twitter.com/*` and `https://x.com/*`
- Only use `@run-at document-start` if intercepting fetch/XHR; otherwise use default (document-end)
- Namespace: `https://github.com/digitalby`

## Twitter/X DOM Patterns
- Tweets: `article[data-testid="tweet"]`
- User name container: `[data-testid="User-Name"]`
- Avatar with handle: `[data-testid^="UserAvatar-Container-"]`
- Tweet three-dot menu: `[data-testid="caret"]`
- Back button (soft nav): `[data-testid="app-bar-back"]`
- Retweet button: `[data-testid="retweet"]` / `[data-testid="unretweet"]`
- Timestamp/permalink: `time` element inside an `a` tag
- Dropdown menus: `[role="menu"]` with `[role="menuitem"]` children
- Tabs: `[role="tablist"]` with `[role="tab"]` children
- j/k focused tweet: walk up from `document.activeElement` to find enclosing `article[data-testid="tweet"]`

## Keyboard Shortcut Scripts
- Always guard against typing: ignore when activeElement is INPUT, TEXTAREA, or contenteditable
- Always ignore when modifier keys (ctrl/cmd/alt) are held
- Handle Twitter's chord shortcuts (e.g. `g+p`): track chord prefix keys and skip interception if a chord is pending
- For menu interactions: click the button, poll for menu appearance (50ms intervals, max 10 attempts), then find menu item by text content
- Use `history.back()` only as fallback — prefer Twitter's `[data-testid="app-bar-back"]` for soft SPA navigation

## Twitter/X API
- GraphQL query IDs rotate with each deployment — discover from JS bundles, never hardcode
- `featureSwitches` array near query definitions can be extracted and all set to `true`
- `screen_name` has moved OUT of the `legacy` response object — use the screen name from the request parameter
- `followers_count` is in `legacy` but use deep search as fallback
- Bearer token is public/shared; CSRF token from `ct0` cookie
- Rate limit: ~1000 requests per 15-minute window; use escalating delays and 429 backoff
- Use `origFetch` (saved before overriding `window.fetch`) for own API calls
