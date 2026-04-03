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

    // Find the container holding all shortcut sections.
    // Desktop: [role="dialog"] > ... > [data-viewportview="true"] > sections
    // Mobile:  <main> > ... > scrollable div > sections
    // Identified by the h2#modal-header heading near [role="table"] elements.
    // Uses structural markers (id, roles) instead of text to support all languages.
    function findSectionsContainer() {
        const header = document.getElementById('modal-header');
        if (!header) return null;
        // Walk up from the header to find the ancestor containing [role="table"] sections
        let el = header.parentElement;
        while (el) {
            if (el.querySelector('[role="table"]')) return el;
            el = el.parentElement;
        }
        return null;
    }

    function renderSection(container) {
        // Remove previous render if any
        const old = document.getElementById(SECTION_ID);
        if (old) old.remove();

        if (entries.length === 0) return;

        // Find an existing section to clone structure from.
        // Each section wraps a heading + [role="table"]. The section is the
        // table's parent (which may have varying CSS classes across views).
        const existingTable = container.querySelector('[role="table"]');
        if (!existingTable) return;
        const existingRow = existingTable.querySelector('[role="row"]');
        if (!existingRow) return;
        const existingSection = existingTable.parentElement;
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

        // Force onto its own row in the desktop flex layout (which assumes 3 columns)
        section.style.flexBasis = '100%';

        // Append after the last existing section
        existingSection.parentElement.appendChild(section);
    }

    function checkForShortcutsView() {
        // Already injected
        if (document.getElementById(SECTION_ID)) return;

        const container = findSectionsContainer();
        if (container) {
            renderSection(container);
        }
    }

    // Watch for shortcuts view appearance (dialog on desktop, page on mobile)
    const observer = new MutationObserver(checkForShortcutsView);

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

        if (e.key === 'f') {
            e.preventDefault();
            e.stopPropagation();
            openProfile();
        }
    });

    console.log('[ProfileHotkey] Loaded: f=open profile');
})();

