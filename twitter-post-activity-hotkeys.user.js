// ==UserScript==
// @name         Twitter - Post Activity Hotkeys
// @namespace    https://github.com/digitalby
// @version      1.1.0
// @author       digitalby
// @description  Keyboard shortcuts for post activity: v to view, q/t/l to switch tabs (Quotes/Reposts/Likes)
// @match        https://twitter.com/*
// @match        https://x.com/*
// @require      https://raw.githubusercontent.com/digitalby/twitter-userscripts/main/twitter-custom-keys.lib.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    window.__twitterCustomKeys?.register('v', 'View post activity');
    window.__twitterCustomKeys?.register('q', 'Quotes tab');
    window.__twitterCustomKeys?.register('t', 'Reposts tab');
    window.__twitterCustomKeys?.register('l', 'Likes tab');

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

    function clickTab(label) {
        const tabs = document.querySelectorAll('[role="tab"]');
        for (const tab of tabs) {
            if (tab.textContent.toLowerCase().includes(label.toLowerCase())) {
                tab.click();
                return true;
            }
        }
        return false;
    }

    async function viewPostActivity() {
        const article = getFocusedTweet();
        if (!article) return;

        const caret = article.querySelector('[data-testid="caret"]');
        if (!caret) return;

        caret.click();

        // Wait for dropdown menu to appear
        let menu = null;
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 50));
            menu = document.querySelector('[role="menu"]');
            if (menu) break;
        }
        if (!menu) return;

        const items = menu.querySelectorAll('[role="menuitem"]');
        for (const item of items) {
            if (item.textContent.includes('View post activity')) {
                item.click();
                return;
            }
        }

        // Not found (not tweet author) — close menu
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }

    document.addEventListener('keydown', function (e) {
        if (isTyping()) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        switch (e.key) {
            case 'v':
                e.preventDefault();
                e.stopPropagation();
                viewPostActivity();
                break;
            case 'q':
                if (clickTab('Quotes')) { e.preventDefault(); e.stopPropagation(); }
                break;
            case 't':
                if (clickTab('Reposts')) { e.preventDefault(); e.stopPropagation(); }
                break;
            case 'l':
                if (clickTab('Likes')) { e.preventDefault(); e.stopPropagation(); }
                break;
        }
    });

    console.log('[PostActivityHotkeys] Loaded: v=view activity, q=quotes, t=reposts, l=likes');
})();
