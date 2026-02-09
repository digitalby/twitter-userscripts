// ==UserScript==
// @name         Twitter - Inline Follower Count
// @namespace    https://github.com/digitalby
// @version      1.0.1
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

    function extractUsers(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (obj.legacy && typeof obj.legacy.followers_count === 'number' && obj.legacy.screen_name) {
            const handle = obj.legacy.screen_name.toLowerCase();
            const prev = followerCache.get(handle);
            followerCache.set(handle, obj.legacy.followers_count);
            if (prev === undefined) scheduleReprocess();
        }
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (Array.isArray(val)) {
                val.forEach(item => extractUsers(item));
            } else if (val && typeof val === 'object') {
                extractUsers(val);
            }
        }
    }

    const origFetch = window.fetch;
    window.fetch = async function (...args) {
        const resp = await origFetch.apply(this, args);
        try {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            if (url && (url.includes('/graphql/') || url.includes('/i/api/'))) {
                const clone = resp.clone();
                clone.json().then(json => {
                    try { extractUsers(json); } catch {}
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
                    extractUsers(json);
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

            // Find the handle using the User-Name test ID container
            const userNameContainer = article.querySelector('[data-testid="User-Name"]');
            if (!userNameContainer) continue;

            // Look for the @handle text within the container
            let handle = null;
            const spans = userNameContainer.querySelectorAll('span');
            for (const span of spans) {
                const text = span.textContent.trim();
                if (text.startsWith('@') && span.children.length === 0) {
                    handle = text.slice(1).toLowerCase();
                    break;
                }
            }
            if (!handle) continue;

            const count = followerCache.get(handle);
            if (count === undefined) continue;

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
