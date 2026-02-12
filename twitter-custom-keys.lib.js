// twitter-custom-keys.lib.js — Shared library for registering custom keyboard shortcuts
// @require'd by individual hotkey userscripts. Injects a "Custom" section into Twitter's
// built-in keyboard shortcuts dialog (opened with ?).
//
// Usage: window.__twitterCustomKeys.register(key, description)

(function () {
    'use strict';

    // Singleton guard — only the first script to load initializes
    if (window.__twitterCustomKeys) return;

    const entries = [];
    const SECTION_ID = 'tm-custom-keys-section';

    window.__twitterCustomKeys = {
        register(key, description) {
            entries.push({ key, description });
        }
    };

    function injectStyles() {
        if (document.getElementById('tm-custom-keys-style')) return;
        const style = document.createElement('style');
        style.id = 'tm-custom-keys-style';
        style.textContent = `
            #${SECTION_ID} {
                padding: 0 16px 16px;
            }
            #${SECTION_ID} h3 {
                font-size: 17px;
                font-weight: 700;
                color: rgb(231, 233, 234);
                padding: 12px 0 8px;
                margin: 0;
            }
            #${SECTION_ID} .tm-ck-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 0;
            }
            #${SECTION_ID} .tm-ck-desc {
                color: rgb(113, 118, 123);
                font-size: 15px;
            }
            #${SECTION_ID} .tm-ck-key {
                color: rgb(231, 233, 234);
                font-size: 15px;
                font-weight: 700;
                min-width: 24px;
                text-align: right;
                margin-left: 16px;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
    }

    function renderSection(dialog) {
        // Remove previous render if any
        const old = dialog.querySelector('#' + SECTION_ID);
        if (old) old.remove();

        if (entries.length === 0) return;

        injectStyles();

        const section = document.createElement('div');
        section.id = SECTION_ID;

        const heading = document.createElement('h3');
        heading.textContent = 'Custom';
        section.appendChild(heading);

        for (const { key, description } of entries) {
            const row = document.createElement('div');
            row.className = 'tm-ck-row';

            const desc = document.createElement('span');
            desc.className = 'tm-ck-desc';
            desc.textContent = description;

            const keyEl = document.createElement('span');
            keyEl.className = 'tm-ck-key';
            keyEl.textContent = key;

            row.appendChild(desc);
            row.appendChild(keyEl);
            section.appendChild(row);
        }

        // Find the scrollable content area and append
        const scrollable = dialog.querySelector('[data-viewportview="true"]')
            || dialog.querySelector('[style*="overflow"]')
            || dialog;

        // Try to find the last existing section to insert after
        scrollable.appendChild(section);
    }

    function checkForDialog() {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const dialog of dialogs) {
            if (dialog.querySelector('#' + SECTION_ID)) continue;
            // Check if this is the keyboard shortcuts dialog
            const headings = dialog.querySelectorAll('h2, [role="heading"]');
            for (const h of headings) {
                if (h.textContent.includes('Keyboard shortcuts')) {
                    renderSection(dialog);
                    return;
                }
            }
        }
    }

    // Watch for dialog appearance
    const observer = new MutationObserver(checkForDialog);

    function startObserver() {
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.body) {
        startObserver();
    } else {
        document.addEventListener('DOMContentLoaded', startObserver);
    }

    console.log('[CustomKeys] Shared library loaded');
})();
