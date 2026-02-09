// ==UserScript==
// @name         Twitter - Open Quote Tweet Hotkey
// @namespace    https://github.com/digitalby
// @version      1.0.1
// @author       digitalby
// @description  Press p on a focused tweet to open its embedded quote tweet
// @match        https://twitter.com/*
// @match        https://x.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Track chord prefixes (e.g. g+p = go to profile)
    const CHORD_PREFIXES = ['g'];
    const CHORD_TIMEOUT = 1000;
    let chordPending = false;
    let chordTimer = null;

    document.addEventListener('keydown', function (e) {
        if (CHORD_PREFIXES.includes(e.key)) {
            chordPending = true;
            clearTimeout(chordTimer);
            chordTimer = setTimeout(() => { chordPending = false; }, CHORD_TIMEOUT);
        }
    }, true);

    function isTyping() {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
        if (el.getAttribute('contenteditable') === 'true') return true;
        if (el.closest('[contenteditable="true"]')) return true;
        return false;
    }

    function getFocusedTweet() {
        let el = document.activeElement;
        while (el) {
            if (el.matches && el.matches('article[data-testid="tweet"]')) return el;
            el = el.parentElement;
        }
        return null;
    }

    function openQuoteTweet() {
        const article = getFocusedTweet();
        if (!article) return;

        // Strategy 1: data-testid for quote tweet
        const quote = article.querySelector('[data-testid="quoteTweet"]');
        if (quote) {
            const link = quote.querySelector('a[href*="/status/"]');
            if (link) { link.click(); return; }
            quote.click();
            return;
        }

        // Strategy 2: Find the tweet's own permalink, then look for a different /status/ link
        // that isn't in the action bar area (views/analytics)
        const timeLink = article.querySelector('time')?.closest('a[href*="/status/"]');
        if (!timeLink) return;
        const tweetHref = timeLink.getAttribute('href');

        const links = article.querySelectorAll('a[href*="/status/"]');
        for (const link of links) {
            const href = link.getAttribute('href');
            // Skip the tweet's own permalink and analytics/views links
            if (href === tweetHref) continue;
            if (href.includes('/analytics')) continue;
            // Must be a different tweet's /status/ URL — likely the quote tweet
            if (/\/status\/\d+/.test(href)) {
                link.click();
                return;
            }
        }
    }

    document.addEventListener('keydown', function (e) {
        if (isTyping()) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'p') {
            if (chordPending) { chordPending = false; return; }
            e.preventDefault();
            e.stopPropagation();
            openQuoteTweet();
        }
    });

    console.log('[QuoteHotkey] Loaded: p=open quote tweet');
})();
