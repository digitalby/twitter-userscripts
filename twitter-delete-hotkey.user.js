// ==UserScript==
// @name         Twitter - Delete Hotkey
// @namespace    https://github.com/digitalby
// @version      1.1.0
// @author       digitalby
// @description  Press d on a focused tweet to delete it (via the ... menu)
// @match        https://twitter.com/*
// @match        https://x.com/*
// @require      https://raw.githubusercontent.com/digitalby/twitter-userscripts/main/twitter-custom-keys.lib.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    window.__twitterCustomKeys?.register('d', 'Delete focused tweet');

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

    async function deleteTweet() {
        const article = getFocusedTweet();
        if (!article) return;

        const caret = article.querySelector('[data-testid="caret"]');
        if (!caret) return;

        caret.click();

        let menu = null;
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 50));
            menu = document.querySelector('[role="menu"]');
            if (menu) break;
        }
        if (!menu) return;

        const items = menu.querySelectorAll('[role="menuitem"]');
        for (const item of items) {
            if (item.textContent.includes('Delete')) {
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

        if (e.key === 'd') {
            e.preventDefault();
            e.stopPropagation();
            deleteTweet();
        }
    });

    console.log('[DeleteHotkey] Loaded: d=delete tweet');
})();
