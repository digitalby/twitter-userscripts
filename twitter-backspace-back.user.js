// ==UserScript==
// @name         Twitter - Backspace to Go Back
// @namespace    https://github.com/digitalby
// @version      1.0.2
// @author       digitalby
// @description  Press Backspace to navigate back on Twitter/X
// @match        https://twitter.com/*
// @match        https://x.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Backspace') return;

        const tag = document.activeElement.tagName;
        const isEditable = document.activeElement.isContentEditable;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;

        // Only act if Twitter's back button is visible
        const backBtn = document.querySelector('[data-testid="app-bar-back"]');
        if (!backBtn || backBtn.offsetParent === null) return;

        e.preventDefault();
        backBtn.click();
    });
})();
