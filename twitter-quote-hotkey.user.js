// ==UserScript==
// @name         Twitter - Open Quote Tweet Hotkey
// @namespace    https://github.com/digitalby
// @version      1.0.0
// @author       digitalby
// @description  Press p on a focused tweet to open its embedded quote tweet
// @match        https://twitter.com/*
// @match        https://x.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

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

        // Strategy 2: Find a nested tweet link inside a card-like container
        // Quote tweets are typically rendered as a bordered block with a link to /username/status/id
        const links = article.querySelectorAll('a[href*="/status/"]');
        // The first /status/ link is usually the tweet's own permalink (timestamp).
        // The second one, if present, is likely the quoted tweet.
        if (links.length >= 2) {
            links[1].click();
            return;
        }
    }

    document.addEventListener('keydown', function (e) {
        if (isTyping()) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'p') {
            e.preventDefault();
            e.stopPropagation();
            openQuoteTweet();
        }
    });

    console.log('[QuoteHotkey] Loaded: p=open quote tweet');
})();
