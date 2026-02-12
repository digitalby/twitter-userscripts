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

    function renderSection(dialog) {
        // Remove previous render if any
        const old = dialog.querySelector('#' + SECTION_ID);
        if (old) old.remove();

        if (entries.length === 0) return;

        // Find an existing section to clone structure from.
        // Each section is: wrapper div > (heading wrapper div + table div)
        const existingTable = dialog.querySelector('[role="table"]');
        if (!existingTable) return;
        const existingRow = existingTable.querySelector('[role="row"]');
        if (!existingRow) return;
        const existingSection = existingTable.closest('.css-175oi2r.r-1wbh5a2');
        if (!existingSection) return;

        // Clone the entire section as our template
        const section = existingSection.cloneNode(true);
        section.id = SECTION_ID;

        // Update the heading text to "Custom"
        const headingSpan = section.querySelector('h2[role="heading"] span');
        if (headingSpan) {
            headingSpan.textContent = 'Custom';
        }

        // Get reference to the table, clear its rows, and rebuild
        const table = section.querySelector('[role="table"]');
        table.innerHTML = '';

        for (const { key, description } of entries) {
            // Clone a row from the original dialog for correct classes
            const row = existingRow.cloneNode(true);

            // First cell = description
            const cells = row.querySelectorAll('[role="cell"]');
            const descCell = cells[0];
            const keyCell = cells[1];

            // Set description text
            const descSpan = descCell.querySelector('span');
            if (descSpan) {
                descSpan.textContent = description;
            } else {
                descCell.textContent = description;
            }

            // Set key — clear existing content and rebuild from a single-key template
            keyCell.innerHTML = '';
            const existingKeyDiv = existingRow.querySelector('[role="cell"]:last-child > div');
            if (existingKeyDiv) {
                const keyDiv = existingKeyDiv.cloneNode(true);
                keyDiv.textContent = key;
                keyCell.appendChild(keyDiv);
            } else {
                keyCell.textContent = key;
            }

            table.appendChild(row);
        }

        // Find the scrollable content area and append after the last section
        const scrollable = dialog.querySelector('[data-viewportview="true"]')
            || existingSection.parentElement;
        if (scrollable) {
            scrollable.appendChild(section);
        }
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
