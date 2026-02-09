# Project Memory

## Twitter/X API Insights
- Twitter's GraphQL `UserByScreenName` endpoint uses rotating query IDs — must discover from JS bundles
- The `featureSwitches` array near the query definition in bundles can be extracted and set to `true`
- **IMPORTANT**: Newer API responses have moved `screen_name` OUT of the `legacy` object. Don't rely on `legacy.screen_name` existing. Use the screen name you already know from the request parameter instead.
- `followers_count` is still in `legacy` but always use fallback deep search
- `description` (bio) is in `legacy.description` or `profile_bio.description`
- Bearer token is public/shared across all Twitter web clients
- CSRF token comes from `ct0` cookie
- Use `origFetch` (saved before override) for our own API calls to avoid infinite loops

## Script Architecture
- `@run-at document-start` + fetch/XHR interception to capture Twitter's own API responses
- Serialized queue with random delays (200-600ms) for our own API calls
- `userCache` Map stores `{ followers, bio }` per lowercase handle
- MutationObserver triggers `processTweets()` on DOM changes
- `scheduleReprocess()` debounces re-processing when new cache entries arrive

## File: twitter-inline-follower-count.user.js
- Main userscript, self-contained IIFE
- Current version: 1.2.0
