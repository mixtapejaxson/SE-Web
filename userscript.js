// ==UserScript==
// @name         SnapEnhance Full - UI Controlled & Extended (Fixed)
// @namespace    snapenhance-web
// @description  Unlocks Snapchat Web: draggable UI, autosave chats/media, reopen snaps, persistent tools, and privacy bypasses
// @version      2.11.2
// @author       SnapEnhance (with fixes)
// @match        *://www.snapchat.com/web/*
// @grant        unsafeWindow
// @run-at       document-start
// @license      GPL-3.0-only
// ==/UserScript==

(function (window) {
    'use strict';

    // Ensure unsafeWindow is available for accessing the page's global scope,
    // falling back to window if running in an environment where unsafeWindow is not defined.
    const currentWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    // Define the initial state for all features. These values are defaults
    // and will be overridden by saved settings from localStorage.
    const state = {
        alwaysFocus: true,
        allowRightClick: true,
        bypassReadReceipts: true,
        bypassTypingIndicator: false,
        bypassScreenshotDetection: false,
        bypassOverlay: false,
        infiniteReplays: true,
        enableMediaDownloads: true,
        autoDownloadMedia: false,
        autosaveSpecificUsers: false,
        specificUsersToAutosave: [],
        autosaveChats: false,
        hideBanners: false,
        reopenSnaps: true,
        autoOpenSnapsAndStories: false,
        autoSkipStories: false,
        autoSkipDelay: 3000,
        preventStoryAutoAdvance: false,
        enableCustomCss: false,
        customCss: '',
        enableCustomChatBackground: false,
        customChatBackgroundUrl: '',
        customChatBackgroundRepeat: 'no-repeat',
        customChatBackgroundSize: 'cover',
        blockContent: false,
        blockedContentKeywords: [],
        enableElementHiding: false,
        elementsToHideSelectors: '',
        panelPosition: { top: '20px', left: '20px' },
        activeTab: 'general',
        uiAccentColor: '#00bcd4',
        enableHotkeys: false,
        hotkeyTogglePanel: 'p',
        hotkeyNextStory: 'ArrowRight',
        hotkeyPreviousStory: 'ArrowLeft',
        enablePiP: false,
        blockAggressiveAds: false,
        autoHideViewedContent: false,
    };

    // Load saved settings from localStorage.
    try {
        const savedSettings = JSON.parse(localStorage.getItem('snapenhance_settings') || '{}');
        if (savedSettings.panelPosition) {
            Object.assign(state.panelPosition, savedSettings.panelPosition);
            delete savedSettings.panelPosition;
        }
        Object.assign(state, savedSettings);
    } catch (e) {
        console.error('[SnapEnhance] Error loading settings from localStorage:', e);
    }


    // Initialize media and chat storage.
    let savedMediaStore = new Map();
    try {
        savedMediaStore = new Map(JSON.parse(localStorage.getItem('snapenhance_media') || '[]'));
    } catch (e) {
        console.error('[SnapEnhance] Error loading saved media from localStorage:', e);
        localStorage.removeItem('snapenhance_media'); // Clear corrupted data
    }

    let savedChatStore = {};
    try {
        savedChatStore = JSON.parse(localStorage.getItem('snapenhance_chats') || '{}');
    } catch (e) {
        console.error('[SnapEnhance] Error loading saved chats from localStorage:', e);
        localStorage.removeItem('snapenhance_chats'); // Clear corrupted data
    }

    /**
     * Creates and displays a custom modal message box.
     * @param {string} message - The message to display.
     * @param {string} type - 'success', 'error', or 'info' for styling.
     * @param {function} onConfirm - Callback function for 'OK' button.
     * @param {boolean} showCancel - Whether to show a cancel button.
     * @param {function} onCancel - Callback function for 'Cancel' button.
     */
    const showMessageBox = (message, type = 'info', onConfirm = () => {}, showCancel = false, onCancel = () => {}) => {
        const existingMessageBox = document.getElementById('snapenhance-message-box');
        if (existingMessageBox) {
            existingMessageBox.remove();
        }

        const msgBox = document.createElement('div');
        msgBox.id = 'snapenhance-message-box';
        msgBox.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2a2a2a'};
        color: white; padding: 25px; border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.8); z-index: 100000; text-align: center;
        max-width: 350px; font-family: 'Inter', sans-serif;
        animation: fadeInMessageBox 0.3s ease-out; /* Renamed animation */
        `;
        msgBox.innerHTML = `
        <p style="margin-bottom: 20px; font-size: 16px; line-height: 1.5;">${message}</p>
        <div style="display: flex; justify-content: center; gap: 10px;">
        <button id="snapenhance-msg-ok-btn" style="
        background: ${type === 'success' ? '#45a049' : type === 'error' ? '#d32f2f' : '#007bff'};
        color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer;
        font-weight: 600; transition: background-color 0.2s ease;
        ">OK</button>
        ${showCancel ? `<button id="snapenhance-msg-cancel-btn" style="
            background: #555; color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer;
            font-weight: 600; transition: background-color 0.2s ease;
            ">Cancel</button>` : ''}
            </div>
            `;

            if (document.body) { // Ensure body exists before appending
                document.body.appendChild(msgBox);
            }


            if (!document.getElementById('snapenhance-fadein-stylesheet')) {
                const styleSheet = document.createElement('style');
                styleSheet.id = 'snapenhance-fadein-stylesheet';
                styleSheet.type = 'text/css';
                styleSheet.innerText = `
                @keyframes fadeInMessageBox { /* Renamed animation */
                    from { opacity: 0; transform: translate(-50%, -60%); }
                    to { opacity: 1; transform: translate(-50%, -50%); }
                }
                `;
                if(document.head) document.head.appendChild(styleSheet);
            }

            const okBtn = document.getElementById('snapenhance-msg-ok-btn');
            if(okBtn) okBtn.onclick = () => {
                msgBox.remove();
                onConfirm();
            };

            if (showCancel) {
                const cancelBtn = document.getElementById('snapenhance-msg-cancel-btn');
                if(cancelBtn) cancelBtn.onclick = () => {
                    msgBox.remove();
                    onCancel();
                };
            }
    };

    /**
     * Saves the current state object to localStorage.
     */
    const saveSettings = () => {
        try {
            localStorage.setItem('snapenhance_settings', JSON.stringify(state));
        } catch (e) {
            console.error('[SnapEnhance] Error saving settings to localStorage:', e);
            showMessageBox('Error saving settings. Storage might be full.', 'error');
        }
    };

    const originalDocumentVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const originalDocumentHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    const originalDocumentHasFocusDescriptor = Object.getOwnPropertyDescriptor(document, 'hasFocus');


    let customCssStyleElement = null;
    let customChatBackgroundStyleElement = null;
    let elementHidingStyleElement = null;
    let aggressiveAdBlockingStyleElement = null;

    const originalAddEventListener = currentWindow.EventTarget.prototype.addEventListener;
    let snapenhanceRightClickListener = null;


    /**
     * Helper to darken a hex color.
     * @param {string} hex - The hex color string (e.g., '#RRGGBB').
     * @param {number} percent - The percentage to darken (e.g., 20 for 20%).
     * @returns {string} The darkened hex color string.
     */
    const darkenColor = (hex, percent) => {
        let f = parseInt(hex.slice(1), 16),
            R = f >> 16,
            G = (f >> 8) & 0x00ff,
            B = f & 0x0000ff,
            p = percent / 100;

        R = Math.max(0, Math.round(R * (1 - p)));
        G = Math.max(0, Math.round(G * (1 - p)));
        B = Math.max(0, Math.round(B * (1 - p)));

        return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    };


    /**
     * Applies or reverts behavioral modifications based on the current state.
     */
    const applyBehaviors = () => {
        if (state.alwaysFocus) {
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            // Snapchat's code calls document.hasFocus(), so it needs to be a function.
            Object.defineProperty(document, 'hasFocus', { value: () => true, configurable: true, writable: true });
            currentWindow.dispatchEvent(new Event('visibilitychange'));
        } else {
            // Revert to original browser behavior, if original descriptors exist
            if (originalDocumentVisibilityStateDescriptor) {
                Object.defineProperty(document, 'visibilityState', originalDocumentVisibilityStateDescriptor);
            } else { // Fallback if original descriptor somehow wasn't captured
                delete document.visibilityState;
            }
            if (originalDocumentHiddenDescriptor) {
                Object.defineProperty(document, 'hidden', originalDocumentHiddenDescriptor);
            } else {
                delete document.hidden;
            }
            if (originalDocumentHasFocusDescriptor) {
                Object.defineProperty(document, 'hasFocus', originalDocumentHasFocusDescriptor);
            } else {
                delete document.hasFocus;
            }
            currentWindow.dispatchEvent(new Event('visibilitychange'));
        }

        document.querySelectorAll('div[data-testid="banner"]').forEach(b => {
            b.style.display = state.hideBanners ? 'none' : '';
        });

        if (state.allowRightClick) {
            if (!snapenhanceRightClickListener) {
                snapenhanceRightClickListener = (e) => e.stopPropagation();
                document.addEventListener('contextmenu', snapenhanceRightClickListener, true);
            }
        } else {
            if (snapenhanceRightClickListener) {
                document.removeEventListener('contextmenu', snapenhanceRightClickListener, true);
                snapenhanceRightClickListener = null;
            }
        }

        if (state.enableCustomCss && state.customCss) {
            if (!customCssStyleElement && document.head) {
                customCssStyleElement = document.createElement('style');
                customCssStyleElement.id = 'snapenhance-custom-css';
                document.head.appendChild(customCssStyleElement);
            }
            if(customCssStyleElement) customCssStyleElement.textContent = state.customCss;
        } else {
            if (customCssStyleElement && customCssStyleElement.parentNode) {
                customCssStyleElement.parentNode.removeChild(customCssStyleElement);
                customCssStyleElement = null;
            }
        }

        const chatContainer = document.querySelector('[data-testid="chat-feed-scroll-container"]');
        if (state.enableCustomChatBackground && state.customChatBackgroundUrl && chatContainer) {
            if (!customChatBackgroundStyleElement && document.head) {
                customChatBackgroundStyleElement = document.createElement('style');
                customChatBackgroundStyleElement.id = 'snapenhance-custom-chat-background';
                document.head.appendChild(customChatBackgroundStyleElement);
            }
            if(customChatBackgroundStyleElement) customChatBackgroundStyleElement.textContent = `
            [data-testid="chat-feed-scroll-container"] {
                background-image: url('${state.customChatBackgroundUrl}') !important;
                background-repeat: ${state.customChatBackgroundRepeat} !important;
                background-size: ${state.customChatBackgroundSize} !important;
                background-position: center !important;
            }
            `;
        } else {
            if (customChatBackgroundStyleElement && customChatBackgroundStyleElement.parentNode) {
                customChatBackgroundStyleElement.parentNode.removeChild(customChatBackgroundStyleElement);
                customChatBackgroundStyleElement = null;
            }
        }

        if (state.enableElementHiding && state.elementsToHideSelectors) {
            if (!elementHidingStyleElement && document.head) {
                elementHidingStyleElement = document.createElement('style');
                elementHidingStyleElement.id = 'snapenhance-element-hiding';
                document.head.appendChild(elementHidingStyleElement);
            }
            if(elementHidingStyleElement) elementHidingStyleElement.textContent = `
            ${state.elementsToHideSelectors} {
                display: none !important;
                visibility: hidden !important;
            }
            `;
        } else {
            if (elementHidingStyleElement && elementHidingStyleElement.parentNode) {
                elementHidingStyleElement.parentNode.removeChild(elementHidingStyleElement);
                elementHidingStyleElement = null;
            }
        }

        if (state.blockAggressiveAds) {
            if (!aggressiveAdBlockingStyleElement && document.head) {
                aggressiveAdBlockingStyleElement = document.createElement('style');
                aggressiveAdBlockingStyleElement.id = 'snapenhance-aggressive-ad-blocking';
                document.head.appendChild(aggressiveAdBlockingStyleElement);
            }
            if(aggressiveAdBlockingStyleElement) aggressiveAdBlockingStyleElement.textContent = `
            div[aria-label*="ad"], div[data-ad-id], div[data-promoted],
            div[role="feed"] > div:has([aria-label*="Sponsored"]),
            div[data-testid*="ad-component"], div[data-component-name*="Ad"],
            div[data-component-name*="Promotion"] {
                display: none !important; visibility: hidden !important;
            }`;
        } else {
            if (aggressiveAdBlockingStyleElement && aggressiveAdBlockingStyleElement.parentNode) {
                aggressiveAdBlockingStyleElement.parentNode.removeChild(aggressiveAdBlockingStyleElement);
                aggressiveAdBlockingStyleElement = null;
            }
        }
    };

    /**
     * Saves a chat message to localStorage.
     */
    const saveChat = (username, message) => {
        if (!savedChatStore[username]) {
            savedChatStore[username] = [];
        }
        const lastMessage = savedChatStore[username][savedChatStore[username].length - 1];
        if (lastMessage && lastMessage.message === message && (Date.now() - lastMessage.timestamp < 1000)) {
            return;
        }
        savedChatStore[username].push({ message, timestamp: Date.now() });
        try {
            localStorage.setItem('snapenhance_chats', JSON.stringify(savedChatStore));
        } catch (e) {
            console.error('[SnapEnhance] Error saving chats to localStorage:', e);
            showMessageBox('Error saving chats. Storage might be full.', 'error');
        }
    };

    /**
     * Saves a media source URL to localStorage.
     */
    const saveMedia = (src, type = 'unknown', sender = 'unknown') => {
        if (src && !savedMediaStore.has(src)) {
            savedMediaStore.set(src, { src, type, sender, timestamp: Date.now() });
            try {
                localStorage.setItem('snapenhance_media', JSON.stringify(Array.from(savedMediaStore.entries())));
            } catch (e) {
                console.error('[SnapEnhance] Error saving media to localStorage:', e);
                savedMediaStore.delete(src);
                showMessageBox('Error saving media. Storage might be full.', 'error');
            }
        }
    };

    const getMediaSender = (el) => {
        const senderEl = el.closest('[data-sender-name], [data-username]');
        if (senderEl) {
            const sender = senderEl.getAttribute('data-sender-name') || senderEl.getAttribute('data-username');
            if (sender) return sender.toLowerCase();
        }
        const ariaLabelParent = el.closest('[aria-label*="story from"], [aria-label*="snap from"]');
        if (ariaLabelParent) {
            const ariaLabel = ariaLabelParent.getAttribute('aria-label');
            const match = ariaLabel ? ariaLabel.match(/(?:story|snap) from ([\w\d._-]+)/i) : null;
            if (match && match[1]) return match[1].toLowerCase();
        }
        return 'unknown';
    };

    const getMediaType = (el) => {
        if (el.closest('[aria-label*="Snap"], [aria-label*="snap"]')) return 'snap';
        if (el.closest('[aria-label*="Story"], [aria-label*="story"]')) return 'story';
        if (el.closest('[data-testid*="chat-media"]')) return 'chat_media';
        if (el.src && el.src.includes('snapchat.com/web/media')) return 'snap_or_story_url';
        return 'unknown';
    };

    /**
     * Hooks into media elements (img, video, audio) to enable downloads and auto-save.
     */
    const hookMediaElements = () => {
        document.querySelectorAll('img, video, audio').forEach(el => {
            // Simplified check: if already hooked, assume states are managed by toggles
            // More complex state checking removed for brevity as it wasn't the primary bug source
            // if (el.hasAttribute('data-snapenhanced-media-hooked')) return;


            if (state.enableMediaDownloads) {
                el.style.pointerEvents = 'auto';
                el.removeAttribute('controlsList');
                el.setAttribute('controls', 'true');

                if (!el.snapEnhanceContextMenuListener) {
                    const listener = (e) => e.stopPropagation();
                    el.snapEnhanceContextMenuListener = listener;
                    el.addEventListener('contextmenu', listener, true);
                }

                if (state.autoDownloadMedia && el.src && !el.hasAttribute('data-snapenhanced-processed-autosave')) {
                    const sender = getMediaSender(el);
                    const type = getMediaType(el);
                    let shouldSave = !state.autosaveSpecificUsers || (sender !== 'unknown' && state.specificUsersToAutosave.includes(sender));

                    if (shouldSave && ['snap', 'story', 'chat_media', 'snap_or_story_url'].includes(type)) {
                        el.setAttribute('data-snapenhanced-processed-autosave', 'true');
                        saveMedia(el.src, type, sender);
                    }
                }
            } else {
                el.style.pointerEvents = '';
                el.removeAttribute('controls');
                if (el.snapEnhanceContextMenuListener) {
                    el.removeEventListener('contextmenu', el.snapEnhanceContextMenuListener, true);
                    delete el.snapEnhanceContextMenuListener;
                }
                el.removeAttribute('data-snapenhanced-processed-autosave');
            }

            if (el.tagName === 'VIDEO') {
                el.disablePictureInPicture = !state.enablePiP;
                if (state.enablePiP) el.setAttribute('controls', 'true');
            }

            el.setAttribute('data-snapenhanced-media-hooked', 'true');
        });
    };

    let chatObserver = null;
    const observeMessages = () => {
        if (chatObserver) {
            chatObserver.disconnect();
            chatObserver = null;
        }

        if (state.autosaveChats) {
            const chatContainer = document.querySelector('[data-testid="chat-feed-scroll-container"]');
            if (chatContainer) {
                chatObserver = new MutationObserver((mutations) => {
                    mutations.forEach(mutation => {
                        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                            mutation.addedNodes.forEach(node => {
                                if (node.nodeType === Node.ELEMENT_NODE) {
                                    const messageElements = node.matches('[data-sender-name]') ? [node] : Array.from(node.querySelectorAll('[data-sender-name]'));
                                    messageElements.forEach(el => {
                                        const user = el.getAttribute('data-sender-name');
                                        const message = el.textContent ? el.textContent.trim() : '';
                                        if (user && message && !el.hasAttribute('data-snapenhanced-chat-processed')) {
                                            saveChat(user, message);
                                            el.setAttribute('data-snapenhanced-chat-processed', 'true');
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
                chatObserver.observe(chatContainer, { childList: true, subtree: true });
            } else {
                console.warn('[SnapEnhance] Chat container not found. Chat autosave will not function.');
            }
        }
    };

    let storySkipTimeout = null;
    const mainObserver = new MutationObserver((mutations) => {
        applyBehaviors();
        hookMediaElements();

        if (state.reopenSnaps) {
            document.querySelectorAll('[aria-label="Snap expired"], [aria-label="Snap viewed"]').forEach(el => {
                if (!el.hasAttribute('data-snapenhanced-reopened')) {
                    el.setAttribute('aria-label', 'Snap viewable');
                    if(el.classList) {
                        el.classList.remove('viewed', 'expired');
                        el.classList.add('new');
                    }
                    el.setAttribute('data-snapenhanced-reopened', 'true');
                    const clickableParent = el.closest('[role="button"], [role="link"], [tabindex]');
                    if (clickableParent) {
                        clickableParent.style.pointerEvents = 'auto';
                        clickableParent.style.opacity = '1';
                    }
                }
            });
        }

        if (state.autoOpenSnapsAndStories) {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const newSnapOrStory = node.matches('[aria-label*="Snap"]:not([aria-label*="viewed"]):not([aria-label*="expired"]), [aria-label*="Story"]:not([aria-label*="viewed"]):not([aria-label*="expired"])') ? node : node.querySelector('[aria-label*="Snap"]:not([aria-label*="viewed"]):not([aria-label*="expired"]), [aria-label*="Story"]:not([aria-label*="viewed"]):not([aria-label*="expired"])');
                            if (newSnapOrStory && !newSnapOrStory.hasAttribute('data-snapenhanced-opened') && !newSnapOrStory.closest('[data-testid="story-viewer-container"]')) {
                                if(typeof newSnapOrStory.click === 'function') newSnapOrStory.click();
                                newSnapOrStory.setAttribute('data-snapenhanced-opened', 'true');
                            }
                        }
                    });
                }
            });
        }

        if (state.autoSkipStories) {
            const activeStoryViewer = document.querySelector('[data-testid="story-viewer-container"]');
            if (activeStoryViewer && !activeStoryViewer.hasAttribute('data-snapenhanced-skipping')) {
                activeStoryViewer.setAttribute('data-snapenhanced-skipping', 'true');
                if (storySkipTimeout) clearTimeout(storySkipTimeout);
                storySkipTimeout = setTimeout(() => {
                    const nextButton = document.querySelector('[aria-label="Next Story"], [data-testid="next-button"]');
                    if (nextButton && typeof nextButton.click === 'function') nextButton.click();
                    else {
                        const event = new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, bubbles: true, cancelable: true });
                        document.dispatchEvent(event);
                    }
                    if(activeStoryViewer) activeStoryViewer.removeAttribute('data-snapenhanced-skipping');
                }, state.autoSkipDelay);
            } else if (!activeStoryViewer && storySkipTimeout) {
                clearTimeout(storySkipTimeout);
                storySkipTimeout = null;
            }
        } else {
            if (storySkipTimeout) {
                clearTimeout(storySkipTimeout);
                storySkipTimeout = null;
            }
        }

        if (state.preventStoryAutoAdvance) {
            document.querySelectorAll('[data-testid="story-progress-bar-segment"]').forEach(bar => {
                bar.style.animationPlayState = 'paused';
                bar.style.width = '100%';
            });
        } else {
            document.querySelectorAll('[data-testid="story-progress-bar-segment"]').forEach(bar => {
                bar.style.animationPlayState = '';
                bar.style.width = '';
            });
        }

        if (state.bypassOverlay) {
            const overlaySelectors = ['[data-testid*="screenshot-overlay"]', '[aria-label*="screenshot detected"]', '[role="dialog"][data-modal-type="alert"]'];
            overlaySelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(overlay => {
                    if (overlay.style.display !== 'none' || overlay.style.visibility !== 'hidden') {
                        overlay.style.display = 'none';
                        overlay.style.visibility = 'hidden';
                    }
                });
            });
        }

        if (state.blockContent && state.blockedContentKeywords.length > 0) {
            const contentContainers = document.querySelectorAll('[data-testid*="story-item"], [data-testid*="discover-tile"], [aria-label*="story from"], [aria-label*="Discover content"]');
            contentContainers.forEach(item => {
                const textContent = item.textContent ? item.textContent.toLowerCase() : '';
                const ariaLabel = item.getAttribute('aria-label')?.toLowerCase() || '';
                const shouldBlock = state.blockedContentKeywords.some(keyword =>
                    textContent.includes(keyword.toLowerCase()) || ariaLabel.includes(keyword.toLowerCase())
                );
                if (shouldBlock && item.style.display !== 'none') {
                    item.style.display = 'none';
                    item.setAttribute('data-snapenhanced-blocked', 'true');
                } else if (!shouldBlock && item.style.display === 'none' && item.hasAttribute('data-snapenhanced-blocked')) {
                    item.style.display = '';
                    item.removeAttribute('data-snapenhanced-blocked');
                }
            });
        }

        if (state.autoHideViewedContent) {
            document.querySelectorAll('[aria-label="Snap viewed"], [aria-label="Story viewed"]').forEach(el => {
                if (!el.hasAttribute('data-snapenhanced-hidden-viewed')) {
                    el.style.display = 'none';
                    el.setAttribute('data-snapenhanced-hidden-viewed', 'true');
                }
            });
        } else {
            document.querySelectorAll('[data-snapenhanced-hidden-viewed]').forEach(el => {
                el.style.display = '';
                el.removeAttribute('data-snapenhanced-hidden-viewed');
            });
        }
    });
    if(document.documentElement) {
        mainObserver.observe(document.documentElement, { childList: true, subtree: true });
    }


    currentWindow.EventTarget.prototype.addEventListener = function (...args) {
        const [eventName, handler, options] = args;
        if (state.alwaysFocus && ['blur', 'visibilitychange'].includes(eventName)) return;

        if (state.bypassScreenshotDetection && eventName === 'keydown') {
            const wrappedHandler = function (e) {
                if (e.key === 'PrintScreen' || e.keyCode === 44 ||
                    (e.altKey && (e.key === 'PrintScreen' || e.keyCode === 44)) ||
                    (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5' || e.keyCode === 51 || e.keyCode === 52 || e.keyCode === 53))) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }
                if (typeof handler === 'function') {
                    handler.apply(this, arguments);
                }
            };
            return originalAddEventListener.call(this, eventName, wrappedHandler, options);
        }
        return originalAddEventListener.apply(this, args);
    };

    document.addEventListener('copy', (e) => {
        if (state.bypassScreenshotDetection) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }, true);

    const originalFetch = currentWindow.fetch;
    currentWindow.fetch = async function (...args) {
        const url = args[0]?.url || args[0];
        if (state.bypassReadReceipts && typeof url === 'string' && url.includes('readreceipt-indexer/batchuploadreadreceipts')) {
            return new currentWindow.Response(null, { status: 200, statusText: 'OK' });
        }
        if (state.bypassTypingIndicator && typeof url === 'string' && url.includes('/type-status/')) {
            return new currentWindow.Response(null, { status: 200, statusText: 'OK' });
        }
        if (state.infiniteReplays && typeof url === 'string' && (url.includes('/snap-indexer/viewed') || url.includes('/story-indexer/viewed') || url.includes('/mark_as_viewed'))) {
            return new currentWindow.Response(null, { status: 200, statusText: 'OK' });
        }
        if (state.preventStoryAutoAdvance && typeof url === 'string' && (url.includes('/story-advance') || url.includes('/next-story'))) {
            return new currentWindow.Response(null, { status: 200, statusText: 'OK' });
        }
        return originalFetch.apply(this, args);
    };

    const handleHotkeys = (e) => {
        if (!state.enableHotkeys || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const targetTagName = e.target && typeof e.target.tagName === 'string' ? e.target.tagName.toLowerCase() : '';
        if (targetTagName === 'input' || targetTagName === 'textarea') return;

        const pressedKey = e.key.toLowerCase();
        switch (pressedKey) {
            case state.hotkeyTogglePanel.toLowerCase():
                if(minMaxBtn && typeof minMaxBtn.click === 'function') minMaxBtn.click();
                e.preventDefault();
                break;
            case state.hotkeyNextStory.toLowerCase():
                const nextButton = document.querySelector('[aria-label="Next Story"], [data-testid="next-button"]');
                if (nextButton && typeof nextButton.click === 'function') nextButton.click();
                else {
                    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, bubbles: true, cancelable: true });
                    document.dispatchEvent(event);
                }
                e.preventDefault();
                break;
            case state.hotkeyPreviousStory.toLowerCase():
                const prevButton = document.querySelector('[aria-label="Previous Story"], [data-testid="previous-button"]');
                if (prevButton && typeof prevButton.click === 'function') prevButton.click();
                else {
                    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37, bubbles: true, cancelable: true });
                    document.dispatchEvent(event);
                }
                e.preventDefault();
                break;
        }
    };
    currentWindow.addEventListener('keydown', handleHotkeys);

    const panel = document.createElement('div');
    panel.id = 'snapenhance-panel';
    panel.style.cssText = `
    position: fixed;
    top: ${state.panelPosition.top};
    left: ${state.panelPosition.left};
    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    color: #e0e0e0;
    padding: 15px;
    z-index: 99999;
    border-radius: 12px;
    font-size: 14px;
    font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    min-width: 280px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.8);
    user-select: none;
    resize: both;
    overflow: hidden;
    border: 1px solid #333;
    transition: height 0.2s ease, min-width 0.2s ease;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
    cursor: grab;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #444;
    font-weight: 600;
    `;

    const title = document.createElement('div');
    title.textContent = 'SnapEnhance';
    title.style.cssText = `
    font-weight: 700;
    font-size: 18px;
    color: ${state.uiAccentColor};
    `;

    const minMaxBtn = document.createElement('button');
    minMaxBtn.textContent = '−';
    minMaxBtn.style.cssText = `
    background: none;
    border: none;
    color: ${state.uiAccentColor};
    font-size: 24px;
    cursor: pointer;
    user-select: none;
    padding: 0 8px;
    line-height: 1;
    transition: color 0.2s ease;
    `;
    minMaxBtn.onmouseover = (e) => e.target.style.color = '#fff';
    minMaxBtn.onmouseout = (e) => e.target.style.color = state.uiAccentColor;

    header.appendChild(title);
    header.appendChild(minMaxBtn);
    panel.appendChild(header);

    const tabNav = document.createElement('div');
     tabNav.style.cssText = `
    display: flex;
    justify-content: space-around;
    margin-bottom: 10px;
    border-bottom: 1px solid #555;
    padding-bottom: 5px;
    `;
    panel.appendChild(tabNav);


    const tabContents = {};
    const tabContentContainer = document.createElement('div');
    panel.appendChild(tabContentContainer);


    const createTabButton = (tabId, label) => {
        const button = document.createElement('button');
        button.textContent = label;
        button.id = `tab-btn-${tabId}`;
        button.style.cssText = `
        background: none;
        border: none;
        color: #c0c0c0;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        border-radius: 6px 6px 0 0;
        transition: background-color 0.2s ease, color 0.2s ease;
        `;
        button.onmouseover = (e) => { if (state.activeTab !== tabId) e.target.style.backgroundColor = '#333'; };
        button.onmouseout = (e) => { if (state.activeTab !== tabId) e.target.style.backgroundColor = 'transparent'; };

        button.onclick = () => showTab(tabId);
        tabNav.appendChild(button);

        const contentDiv = document.createElement('div');
        contentDiv.id = `tab-content-${tabId}`;
        contentDiv.style.cssText = `
        padding-top: 10px;
        display: none;
        `;
        tabContents[tabId] = contentDiv;
        tabContentContainer.appendChild(contentDiv);
        return contentDiv;
    };


    const showTab = (tabId) => {
        Object.values(tabContents).forEach(div => div.style.display = 'none');
        tabNav.querySelectorAll('button').forEach(btn => {
            btn.style.backgroundColor = 'transparent';
            btn.style.color = '#c0c0c0';
            btn.style.borderBottom = 'none';
        });

        if (tabContents[tabId]) {
            tabContents[tabId].style.display = 'block';
        }
        const activeBtn = document.getElementById(`tab-btn-${tabId}`);
        if (activeBtn) {
            activeBtn.style.backgroundColor = '#2a2a2a';
            activeBtn.style.color = '#fff';
            activeBtn.style.borderBottom = `2px solid ${state.uiAccentColor}`;
        }
        state.activeTab = tabId;
        saveSettings();
    };

    const createToggle = (label, key, parentElement, onToggleChangeCallback) => { // Added callback
        const labelEl = document.createElement('label');
        labelEl.style.cssText = `
        display: flex;
        align-items: center;
        margin: 8px 0;
        cursor: pointer;
        user-select: none;
        color: #c0c0c0;
        `;

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = state[key];
        input.id = key;
        input.style.cssText = `
        margin-right: 10px;
        transform: scale(1.2);
        accent-color: ${state.uiAccentColor};
        `;
        input.onchange = (e) => { // Pass event to callback
            state[key] = input.checked;
            saveSettings();
            applyBehaviors();
            hookMediaElements();
            if (key === 'autosaveChats') observeMessages();
            if (['autoSkipStories', 'blockContent', 'enableCustomCss', 'enableElementHiding', 'preventStoryAutoAdvance', 'blockAggressiveAds', 'autoHideViewedContent'].includes(key)) {
                if(mainObserver && document.documentElement) {
                    mainObserver.disconnect();
                    mainObserver.observe(document.documentElement, { childList: true, subtree: true });
                }
            }
            if (typeof onToggleChangeCallback === 'function') {
                 onToggleChangeCallback(e.target.checked); // Call with checked state
            }
        };

        labelEl.appendChild(input);
        labelEl.appendChild(document.createTextNode(label));
        parentElement.appendChild(labelEl);
        return labelEl;
    };

     const createHotkeyInput = (label, key, parentElement) => {
        const div = document.createElement('div');
        div.style.cssText = `
        display: flex;
        align-items: center;
        margin: 8px 0;
        color: #c0c0c0;
        gap: 10px;
        margin-left: 25px;
        `;

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.flexShrink = '0';
        div.appendChild(labelEl);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = state[key];
        input.placeholder = 'Press a key';
        input.readOnly = true;
        input.style.cssText = `
        width: 80px;
        padding: 5px;
        border-radius: 5px;
        border: 1px solid #555;
        background-color: #333;
        color: #eee;
        font-size: 13px;
        text-align: center;
        cursor: pointer;
        `;

        input.addEventListener('keydown', (e) => {
            e.preventDefault();
            input.value = e.key;
            state[key] = e.key;
            saveSettings();
            input.blur();
        });

        div.appendChild(input);
        parentElement.appendChild(div);
    };


    // --- Create Tabs ---
    const generalTabContent = createTabButton('general', 'General');
    const mediaTabContent = createTabButton('media', 'Media');
    const chatsTabContent = createTabButton('chats', 'Chats');
    const personalizationTabContent = createTabButton('personalization', 'Personalization');
    const contentFilteringTabContent = createTabButton('content_filtering', 'Content Filtering');
    const advancedTabContent = createTabButton('advanced', 'Advanced');


    // --- Populate General Tab ---
    createToggle('Always Focus (Prevent Tab Blur)', 'alwaysFocus', generalTabContent);
    createToggle('Allow Right Click Globally', 'allowRightClick', generalTabContent);
    createToggle('Bypass Read Receipts (Undetected)', 'bypassReadReceipts', generalTabContent);
    createToggle('Bypass Typing Indicator', 'bypassTypingIndicator', generalTabContent);
    createToggle('Bypass Screenshot Detection', 'bypassScreenshotDetection', generalTabContent);
    createToggle('Bypass Overlay (Screenshot/Recording)', 'bypassOverlay', generalTabContent);
    createToggle('Infinite Replays', 'infiniteReplays', generalTabContent);
    createToggle('Hide Banners (Experimental)', 'hideBanners', generalTabContent);
    createToggle('Reopen Snaps (Visual Only)', 'reopenSnaps', generalTabContent);
    createToggle('Auto-Open Snaps/Stories', 'autoOpenSnapsAndStories', generalTabContent);
    createToggle('Auto-Skip Stories', 'autoSkipStories', generalTabContent, (checked) => { // Pass callback directly
        autoSkipDelayContainer.style.display = checked ? 'flex' : 'none';
    });
    createToggle('Prevent Story Auto-Advance', 'preventStoryAutoAdvance', generalTabContent);
    createToggle('Auto-Hide Viewed Stories/Snaps from Feed', 'autoHideViewedContent', generalTabContent);

    const autoSkipDelayContainer = document.createElement('div');
    autoSkipDelayContainer.style.cssText = `
    margin-top: 5px;
    margin-left: 25px;
    display: ${state.autoSkipStories ? 'flex' : 'none'};
    align-items: center;
    color: #c0c0c0;
    `;
    generalTabContent.appendChild(autoSkipDelayContainer);
    const autoSkipDelayLabel = document.createElement('label');
    autoSkipDelayLabel.textContent = 'Delay (ms):';
    autoSkipDelayLabel.style.marginRight = '5px';
    autoSkipDelayContainer.appendChild(autoSkipDelayLabel);
    const autoSkipDelayInput = document.createElement('input');
    autoSkipDelayInput.type = 'number';
    autoSkipDelayInput.min = '500';
    autoSkipDelayInput.step = '100';
    autoSkipDelayInput.value = state.autoSkipDelay;
    autoSkipDelayInput.style.cssText = `
    width: 80px;
    padding: 5px;
    border-radius: 5px;
    border: 1px solid #555;
    background-color: #333;
    color: #eee;
    font-size: 13px;
    `;
    autoSkipDelayInput.oninput = () => {
        const delay = parseInt(autoSkipDelayInput.value, 10);
        if (!isNaN(delay) && delay >= 500) {
            state.autoSkipDelay = delay;
            saveSettings();
        }
    };
    autoSkipDelayContainer.appendChild(autoSkipDelayInput);

     const createButton = (text, onClickHandler, bgColor = '#007bff', customStyles = '') => {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
        background: ${bgColor};
        border: none;
        padding: 10px 15px;
        color: #fff;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        transition: background-color 0.2s ease, transform 0.1s ease;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        ${customStyles}
        `;
        button.onmouseover = (e) => e.target.style.backgroundColor = darkenColor(bgColor, 15);
        button.onmousedown = (e) => e.target.style.transform = 'translateY(1px)';
        button.onmouseup = (e) => e.target.style.transform = 'translateY(0)';
        button.onmouseout = (e) => { e.target.style.backgroundColor = bgColor; e.target.style.transform = 'translateY(0)'; };
        button.onclick = onClickHandler;
        return button;
    };


    const markAllAsReadBtn = createButton('Mark All Snaps/Chats as Viewed', () => {
        showMessageBox('Are you sure you want to mark all current unread snaps and chats as viewed?', 'info', () => {
            document.querySelectorAll('[aria-label*="New Snap"], [aria-label*="New Story"], [aria-label*="Unread Chat"]').forEach(el => {
                if (typeof el.click === 'function') el.click();
            });
            showMessageBox('Attempted to mark all visible unread items as viewed.', 'success');
        }, true);
    }, '#673AB7', 'margin-top: 10px;');
    generalTabContent.appendChild(markAllAsReadBtn);


    // --- Populate Media Tab ---
    createToggle('Enable Media Downloads (Add Controls)', 'enableMediaDownloads', mediaTabContent);
    createToggle('Auto-Save All Media (View in Panel)', 'autoDownloadMedia', mediaTabContent);
    createToggle('Auto-Save Specific Users Media', 'autosaveSpecificUsers', mediaTabContent, (checked) => {
        specificUsersSection.style.display = checked ? 'block' : 'none';
    });
    createToggle('Enable Picture-in-Picture for Videos', 'enablePiP', mediaTabContent);

    const specificUsersSection = document.createElement('div');
    specificUsersSection.style.cssText = `
    margin-top: 15px;
    padding-top: 10px;
    border-top: 1px solid #444;
    display: ${state.autosaveSpecificUsers ? 'block' : 'none'};
    `;
    mediaTabContent.appendChild(specificUsersSection);

    const specificUsersLabel = document.createElement('div');
    specificUsersLabel.textContent = 'Auto-Save Media From Users:';
    specificUsersLabel.style.cssText = `color: ${state.uiAccentColor}; font-weight: 600; margin-bottom: 8px;`;
    specificUsersSection.appendChild(specificUsersLabel);

    const userAddInput = document.createElement('input');
    userAddInput.type = 'text';
    userAddInput.placeholder = 'Enter username (e.g., john_doe123)';
    userAddInput.style.cssText = `
    width: calc(100% - 70px); padding: 8px; margin-right: 5px; border-radius: 5px;
    border: 1px solid #555; background-color: #333; color: #eee; font-size: 13px;
    `;
    specificUsersSection.appendChild(userAddInput);

    const addUserBtn = createButton('Add', () => {
        const username = userAddInput.value.trim().toLowerCase();
        if (username && !state.specificUsersToAutosave.includes(username)) {
            state.specificUsersToAutosave.push(username);
            saveSettings();
            renderUserList();
            userAddInput.value = '';
            hookMediaElements();
        }
    }, '#4CAF50', 'padding: 8px 12px; font-size: 13px;');
    specificUsersSection.appendChild(addUserBtn);


    const userListDiv = document.createElement('div');
    userListDiv.style.cssText = 'margin-top: 10px; max-height: 100px; overflow-y: auto; border: 1px solid #444; border-radius: 5px; padding: 5px; background-color: #2a2a2a;';
    specificUsersSection.appendChild(userListDiv);

    const renderUserList = () => {
        userListDiv.innerHTML = '';
        if (state.specificUsersToAutosave.length === 0) {
            userListDiv.textContent = 'No users added.';
            userListDiv.style.color = '#888';
            userListDiv.style.textAlign = 'center';
            userListDiv.style.padding = '15px';
        } else {
            userListDiv.style.color = ''; userListDiv.style.textAlign = ''; userListDiv.style.padding = '5px';
            state.specificUsersToAutosave.forEach(user => {
                const userItem = document.createElement('div');
                userItem.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; background-color: #3a3a3a; border-radius: 4px; margin-bottom: 3px; font-size: 13px;`;
                userItem.textContent = user;
                const removeBtn = createButton('x', () => {
                    state.specificUsersToAutosave = state.specificUsersToAutosave.filter(u => u !== user);
                    saveSettings();
                    renderUserList();
                    hookMediaElements();
                }, '#f44336', `font-size: 10px; width: 18px; height: 18px; padding: 0; display: flex; align-items: center; justify-content: center;`);
                userItem.appendChild(removeBtn);
                userListDiv.appendChild(userItem);
            });
        }
    };
    renderUserList();

    const clearUserMediaSection = document.createElement('div');
    clearUserMediaSection.style.cssText = `margin-top: 15px; padding-top: 10px; border-top: 1px solid #444;`;
    mediaTabContent.appendChild(clearUserMediaSection);
    const clearUserMediaLabel = document.createElement('div');
    clearUserMediaLabel.textContent = 'Clear Media for Specific User:';
    clearUserMediaLabel.style.cssText = `color: ${state.uiAccentColor}; font-weight: 600; margin-bottom: 8px;`;
    clearUserMediaSection.appendChild(clearUserMediaLabel);

    const clearUserMediaInput = document.createElement('input');
    clearUserMediaInput.type = 'text';
    clearUserMediaInput.placeholder = 'Enter username to clear media';
    clearUserMediaInput.style.cssText = `width: calc(100% - 70px); padding: 8px; margin-right: 5px; border-radius: 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 13px;`;
    clearUserMediaSection.appendChild(clearUserMediaInput);

    const clearUserMediaBtn = createButton('Clear', () => {
        const usernameToClear = clearUserMediaInput.value.trim().toLowerCase();
        if (usernameToClear) {
            showMessageBox(`Are you sure you want to clear all saved media for user "${usernameToClear}"? This cannot be undone.`, 'info', () => {
                const initialSize = savedMediaStore.size;
                const mediaToDelete = [];
                savedMediaStore.forEach((value, key) => {
                    if (value.sender && value.sender.toLowerCase() === usernameToClear) {
                        mediaToDelete.push(key);
                    }
                });
                mediaToDelete.forEach(key => savedMediaStore.delete(key));
                try {
                    localStorage.setItem('snapenhance_media', JSON.stringify(Array.from(savedMediaStore.entries())));
                    if (initialSize !== savedMediaStore.size) {
                        showMessageBox(`Cleared media for user "${usernameToClear}".`, 'success');
                    } else {
                        showMessageBox(`No media found for user "${usernameToClear}".`, 'info');
                    }
                } catch (e) {
                    console.error('[SnapEnhance] Error saving media after clearing for user:', e);
                    showMessageBox('Error updating media store. Storage might be full.', 'error');
                }
                clearUserMediaInput.value = '';
            }, true);
        } else {
            showMessageBox('Please enter a username to clear media.', 'error');
        }
    }, '#f44336', 'padding: 8px 12px; font-size: 13px;');
    clearUserMediaSection.appendChild(clearUserMediaBtn);


    // --- Populate Chats Tab ---
    createToggle('Autosave Chats (View in Panel)', 'autosaveChats', chatsTabContent);
    const exportChatsSection = document.createElement('div');
    exportChatsSection.style.cssText = `margin-top: 15px; padding-top: 10px; border-top: 1px solid #444;`;
    chatsTabContent.appendChild(exportChatsSection);
    const exportChatsLabel = document.createElement('div');
    exportChatsLabel.textContent = 'Export Chats:';
    exportChatsLabel.style.cssText = `color: ${state.uiAccentColor}; font-weight: 600; margin-bottom: 8px;`;
    exportChatsSection.appendChild(exportChatsLabel);

    const exportChatUserInput = document.createElement('input');
    exportChatUserInput.type = 'text';
    exportChatUserInput.placeholder = 'Enter username (leave empty for all)';
    exportChatUserInput.style.cssText = `width: calc(100% - 70px); padding: 8px; margin-right: 5px; border-radius: 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 13px;`;
    exportChatsSection.appendChild(exportChatUserInput);

    const exportChatsBtn = createButton('Export', () => {
        const username = exportChatUserInput.value.trim().toLowerCase();
        let chatContent = '';
        let fileName = 'all_chats.txt';

        if (username) {
            if (savedChatStore[username]) {
                chatContent += `--- Chat with ${username} ---\n\n`;
                savedChatStore[username].forEach(msg => {
                    chatContent += `[${new Date(msg.timestamp).toLocaleString()}] ${msg.message}\n`;
                });
                fileName = `${username}_chats.txt`;
            } else {
                showMessageBox(`No chats found for user "${username}".`, 'info'); return;
            }
        } else {
            const chatUsers = Object.keys(savedChatStore).sort();
            if (chatUsers.length === 0) { showMessageBox('No chats saved to export.', 'info'); return; }
            chatUsers.forEach(user => {
                chatContent += `--- Chat with ${user} ---\n\n`;
                savedChatStore[user].forEach(msg => {
                    chatContent += `[${new Date(msg.timestamp).toLocaleString()}] ${msg.message}\n`;
                });
                chatContent += '\n\n';
            });
        }

        if (chatContent) {
            try {
                const blob = new Blob([chatContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = fileName;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showMessageBox('Chat transcript downloaded successfully!', 'success');
            } catch (e) {
                console.error('[SnapEnhance] Error exporting chats:', e);
                showMessageBox('Error exporting chats.', 'error');
            }
        } else { showMessageBox('No chat content to export.', 'error'); }
    }, '#00BCD4', 'padding: 8px 12px; font-size: 13px;');
    exportChatsSection.appendChild(exportChatsBtn);


    const clearUserChatSection = document.createElement('div');
    clearUserChatSection.style.cssText = `margin-top: 15px; padding-top: 10px; border-top: 1px solid #444;`;
    chatsTabContent.appendChild(clearUserChatSection);
    const clearUserChatLabel = document.createElement('div');
    clearUserChatLabel.textContent = 'Clear Chats for Specific User:';
    clearUserChatLabel.style.cssText = `color: ${state.uiAccentColor}; font-weight: 600; margin-bottom: 8px;`;
    clearUserChatSection.appendChild(clearUserChatLabel);

    const clearUserChatInput = document.createElement('input');
    clearUserChatInput.type = 'text';
    clearUserChatInput.placeholder = 'Enter username to clear chats';
    clearUserChatInput.style.cssText = `width: calc(100% - 70px); padding: 8px; margin-right: 5px; border-radius: 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 13px;`;
    clearUserChatSection.appendChild(clearUserChatInput);

    const clearUserChatBtn = createButton('Clear', () => {
        const usernameToClear = clearUserChatInput.value.trim().toLowerCase();
        if (usernameToClear) {
            showMessageBox(`Are you sure you want to clear all saved chats for user "${usernameToClear}"? This cannot be undone.`, 'info', () => {
                if (savedChatStore[usernameToClear]) {
                    delete savedChatStore[usernameToClear];
                    try {
                        localStorage.setItem('snapenhance_chats', JSON.stringify(savedChatStore));
                        showMessageBox(`Cleared chats for user "${usernameToClear}".`, 'success');
                    } catch (e) {
                        console.error('[SnapEnhance] Error saving chats after clearing for user:', e);
                        showMessageBox('Error updating chat store. Storage might be full.', 'error');
                    }
                } else {
                    showMessageBox(`No chats found for user "${usernameToClear}".`, 'info');
                }
                clearUserChatInput.value = '';
            }, true);
        } else {
            showMessageBox('Please enter a username to clear chats.', 'error');
        }
    }, '#f44336', 'padding: 8px 12px; font-size: 13px;');
    clearUserChatSection.appendChild(clearUserChatBtn);


    // --- Populate Personalization Tab ---
    createToggle('Enable Custom Chat Background', 'enableCustomChatBackground', personalizationTabContent, (checked) => {
        customChatBackgroundSection.style.display = checked ? 'block' : 'none';
    });
    const customChatBackgroundSection = document.createElement('div');
    customChatBackgroundSection.style.cssText = `
    margin-top: 15px; padding-top: 10px; border-top: 1px solid #444;
    display: ${state.enableCustomChatBackground ? 'block' : 'none'};
    `;
    personalizationTabContent.appendChild(customChatBackgroundSection);
    const customChatBackgroundLabel = document.createElement('div');
    customChatBackgroundLabel.textContent = 'Chat Background Image URL:';
    customChatBackgroundLabel.style.cssText = `color: ${state.uiAccentColor}; font-weight: 600; margin-bottom: 8px;`;
    customChatBackgroundSection.appendChild(customChatBackgroundLabel);

    const customChatBackgroundUrlInput = document.createElement('input');
    customChatBackgroundUrlInput.type = 'text';
    customChatBackgroundUrlInput.placeholder = 'e.g., https://example.com/image.jpg';
    customChatBackgroundUrlInput.value = state.customChatBackgroundUrl;
    customChatBackgroundUrlInput.style.cssText = `width: calc(100% - 10px); padding: 8px; border-radius: 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 13px; margin-bottom: 10px;`;
    customChatBackgroundUrlInput.oninput = () => {
        state.customChatBackgroundUrl = customChatBackgroundUrlInput.value.trim();
        saveSettings(); applyBehaviors();
    };
    customChatBackgroundSection.appendChild(customChatBackgroundUrlInput);

    const bgOptionsContainer = document.createElement('div');
    bgOptionsContainer.style.cssText = `display: flex; gap: 10px; margin-bottom: 10px;`;
    customChatBackgroundSection.appendChild(bgOptionsContainer);

    const createSelect = (label, key, options, parent) => {
        const div = document.createElement('div');
        div.style.cssText = `display: flex; flex-direction: column; flex: 1;`;
        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.style.cssText = `font-size: 12px; color: #c0c0c0; margin-bottom: 3px;`;
        div.appendChild(lbl);
        const select = document.createElement('select');
        select.style.cssText = `padding: 5px; border-radius: 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 13px;`;
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            select.appendChild(option);
        });
        select.value = state[key];
        select.onchange = () => { state[key] = select.value; saveSettings(); applyBehaviors(); };
        div.appendChild(select);
        parent.appendChild(div);
    };
    createSelect('Repeat:', 'customChatBackgroundRepeat', ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'], bgOptionsContainer);
    createSelect('Size:', 'customChatBackgroundSize', ['auto', 'cover', 'contain', '100% 100%'], bgOptionsContainer);


    // --- Populate Content Filtering Tab ---
    createToggle('Block Story/Discover Content', 'blockContent', contentFilteringTabContent, (checked) => {
        blockedContentSection.style.display = checked ? 'block' : 'none';
    });
    createToggle('Aggressive Ad Blocker', 'blockAggressiveAds', contentFilteringTabContent);
    const blockedContentSection = document.createElement('div');
    blockedContentSection.style.cssText = `
    margin-top: 15px; padding-top: 10px; border-top: 1px solid #444;
    display: ${state.blockContent ? 'block' : 'none'};
    `;
    contentFilteringTabContent.appendChild(blockedContentSection);
    const blockedContentLabel = document.createElement('div');
    blockedContentLabel.textContent = 'Block Content Containing:';
    blockedContentLabel.style.cssText = `color: ${state.uiAccentColor}; font-weight: 600; margin-bottom: 8px;`;
    blockedContentSection.appendChild(blockedContentLabel);

    const blockedKeywordInput = document.createElement('input');
    blockedKeywordInput.type = 'text';
    blockedKeywordInput.placeholder = 'Enter keyword or username';
    blockedKeywordInput.style.cssText = `width: calc(100% - 70px); padding: 8px; margin-right: 5px; border-radius: 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 13px;`;
    blockedContentSection.appendChild(blockedKeywordInput);

    const addBlockedKeywordBtn = createButton('Add', () => {
        const keyword = blockedKeywordInput.value.trim();
        if (keyword && !state.blockedContentKeywords.includes(keyword)) {
            state.blockedContentKeywords.push(keyword);
            saveSettings(); renderBlockedKeywordList(); blockedKeywordInput.value = '';
            if(mainObserver && document.documentElement) { mainObserver.disconnect(); mainObserver.observe(document.documentElement, { childList: true, subtree: true });}
        }
    }, '#4CAF50', 'padding: 8px 12px; font-size: 13px;');
    blockedContentSection.appendChild(addBlockedKeywordBtn);

    const blockedKeywordListDiv = document.createElement('div');
    blockedKeywordListDiv.style.cssText = 'margin-top: 10px; max-height: 100px; overflow-y: auto; border: 1px solid #444; border-radius: 5px; padding: 5px; background-color: #2a2a2a;';
    blockedContentSection.appendChild(blockedKeywordListDiv);

    const renderBlockedKeywordList = () => {
        blockedKeywordListDiv.innerHTML = '';
        if (state.blockedContentKeywords.length === 0) {
            blockedKeywordListDiv.textContent = 'No keywords added.';
            blockedKeywordListDiv.style.color = '#888'; blockedKeywordListDiv.style.textAlign = 'center'; blockedKeywordListDiv.style.padding = '15px';
        } else {
            blockedKeywordListDiv.style.color = ''; blockedKeywordListDiv.style.textAlign = ''; blockedKeywordListDiv.style.padding = '5px';
            state.blockedContentKeywords.forEach(keyword => {
                const keywordItem = document.createElement('div');
                keywordItem.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; background-color: #3a3a3a; border-radius: 4px; margin-bottom: 3px; font-size: 13px;`;
                keywordItem.textContent = keyword;
                const removeBtn = createButton('x', () => {
                    state.blockedContentKeywords = state.blockedContentKeywords.filter(k => k !== keyword);
                    saveSettings(); renderBlockedKeywordList();
                    if(mainObserver && document.documentElement) { mainObserver.disconnect(); mainObserver.observe(document.documentElement, { childList: true, subtree: true });}
                }, '#f44336', `font-size: 10px; width: 18px; height: 18px; padding: 0; display: flex; align-items: center; justify-content: center;`);
                keywordItem.appendChild(removeBtn);
                blockedKeywordListDiv.appendChild(keywordItem);
            });
        }
    };
    renderBlockedKeywordList();


    // --- Populate Advanced Tab ---
    createToggle('Hide Specific UI Elements (CSS)', 'enableElementHiding', advancedTabContent, (checked) => {
        elementHidingSection.style.display = checked ? 'block' : 'none';
    });
    const elementHidingSection = document.createElement('div');
    elementHidingSection.style.cssText = `margin-top: 15px; padding-top: 10px; border-top: 1px solid #444; display: ${state.enableElementHiding ? 'block' : 'none'};`;
    advancedTabContent.appendChild(elementHidingSection);
    const elementHidingLabel = document.createElement('div');
    elementHidingLabel.textContent = 'CSS Selectors to Hide (comma-separated):';
    elementHidingLabel.style.cssText = `color: ${state.uiAccentColor}; font-weight: 600; margin-bottom: 8px;`;
    elementHidingSection.appendChild(elementHidingLabel);
    const elementsToHideTextarea = document.createElement('textarea');
    elementsToHideTextarea.value = state.elementsToHideSelectors;
    elementsToHideTextarea.placeholder = 'e.g., .some-class, #some-id, div[data-testid="xyz"]';
    elementsToHideTextarea.style.cssText = `width: calc(100% - 10px); height: 80px; padding: 5px; border-radius: 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 12px; resize: vertical;`;
    elementsToHideTextarea.oninput = () => { state.elementsToHideSelectors = elementsToHideTextarea.value.trim(); saveSettings(); applyBehaviors(); };
    elementHidingSection.appendChild(elementsToHideTextarea);


    createToggle('Enable Custom CSS (Experimental)', 'enableCustomCss', advancedTabContent, (checked) => {
        customCssSection.style.display = checked ? 'block' : 'none';
    });
    const customCssSection = document.createElement('div');
    customCssSection.style.cssText = `margin-top: 15px; padding-top: 10px; border-top: 1px solid #444; display: ${state.enableCustomCss ? 'block' : 'none'};`;
    advancedTabContent.appendChild(customCssSection);
    const customCssLabel = document.createElement('div');
    customCssLabel.textContent = 'Custom CSS:';
    customCssLabel.style.cssText = `color: ${state.uiAccentColor}; font-weight: 600; margin-bottom: 8px;`;
    customCssSection.appendChild(customCssLabel);
    const customCssTextarea = document.createElement('textarea');
    customCssTextarea.value = state.customCss;
    customCssTextarea.placeholder = '/* Enter your custom CSS here */\n.some-element { background-color: red; }';
    customCssTextarea.style.cssText = `width: calc(100% - 10px); height: 100px; padding: 5px; border-radius: 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 12px; resize: vertical;`;
    customCssTextarea.oninput = () => { state.customCss = customCssTextarea.value; saveSettings(); applyBehaviors(); };
    customCssSection.appendChild(customCssTextarea);

    const accentColorContainer = document.createElement('div');
    accentColorContainer.style.cssText = `margin-top: 15px; padding-top: 10px; border-top: 1px solid #444; display: flex; align-items: center; gap: 10px;`;
    advancedTabContent.appendChild(accentColorContainer);
    const accentColorLabel = document.createElement('label');
    accentColorLabel.textContent = 'UI Accent Color:';
    accentColorLabel.style.cssText = `color: ${state.uiAccentColor}; font-weight: 600;`;
    accentColorContainer.appendChild(accentColorLabel);
    const accentColorInput = document.createElement('input');
    accentColorInput.type = 'color';
    accentColorInput.value = state.uiAccentColor;
    accentColorInput.style.cssText = `width: 40px; height: 30px; border: 1px solid #555; border-radius: 5px; cursor: pointer; background: none; padding: 0;`;
    accentColorInput.oninput = () => {
        state.uiAccentColor = accentColorInput.value;
        saveSettings();
        if(title) title.style.color = state.uiAccentColor;
        if(minMaxBtn) minMaxBtn.style.color = state.uiAccentColor;
        if(tabNav) tabNav.querySelectorAll('button').forEach(btn => {
            if (btn.id === `tab-btn-${state.activeTab}`) btn.style.borderBottom = `2px solid ${state.uiAccentColor}`;
        });
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.style.accentColor = state.uiAccentColor);
        if(specificUsersLabel) specificUsersLabel.style.color = state.uiAccentColor;
        if(customCssLabel) customCssLabel.style.color = state.uiAccentColor;
        if(accentColorLabel) accentColorLabel.style.color = state.uiAccentColor;
        if(blockedContentLabel) blockedContentLabel.style.color = state.uiAccentColor;
        if(customChatBackgroundLabel) customChatBackgroundLabel.style.color = state.uiAccentColor;
        if(clearUserMediaLabel) clearUserMediaLabel.style.color = state.uiAccentColor;
        if(exportChatsLabel) exportChatsLabel.style.color = state.uiAccentColor;
        if(clearUserChatLabel) clearUserChatLabel.style.color = state.uiAccentColor;
        if(elementHidingLabel) elementHidingLabel.style.color = state.uiAccentColor;
    };
    accentColorContainer.appendChild(accentColorInput);

    const hotkeysSection = document.createElement('div');
    hotkeysSection.style.cssText = `margin-top: 15px; padding-top: 10px; border-top: 1px solid #444;`;
    advancedTabContent.appendChild(hotkeysSection);
    createToggle('Enable Custom Hotkeys', 'enableHotkeys', hotkeysSection, (checked) => {
        hotkeyInputsContainer.style.display = checked ? 'block' : 'none';
    });
    const hotkeyInputsContainer = document.createElement('div');
    hotkeyInputsContainer.style.cssText = `margin-top: 10px; display: ${state.enableHotkeys ? 'block' : 'none'};`;
    hotkeysSection.appendChild(hotkeyInputsContainer);
    createHotkeyInput('Toggle Panel:', 'hotkeyTogglePanel', hotkeyInputsContainer);
    createHotkeyInput('Next Story/Snap:', 'hotkeyNextStory', hotkeyInputsContainer);
    createHotkeyInput('Previous Story/Snap:', 'hotkeyPreviousStory', hotkeyInputsContainer);

    const createButtonsContainer = () => {
        const div = document.createElement('div');
        div.style.cssText = `margin-top: 18px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #444; padding-top: 12px;`;
        return div;
    };
    const mediaButtonsDiv = createButtonsContainer();
    mediaTabContent.appendChild(mediaButtonsDiv);
    const chatsButtonsDiv = createButtonsContainer();
    chatsTabContent.appendChild(chatsButtonsDiv);

    mediaButtonsDiv.appendChild(createButton('View Saved Media', () => {
        try {
            const win = currentWindow.open('', 'SnapEnhance - Saved Media', 'width=800,height=600,scrollbars=yes,resizable=yes');
            if (!win) { showMessageBox('Popup blocked! Please allow popups for this site.', 'error'); return; }
            const mediaData = Array.from(savedMediaStore.values());
            const generateMediaContentFunctionString = `
            const generateContent = (data, sortBy, sortOrder) => {
                data.sort((a, b) => {
                    const valA = sortBy === 'timestamp' ? a.timestamp : (a[sortBy] || '').toLowerCase();
                    const valB = sortBy === 'timestamp' ? b.timestamp : (b[sortBy] || '').toLowerCase();
                    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                    return 0;
                });
                let html = '';
                if (data.length === 0) html = '<p class="no-content">No media saved yet.</p>';
                else data.forEach(item => {
                    const fileName = item.src.split('/').pop().split('?')[0];
                    let mediaTag = '';
                    if (item.src.match(/\.(jpeg|jpg|gif|png|webp)$/i)) mediaTag = \`<img src="\${item.src}" alt="\${fileName}" loading="lazy">\`;
                    else if (item.src.match(/\.(mp4|webm|ogg)$/i)) mediaTag = \`<video src="\${item.src}" controls loading="lazy"></video>\`;
                    else if (item.src.match(/\.(mp3|wav|aac)$/i)) mediaTag = \`<audio src="\${item.src}" controls loading="lazy"></audio>\`;
                    const date = new Date(item.timestamp).toLocaleString();
                    html += \`<li><div class="media-info"><a href="\${item.src}" target="_blank" rel="noopener noreferrer">\${fileName}</a><span class="media-meta">\${item.sender !== 'unknown' ? \`From: <strong>\${item.sender}</strong> | \` : ''}Type: <strong>\${item.type}</strong> | Saved: <span class="timestamp">\${date}</span></span></div>\${mediaTag}</li>\`;
                });
                return \`<ul>\${html}</ul>\`;
            };`;
            win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SnapEnhance - Saved Media</title><style>body{font-family:'Inter',sans-serif;background-color:#222;color:#eee;padding:20px;margin:0}h2{color:${state.uiAccentColor};margin-bottom:20px;border-bottom:1px solid #444;padding-bottom:10px}.controls{margin-bottom:20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.controls label{margin-right:5px;color:#c0c0c0}.controls select,.controls button{padding:8px 12px;border-radius:5px;border:1px solid #555;background-color:#333;color:#eee;font-size:14px;cursor:pointer}.controls select:focus,.controls button:focus{outline:none;border-color:${state.uiAccentColor}}.controls button{background-color:#007bff;border-color:#007bff}.controls button:hover{background-color:${darkenColor('#007bff',15)}}ul{list-style-type:none;padding:0}li{margin-bottom:15px;background-color:#333;padding:15px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;flex-direction:column;align-items:flex-start}.media-info{width:100%;margin-bottom:10px}.media-meta{font-size:0.9em;color:#aaa;margin-top:5px;display:block}.media-meta strong{color:#fff}a{color:#4CAF50;text-decoration:none;word-break:break-all;font-weight:500}a:hover{text-decoration:underline}img,video,audio{max-width:100%;height:auto;display:block;margin-top:10px;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.3);background-color:#000}video,audio{width:100%}.no-content{color:#aaa;text-align:center;padding:50px}</style></head><body><h2>Saved Media (${savedMediaStore.size} items)</h2><div class="controls"><label for="sort-by">Sort By:</label><select id="sort-by"><option value="timestamp">Date Saved</option><option value="filename">Filename</option><option value="sender">Sender</option><option value="type">Type</option></select><label for="sort-order">Order:</label><select id="sort-order"><option value="desc">Descending</option><option value="asc">Ascending</option></select><button id="download-all-media-btn">Download All</button></div><div id="media-list-container"></div><script>${generateMediaContentFunctionString} const mediaData=${JSON.stringify(mediaData)};const mediaListContainer=document.getElementById('media-list-container');const sortBySelect=document.getElementById('sort-by');const sortOrderSelect=document.getElementById('sort-order');const downloadAllBtn=document.getElementById('download-all-media-btn');const updateMediaList=()=>{const sortBy=sortBySelect.value;const sortOrder=sortOrderSelect.value;mediaListContainer.innerHTML=generateContent(mediaData,sortBy,sortOrder);};updateMediaList();sortBySelect.addEventListener('change',updateMediaList);sortOrderSelect.addEventListener('change',updateMediaList);downloadAllBtn.addEventListener('click',()=>{if(confirm("This will attempt to download all media items. Proceed?")){mediaData.forEach(item=>{const a=document.createElement('a');a.href=item.src;a.download=item.src.split('/').pop().split('?')[0];document.body.appendChild(a);a.click();document.body.removeChild(a);});}});<\/script></body></html>`);
            win.document.close();
        } catch (error) {
            console.error('[SnapEnhance] Error opening saved media window:', error);
            showMessageBox('Could not open saved media window. Check console.', 'error');
        }
    }));

    mediaButtonsDiv.appendChild(createButton('Clear Saved Media', () => {
        showMessageBox('Are you sure you want to clear ALL saved media? This cannot be undone.', 'info', () => {
            savedMediaStore.clear();
            try {
                localStorage.removeItem('snapenhance_media');
                showMessageBox('Saved media cleared!', 'success');
            } catch (e) {
                console.error('[SnapEnhance] Error clearing saved media from localStorage:', e);
                showMessageBox('Error clearing media from storage.', 'error');
            }
        }, true);
    }, '#f44336'));

    chatsButtonsDiv.appendChild(createButton('View Saved Chats', () => {
        try {
            const win = currentWindow.open('', 'SnapEnhance - Saved Chats', 'width=800,height=600,scrollbars=yes,resizable=yes');
            if (!win) { showMessageBox('Popup blocked! Please allow popups for this site.', 'error'); return; }
            win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SnapEnhance - Saved Chats</title><style>body{font-family:'Inter',sans-serif;background-color:#222;color:#eee;padding:20px;margin:0}h2{color:${state.uiAccentColor};margin-bottom:20px;border-bottom:1px solid #444;padding-bottom:10px}h3{color:#4CAF50;margin-top:25px;border-bottom:1px solid #555;padding-bottom:5px;font-size:1.2em}ul{list-style-type:none;padding:0}li{margin-bottom:8px;background-color:#333;padding:10px;border-radius:6px;word-break:break-word;box-shadow:0 1px 3px rgba(0,0,0,0.2)}.timestamp{color:#aaa;font-size:0.9em;margin-right:8px;font-weight:300}.no-content{color:#aaa;text-align:center;padding:50px}</style></head><body><h2>Saved Chats</h2>`);
            const chatUsers = Object.keys(savedChatStore).sort();
            if (chatUsers.length === 0) win.document.write('<p class="no-content">No chats saved yet.</p>');
            else chatUsers.forEach(user => {
                win.document.write(`<h3>${user}</h3><ul>`);
                savedChatStore[user].forEach(msg => {
                    const date = new Date(msg.timestamp).toLocaleString();
                    const escapedMessage = msg.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    win.document.write(`<li><span class="timestamp">[${date}]</span> ${escapedMessage}</li>`);
                });
                win.document.write('</ul>');
            });
            win.document.write('</body></html>');
            win.document.close();
        } catch (error) {
            console.error('[SnapEnhance] Error opening saved chats window:', error);
            showMessageBox('Could not open saved chats window. Check console.', 'error');
        }
    }));

    chatsButtonsDiv.appendChild(createButton('Clear Saved Chats', () => {
        showMessageBox('Are you sure you want to clear ALL saved chats? This cannot be undone.', 'info', () => {
            savedChatStore = {};
            try {
                localStorage.removeItem('snapenhance_chats');
                showMessageBox('Saved chats cleared!', 'success');
            } catch (e) {
                console.error('[SnapEnhance] Error clearing saved chats from localStorage:', e);
                showMessageBox('Error clearing chats from storage.', 'error');
            }
        }, true);
    }, '#f44336'));


    let isDragging = false;
    let dragStartX, dragStartY;
    if(header) {
        header.addEventListener('mousedown', e => {
            if (e.button === 0) {
                isDragging = true;
                dragStartX = e.clientX - panel.offsetLeft;
                dragStartY = e.clientY - panel.offsetTop;
                panel.style.cursor = 'grabbing';
                if(document.body) {
                    document.body.style.userSelect = 'none';
                    document.body.style.cursor = 'grabbing';
                }
            }
        });
    }

    currentWindow.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            panel.style.cursor = 'grab';
            if(document.body) {
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
            }
            state.panelPosition.top = panel.style.top;
            state.panelPosition.left = panel.style.left;
            saveSettings();
        }
    });

    currentWindow.addEventListener('mousemove', e => {
        if (!isDragging) return;
        let newX = e.clientX - dragStartX;
        let newY = e.clientY - dragStartY;
        newX = Math.max(0, Math.min(currentWindow.innerWidth - panel.offsetWidth, newX));
        newY = Math.max(0, Math.min(currentWindow.innerHeight - panel.offsetHeight, newY));
        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
    });

    if(minMaxBtn) {
        minMaxBtn.onclick = () => {
            const isMinimized = tabContentContainer.style.display === 'none';
            if (isMinimized) {
                tabContentContainer.style.display = 'block';
                tabNav.style.display = 'flex';
                minMaxBtn.textContent = '−';
                panel.style.minWidth = '280px';
                panel.style.height = '';
                panel.style.overflow = 'auto';
            } else {
                tabContentContainer.style.display = 'none';
                tabNav.style.display = 'none';
                minMaxBtn.textContent = '+';
                panel.style.minWidth = '280px';
                panel.style.height = 'auto';
                panel.style.overflow = 'hidden';
            }
        };
    }

    const appendPanel = () => {
        if (document.body) {
            document.body.appendChild(panel);
            applyBehaviors();
            hookMediaElements();
            observeMessages();
            showTab(state.activeTab);
            if (tabContentContainer.style.display === 'none' && minMaxBtn) {
                 minMaxBtn.textContent = '+';
                 panel.style.overflow = 'hidden';
            } else if (minMaxBtn) {
                 minMaxBtn.textContent = '−';
                 panel.style.overflow = 'auto';
            }

        } else {
            setTimeout(appendPanel, 100);
        }
    };
    appendPanel();

})(unsafeWindow || window);
