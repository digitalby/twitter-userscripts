// ==UserScript==
// @name         Twitter - Backspace to Go Back
// @namespace    https://github.com/digitalby
// @version      1.1.1
// @author       digitalby
// @description  Press Backspace to navigate back on Twitter/X
// @match        https://twitter.com/*
// @match        https://x.com/*
// @require      https://raw.githubusercontent.com/digitalby/twitter-userscripts/main/twitter-custom-keys.lib.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    window.__twitterCustomKeys?.register('Backspace', 'Go back');

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Backspace') return;

        if (window.__twitterCustomKeys?.isTyping?.(e)) return;

        // Only act if Twitter's back button is visible
        const backBtn = document.querySelector('[data-testid="app-bar-back"]');
        if (!backBtn || backBtn.offsetParent === null) return;

        e.preventDefault();
        backBtn.click();
    });
})();
