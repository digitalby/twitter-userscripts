// ==UserScript==
// @name         Twitter - Backspace to Go Back
// @namespace    https://github.com/digitalby
// @version      1.0
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

        e.preventDefault();
        history.back();
    });
})();
