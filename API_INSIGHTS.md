# API Insights

## Twitter/X GraphQL API
- `UserByScreenName` endpoint uses rotating query IDs — must discover from JS bundles, never hardcode
- The `featureSwitches` array near the query definition in bundles can be extracted and all set to `true`
- **IMPORTANT**: Newer API responses have moved `screen_name` OUT of the `legacy` object. Don't rely on `legacy.screen_name` existing. Use the screen name you already know from the request parameter instead.
- `followers_count` is still in `legacy` but always use fallback deep search
- `description` (bio) is in `legacy.description` or `profile_bio.description`
- Bearer token is public/shared across all Twitter web clients
- CSRF token comes from `ct0` cookie
- Rate limit: ~1000 requests per 15-minute window; use escalating delays + 429 backoff
- Use `origFetch` (saved before overriding `window.fetch`) for own API calls to avoid infinite loops

## Follower Count Script Architecture
- `@run-at document-start` + fetch/XHR interception to capture Twitter's own API responses
- Serialized queue with escalating delays (1-3s base, +1s per consecutive request, capped at 10-12s)
- Queue cancellation on DOM changes — only fetches currently visible profiles
- `userCache` Map stores `{ followers, bio, ts }` per lowercase handle
- Persistent cache in `localStorage` with 7-day TTL
- MutationObserver triggers `processTweets()` on DOM changes
- `scheduleReprocess()` debounces re-processing when new cache entries arrive

## Twitter/X DOM Patterns
- Tweets: `article[data-testid="tweet"]`
- User name: `[data-testid="User-Name"]`, Avatar: `[data-testid^="UserAvatar-Container-"]`
- Three-dot menu: `[data-testid="caret"]`
- Back button (soft nav): `[data-testid="app-bar-back"]`
- Retweet button: `[data-testid="retweet"]` / `[data-testid="unretweet"]`
- Dropdown menus: `[role="menu"]` → `[role="menuitem"]`
- Tabs: `[role="tablist"]` → `[role="tab"]`
- j/k focused tweet: walk `document.activeElement` up to `article[data-testid="tweet"]`
