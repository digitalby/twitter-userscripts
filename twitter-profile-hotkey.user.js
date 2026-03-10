// ==UserScript==
// @name         Twitter - Open Profile Hotkey
// @namespace    https://github.com/digitalby
// @version      1.1.0
// @author       digitalby
// @description  Press f on a focused tweet to open the author's profile
// @match        https://twitter.com/*
// @match        https://x.com/*
// @require      https://raw.githubusercontent.com/digitalby/twitter-userscripts/main/twitter-custom-keys.lib.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    window.__twitterCustomKeys?.register('f', "Open author's profile");

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

    function openProfile() {
        const article = getFocusedTweet();
        if (!article) return;

        // Find the avatar link — it always points to the author's profile
        const avatar = article.querySelector('[data-testid^="UserAvatar-Container-"] a[href]');
        if (avatar) {
            avatar.click();
            return;
        }

        // Fallback: find the @handle and navigate
        const userNameContainer = article.querySelector('[data-testid="User-Name"]');
        if (userNameContainer) {
            const link = userNameContainer.querySelector('a[href^="/"]');
            if (link) {
                link.click();
                return;
            }
        }
    }

    document.addEventListener('keydown', function (e) {
        if (isTyping()) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if ((window.__twitterCustomKeys?.matchesShortcut?.(e, 'f')) ?? e.key === 'f') {
            e.preventDefault();
            e.stopPropagation();
            openProfile();
        }
    });

    console.log('[ProfileHotkey] Loaded: f=open profile');
})();
