// ==UserScript==
// @name         Twitter - User Cell Hotkeys
// @namespace    https://github.com/digitalby
// @version      1.1.0
// @author       digitalby
// @description  Keyboard shortcuts on user cells: x=block, f=profile, u=mute, w=follow
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

    function getFocusedUserCell() {
        let el = document.activeElement;
        while (el) {
            if (el.matches && el.matches('[data-testid="UserCell"]')) return el;
            el = el.parentElement;
        }
        return null;
    }

    function openProfile(cell) {
        const link = cell.querySelector('a[href^="/"][role="link"]');
        if (link) { link.click(); return; }
        const links = cell.querySelectorAll('a[href^="/"]');
        for (const l of links) {
            const href = l.getAttribute('href');
            if (href && /^\/[a-zA-Z0-9_]+$/.test(href)) {
                l.click();
                return;
            }
        }
    }

    function followUser(cell) {
        const btn = cell.querySelector('[data-testid$="-follow"]');
        if (btn) { btn.click(); return; }
        const buttons = cell.querySelectorAll('[role="button"]');
        for (const b of buttons) {
            if (b.textContent.trim() === 'Follow') { b.click(); return; }
        }
    }

    async function clickMenuItem(cell, label) {
        // Find the three-dot / more button in the cell
        const caret = cell.querySelector('[data-testid="caret"]')
            || cell.querySelector('[aria-label="More"]')
            || cell.querySelector('[data-testid^="UserCell"] [role="button"]:last-of-type');

        // Some user cells have inline action buttons instead of a caret menu
        // Try finding a button with matching aria-label
        const inlineBtn = cell.querySelector(`[aria-label*="${label}" i]`);
        if (inlineBtn) { inlineBtn.click(); return; }

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
            if (item.textContent.includes(label)) {
                item.click();
                return;
            }
        }

        // Not found — close menu
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }

    document.addEventListener('keydown', function (e) {
        if (isTyping()) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const cell = getFocusedUserCell();
        if (!cell) return;

        switch (e.key) {
            case 'x':
                e.preventDefault();
                e.stopPropagation();
                clickMenuItem(cell, 'Block');
                break;
            case 'f':
                e.preventDefault();
                e.stopPropagation();
                openProfile(cell);
                break;
            case 'u':
                e.preventDefault();
                e.stopPropagation();
                clickMenuItem(cell, 'Mute');
                break;
            case 'w':
                e.preventDefault();
                e.stopPropagation();
                followUser(cell);
                break;
        }
    });

    console.log('[UserCellHotkeys] Loaded: x=block, f=profile, u=mute, w=follow');
})();
