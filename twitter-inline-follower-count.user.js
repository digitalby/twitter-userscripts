// ==UserScript==
// @name         Twitter - Inline Follower Count
// @namespace    https://github.com/digitalby
// @version      1.1.2
// @author       digitalby
// @description  Display follower count directly in tweets (e.g. Google @Google · Feb 2 · [42M followers])
// @match        https://twitter.com/*
// @match        https://x.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const followerCache = new Map();

    function formatCount(n) {
        if (n >= 1e6) {
            const val = n / 1e6;
            return (val >= 10 ? Math.round(val) : val.toFixed(1).replace(/\.0$/, '')) + 'M';
        }
        if (n >= 1e3) {
            const val = n / 1e3;
            return (val >= 10 ? Math.round(val) : val.toFixed(1).replace(/\.0$/, '')) + 'K';
        }
        return String(n);
    }

    let reprocessTimer = null;

    function scheduleReprocess() {
        if (reprocessTimer) return;
        reprocessTimer = setTimeout(() => {
            reprocessTimer = null;
            processTweets();
        }, 100);
    }

    // Dynamic GraphQL API fetch — discovers query ID from Twitter's own JS bundles
    const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
    const fetchQueued = new Set();
    let fetchQueue = [];
    let fetchRunning = false;
    let discoveredQueryId = null;
    let discoveryPromise = null;
    let capturedFeatures = null;

    function getCsrfToken() {
        const match = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/);
        return match ? match[1] : '';
    }

    function randomDelay(min, max) {
        return min + Math.random() * (max - min);
    }

    // Discover the UserByScreenName query ID from Twitter's loaded JS chunks
    const QUERY_ID_PATTERNS = [
        /queryId:"([^"]+)",operationName:"UserByScreenName"/,
        /operationName:"UserByScreenName",queryId:"([^"]+)"/,
        /queryId:"([^"]+)"[^}]{0,100}operationName:"UserByScreenName"/,
        /operationName:"UserByScreenName"[^}]{0,100}queryId:"([^"]+)"/,
    ];

    async function discoverQueryId() {
        if (discoveredQueryId) return discoveredQueryId;
        console.log('[FollowerCount] Starting query ID discovery...');
        const scripts = document.querySelectorAll('script[src]');
        console.log('[FollowerCount] Found', scripts.length, 'script tags to scan');
        let scanned = 0, failed = 0;
        for (const script of scripts) {
            try {
                const resp = await origFetch(script.src);
                if (!resp.ok) { failed++; continue; }
                const text = await resp.text();
                scanned++;
                for (const pattern of QUERY_ID_PATTERNS) {
                    const match = text.match(pattern);
                    if (match) {
                        discoveredQueryId = match[1];
                        console.log('[FollowerCount] Discovered queryId:', discoveredQueryId, 'from', script.src);
                        // Extract featureSwitches near the UserByScreenName definition
                        const idx = match.index;
                        const nearby = text.substring(idx, idx + 2000);
                        const featMatch = nearby.match(/featureSwitches:\[([^\]]+)\]/);
                        if (featMatch) {
                            const switches = featMatch[1].match(/"([^"]+)"/g).map(s => s.slice(1, -1));
                            const featObj = {};
                            switches.forEach(s => { featObj[s] = true; });
                            capturedFeatures = JSON.stringify(featObj);
                            console.log('[FollowerCount] Extracted', switches.length, 'features from bundle');
                        }
                        return discoveredQueryId;
                    }
                }
            } catch (e) {
                failed++;
                console.debug('[FollowerCount] Failed to fetch script:', script.src, e.message);
            }
        }
        console.warn('[FollowerCount] Query ID not found. Scanned:', scanned, 'Failed:', failed);
        return null;
    }

    // Retry discovery with delay (scripts may load late)
    async function discoverQueryIdWithRetry() {
        for (let attempt = 0; attempt < 3; attempt++) {
            const id = await discoverQueryId();
            if (id) return id;
            console.log('[FollowerCount] Discovery attempt', attempt + 1, 'failed, retrying in', (attempt + 1) * 2, 's...');
            await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
            discoveryPromise = null; // allow re-run
        }
        return null;
    }

    function queueUserFetch(handle) {
        if (fetchQueued.has(handle)) return;
        fetchQueued.add(handle);
        fetchQueue.push(handle);
        drainFetchQueue();
    }

    function drainFetchQueue() {
        if (fetchRunning || fetchQueue.length === 0) return;
        fetchRunning = true;
        const handle = fetchQueue.shift();
        fetchUserByScreenName(handle).finally(() => {
            fetchRunning = false;
            const delay = randomDelay(200, 600);
            setTimeout(drainFetchQueue, delay);
        });
    }

    async function fetchUserByScreenName(screenName) {
        try {
            // Ensure we have the query ID (shared single discovery with retry)
            if (!discoveredQueryId) {
                if (!discoveryPromise) discoveryPromise = discoverQueryIdWithRetry();
                await discoveryPromise;
            }
            if (!discoveredQueryId) {
                console.warn('[FollowerCount] No queryId available, skipping fetch for', screenName);
                fetchQueued.delete(screenName.toLowerCase()); // allow retry later
                return;
            }

            if (!capturedFeatures) {
                console.warn('[FollowerCount] No features available, skipping fetch for', screenName);
                fetchQueued.delete(screenName.toLowerCase()); // allow retry later
                return;
            }

            const variables = JSON.stringify({ screen_name: screenName, withSafetyModeUserFields: true });
            const params = new URLSearchParams({ variables, features: capturedFeatures, fieldToggles: '{}' });
            const url = `https://x.com/i/api/graphql/${discoveredQueryId}/UserByScreenName?${params}`;

            const resp = await origFetch(url, {
                headers: {
                    'authorization': `Bearer ${decodeURIComponent(BEARER)}`,
                    'x-csrf-token': getCsrfToken(),
                    'x-twitter-active-user': 'yes',
                    'x-twitter-auth-type': 'OAuth2Session',
                },
                credentials: 'include',
            });
            if (!resp.ok) {
                console.warn('[FollowerCount] API error for', screenName, resp.status);
                return;
            }
            const json = await resp.json();
            // Direct extraction — we already know the screenName, just find followers_count
            const result = json?.data?.user?.result;
            const fc = result?.legacy?.followers_count
                ?? result?.followers_count
                ?? findFollowersCount(result);
            if (typeof fc === 'number') {
                cacheUser(screenName, fc);
            } else {
                console.warn('[FollowerCount] Could not find followers_count for', screenName);
            }
            // Also run generic extraction for any other user data in the response
            extractUsers(json, 0);
        } catch (e) {
            console.warn('[FollowerCount] Fetch failed for', screenName, e);
        }
    }

    // Deep search for followers_count in an object
    function findFollowersCount(obj, depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 20) return null;
        if (typeof obj.followers_count === 'number') return obj.followers_count;
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (val && typeof val === 'object') {
                const found = findFollowersCount(val, depth + 1);
                if (found !== null) return found;
            }
        }
        return null;
    }

    function cacheUser(screenName, followersCount) {
        const handle = screenName.toLowerCase();
        const prev = followerCache.get(handle);
        followerCache.set(handle, followersCount);
        if (prev === undefined) {
            console.log('[FollowerCount] Cached:', handle, formatCount(followersCount));
            scheduleReprocess();
        }
    }

    function extractUsers(obj, depth) {
        if (!obj || typeof obj !== 'object') return;
        if (depth > 50) return;
        // Standard legacy structure
        if (obj.legacy && typeof obj.legacy.followers_count === 'number' && obj.legacy.screen_name) {
            cacheUser(obj.legacy.screen_name, obj.legacy.followers_count);
        }
        // Alternative: screen_name and followers_count at the same level
        if (typeof obj.screen_name === 'string' && typeof obj.followers_count === 'number') {
            cacheUser(obj.screen_name, obj.followers_count);
        }
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (Array.isArray(val)) {
                val.forEach(item => extractUsers(item, depth + 1));
            } else if (val && typeof val === 'object') {
                extractUsers(val, depth + 1);
            }
        }
    }

    console.log('[FollowerCount] Script loaded, intercepting fetch/XHR');

    const origFetch = window.fetch;
    window.fetch = async function (...args) {
        const resp = await origFetch.apply(this, args);
        try {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            if (url && url.includes('/graphql/')) {
                // Capture query IDs from Twitter's own requests
                const qidMatch = url.match(/\/graphql\/([^/?]+)\/UserByScreenName/);
                if (qidMatch && !discoveredQueryId) {
                    discoveredQueryId = qidMatch[1];
                    console.log('[FollowerCount] Captured UserByScreenName queryId from traffic:', discoveredQueryId);
                }
            }
            if (url && (url.includes('/graphql/') || url.includes('/i/api/'))) {
                const clone = resp.clone();
                clone.json().then(json => {
                    try { extractUsers(json, 0); } catch (e) { console.warn('[FollowerCount] fetch parse error:', e); }
                }).catch(() => {});
            }
        } catch {}
        return resp;
    };

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._tmUrl = url;
        return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (...args) {
        if (this._tmUrl && (this._tmUrl.includes('/graphql/') || this._tmUrl.includes('/i/api/'))) {
            this.addEventListener('load', function () {
                try {
                    const json = JSON.parse(this.responseText);
                    extractUsers(json, 0);
                } catch {}
            });
        }
        return origSend.apply(this, args);
    };

    const BADGE_ATTR = 'data-follower-badge';
    const STYLE_ID = 'tm-follower-count-style';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .tm-follower-badge {
                color: rgb(113, 118, 123);
                font-size: 13px;
                font-weight: 400;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
            }
            .tm-follower-badge::before {
                content: "·";
                margin: 0 4px;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function processTweets() {
        injectStyles();
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        for (const article of articles) {
            if (article.hasAttribute(BADGE_ATTR)) continue;

            // Find the handle using multiple strategies
            let handle = null;

            // Strategy 1: Find @handle text in User-Name container
            const userNameContainer = article.querySelector('[data-testid="User-Name"]');
            if (userNameContainer) {
                const spans = userNameContainer.querySelectorAll('span');
                for (const span of spans) {
                    const text = span.textContent.trim();
                    if (text.startsWith('@') && span.children.length === 0) {
                        handle = text.slice(1).toLowerCase();
                        break;
                    }
                }
            }

            // Strategy 2: Extract from UserAvatar-Container-* data-testid
            if (!handle) {
                const avatar = article.querySelector('[data-testid^="UserAvatar-Container-"]');
                if (avatar) {
                    handle = avatar.getAttribute('data-testid').replace('UserAvatar-Container-', '').toLowerCase();
                }
            }

            if (!handle) continue;

            const count = followerCache.get(handle);
            if (count === undefined) {
                queueUserFetch(handle);
                continue;
            }

            const timeEl = article.querySelector('time');
            if (!timeEl) continue;
            const timeLink = timeEl.closest('a');
            const container = timeLink ? timeLink.parentElement : timeEl.parentElement;
            if (!container) continue;

            article.setAttribute(BADGE_ATTR, handle);

            const badge = document.createElement('span');
            badge.className = 'tm-follower-badge';
            badge.textContent = formatCount(count) + 'f';
            container.appendChild(badge);
        }
    }

    function startObserver() {
        processTweets();
        const observer = new MutationObserver(() => processTweets());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.body) {
        startObserver();
    } else {
        document.addEventListener('DOMContentLoaded', startObserver);
    }
})();
