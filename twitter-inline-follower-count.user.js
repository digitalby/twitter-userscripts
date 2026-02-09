// ==UserScript==
// @name         Twitter - Inline Follower Count
// @namespace    https://github.com/digitalby
// @version      1.0.4
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

    // Direct API fetch for user profile data
    const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
    const fetchQueued = new Set();
    let fetchQueue = [];
    let fetchRunning = false;

    function getCsrfToken() {
        const match = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/);
        return match ? match[1] : '';
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
            setTimeout(drainFetchQueue, 300);
        });
    }

    async function fetchUserByScreenName(screenName) {
        try {
            const variables = JSON.stringify({ screen_name: screenName, withSafetyModeUserFields: true });
            const features = JSON.stringify({
                hidden_profile_subscriptions_enabled: true,
                rweb_tipjar_consumption_enabled: true,
                responsive_web_graphql_exclude_directive_enabled: true,
                verified_phone_label_enabled: false,
                subscriptions_verification_info_is_identity_verified_enabled: true,
                subscriptions_verification_info_verified_since_enabled: true,
                highlights_tweets_tab_ui_enabled: true,
                responsive_web_twitter_article_notes_tab_enabled: true,
                subscriptions_feature_can_gift_premium: true,
                creator_subscriptions_tweet_preview_api_enabled: true,
                responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
                responsive_web_graphql_timeline_navigation_enabled: true
            });
            const params = new URLSearchParams({ variables, features, fieldToggles: '{}' });
            const url = `https://x.com/i/api/graphql/xc8f1g7BYqr6VTzTbvNlGw/UserByScreenName?${params}`;

            const resp = await origFetch(url, {
                headers: {
                    'authorization': `Bearer ${decodeURIComponent(BEARER)}`,
                    'x-csrf-token': getCsrfToken(),
                    'x-twitter-active-user': 'yes',
                    'x-twitter-auth-type': 'OAuth2Session',
                    'content-type': 'application/json',
                },
                credentials: 'include',
            });
            if (!resp.ok) {
                console.warn('[FollowerCount] API error for', screenName, resp.status);
                return;
            }
            const json = await resp.json();
            extractUsers(json, 0);
        } catch (e) {
            console.warn('[FollowerCount] Fetch failed for', screenName, e);
        }
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
