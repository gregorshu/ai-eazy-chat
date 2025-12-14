// Constants
const CONFIG = {
  // Timing
  SAVE_STATE_DEBOUNCE_MS: 300,
  BLOCK_EDIT_DEBOUNCE_MS: 500,
  FOCUS_DELAY_MS: 100,
  ANIMATION_DELAY_MS: 50,
  DEFAULT_TOAST_TIMEOUT_MS: 2200,
  ERROR_TOAST_TIMEOUT_MS: 5000,
  INFO_TOAST_TIMEOUT_MS: 3000,
  
  // Retry configuration
  RETRY_DELAYS_MS: [3000, 5000, 7000],
  RATE_LIMIT_STATUS: 429,
  
  // Limits
  MAX_CHATS_TO_KEEP: 50,
  ERROR_MESSAGE_PREVIEW_LENGTH: 100,
  ERROR_RESPONSE_PREVIEW_LENGTH: 500,
  
  // Storage
  STATE_KEY: 'ai-eazy-chat-state',
};

const stateKey = CONFIG.STATE_KEY;
const appShell = document.querySelector('.app-shell');
const sidebar = document.querySelector('.sidebar');
const messageContainer = document.getElementById('messages');
const folderList = document.getElementById('folder-list');
const promptInput = document.getElementById('prompt');
const sendButton = document.getElementById('send');
const cancelButton = document.getElementById('cancel');
const expandTextareaButton = document.getElementById('expand-textarea');
const textareaWrapper = document.querySelector('.textarea-wrapper');
const newChatButton = document.getElementById('new-chat');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const toast = document.getElementById('toast');
const newFolderButton = document.getElementById('new-folder');
const toggleSidebarButton = document.getElementById('sidebar-toggle');
const settingsButton = document.getElementById('settings-button');
const folderOverlay = document.getElementById('folder-overlay');
const folderNameInput = document.getElementById('folder-name-input');
const createFolderButton = document.getElementById('create-folder');
const cancelFolderButton = document.getElementById('cancel-folder');
const closeFolderButton = document.getElementById('close-folder');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsModelInput = document.getElementById('settings-model');
const settingsApiKeyInput = document.getElementById('settings-api-key');
const tabModelButton = document.getElementById('tab-model');
const tabPersonaButton = document.getElementById('tab-persona');
const tabThemeButton = document.getElementById('tab-theme');
const tabPanelModel = document.getElementById('tab-panel-model');
const tabPanelPersona = document.getElementById('tab-panel-persona');
const tabPanelTheme = document.getElementById('tab-panel-theme');
const themeModeDarkButton = document.getElementById('theme-mode-dark');
const themeModeLightButton = document.getElementById('theme-mode-light');
const themeHueInput = document.getElementById('theme-hue');
const themeHueValue = document.querySelector('.theme-hue-value');
const themeHueIndicator = document.querySelector('.theme-hue-indicator');
const personasList = document.getElementById('personas-list');
const addPersonaButton = document.getElementById('add-persona-button');
const personaModal = document.getElementById('persona-modal');
const personaModalTitle = document.getElementById('persona-modal-title');
const personaNameInput = document.getElementById('persona-name-input');
const personaContentInput = document.getElementById('persona-content-input');
const savePersonaButton = document.getElementById('save-persona');
const cancelPersonaButton = document.getElementById('cancel-persona');
const closePersonaModalButton = document.getElementById('close-persona-modal');
const modelDropdown = document.getElementById('model-dropdown');
const modelToggleButton = document.getElementById('model-toggle');
// Canvas elements - may be null if HTML hasn't loaded yet, handled with null checks
const canvasButton = document.getElementById('canvas-button');
const canvasListOverlay = document.getElementById('canvas-list-overlay');
const canvasOverlay = document.getElementById('canvas-overlay');
const closeCanvasListButton = document.getElementById('close-canvas-list');
const newCanvasButton = document.getElementById('new-canvas-button');
const closeCanvasButton = document.getElementById('close-canvas');
const canvasNameInput = document.getElementById('canvas-name-input');
const canvasNewBlockButton = document.getElementById('canvas-new-block');
const canvasAiEditButton = document.getElementById('canvas-ai-edit');
const canvasListFromCanvasButton = document.getElementById('canvas-list-from-canvas');
const canvasSelectAllButton = document.getElementById('canvas-select-all');
const canvasDeselectAllButton = document.getElementById('canvas-deselect-all');
const canvasCopyAllButton = document.getElementById('canvas-copy-all');
const canvasUndoButton = document.getElementById('canvas-undo');
const canvasRedoButton = document.getElementById('canvas-redo');
const canvasAiEditOverlay = document.getElementById('canvas-ai-edit-overlay');
const closeCanvasAiEditButton = document.getElementById('close-canvas-ai-edit');
const cancelCanvasAiEditButton = document.getElementById('cancel-canvas-ai-edit');
const applyCanvasAiEditButton = document.getElementById('apply-canvas-ai-edit');
const canvasAiInstructionInput = document.getElementById('canvas-ai-instruction');
const canvasDeleteBlockOverlay = document.getElementById('canvas-delete-block-overlay');
const closeCanvasDeleteBlockButton = document.getElementById('close-canvas-delete-block');
const cancelCanvasDeleteBlockButton = document.getElementById('cancel-canvas-delete-block');
const confirmCanvasDeleteBlockButton = document.getElementById('confirm-canvas-delete-block');
const modelSearchInput = document.getElementById('model-search');
const modelList = document.getElementById('model-list');
const refreshModelsButton = document.getElementById('refresh-models');
const closeSettingsButtons = [
  document.getElementById('close-settings'),
  document.getElementById('close-settings-cta'),
];
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmContext = document.getElementById('confirm-context');
const confirmAction = document.getElementById('confirm-action');
const cancelConfirmButton = document.getElementById('cancel-confirm');
const closeConfirmButton = document.getElementById('close-confirm');
let openChatMenuId = null;
const retryDelays = CONFIG.RETRY_DELAYS_MS;
let activeAbortController = null;
let isRequestPending = false;
let wasFolderModalOpen = false;
let activeConfirmHandler = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function uuid() {
  return crypto.randomUUID();
}

let saveStateTimeout = null;

// DOM batching queue for requestAnimationFrame batching
let domUpdateQueue = [];
let rafScheduled = false;

// Batch DOM updates using requestAnimationFrame
// This batches multiple DOM updates into a single frame for better performance
function batchDOMUpdate(callback) {
  domUpdateQueue.push(callback);
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(() => {
      // Execute all queued updates
      const queue = domUpdateQueue.slice();
      domUpdateQueue = [];
      rafScheduled = false;
      
      // Execute all callbacks
      queue.forEach(cb => cb());
    });
  }
}

// Memoization cache
const memoCache = new Map();

// Memoization helper function
function memoize(key, computeFn, dependencies = []) {
  // Create cache key from function name and dependencies
  const cacheKey = `${key}_${JSON.stringify(dependencies)}`;
  
  // Check if we have a cached value
  if (memoCache.has(cacheKey)) {
    return memoCache.get(cacheKey);
  }
  
  // Compute and cache the value
  const result = computeFn();
  memoCache.set(cacheKey, result);
  return result;
}

// Clear memoization cache when state changes
function clearMemoCache(pattern = null) {
  if (pattern) {
    // Clear only entries matching pattern
    for (const key of memoCache.keys()) {
      if (key.startsWith(pattern)) {
        memoCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    memoCache.clear();
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(stateKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse state', e);
    if (e.name === 'QuotaExceededError' || e.name === 'SecurityError') {
      console.warn('LocalStorage access denied or quota exceeded');
    }
    return null;
  }
}

function saveState(state) {
  clearTimeout(saveStateTimeout);
  saveStateTimeout = setTimeout(() => {
    try {
      localStorage.setItem(stateKey, JSON.stringify(state));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded');
        toastMessage('Storage limit reached. Some data may not be saved. Consider clearing old chats.', CONFIG.ERROR_TOAST_TIMEOUT_MS);
        // Attempt to clean up old data (optional - can be enhanced later)
        try {
          // Remove very old chats or large canvases
          const cleanedState = { ...state };
          // Keep only last N chats
          if (cleanedState.chats && cleanedState.chats.length > CONFIG.MAX_CHATS_TO_KEEP) {
            cleanedState.chats = cleanedState.chats.slice(-CONFIG.MAX_CHATS_TO_KEEP);
            localStorage.setItem(stateKey, JSON.stringify(cleanedState));
            toastMessage('Cleaned up old data. Please try again.', CONFIG.INFO_TOAST_TIMEOUT_MS);
          }
        } catch (cleanupError) {
          console.error('Cleanup failed:', cleanupError);
        }
      } else if (e.name === 'SecurityError' || e.name === 'TypeError') {
        console.warn('LocalStorage not available:', e);
        // localStorage might be disabled - continue without saving
      } else {
        console.error('Failed to save state:', e);
        toastMessage('Failed to save state. Changes may be lost on refresh.', CONFIG.ERROR_TOAST_TIMEOUT_MS);
      }
    }
  }, CONFIG.SAVE_STATE_DEBOUNCE_MS);
}

// Ensure final save happens on page unload
window.addEventListener('beforeunload', () => {
  if (saveStateTimeout) {
    clearTimeout(saveStateTimeout);
    try {
      localStorage.setItem(stateKey, JSON.stringify(appState));
    } catch (e) {
      console.error('Failed to save state on unload:', e);
    }
  }
});

const defaultModelOptions = [
  'openrouter/auto',
  'anthropic/claude-3-sonnet',
  'openai/gpt-4o-mini',
];

const defaultState = () => {
  const defaultFolder = { id: 'root', name: 'Unsorted' };
  const chatId = uuid();
  const defaultPersonaId = uuid();
  const defaultPersona = {
    id: defaultPersonaId,
    name: 'Default Assistant',
    content: 'You are a helpful AI-assistant.',
    isDefault: true,
  };
  return {
    folders: [defaultFolder],
    chats: [
      {
        id: chatId,
        name: 'New chat',
        folderId: 'root',
        files: [],
        messages: [],
        canvases: [],
      },
    ],
    editingChatId: null,
    editingChatDraft: '',
    editingFolderId: null,
    editingFolderDraft: '',
    editingMessageChatId: null,
    editingMessageIndex: null,
    editingMessageDraft: '',
    newFolderModalOpen: false,
    newFolderDraft: '',
    selectedChatId: chatId,
    selectedFolderId: defaultFolder.id,
    sidebarHidden: false,
    expandedFolders: { root: true },
    textareaExpanded: false,
    personas: [defaultPersona],
    editingPersonaId: null,
    editingPersonaDraft: { name: '', content: '' },
    newPersonaModalOpen: false,
    newPersonaDraft: { name: '', content: '' },
    settings: { activePersonaId: defaultPersonaId, model: 'openrouter/auto', apiKey: '' },
    modelOptions: defaultModelOptions,
    modelOptionsLoading: false,
    modelDropdownOpen: false,
    modelSearch: '',
    activeSettingsTab: 'model',
    theme: { mode: 'dark', hue: 160 },
    openCanvasId: null,
    openCanvasChatId: null,
    canvasModalOpen: false,
    canvasListModalOpen: false,
    selectedBlockIds: [],
    canvasAiEditDraft: '',
    canvasAiEditSelection: null,
    pendingDeleteBlock: null,
    pendingCanvasPatches: null,
  };
};

const storedState = loadState();
const baseDefaults = defaultState();

// Migrate old persona format to new personas array
let personas = baseDefaults.personas;
let activePersonaId = baseDefaults.settings.activePersonaId;

if (storedState) {
  // If personas array exists, use it
  if (storedState.personas && Array.isArray(storedState.personas) && storedState.personas.length > 0) {
    personas = storedState.personas;
    // Ensure default persona has isDefault flag
    personas = personas.map((p, index) => {
      if (index === 0 && !p.isDefault && p.name === 'Default Assistant' && p.content === 'You are a helpful AI-assistant.') {
        return { ...p, isDefault: true };
      }
      return p;
    });
    activePersonaId = storedState.settings?.activePersonaId || personas[0].id;
  } else if (storedState.settings?.persona) {
    // Migrate old persona string to new format
    const oldPersonaId = uuid();
    personas = [
      {
        id: oldPersonaId,
        name: 'Custom Persona',
        content: storedState.settings.persona,
      },
    ];
    activePersonaId = oldPersonaId;
  }
}

const fallbackSettings =
  storedState?.settings || {
    activePersonaId: activePersonaId,
    model: storedState?.chats?.[0]?.model || 'openrouter/auto',
    apiKey: '',
  };

let appState = storedState
  ? {
      ...baseDefaults,
      ...storedState,
      sidebarHidden: storedState.sidebarHidden ?? false,
      expandedFolders: { root: true, ...(storedState.expandedFolders || {}) },
      textareaExpanded: storedState.textareaExpanded || false,
      editingChatId: null,
      editingChatDraft: '',
      editingFolderId: null,
      editingFolderDraft: '',
      editingMessageChatId: null,
      editingMessageIndex: null,
      editingMessageDraft: '',
      newFolderModalOpen: false,
      newFolderDraft: '',
      personas: personas,
      editingPersonaId: null,
      editingPersonaDraft: { name: '', content: '' },
      newPersonaModalOpen: false,
      newPersonaDraft: { name: '', content: '' },
      modelOptions: storedState.modelOptions || defaultModelOptions,
      modelOptionsLoading: false,
      modelDropdownOpen: storedState.modelDropdownOpen || false,
      modelSearch: storedState.modelSearch || '',
      activeSettingsTab: storedState.activeSettingsTab || 'model',
      settings: { ...baseDefaults.settings, ...fallbackSettings, activePersonaId: activePersonaId },
      theme: storedState.theme || baseDefaults.theme,
      openCanvasId: storedState.openCanvasId || null,
      openCanvasChatId: storedState.openCanvasChatId || null,
      canvasModalOpen: storedState.canvasModalOpen || false,
      canvasListModalOpen: storedState.canvasListModalOpen || false,
      selectedBlockIds: Array.isArray(storedState.selectedBlockIds) ? storedState.selectedBlockIds : [],
      canvasAiEditDraft: storedState.canvasAiEditDraft || '',
      canvasAiEditSelection: storedState.canvasAiEditSelection || null,
      pendingDeleteBlock: null,
      pendingCanvasPatches: null,
    }
  : baseDefaults;

// Ensure all chats have canvases array initialized (after appState is set)
try {
  if (appState.chats && Array.isArray(appState.chats)) {
    let needsUpdate = false;
    appState.chats = appState.chats.map(chat => {
      if (!chat.canvases) {
        needsUpdate = true;
        return { ...chat, canvases: [] };
      }
      return chat;
    });
    // Only save if we actually modified something
    if (needsUpdate) {
      saveState(appState);
    }
  }
} catch (err) {
  console.error('Error initializing canvas arrays:', err);
  // Don't break the app if canvas initialization fails
}

if (!appState.settings.model) {
  appState = {
    ...appState,
    settings: { ...appState.settings, model: 'openrouter/auto' },
  };
  saveState(appState);
}

// Ensure activePersonaId exists in personas array
if (appState.personas.length > 0) {
  const personaMap = buildPersonaMap();
  if (!personaMap.has(appState.settings.activePersonaId)) {
    appState.settings.activePersonaId = appState.personas[0].id;
    saveState(appState);
  }
}

// Track previous state for change detection
let prevState = null;

function setState(update) {
  prevState = { ...appState };
  appState = { ...appState, ...update };
  saveState(appState);
  
  // Clear memoization cache when relevant state changes
  if (update.settings?.activePersonaId !== undefined || 
      update.chats !== undefined || 
      update.personas !== undefined ||
      update.folders !== undefined) {
    clearMemoCache();
  }
  
  // Handle theme changes
  if (update.theme !== undefined) {
    applyTheme(update.theme);
  }
  
  // Handle settings tab changes separately (no need for full render)
  if (update.activeSettingsTab !== undefined) {
    renderSettingsTabs();
    return; // Early return to avoid unnecessary renders
  }
  
  // Handle draft state updates (typing in inputs) - no render needed at all
  const isDraftOnly = (update.newFolderDraft !== undefined || 
                       update.editingFolderDraft !== undefined ||
                       update.newPersonaDraft !== undefined ||
                       update.editingPersonaDraft !== undefined ||
                       update.editingChatDraft !== undefined ||
                       update.editingMessageDraft !== undefined) &&
                      Object.keys(update).every(key => 
                        key === 'newFolderDraft' || 
                        key === 'editingFolderDraft' ||
                        key === 'newPersonaDraft' ||
                        key === 'editingPersonaDraft' ||
                        key === 'editingChatDraft' ||
                        key === 'editingMessageDraft'
                      );
  
  if (isDraftOnly) {
    // Just save state, no render needed for draft updates
    return;
  }
  
  // Handle modal open/close - only update modal visibility, no chat re-render
  const isModalToggle = (update.newFolderModalOpen !== undefined || 
                          update.newPersonaModalOpen !== undefined) &&
                         Object.keys(update).every(key => 
                           key === 'newFolderModalOpen' || 
                           key === 'newPersonaModalOpen' ||
                           key === 'newFolderDraft' ||
                           key === 'newPersonaDraft' ||
                           key === 'editingPersonaDraft'
                         );
  
  if (isModalToggle) {
    // Only update modal visibility
    const folderOverlay = document.getElementById('folder-overlay');
    const personaModal = document.getElementById('persona-modal');
    
    if (update.newFolderModalOpen !== undefined && folderOverlay) {
      folderOverlay.classList.toggle('show', update.newFolderModalOpen);
      if (update.newFolderModalOpen && folderNameInput) {
        folderNameInput.value = update.newFolderDraft || appState.newFolderDraft || '';
        setTimeout(() => folderNameInput.focus(), CONFIG.FOCUS_DELAY_MS);
      }
    }
    
    if (update.newPersonaModalOpen !== undefined && personaModal) {
      personaModal.classList.toggle('show', update.newPersonaModalOpen);
    }
    
    return; // Early return to avoid unnecessary renders
  }
  
  // Handle canvas-related updates - no chat re-render
  const isCanvasUpdate = update.openCanvasId !== undefined ||
                         update.openCanvasChatId !== undefined ||
                         update.canvasModalOpen !== undefined ||
                         update.canvasListModalOpen !== undefined ||
                         update.selectedBlockIds !== undefined;
  
  if (isCanvasUpdate) {
    // Only update canvas UI, no chat re-render
    if (update.canvasModalOpen !== undefined || update.openCanvasId !== undefined) {
      renderCanvas();
    }
    if (update.canvasListModalOpen !== undefined) {
      renderCanvasList();
    }
    return; // Early return to avoid unnecessary renders
  }
  
  // Handle model-related updates separately (no need for full render)
  const isModelSearchOnly = update.modelSearch !== undefined && 
                            Object.keys(update).length === 1;
  const isModelDropdownToggle = update.modelDropdownOpen !== undefined && 
                                Object.keys(update).length === 1;
  const isModelSelection = update.settings !== undefined && 
                            update.settings.model !== undefined && 
                            update.modelDropdownOpen === false;
  // Handle typing in model input (updates both settings.model and modelSearch)
  const isModelInputTyping = update.settings !== undefined && 
                             update.settings.model !== undefined && 
                             update.modelSearch !== undefined &&
                             update.modelDropdownOpen === undefined;
  
  if (isModelSearchOnly || isModelDropdownToggle || isModelSelection || isModelInputTyping) {
    // Only update model dropdown UI, no full render
    if (isModelSelection && settingsModelInput) {
      settingsModelInput.value = update.settings.model;
    }
    renderModelOptions();
    return; // Early return to avoid unnecessary renders
  }
  
  // Determine if we need full render or can use granular updates
  const needsFullRender = 
    update.folders !== undefined ||
    update.chats !== undefined ||
    update.sidebarHidden !== undefined ||
    update.textareaExpanded !== undefined ||
    (update.settings !== undefined && !isModelSelection && !isModelInputTyping) ||
    update.modelOptions !== undefined;
  
  if (needsFullRender) {
  render();
  } else {
    // Use granular updates for sidebar state changes
    syncSidebarState(prevState, update);
    // Still need to render other parts (messages, files, etc.)
    renderMessages();
    renderFiles();
    renderModelOptions();
    renderPersonas();
  }
}

// Render only the settings tabs UI (no chat re-render)
function renderSettingsTabs() {
  const activeTab = appState.activeSettingsTab || 'model';
  if (tabModelButton) {
    tabModelButton.classList.toggle('active', activeTab === 'model');
  }
  if (tabPersonaButton) {
    tabPersonaButton.classList.toggle('active', activeTab === 'persona');
  }
  if (tabThemeButton) {
    tabThemeButton.classList.toggle('active', activeTab === 'theme');
  }
  if (tabPanelModel) {
    tabPanelModel.classList.toggle('active', activeTab === 'model');
  }
  if (tabPanelPersona) {
    tabPanelPersona.classList.toggle('active', activeTab === 'persona');
  }
  if (tabPanelTheme) {
    tabPanelTheme.classList.toggle('active', activeTab === 'theme');
  }
  
  // Update theme controls if on theme tab
  if (activeTab === 'theme') {
    renderThemeSettings();
  }
}

// Sync sidebar state with granular updates
function syncSidebarState(prevState, update) {
  if (!prevState) return;
  
  // Update selected folder
  if (update.selectedFolderId !== undefined && update.selectedFolderId !== prevState.selectedFolderId) {
    updateFolderActiveState(prevState.selectedFolderId, false);
    updateFolderActiveState(update.selectedFolderId, true);
  }
  
  // Update selected chat
  if (update.selectedChatId !== undefined && update.selectedChatId !== prevState.selectedChatId) {
    updateChatActiveState(prevState.selectedChatId, false);
    updateChatActiveState(update.selectedChatId, true);
  }
  
  // Update expanded folders
  if (update.expandedFolders) {
    Object.keys(update.expandedFolders).forEach(folderId => {
      const newExpanded = update.expandedFolders[folderId] !== false;
      const oldExpanded = prevState.expandedFolders?.[folderId] !== false;
      if (newExpanded !== oldExpanded) {
        updateFolderExpandedState(folderId, newExpanded);
      }
    });
  }
  
  // Update folder editing state
  if (update.editingFolderId !== undefined) {
    if (prevState.editingFolderId) {
      const folderMap = buildFolderMap();
      const prevFolder = folderMap.get(prevState.editingFolderId);
      if (prevFolder) {
        const folderEl = getFolderElement(prevFolder.id);
        updateFolderElement(folderEl, prevFolder);
      }
    }
    if (update.editingFolderId) {
      const folderMap = buildFolderMap();
      const folder = folderMap.get(update.editingFolderId);
      if (folder) {
        const folderEl = getFolderElement(folder.id);
        updateFolderElement(folderEl, folder);
      }
    }
  }
  
  // Update chat editing state
  if (update.editingChatId !== undefined) {
    if (prevState.editingChatId) {
      const chatMap = buildChatMap();
      const prevChat = chatMap.get(prevState.editingChatId);
      if (prevChat) {
        const chatEl = getChatElement(prevChat.id);
        updateChatElement(chatEl, prevChat);
      }
    }
    if (update.editingChatId) {
      const chatMap = buildChatMap();
      const chat = chatMap.get(update.editingChatId);
      if (chat) {
        const chatEl = getChatElement(chat.id);
        updateChatElement(chatEl, chat);
      }
    }
  }
  
  // Update openChatMenuId (handled in menu toggle, but sync if needed)
  if (update.openChatMenuId !== undefined && update.openChatMenuId !== openChatMenuId) {
    // Menu toggle is handled directly in DOM, but we can sync here if needed
    if (prevState.openChatMenuId) {
      const prevChatEl = getChatElement(prevState.openChatMenuId);
      if (prevChatEl) {
        const menu = prevChatEl.querySelector('.chat-menu');
        if (menu) menu.classList.remove('show');
      }
    }
    if (update.openChatMenuId) {
      const chatEl = getChatElement(update.openChatMenuId);
      if (chatEl) {
        const menu = chatEl.querySelector('.chat-menu');
        if (menu) menu.classList.add('show');
      }
    }
    openChatMenuId = update.openChatMenuId;
  }
}

// Helper functions to build Maps for O(1) lookups
function buildChatMap() {
  return new Map(appState.chats.map(c => [c.id, c]));
}

function buildFolderMap() {
  return new Map(appState.folders.map(f => [f.id, f]));
}

function buildPersonaMap() {
  return new Map(appState.personas.map(p => [p.id, p]));
}

function buildCanvasMap(chat) {
  if (!chat || !chat.canvases) return new Map();
  return new Map(chat.canvases.map(c => [c.id, c]));
}

function buildBlockMap(canvas) {
  if (!canvas || !canvas.blocks) return new Map();
  return new Map(canvas.blocks.map(b => [b.id, b]));
}

function getSelectedChat() {
  const chatMap = buildChatMap();
  return chatMap.get(appState.selectedChatId) || appState.chats[0];
}

function getActivePersona() {
  // Memoize based on active persona ID
  return memoize('activePersona', () => {
    const personaMap = buildPersonaMap();
    const activePersona = personaMap.get(appState.settings.activePersonaId);
    return activePersona ? activePersona.content : '';
  }, [appState.settings.activePersonaId]);
}

function getCanvasPersonaInstructions() {
  // Memoize this static instruction string
  return memoize('canvasPersonaInstructions', () => {
    return `You are editing a Canvas document. Canvas is a special editable document feature with the following rules:

1. The document is authoritative - never rewrite the whole thing unless explicitly told to do so.
2. Support partial, targeted edits: operate only on the selected block or text range provided.
3. Accept and apply user's manual edits without interference.
4. When editing, return changes as structured patches (replace/insert/delete) tied to block IDs or selection IDs.
5. Preserve formatting, ordering, sections, and all unselected text exactly as-is.
6. Never perform edits outside the given selection.
7. Provide clean rewrites, expansions, summaries, or transformations only when requested.
8. Be aware of context around the selection but do not rewrite it.
9. Respect document versioning: edit only the current version and do not apply unseen changes.
10. Avoid duplicating entire documents in responses; output only required patches or rewritten snippets.
11. Ensure reversibility: produce atomic, deterministic edits that can be undone.
12. Reject actions when instructions are ambiguous or when required selection metadata is missing.
13. Do not hallucinate content; preserve the factual integrity of the document.

When responding with edits, use this JSON format:
{
  "patches": [
    {
      "type": "replace" | "insert" | "delete",
      "blockId": "block-id-string",
      "oldContent": "original content (for replace/delete) - MUST match EXACTLY character-for-character",
      "newContent": "new content (for replace/insert)",
      "position": number (REQUIRED for text range selections - the start position in the block)
    }
  ]
}

CRITICAL: 
- The "blockId" MUST be the exact ID shown in the context (e.g., "Block 1 (ID: abc123)" means blockId is "abc123")
- The "oldContent" MUST match the current content EXACTLY, including all whitespace, newlines, and characters
- When editing multiple blocks, provide separate patches for each block
- For "replace" type without position: "oldContent" should match the ENTIRE current block content exactly
- For "replace" type with position: "oldContent" must match the exact text at that position
- Always verify blockId exists in the context before creating a patch

IMPORTANT: When editing, you can reference canvases by their names (e.g., "edit Canvas 1" or "update the Canvas named 'My Notes'"). The canvas being edited is marked as "(CURRENT - EDIT THIS ONE)" in the context.

Only include patches for blocks that need to be changed. Do not include patches for unchanged blocks.`;
  }, []);
}

// Canvas command parsing
function parseCanvasCommand(message) {
  const lowerMessage = message.toLowerCase().trim();
  
  // Check for canvas-related keywords
  const canvasKeywords = ['canvas', 'edit canvas', 'edit block', 'add to canvas', 'rewrite selection', 'update canvas'];
  const hasCanvasKeyword = canvasKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (!hasCanvasKeyword) {
    return null;
  }
  
  // Extract block reference if present (e.g., "edit block 2", "block 3")
  const blockMatch = message.match(/block\s+(\d+)/i);
  const blockIndex = blockMatch ? parseInt(blockMatch[1], 10) - 1 : null;
  
  // Check for selection references
  const hasSelection = lowerMessage.includes('selection') || lowerMessage.includes('selected');
  
  return {
    isCanvasCommand: true,
    blockIndex: blockIndex,
    hasSelection: hasSelection,
    command: message,
  };
}

// Save all pending manual edits from DOM to state
function flushPendingCanvasEdits(canvasId) {
  const canvasContent = document.getElementById('canvas-content');
  if (!canvasContent) return;
  
  const canvas = getCanvas(appState.openCanvasChatId, canvasId);
  if (!canvas) return;
  
  // Get all block elements from DOM
  const blockElements = canvasContent.querySelectorAll('.canvas-block[data-block-id]');
  let hasChanges = false;
  
  blockElements.forEach(blockEl => {
    const blockId = blockEl.getAttribute('data-block-id');
    // Use textContent to preserve newlines as \n characters
    const currentContent = blockEl.textContent || '';
    const blockMap = buildBlockMap(canvas);
    const block = blockMap.get(blockId);
    
    if (block && block.content !== currentContent) {
      // Update block content immediately (bypass debounce)
      block.content = currentContent;
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    canvas.updatedAt = Date.now();
    saveState(appState);
  }
}

// AI Edit Handler
async function requestCanvasEdit(canvasId, command) {
  if (!appState.openCanvasChatId || !canvasId) {
    toastMessage('No canvas open');
    return;
  }
  
  const canvas = getCanvas(appState.openCanvasChatId, canvasId);
  if (!canvas) {
    toastMessage('Canvas not found');
    return;
  }
  
  const chat = getSelectedChat();
  if (!chat) {
    toastMessage('No chat selected');
    return;
  }
  
  // Flush any pending manual edits before proceeding
  flushPendingCanvasEdits(canvasId);
  
  // Re-fetch canvas after flushing edits to ensure we have latest state
  const updatedCanvas = getCanvas(appState.openCanvasChatId, canvasId);
  if (!updatedCanvas) {
    toastMessage('Canvas not found after saving edits');
    return;
  }
  
  // Show loading state
  if (canvasAiEditButton) {
    canvasAiEditButton.disabled = true;
    canvasAiEditButton.textContent = 'Editing...';
  }
  
  // Build context for AI (use updated canvas)
  let contextBlocks = [];
  
  // Use selected blocks if any, otherwise use all blocks from current canvas
  if (appState.selectedBlockIds && appState.selectedBlockIds.length > 0) {
    contextBlocks = updatedCanvas.blocks.filter(b => appState.selectedBlockIds.includes(b.id));
  } else {
    // Use all blocks if no selection
    contextBlocks = updatedCanvas.blocks;
  }
  
  // Get all canvases from the chat for full context
  const allCanvases = (chat.canvases || []).filter(c => c && c.blocks && c.blocks.length > 0);
  
  // Build prompt
  const canvasInstructions = getCanvasPersonaInstructions();
  const activePersona = getActivePersona();
  
  // Build canvas context text (all canvases) - but mark selected blocks clearly
  let canvasContextText = '';
  if (allCanvases.length > 0) {
    const canvasSections = allCanvases.map(canvas => {
      const isCurrentCanvas = canvas.id === canvasId;
      const blocksText = canvas.blocks.map((block, idx) => {
        const isSelected = isCurrentCanvas && appState.selectedBlockIds && appState.selectedBlockIds.includes(block.id);
        const selectedMarker = isSelected ? ' ⭐ SELECTED FOR EDITING' : '';
        return `  [Block ${idx + 1}${selectedMarker}]\n  Block ID: "${block.id}"\n  Content:\n  ${block.content}`;
      }).join('\n\n');
      return `=== ${canvas.name}${isCurrentCanvas ? ' (CURRENT - EDIT THIS ONE)' : ''} ===\n${blocksText}`;
    }).join('\n\n');
    canvasContextText = `\n\nAll Canvases in this Chat (for context only):\n${canvasSections}`;
  }
  
  // Build context for the canvas being edited - ONLY selected blocks
  const currentCanvasContext = contextBlocks.map((block, idx) => {
    return `[Block ${idx + 1}]\nBlock ID: "${block.id}"\nContent:\n${block.content}`;
  }).join('\n\n');
  
  // Build user prompt with canvas instructions and context
  // Server will build system prompt from persona + files
  const selectionNote = appState.selectedBlockIds && appState.selectedBlockIds.length > 0
    ? `\n\nCRITICAL: You must ONLY edit the blocks marked with ⭐ SELECTED FOR EDITING above. These are the ONLY blocks you should create patches for. Do not edit any other blocks, even if they appear in the context.`
    : '';
  
  const userPrompt = `${canvasInstructions}\n\nBlocks to Edit (from "${updatedCanvas.name}"):\n${currentCanvasContext}${canvasContextText}${selectionNote}\n\nUser Request: ${command}\n\nPlease provide edits as JSON patches following the format specified in the instructions. ONLY create patches for blocks marked with ⭐ SELECTED FOR EDITING.`;
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: appState.settings.model,
        apiKey: appState.settings.apiKey,
        persona: activePersona,
        files: chat.files || [],
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    
    // Handle streaming or non-streaming response
    const contentType = response.headers.get('content-type') || '';
    const isStream = contentType.includes('text/event-stream');
    
    let content = '';
    
    if (!response.ok) {
      // Try to read error message
      if (isStream) {
        try {
          content = await readEventStream(response, null);
        } catch (e) {
          content = e.responseContent || e.message || 'Streaming error';
        }
      } else {
        try {
          const errorData = await response.json();
          content = errorData.error || errorData.message || response.statusText;
        } catch (e) {
          // If not JSON, try to read as text
          try {
            content = await response.text();
          } catch (e2) {
            content = response.statusText || 'Unknown error';
          }
        }
      }
      throw new Error(`API error (${response.status}): ${content}`);
    }
    
    if (isStream) {
      // Read streaming response
      try {
        content = await readEventStream(response, null);
        // If content is empty or doesn't look like valid AI response, it might be an error
        if (!content || content.trim().length === 0) {
          throw new Error('Empty response from AI');
        }
      } catch (e) {
        // If streaming fails, check if it's an error we created
        if (e.responseContent) {
          throw e;
        }
        // Otherwise, create a new error
        const streamError = new Error('Failed to read stream: ' + (e.message || 'Unknown error'));
        streamError.responseContent = e.responseContent || '';
        throw streamError;
      }
    } else {
      // Read JSON response
      try {
        const data = await response.json();
        content = data.content || '';
        // Check for error in JSON response
        if (data.error) {
          throw new Error(`API error: ${data.error}`);
        }
      } catch (e) {
        // If response is not JSON, try to read as text
        if (e.message && e.message.includes('API error')) {
          throw e; // Re-throw API errors
        }
        try {
          const textContent = await response.text();
          // Store the content for debugging
          const jsonError = new Error('Response is not valid JSON: ' + e.message);
          jsonError.responseContent = textContent;
          throw jsonError;
        } catch (e2) {
          const parseError = new Error('Failed to parse response: ' + e.message);
          parseError.responseContent = '';
          throw parseError;
        }
      }
    }
    
    // Parse JSON patches from response
    let patches = [];
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*"patches"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        patches = parsed.patches || [];
      } else {
        // Try parsing entire response as JSON
        const parsed = JSON.parse(content);
        patches = parsed.patches || [];
      }
    } catch (e) {
      toastMessage('Failed to parse AI response as patches. Response: ' + content.substring(0, CONFIG.ERROR_MESSAGE_PREVIEW_LENGTH));
      // Restore selection state and reopen modal with saved draft
      restoreCanvasSelection();
      if (canvasAiEditOverlay) {
        canvasAiEditOverlay.classList.add('show');
        if (canvasAiInstructionInput) {
          canvasAiInstructionInput.value = appState.canvasAiEditDraft || '';
          setTimeout(() => canvasAiInstructionInput.focus(), CONFIG.FOCUS_DELAY_MS);
        }
      }
      // Re-render canvas to show restored selection
      const canvas = getCanvas(appState.openCanvasChatId, canvasId);
      if (canvas) {
        renderCanvasBlocks(canvas);
      }
      return;
    }
    
    // Validate and prepare patches for review (don't apply yet)
    if (patches.length > 0) {
      const errors = [];
      const validPatches = [];
      const patchPreviews = [];
      
      // Get selected block IDs if any
      const allowedBlockIds = appState.selectedBlockIds && appState.selectedBlockIds.length > 0
        ? new Set(appState.selectedBlockIds)
        : null; // null means all blocks are allowed
      
      patches.forEach((patch, patchIndex) => {
        if (!patch.blockId || !patch.type) {
          errors.push(`Patch ${patchIndex + 1}: Missing blockId or type`);
          console.warn('Invalid patch:', patch);
          return;
        }
        
        // Validate that patch targets a selected block (if selection exists)
        if (allowedBlockIds && !allowedBlockIds.has(patch.blockId)) {
          errors.push(`Patch ${patchIndex + 1}: Block ${patch.blockId} is not selected for editing`);
          console.warn(`Patch targets non-selected block: ${patch.blockId}. Selected blocks:`, Array.from(allowedBlockIds));
          return;
        }
        
        // Get fresh canvas state
        const currentCanvas = getCanvas(appState.openCanvasChatId, canvasId);
        if (!currentCanvas) {
          errors.push(`Patch ${patchIndex + 1}: Canvas ${canvasId} not found`);
          console.warn(`Canvas ${canvasId} not found`);
          return;
        }
        
        const blockMap = buildBlockMap(currentCanvas);
    const block = blockMap.get(patch.blockId);
        if (!block) {
          errors.push(`Patch ${patchIndex + 1}: Block ${patch.blockId} not found in canvas`);
          console.warn(`Block ${patch.blockId} not found`);
          return;
        }
        
        try {
          let oldContent = '';
          let newContent = '';
          let isValid = false;
          
          if (patch.type === 'replace') {
            if (patch.position !== undefined && patch.oldContent !== undefined) {
              // Position-based replacement
              const start = patch.position;
              const end = start + patch.oldContent.length;
              const actualOldContent = block.content.slice(start, end);
              if (actualOldContent === patch.oldContent) {
                oldContent = block.content;
                newContent = block.content.slice(0, start) + (patch.newContent || '') + block.content.slice(end);
                isValid = true;
              } else {
                const errorMsg = `Patch ${patchIndex + 1}: Content mismatch at position ${start}`;
                errors.push(errorMsg);
                console.warn(`Patch oldContent mismatch at position ${start}. Expected: "${patch.oldContent}", Found: "${actualOldContent}"`);
              }
            } else {
              // Replace entire block
              oldContent = block.content;
              newContent = patch.newContent || '';
              isValid = true;
            }
          } else if (patch.type === 'insert') {
            const position = patch.position !== undefined ? patch.position : block.content.length;
            oldContent = block.content;
            newContent = block.content.slice(0, position) + (patch.newContent || '') + block.content.slice(position);
            isValid = true;
          } else if (patch.type === 'delete') {
            if (patch.position !== undefined && patch.oldContent) {
              const start = patch.position;
              const end = start + patch.oldContent.length;
              const actualOldContent = block.content.slice(start, end);
              if (actualOldContent === patch.oldContent) {
                oldContent = block.content;
                newContent = block.content.slice(0, start) + block.content.slice(end);
                isValid = true;
              } else {
                const errorMsg = `Patch ${patchIndex + 1}: Content mismatch at position ${start}`;
                errors.push(errorMsg);
                console.warn(`Patch oldContent mismatch at position ${start}. Expected: "${patch.oldContent}", Found: "${actualOldContent}"`);
              }
            } else {
              // Delete entire block
              oldContent = block.content;
              newContent = '';
              isValid = true;
            }
          } else {
            errors.push(`Patch ${patchIndex + 1}: Unknown patch type "${patch.type}"`);
            console.warn(`Unknown patch type: ${patch.type}`, patch);
          }
          
          if (isValid) {
            validPatches.push(patch);
            patchPreviews.push({
              patch,
              blockId: patch.blockId,
              blockIndex: Array.from(buildBlockMap(currentCanvas).keys()).indexOf(patch.blockId),
              oldContent,
              newContent,
              type: patch.type,
            });
          }
        } catch (err) {
          errors.push(`Patch ${patchIndex + 1}: ${err.message}`);
          console.error('Error processing patch:', err, patch);
        }
      });
      
      if (errors.length > 0 && validPatches.length === 0) {
        // All patches failed
        let errorMessage = 'No patches could be applied';
        errorMessage += '. Errors: ' + errors.slice(0, 3).join('; ');
        if (errors.length > 3) {
          errorMessage += ` (and ${errors.length - 3} more)`;
        }
        console.error('Patch application errors:', errors);
        toastMessage(errorMessage, CONFIG.ERROR_TOAST_TIMEOUT_MS);
        restoreCanvasSelection();
        if (canvasAiEditOverlay) {
          canvasAiEditOverlay.classList.add('show');
          if (canvasAiInstructionInput) {
            canvasAiInstructionInput.value = appState.canvasAiEditDraft || '';
            setTimeout(() => canvasAiInstructionInput.focus(), CONFIG.FOCUS_DELAY_MS);
          }
        }
        const canvas = getCanvas(appState.openCanvasChatId, canvasId);
        if (canvas) {
          renderCanvasBlocks(canvas);
        }
        return;
      }
      
      if (validPatches.length > 0) {
        // Store pending patches for review
        appState.pendingCanvasPatches = {
          canvasId,
          patches: patchPreviews,
          errors: errors.length > 0 ? errors : null,
        };
        saveState(appState);
        
        // Show review UI
        renderCanvasBlocks(updatedCanvas);
        updateCanvasButtonStates(canvasId);
        toastMessage(`${validPatches.length} change${validPatches.length > 1 ? 's' : ''} ready for review`, CONFIG.INFO_TOAST_TIMEOUT_MS);
      }
    } else {
      toastMessage('No patches returned from AI');
      // Restore selection state and reopen modal with saved draft
      restoreCanvasSelection();
      if (canvasAiEditOverlay) {
        canvasAiEditOverlay.classList.add('show');
        if (canvasAiInstructionInput) {
          canvasAiInstructionInput.value = appState.canvasAiEditDraft || '';
          setTimeout(() => canvasAiInstructionInput.focus(), CONFIG.FOCUS_DELAY_MS);
        }
      }
      // Re-render canvas to show restored selection
      const canvas = getCanvas(appState.openCanvasChatId, canvasId);
      if (canvas) {
        renderCanvasBlocks(canvas);
      }
    }
  } catch (err) {
    // Provide more helpful error messages
    let errorMessage = err.message || 'Unknown error';
    if (err.message && err.message.includes('JSON')) {
      errorMessage = 'Invalid response format from AI. The AI may not have returned valid JSON patches.';
    } else if (err.message && err.message.includes('API error')) {
      errorMessage = err.message;
    }
    
    toastMessage('Error editing canvas: ' + errorMessage, CONFIG.ERROR_TOAST_TIMEOUT_MS);
    console.error('Canvas edit error:', err);
    
    // Log the response content if available for debugging
    if (err.responseContent) {
      console.error('Response content:', err.responseContent.substring(0, CONFIG.ERROR_RESPONSE_PREVIEW_LENGTH));
    }
    
    // Restore selection state and reopen modal with saved draft on error
    restoreCanvasSelection();
    if (canvasAiEditOverlay) {
      canvasAiEditOverlay.classList.add('show');
      if (canvasAiInstructionInput) {
        canvasAiInstructionInput.value = appState.canvasAiEditDraft || '';
        setTimeout(() => canvasAiInstructionInput.focus(), 100);
      }
    }
    // Re-render canvas to show restored selection
    const canvas = getCanvas(appState.openCanvasChatId, canvasId);
    if (canvas) {
      renderCanvasBlocks(canvas);
    }
  } finally {
    // Restore button state
    if (canvasAiEditButton) {
      canvasAiEditButton.disabled = false;
      canvasAiEditButton.textContent = 'AI Edit';
    }
  }
}

// Theme utility functions
function getThemeColors(mode, hue) {
  const isLight = mode === 'light';
  
  // Reduced brightness for less bright, more glassy appearance
  const bgLightness = isLight ? 88 : 4;
  const panelLightness = isLight ? 82 : 10;
  const cardLightness = isLight ? 78 : 15;
  const textLightness = isLight ? 25 : 88;
  const mutedLightness = isLight ? 45 : 55;
  const borderLightness = isLight ? 70 : 25;
  
  return {
    bg: `hsl(${hue}, ${isLight ? 12 : 18}%, ${bgLightness}%)`,
    panel: `hsl(${hue}, ${isLight ? 8 : 12}%, ${panelLightness}%)`,
    card: `hsl(${hue}, ${isLight ? 6 : 10}%, ${cardLightness}%)`,
    text: `hsl(${hue}, ${isLight ? 4 : 8}%, ${textLightness}%)`,
    muted: `hsl(${hue}, ${isLight ? 8 : 12}%, ${mutedLightness}%)`,
    border: `hsl(${hue}, ${isLight ? 12 : 18}%, ${borderLightness}%)`,
    accent: `hsl(${hue}, ${isLight ? 55 : 65}%, ${isLight ? 42 : 48}%)`,
    danger: `hsl(${isLight ? 0 : 5}, ${isLight ? 65 : 70}%, ${isLight ? 52 : 58}%)`,
  };
}

// Convert HSL to RGB for rgba() usage
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h * 12) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return [f(0), f(8), f(4)];
}

function applyTheme(theme) {
  const colors = getThemeColors(theme.mode, theme.hue);
  const root = document.documentElement;
  
  // Convert accent HSL to RGB for rgba() usage
  const isLight = theme.mode === 'light';
  const accentH = theme.hue;
  const accentS = isLight ? 60 : 70;
  const accentL = isLight ? 45 : 50;
  const [r, g, b] = hslToRgb(accentH, accentS, accentL);
  
  // Apply color variables
  root.style.setProperty('--bg', colors.bg);
  root.style.setProperty('--panel', colors.panel);
  root.style.setProperty('--card', colors.card);
  root.style.setProperty('--text', colors.text);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--danger', colors.danger);
  root.style.setProperty('--theme-hue', theme.hue);
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  
  // Apply theme class to body
  document.body.classList.toggle('theme-light', theme.mode === 'light');
  document.body.classList.toggle('theme-dark', theme.mode === 'dark');
  
  // Update body background gradient with theme hue
  const bgGradient = document.body.querySelector('::before') || document.createElement('style');
  if (!document.getElementById('theme-gradient-style')) {
    const style = document.createElement('style');
    style.id = 'theme-gradient-style';
    document.head.appendChild(style);
  }
  const styleEl = document.getElementById('theme-gradient-style');
  if (styleEl) {
    styleEl.textContent = `
      body::before {
        background: 
          radial-gradient(circle at 8% 20%, hsla(${theme.hue}, 70%, 50%, 0.12), transparent 24%),
          radial-gradient(circle at 90% 10%, hsla(${theme.hue + 60}, 70%, 50%, 0.12), transparent 26%);
      }
    `;
  }
}

// Canvas utility functions
// Parse text into block structures (without IDs - IDs are assigned when blocks are created)
function parseTextIntoBlocks(text) {
  if (!text || text.trim() === '') {
    return [{ content: '', type: 'text' }];
  }
  
  const blocks = [];
  const lines = text.split('\n');
  let currentBlock = { content: '', type: 'text' };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect headings (lines starting with #)
    if (trimmed.startsWith('#')) {
      // Save previous block if it has content
      if (currentBlock.content.trim()) {
        blocks.push(currentBlock);
      }
      currentBlock = { content: trimmed, type: 'heading' };
      blocks.push(currentBlock);
      currentBlock = { content: '', type: 'text' };
      continue;
    }
    
    // Detect lists (lines starting with - or *)
    if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      // Save previous block if it has content
      if (currentBlock.content.trim()) {
        blocks.push(currentBlock);
      }
      currentBlock = { content: trimmed, type: 'list' };
      blocks.push(currentBlock);
      currentBlock = { content: '', type: 'text' };
      continue;
    }
    
    // Empty line - split paragraph (any empty line creates a break)
    if (trimmed === '') {
      // If current block has content, finalize it and start a new one
      if (currentBlock.content.trim()) {
        blocks.push(currentBlock);
        currentBlock = { content: '', type: 'text' };
      }
      // Skip empty lines (don't add them to blocks)
      continue;
    }
    
    // Non-empty line - add to current block
    // If this is the first line of a new block, just set it
    // Otherwise, add with a newline separator
    if (currentBlock.content) {
      currentBlock.content += '\n' + line;
    } else {
      currentBlock.content = line;
    }
  }
  
  // Add final block if it has content
  if (currentBlock.content.trim()) {
    blocks.push(currentBlock);
  }
  
  // If no blocks were created (all empty), return one empty block
  if (blocks.length === 0) {
    return [{ content: '', type: 'text' }];
  }
  
  return blocks;
}

// Canvas operations
function createCanvas(chatId, name = null) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(chatId);
  if (!chat) return null;
  
  if (!chat.canvases) {
    chat.canvases = [];
  }
  
  // Generate unique name if not provided
  let canvasName = name ? name.trim() : null;
  if (!canvasName) {
    const existingNames = chat.canvases.map(c => c.name || '').filter(n => n.startsWith('Canvas '));
    let canvasNumber = 1;
    while (existingNames.includes(`Canvas ${canvasNumber}`)) {
      canvasNumber++;
    }
    canvasName = `Canvas ${canvasNumber}`;
  }
  
  const canvas = {
    id: uuid(),
    name: canvasName,
    blocks: [{ id: uuid(), content: '', type: 'text' }],
    patches: [],
    version: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  chat.canvases.push(canvas);
  saveState(appState);
  return canvas;
}

function deleteCanvas(chatId, canvasId) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(chatId);
  if (!chat || !chat.canvases) return;
  
  chat.canvases = chat.canvases.filter(c => c.id !== canvasId);
  
  // Close if currently open
  if (appState.openCanvasId === canvasId) {
    appState.openCanvasId = null;
    appState.openCanvasChatId = null;
    appState.canvasModalOpen = false;
  }
  
  saveState(appState);
}

function renameCanvas(chatId, canvasId, newName) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(chatId);
  if (!chat || !chat.canvases) return;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas) return;
  
  canvas.name = newName.trim() || 'Untitled Canvas';
  canvas.updatedAt = Date.now();
  saveState(appState);
}

function getCanvas(chatId, canvasId) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(chatId);
  if (!chat) return null;
  const canvasMap = buildCanvasMap(chat);
  return canvasMap.get(canvasId) || null;
}

function openCanvas(chatId, canvasId) {
  const canvas = getCanvas(chatId, canvasId);
  if (!canvas) return;
  
  appState.openCanvasId = canvasId;
  appState.openCanvasChatId = chatId;
  appState.canvasModalOpen = true;
  appState.canvasListModalOpen = false;
  saveState(appState);
  renderCanvas();
}

// Restore canvas selection state from saved AI Edit selection
function restoreCanvasSelection() {
  if (appState.canvasAiEditSelection) {
    appState.selectedBlockIds = appState.canvasAiEditSelection.blockIds || [];
    saveState(appState);
  }
}

function closeCanvas() {
  appState.openCanvasId = null;
  appState.openCanvasChatId = null;
  appState.canvasModalOpen = false;
  appState.selectedBlockIds = [];
  appState.canvasAiEditSelection = null;
  saveState(appState);
  
  const canvasOverlay = document.getElementById('canvas-overlay');
  if (canvasOverlay) {
    canvasOverlay.classList.remove('show');
  }
}

// Patch system
function createPatch(canvasId, type, blockId, oldContent, newContent, position) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return null;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas) return null;
  
  const patch = {
    id: uuid(),
    timestamp: Date.now(),
    type: type, // 'replace' | 'insert' | 'delete'
    blockId: blockId,
    oldContent: oldContent,
    newContent: newContent,
    position: position,
  };
  
  if (!canvas.patches) {
    canvas.patches = [];
  }
  canvas.patches.push(patch);
  canvas.version = (canvas.version || 0) + 1;
  canvas.updatedAt = Date.now();
  saveState(appState);
  
  return patch;
}

function applyPatch(canvas, patch) {
    const blockMap = buildBlockMap(canvas);
    const block = blockMap.get(patch.blockId);
  if (!block) return canvas;
  
  const newCanvas = { ...canvas, blocks: [...canvas.blocks] };
  const blockIndex = Array.from(buildBlockMap(newCanvas).keys()).indexOf(patch.blockId);
  
  if (patch.type === 'replace') {
    newCanvas.blocks[blockIndex] = { ...block, content: patch.newContent || '' };
  } else if (patch.type === 'insert') {
    const position = patch.position !== undefined ? patch.position : block.content.length;
    const newContent = block.content.slice(0, position) + (patch.newContent || '') + block.content.slice(position);
    newCanvas.blocks[blockIndex] = { ...block, content: newContent };
  } else if (patch.type === 'delete') {
    if (patch.position !== undefined && patch.oldContent) {
      const start = patch.position;
      const end = start + patch.oldContent.length;
      const newContent = block.content.slice(0, start) + block.content.slice(end);
      newCanvas.blocks[blockIndex] = { ...block, content: newContent };
    } else {
      // Delete entire block
      newCanvas.blocks = newCanvas.blocks.filter(b => b.id !== patch.blockId);
    }
  }
  
  newCanvas.version = (newCanvas.version || 0) + 1;
  newCanvas.updatedAt = Date.now();
  return newCanvas;
}

function getInversePatch(patch) {
  return {
    id: uuid(),
    timestamp: Date.now(),
    type: patch.type,
    blockId: patch.blockId,
    oldContent: patch.newContent,
    newContent: patch.oldContent,
    position: patch.position,
  };
}

// Check if content should be split into multiple blocks (contains paragraphs/newlines)
function shouldSplitIntoBlocks(content) {
  if (!content) return false;
  // Split if content has multiple paragraphs (any newlines with empty lines or just multiple newlines)
  // More lenient: split on any empty line, or if there are multiple lines
  const hasEmptyLines = /\n\s*\n/.test(content);
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  return hasEmptyLines || lines.length > 1;
}

// Apply content to a block, splitting into multiple blocks if it contains paragraphs
function applyContentWithBlockSplitting(canvasId, targetBlockId, content, blockType = 'text') {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas) return;
  
  const blockMap = buildBlockMap(canvas);
  const targetBlock = blockMap.get(targetBlockId);
  if (!targetBlock) return;
  
  const targetIndex = Array.from(buildBlockMap(canvas).keys()).indexOf(targetBlockId);
  
  // Parse content into blocks (handles paragraphs, headings, lists)
  const newBlocks = parseTextIntoBlocks(content);
  
  if (newBlocks.length === 0) {
    // Empty content, just update the block
    updateBlock(canvasId, targetBlockId, '');
    return;
  }
  
  if (newBlocks.length === 1) {
    // Single block, just update
    updateBlock(canvasId, targetBlockId, newBlocks[0].content);
    return;
  }
  
  // Multiple blocks: replace target block with first new block, insert rest after
  const firstBlock = newBlocks[0];
  const remainingBlocks = newBlocks.slice(1);
  
  // Update target block with first new block's content
  const oldContent = targetBlock.content;
  targetBlock.content = firstBlock.content;
  targetBlock.type = firstBlock.type;
  createPatch(canvasId, 'replace', targetBlockId, oldContent, firstBlock.content);
  
  // Insert remaining blocks after target block
  remainingBlocks.forEach((newBlock, index) => {
    const insertPosition = targetIndex + 1 + index;
    const block = { id: uuid(), content: newBlock.content, type: newBlock.type };
    canvas.blocks.splice(insertPosition, 0, block);
    createPatch(canvasId, 'insert', block.id, '', block.content, insertPosition);
  });
  
  canvas.updatedAt = Date.now();
  saveState(appState);
}

// Block CRUD operations
function createBlock(canvasId, content = '', type = 'text', position) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return null;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas) return null;
  
  const newBlock = { id: uuid(), content, type };
  
  if (position !== undefined && position >= 0 && position < canvas.blocks.length) {
    canvas.blocks.splice(position, 0, newBlock);
  } else {
    canvas.blocks.push(newBlock);
  }
  
  createPatch(canvasId, 'insert', newBlock.id, '', content, position);
  canvas.updatedAt = Date.now();
  saveState(appState);
  return newBlock;
}

function updateBlock(canvasId, blockId, content) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return null;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas) return null;
  
  const blockMap = buildBlockMap(canvas);
  const block = blockMap.get(blockId);
  if (!block) return null;
  
  const oldContent = block.content;
  block.content = content;
  
  createPatch(canvasId, 'replace', blockId, oldContent, content);
  canvas.updatedAt = Date.now();
  saveState(appState);
  return block;
}

function deleteBlock(canvasId, blockId) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return null;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas) return null;
  
  const blockMap = buildBlockMap(canvas);
  const block = blockMap.get(blockId);
  if (!block) return null;
  
  const oldContent = block.content;
  canvas.blocks = canvas.blocks.filter(b => b.id !== blockId);
  
  createPatch(canvasId, 'delete', blockId, oldContent, '');
  canvas.updatedAt = Date.now();
  saveState(appState);
  return true;
}

// Parse a block and split it into multiple blocks based on paragraphs
// Accept a canvas patch
function acceptCanvasPatch(canvasId, blockId) {
  if (!appState.pendingCanvasPatches || appState.pendingCanvasPatches.canvasId !== canvasId) {
    return;
  }
  
  const patchPreview = appState.pendingCanvasPatches.patches.find(p => p.blockId === blockId);
  if (!patchPreview) {
    return;
  }
  
  const canvas = getCanvas(appState.openCanvasChatId, canvasId);
  if (!canvas) return;
  
    const blockMap = buildBlockMap(canvas);
    const block = blockMap.get(blockId);
  if (!block) return;
  
  // Apply the change
  const newContent = patchPreview.newContent;
  if (patchPreview.type === 'delete' && newContent === '') {
    // Delete block
    deleteBlock(canvasId, blockId);
  } else {
    // Check if new content should be split into multiple blocks
    if (shouldSplitIntoBlocks(newContent)) {
      applyContentWithBlockSplitting(canvasId, blockId, newContent, block.type);
    } else {
      updateBlock(canvasId, blockId, newContent);
    }
  }
  
  // Remove this patch from pending
  appState.pendingCanvasPatches.patches = appState.pendingCanvasPatches.patches.filter(p => p.blockId !== blockId);
  
  // If no more pending patches, clear the pending state
  if (appState.pendingCanvasPatches.patches.length === 0) {
    appState.pendingCanvasPatches = null;
    appState.canvasAiEditDraft = '';
    appState.canvasAiEditSelection = null;
    toastMessage('All changes applied');
  } else {
    toastMessage('Change accepted');
  }
  
  saveState(appState);
  
  // Re-render canvas - accept may create/delete blocks, so use full render
  const updatedCanvas = getCanvas(appState.openCanvasChatId, canvasId);
  if (updatedCanvas) {
    renderCanvasBlocks(updatedCanvas, { forceFullRender: true });
    // Update button states after accepting
    updateCanvasButtonStates(canvasId);
  }
}

// Decline a canvas patch
function declineCanvasPatch(canvasId, blockId) {
  if (!appState.pendingCanvasPatches || appState.pendingCanvasPatches.canvasId !== canvasId) {
    return;
  }
  
  // Remove this patch from pending
  appState.pendingCanvasPatches.patches = appState.pendingCanvasPatches.patches.filter(p => p.blockId !== blockId);
  
  // If no more pending patches, clear the pending state
  if (appState.pendingCanvasPatches.patches.length === 0) {
    appState.pendingCanvasPatches = null;
    appState.canvasAiEditDraft = '';
    appState.canvasAiEditSelection = null;
    toastMessage('All changes declined');
  } else {
    toastMessage('Change declined');
  }
  
  saveState(appState);
  
  // Re-render canvas
  const canvas = getCanvas(appState.openCanvasChatId, canvasId);
  if (canvas) {
    // Only update the block that had its patch declined
    renderCanvasBlocks(canvas, { updatedBlockIds: [blockId] });
    // Update button states after declining
    updateCanvasButtonStates(canvasId);
  }
}

// Toggle block selection for AI Edit
function toggleBlockSelection(blockId) {
  if (!appState.selectedBlockIds) {
    appState.selectedBlockIds = [];
  }
  
  const index = appState.selectedBlockIds.indexOf(blockId);
  if (index > -1) {
    // Deselect
    appState.selectedBlockIds.splice(index, 1);
  } else {
    // Select
    appState.selectedBlockIds.push(blockId);
  }
  
  saveState(appState);
}

function parseBlockIntoParagraphs(canvasId, blockId) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas) return;
  
    const blockMap = buildBlockMap(canvas);
    const block = blockMap.get(blockId);
  if (!block) return;
  
  const blockIndex = Array.from(buildBlockMap(canvas).keys()).indexOf(blockId);
  if (blockIndex === -1) return;
  
  // Parse content into blocks
  const newBlocks = parseTextIntoBlocks(block.content);
  
  if (newBlocks.length <= 1) {
    // No paragraphs to split, nothing to do
    toastMessage('No paragraphs found to split');
    return;
  }
  
  // Replace current block with first new block
  const firstBlock = newBlocks[0];
  const oldContent = block.content;
  block.content = firstBlock.content;
  block.type = firstBlock.type;
  createPatch(canvasId, 'replace', blockId, oldContent, firstBlock.content);
  
  // Insert remaining blocks after current block
  newBlocks.slice(1).forEach((newBlock, index) => {
    const insertPosition = blockIndex + 1 + index;
    const createdBlock = { id: uuid(), content: newBlock.content, type: newBlock.type };
    canvas.blocks.splice(insertPosition, 0, createdBlock);
    createPatch(canvasId, 'insert', createdBlock.id, '', createdBlock.content, insertPosition);
  });
  
  canvas.updatedAt = Date.now();
  saveState(appState);
  toastMessage(`Split into ${newBlocks.length} block${newBlocks.length > 1 ? 's' : ''}`);
}

function splitBlock(canvasId, blockId, splitPosition) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return null;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas) return null;
  
  const blockMap = buildBlockMap(canvas);
  const block = blockMap.get(blockId);
  if (!block) return null;
  
  const blockIndex = Array.from(buildBlockMap(canvas).keys()).indexOf(blockId);
  const firstPart = block.content.slice(0, splitPosition);
  const secondPart = block.content.slice(splitPosition);
  
  block.content = firstPart;
  const newBlock = { id: uuid(), content: secondPart, type: block.type };
  
  canvas.blocks.splice(blockIndex + 1, 0, newBlock);
  
  createPatch(canvasId, 'replace', blockId, block.content + secondPart, firstPart);
  createPatch(canvasId, 'insert', newBlock.id, '', secondPart, blockIndex + 1);
  canvas.updatedAt = Date.now();
  saveState(appState);
  return newBlock;
}

function mergeBlocks(canvasId, blockId1, blockId2) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return null;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas) return null;
  
  const blockMap = buildBlockMap(canvas);
  const block1 = blockMap.get(blockId1);
  const block2 = blockMap.get(blockId2);
  if (!block1 || !block2) return null;
  
  const oldContent1 = block1.content;
  const oldContent2 = block2.content;
  block1.content = block1.content + '\n' + block2.content;
  
  canvas.blocks = canvas.blocks.filter(b => b.id !== blockId2);
  
  createPatch(canvasId, 'replace', blockId1, oldContent1, block1.content);
  createPatch(canvasId, 'delete', blockId2, oldContent2, '');
  canvas.updatedAt = Date.now();
  saveState(appState);
  return block1;
}

// Undo/Redo system
function undoCanvasEdit(canvasId) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return false;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas || !canvas.patches || canvas.patches.length === 0) return false;
  
  // Find last non-undone patch
  let lastPatchIndex = -1;
  for (let i = canvas.patches.length - 1; i >= 0; i--) {
    if (!canvas.patches[i].undone) {
      lastPatchIndex = i;
      break;
    }
  }
  
  if (lastPatchIndex === -1) return false;
  
  const patch = canvas.patches[lastPatchIndex];
  const inversePatch = getInversePatch(patch);
  
  // Apply inverse patch
    const blockMap = buildBlockMap(canvas);
    const block = blockMap.get(patch.blockId);
  if (block) {
    if (patch.type === 'replace') {
      block.content = patch.oldContent || '';
    } else if (patch.type === 'insert') {
      if (patch.position !== undefined) {
        const position = patch.position;
        const newContent = block.content.slice(0, position) + block.content.slice(position + (patch.newContent || '').length);
        block.content = newContent;
      } else {
        block.content = block.content.replace(patch.newContent || '', '');
      }
    } else if (patch.type === 'delete') {
      if (patch.position !== undefined) {
        const position = patch.position;
        const newContent = block.content.slice(0, position) + (patch.oldContent || '') + block.content.slice(position);
        block.content = newContent;
      } else {
        // Re-insert deleted block
        const blockIndex = Array.from(buildBlockMap(canvas).keys()).indexOf(patch.blockId);
        if (blockIndex === -1) {
          canvas.blocks.push({ id: patch.blockId, content: patch.oldContent || '', type: 'text' });
        }
      }
    }
  }
  
  patch.undone = true;
  canvas.version = (canvas.version || 0) - 1;
  canvas.updatedAt = Date.now();
  saveState(appState);
  return true;
}

function redoCanvasEdit(canvasId) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return false;
  
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas || !canvas.patches || canvas.patches.length === 0) return false;
  
  // Find last undone patch
  let lastUndoneIndex = -1;
  for (let i = canvas.patches.length - 1; i >= 0; i--) {
    if (canvas.patches[i].undone) {
      lastUndoneIndex = i;
      break;
    }
  }
  
  if (lastUndoneIndex === -1) return false;
  
  const patch = canvas.patches[lastUndoneIndex];
  
  // Re-apply patch
    const blockMap = buildBlockMap(canvas);
    const block = blockMap.get(patch.blockId);
  if (block) {
    if (patch.type === 'replace') {
      block.content = patch.newContent || '';
    } else if (patch.type === 'insert') {
      if (patch.position !== undefined) {
        const position = patch.position;
        const newContent = block.content.slice(0, position) + (patch.newContent || '') + block.content.slice(position);
        block.content = newContent;
      } else {
        block.content += patch.newContent || '';
      }
    } else if (patch.type === 'delete') {
      if (patch.position !== undefined && patch.oldContent) {
        const start = patch.position;
        const end = start + patch.oldContent.length;
        const newContent = block.content.slice(0, start) + block.content.slice(end);
        block.content = newContent;
      } else {
        // Delete block again
        canvas.blocks = canvas.blocks.filter(b => b.id !== patch.blockId);
      }
    }
  }
  
  patch.undone = false;
  canvas.version = (canvas.version || 0) + 1;
  canvas.updatedAt = Date.now();
  saveState(appState);
  return true;
}

function canUndo(canvasId) {
  const chat = appState.chats.find(c => c.id === appState.openCanvasChatId);
  if (!chat || !chat.canvases) return false;
  const canvas = chat.canvases.find(c => c.id === canvasId);
  if (!canvas || !canvas.patches) return false;
  return canvas.patches.some(p => !p.undone);
}

function canRedo(canvasId) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(appState.openCanvasChatId);
  if (!chat || !chat.canvases) return false;
  const canvasMap = buildCanvasMap(chat);
  const canvas = canvasMap.get(canvasId);
  if (!canvas || !canvas.patches) return false;
  return canvas.patches.some(p => p.undone);
}

// Helper function to create a single block element
function createBlockElement(block, index, savedBlockIds, pendingChanges) {
  const blockWrapper = document.createElement('div');
  blockWrapper.className = 'canvas-block-wrapper';
  blockWrapper.setAttribute('data-block-id', block.id);
  
  const blockNumber = document.createElement('div');
  blockNumber.className = 'canvas-block-number';
  blockNumber.textContent = index + 1;
  blockNumber.setAttribute('title', `Block ${index + 1}`);
  
  // Selection checkbox
  const selectCheckbox = document.createElement('button');
  selectCheckbox.className = 'ghost icon canvas-block-select';
  selectCheckbox.setAttribute('aria-label', 'Select block');
  selectCheckbox.textContent = '☐';
  selectCheckbox.title = 'Select block for AI Edit';
  const isSelected = savedBlockIds.includes(block.id);
  if (isSelected) {
    selectCheckbox.textContent = '☑';
    selectCheckbox.classList.add('selected');
    blockWrapper.classList.add('block-selected');
  }
  
  const blockEl = document.createElement('div');
  blockEl.className = `canvas-block ${block.type}`;
  blockEl.setAttribute('data-block-id', block.id);
  blockEl.setAttribute('contenteditable', 'true');
  blockEl.textContent = block.content;
  
  // Add action buttons for each block
  const blockActions = document.createElement('div');
  blockActions.className = 'canvas-block-actions';
  
  // Parse/Split button
  const parseButton = document.createElement('button');
  parseButton.className = 'ghost icon canvas-block-parse';
  parseButton.setAttribute('aria-label', 'Parse and split paragraphs');
  parseButton.textContent = '⇄';
  parseButton.title = 'Parse paragraphs and split into blocks';
  
  // Delete button
  const deleteButton = document.createElement('button');
  deleteButton.className = 'ghost icon canvas-block-delete';
  deleteButton.setAttribute('aria-label', 'Delete block');
  deleteButton.textContent = '✕';
  deleteButton.title = 'Delete block';
  
  blockActions.appendChild(parseButton);
  blockActions.appendChild(deleteButton);
  
  blockWrapper.appendChild(blockNumber);
  blockWrapper.appendChild(selectCheckbox);
  blockWrapper.appendChild(blockEl);
  blockWrapper.appendChild(blockActions);
  
  // Create a container for the block and its proposed changes (if any)
  const blockContainer = document.createElement('div');
  blockContainer.className = 'canvas-block-container';
  blockContainer.setAttribute('data-block-id', block.id);
  
  blockContainer.appendChild(blockWrapper);
  
  // Add proposed block below the old block if there are pending changes
  if (pendingChanges) {
    const proposedBlock = createProposedBlock(block.id, pendingChanges);
    blockContainer.appendChild(proposedBlock);
  }
  
  return blockContainer;
}

// Helper function to create proposed block element
function createProposedBlock(blockId, pendingChanges) {
  const proposedBlock = document.createElement('div');
  proposedBlock.className = 'canvas-block-proposed';
  proposedBlock.setAttribute('data-block-id', blockId);
  proposedBlock.setAttribute('data-proposed', 'true');
  proposedBlock.textContent = pendingChanges.newContent || '(empty)';
  proposedBlock.setAttribute('contenteditable', 'false');
  
  // Add Accept/Decline buttons at the bottom of proposed block
  const proposedActions = document.createElement('div');
  proposedActions.className = 'canvas-block-proposed-actions';
  
  const acceptButton = document.createElement('button');
  acceptButton.className = 'primary canvas-block-review-accept';
  acceptButton.setAttribute('aria-label', 'Accept change');
  acceptButton.textContent = '✓ Accept';
  acceptButton.title = 'Accept change';
  
  const declineButton = document.createElement('button');
  declineButton.className = 'ghost canvas-block-review-decline';
  declineButton.setAttribute('aria-label', 'Decline change');
  declineButton.textContent = '✕ Decline';
  declineButton.title = 'Decline change';
  
  proposedActions.appendChild(acceptButton);
  proposedActions.appendChild(declineButton);
  
  proposedBlock.appendChild(proposedActions);
  return proposedBlock;
}

// Block rendering - optimized with incremental updates
function renderCanvasBlocks(canvas, options = {}) {
  const canvasContent = document.getElementById('canvas-content');
  if (!canvasContent || !canvas) return;
  
  const { forceFullRender = false, updatedBlockIds = null } = options;
  
  // Store current selection state
  const savedBlockIds = appState.selectedBlockIds ? [...appState.selectedBlockIds] : [];
  
  // Track existing DOM blocks
  const existingBlocks = new Map();
  const existingContainers = canvasContent.querySelectorAll('.canvas-block-container');
  existingContainers.forEach(container => {
    const blockId = container.getAttribute('data-block-id');
    if (blockId) {
      existingBlocks.set(blockId, container);
    }
  });
  
  // Track which blocks exist in the new state
  const newBlockIds = new Set(canvas.blocks.map(b => b.id));
  
  // If force full render or no existing blocks, do full render
  if (forceFullRender || existingBlocks.size === 0) {
    canvasContent.innerHTML = '';
    existingBlocks.clear();
  }
  
  // Use DocumentFragment for batch DOM operations
  const fragment = document.createDocumentFragment();
  let hasNewBlocks = false;
  
  canvas.blocks.forEach((block, index) => {
    const existingContainer = existingBlocks.get(block.id);
    const shouldUpdate = forceFullRender || !existingContainer || 
                        (updatedBlockIds && updatedBlockIds.includes(block.id));
    
    // Check if block has pending changes
    const pendingChanges = appState.pendingCanvasPatches && 
                          appState.pendingCanvasPatches.canvasId === canvas.id &&
                          appState.pendingCanvasPatches.patches.find(p => p.blockId === block.id);
    
    if (existingContainer && !shouldUpdate) {
      // Block exists and doesn't need update - just update selection state if needed
      const blockWrapper = existingContainer.querySelector('.canvas-block-wrapper');
      const selectCheckbox = existingContainer.querySelector('.canvas-block-select');
      const isSelected = savedBlockIds.includes(block.id);
      const currentlySelected = blockWrapper?.classList.contains('block-selected');
      
      if (isSelected !== currentlySelected) {
        if (selectCheckbox) {
          selectCheckbox.textContent = isSelected ? '☑' : '☐';
          selectCheckbox.classList.toggle('selected', isSelected);
        }
        blockWrapper?.classList.toggle('block-selected', isSelected);
      }
      
      // Update block number if index changed
      const blockNumber = existingContainer.querySelector('.canvas-block-number');
      if (blockNumber && blockNumber.textContent !== String(index + 1)) {
        blockNumber.textContent = index + 1;
        blockNumber.setAttribute('title', `Block ${index + 1}`);
      }
      
      // Update proposed block if pending changes state changed
      const existingProposed = existingContainer.querySelector('.canvas-block-proposed');
      if (pendingChanges && !existingProposed) {
        // Need to add proposed block
        const proposedBlock = createProposedBlock(block.id, pendingChanges);
        existingContainer.appendChild(proposedBlock);
      } else if (!pendingChanges && existingProposed) {
        // Need to remove proposed block
        existingProposed.remove();
      } else if (pendingChanges && existingProposed) {
        // Update proposed block content if it changed
        const actions = existingProposed.querySelector('.canvas-block-proposed-actions');
        const currentText = existingProposed.childNodes[0]?.textContent?.trim() || '';
        const newContent = pendingChanges.newContent || '(empty)';
        if (currentText !== newContent && currentText !== newContent.trim()) {
          // Replace content while preserving actions
          existingProposed.textContent = newContent;
          if (actions) {
            existingProposed.appendChild(actions);
          }
        }
      }
      
      // Update block content if it changed (but preserve focus/cursor)
      const blockEl = existingContainer.querySelector('.canvas-block');
      if (blockEl && blockEl.textContent !== block.content) {
        // Only update if not currently focused (to preserve cursor position)
        if (document.activeElement !== blockEl) {
          blockEl.textContent = block.content;
        }
      }
      
      return; // Skip to next block
    }
    
    // Remove existing container if it exists (will be replaced)
    if (existingContainer) {
      existingContainer.remove();
    }
    
    hasNewBlocks = true;
    
    // Create new block container
    const blockContainer = createBlockElement(block, index, savedBlockIds, pendingChanges);
    fragment.appendChild(blockContainer);
  });
  
  // Append all new blocks at once using fragment
  if (hasNewBlocks) {
    canvasContent.appendChild(fragment);
  }
  
  // Remove blocks that no longer exist
  existingBlocks.forEach((container, blockId) => {
    if (!newBlockIds.has(blockId)) {
      container.remove();
    }
  });
  
  // Update undo/redo buttons
  const undoButton = document.getElementById('canvas-undo');
  const redoButton = document.getElementById('canvas-redo');
  if (undoButton) {
    undoButton.disabled = !canUndo(canvas.id);
  }
  if (redoButton) {
    redoButton.disabled = !canRedo(canvas.id);
  }
  
  // Update button states based on pending changes
  updateCanvasButtonStates(canvas.id);
  
  // Set up delegated event listeners for canvas blocks (only once)
  if (canvasContent && !canvasContent.dataset.delegated) {
    canvasContent.dataset.delegated = 'true';
    canvasContent.addEventListener('click', handleCanvasBlockClick);
    canvasContent.addEventListener('input', handleCanvasBlockInput);
    canvasContent.addEventListener('blur', handleCanvasBlockBlur, true);
  }
}

function handleCanvasBlockClick(e) {
  const selectCheckbox = e.target.closest('.canvas-block-select');
  if (selectCheckbox) {
    e.stopPropagation();
    e.preventDefault();
    const blockContainer = selectCheckbox.closest('[data-block-id]');
    const blockId = blockContainer?.getAttribute('data-block-id');
    if (blockId) {
      toggleBlockSelection(blockId);
      const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
      if (canvas) {
        // Only update selection state, not full re-render
        renderCanvasBlocks(canvas, { updatedBlockIds: [blockId] });
      }
    }
    return;
  }

  const parseButton = e.target.closest('.canvas-block-parse');
  if (parseButton) {
    e.stopPropagation();
    e.preventDefault();
    const blockContainer = parseButton.closest('[data-block-id]');
    const blockId = blockContainer?.getAttribute('data-block-id');
    if (blockId && appState.openCanvasId) {
      parseBlockIntoParagraphs(appState.openCanvasId, blockId);
      const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
      if (canvas) {
        // Parse creates new blocks, so we need full render
        renderCanvasBlocks(canvas, { forceFullRender: true });
      }
    }
    return;
  }

  const deleteButton = e.target.closest('.canvas-block-delete');
  if (deleteButton) {
    e.stopPropagation();
    e.preventDefault();
    const blockContainer = deleteButton.closest('[data-block-id]');
    const blockId = blockContainer?.getAttribute('data-block-id');
    const canvasId = appState.openCanvasId;
    if (blockId && canvasId) {
      const canvas = getCanvas(appState.openCanvasChatId, canvasId);
      if (canvas) {
        const blockIndex = Array.from(buildBlockMap(canvas).keys()).indexOf(blockId);
        appState.pendingDeleteBlock = { canvasId, blockId, blockIndex: blockIndex + 1 };
        if (canvasDeleteBlockOverlay) {
          canvasDeleteBlockOverlay.classList.add('show');
        }
      }
    }
    return;
  }

  const acceptButton = e.target.closest('.canvas-block-review-accept');
  if (acceptButton) {
    e.stopPropagation();
    e.preventDefault();
    const proposedBlock = acceptButton.closest('[data-proposed]');
    const blockId = proposedBlock?.getAttribute('data-block-id');
    if (blockId && appState.openCanvasId) {
      acceptCanvasPatch(appState.openCanvasId, blockId);
    }
    return;
  }

  const declineButton = e.target.closest('.canvas-block-review-decline');
  if (declineButton) {
    e.stopPropagation();
    e.preventDefault();
    const proposedBlock = declineButton.closest('[data-proposed]');
    const blockId = proposedBlock?.getAttribute('data-block-id');
    if (blockId && appState.openCanvasId) {
      declineCanvasPatch(appState.openCanvasId, blockId);
    }
    return;
  }
}

function handleCanvasBlockInput(e) {
  if (e.target.classList.contains('canvas-block') && e.target.hasAttribute('contenteditable')) {
    const blockId = e.target.getAttribute('data-block-id');
    if (!blockId) return;
    
    clearTimeout(e.target._editTimeout);
    e.target._editTimeout = setTimeout(() => {
      const newContent = e.target.textContent || '';
      const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
      if (!canvas) return;
      const blockMap = buildBlockMap(canvas);
    const block = blockMap.get(blockId);
      if (block && block.content !== newContent) {
        updateBlock(appState.openCanvasId, blockId, newContent);
      }
      }, CONFIG.BLOCK_EDIT_DEBOUNCE_MS);
  }
}

function handleCanvasBlockBlur(e) {
  if (e.target.classList.contains('canvas-block') && e.target.hasAttribute('contenteditable')) {
    const blockId = e.target.getAttribute('data-block-id');
    if (!blockId) return;
    
    clearTimeout(e.target._editTimeout);
    const newContent = e.target.textContent || '';
    const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
    if (!canvas) return;
    const blockMap = buildBlockMap(canvas);
    const block = blockMap.get(blockId);
    if (block && block.content !== newContent) {
      updateBlock(appState.openCanvasId, blockId, newContent);
    }
  }
}

// Check if canvas has pending changes
function hasPendingCanvasChanges(canvasId) {
  return appState.pendingCanvasPatches && 
         appState.pendingCanvasPatches.canvasId === canvasId &&
         appState.pendingCanvasPatches.patches &&
         appState.pendingCanvasPatches.patches.length > 0;
}

// Update canvas button states (disable copy and AI Edit if pending changes)
function updateCanvasButtonStates(canvasId) {
  const hasPending = hasPendingCanvasChanges(canvasId);
  
  if (canvasCopyAllButton) {
    canvasCopyAllButton.disabled = hasPending;
    if (hasPending) {
      canvasCopyAllButton.title = 'Cannot copy while changes are pending review';
    } else {
      canvasCopyAllButton.title = 'Copy all blocks as text';
    }
  }
  
  if (canvasAiEditButton) {
    canvasAiEditButton.disabled = hasPending;
    if (hasPending) {
      canvasAiEditButton.title = 'Cannot edit while changes are pending review';
    } else {
      canvasAiEditButton.title = 'AI Edit';
    }
  }
}

function renderCanvas() {
  if (!appState.openCanvasId || !appState.openCanvasChatId) return;
  
  const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
  if (!canvas) return;
  
  const canvasOverlay = document.getElementById('canvas-overlay');
  const canvasNameInput = document.getElementById('canvas-name-input');
  
  // Update button states when rendering canvas
  updateCanvasButtonStates(canvas.id);
  
  if (canvasOverlay) {
    canvasOverlay.classList.toggle('show', appState.canvasModalOpen);
  }
  
  if (canvasNameInput) {
    canvasNameInput.value = canvas.name;
  }
  
  renderCanvasBlocks(canvas);
}

function renderCanvasList() {
  const canvasList = document.getElementById('canvas-list');
  const canvasListOverlay = document.getElementById('canvas-list-overlay');
  if (!canvasList || !canvasListOverlay) return;
  
  const chat = getSelectedChat();
  if (!chat) return;
  
  const canvases = chat.canvases || [];
  
  canvasList.innerHTML = '';
  
  if (canvases.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'persona-item';
    empty.style.textAlign = 'center';
    empty.style.padding = '20px';
    empty.textContent = 'No canvases yet. Create one to get started.';
    canvasList.appendChild(empty);
  } else {
    canvases.forEach(canvas => {
      const li = document.createElement('li');
      li.className = 'persona-item';
      
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '8px';
      
      const info = document.createElement('div');
      const name = document.createElement('div');
      name.style.fontWeight = '600';
      name.style.marginBottom = '4px';
      name.textContent = canvas.name;
      
      const date = document.createElement('div');
      date.className = 'muted';
      date.style.fontSize = '12px';
      const updatedDate = new Date(canvas.updatedAt);
      date.textContent = `Updated: ${updatedDate.toLocaleDateString()} ${updatedDate.toLocaleTimeString()}`;
      
      info.appendChild(name);
      info.appendChild(date);
      
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      
      const openBtn = document.createElement('button');
      openBtn.className = 'ghost';
      openBtn.textContent = 'Open';
      openBtn.onclick = () => {
        openCanvas(chat.id, canvas.id);
        renderCanvasList();
      };
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'ghost danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = () => {
        openConfirmDialog({
          title: 'Delete canvas',
          context: 'Canvas',
          description: `Delete "${canvas.name}"? This will remove the canvas and all its content.`,
          confirmLabel: 'Delete canvas',
          confirmVariant: 'danger',
          onConfirm: () => {
            deleteCanvas(chat.id, canvas.id);
            renderCanvasList();
          },
        });
      };
      
      actions.appendChild(openBtn);
      actions.appendChild(deleteBtn);
      
      header.appendChild(info);
      header.appendChild(actions);
      li.appendChild(header);
      canvasList.appendChild(li);
    });
  }
  
  canvasListOverlay.classList.toggle('show', appState.canvasListModalOpen);
}

function toastMessage(message, timeout = CONFIG.DEFAULT_TOAST_TIMEOUT_MS) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), timeout);
}

function closeConfirmDialog() {
  confirmOverlay.classList.remove('show');
  activeConfirmHandler = null;
}

function openConfirmDialog({
  title = 'Are you sure?',
  description = '',
  context = 'Confirm action',
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  onConfirm,
}) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = description;
  confirmContext.textContent = context;
  confirmAction.textContent = confirmLabel;
  confirmAction.className = 'primary';
  if (confirmVariant) {
    confirmAction.classList.add(confirmVariant);
  }
  activeConfirmHandler = onConfirm;
  confirmOverlay.classList.add('show');
}

confirmAction.onclick = () => {
  if (typeof activeConfirmHandler === 'function') {
    activeConfirmHandler();
  }
  closeConfirmDialog();
};

cancelConfirmButton.onclick = closeConfirmDialog;
closeConfirmButton.onclick = closeConfirmDialog;
confirmOverlay.addEventListener('click', (event) => {
  if (event.target === confirmOverlay) {
    closeConfirmDialog();
  }
});

// Helper to find or create folder element
function getFolderElement(folderId) {
  return folderList.querySelector(`[data-folder-id="${folderId}"]`);
}

// Helper to find or create chat element
function getChatElement(chatId) {
  return folderList.querySelector(`[data-chat-id="${chatId}"]`);
}

// Update a single folder's active state
function updateFolderActiveState(folderId, isActive) {
  const folderEl = getFolderElement(folderId);
  if (folderEl) {
    const header = folderEl.querySelector('.folder-header');
    if (header) {
      header.classList.toggle('active', isActive);
    }
  }
}

// Update a single folder's expanded state
function updateFolderExpandedState(folderId, isExpanded) {
  const folderEl = getFolderElement(folderId);
  if (folderEl) {
    const toggle = folderEl.querySelector('.folder-toggle');
    const chatsList = folderEl.querySelector('.chat-list');
    if (toggle) {
      toggle.textContent = isExpanded ? '▾' : '▸';
    }
    if (chatsList) {
      chatsList.style.display = isExpanded ? 'flex' : 'none';
    }
  }
}

// Update a single chat's active state
function updateChatActiveState(chatId, isActive) {
  const chatEl = getChatElement(chatId);
  if (chatEl) {
    chatEl.classList.toggle('active', isActive);
  }
}

// Render a single chat element
function renderChat(chat) {
  const chatItem = document.createElement('li');
  chatItem.className = chat.id === appState.selectedChatId ? 'active chat-row' : 'chat-row';
  chatItem.setAttribute('data-chat-id', chat.id);
  chatItem.onclick = () => setState({ selectedChatId: chat.id });

  const info = document.createElement('div');
  info.className = 'chat-row-main';
  const name = document.createElement('span');
  name.textContent = chat.name;
  info.appendChild(name);

  const menuButton = document.createElement('button');
  menuButton.className = 'ghost icon chat-menu-trigger';
  menuButton.textContent = '⋯';
  menuButton.onclick = (e) => {
    e.stopPropagation();
    const wasOpen = openChatMenuId === chat.id;
    openChatMenuId = wasOpen ? null : chat.id;
    // Update menu visibility without full render
    const menu = chatItem.querySelector('.chat-menu');
    if (menu) {
      menu.classList.toggle('show', !wasOpen);
    }
  };

  const menu = document.createElement('div');
  menu.className = 'chat-menu';
  if (openChatMenuId === chat.id) {
    menu.classList.add('show');
  }
  menu.onclick = (e) => e.stopPropagation();

  const renameBtn = document.createElement('button');
  renameBtn.textContent = 'Rename';
  renameBtn.onclick = (e) => {
    e.stopPropagation();
    startChatRename(chat);
  };

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.className = 'danger';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    removeChat(chat.id);
  };

  const moveWrap = document.createElement('div');
  moveWrap.className = 'move-row';
  const moveLabel = document.createElement('label');
  moveLabel.textContent = 'Move to';
  const moveSelect = document.createElement('select');
  appState.folders.forEach((f) => {
    const option = document.createElement('option');
    option.value = f.id;
    option.textContent = f.name;
    option.selected = f.id === chat.folderId;
    moveSelect.appendChild(option);
  });
  moveSelect.onchange = (e) => {
    e.stopPropagation();
    moveChat(chat.id, e.target.value);
  };
  moveSelect.onclick = (e) => e.stopPropagation();
  moveSelect.onmousedown = (e) => e.stopPropagation();
  moveWrap.appendChild(moveLabel);
  moveWrap.appendChild(moveSelect);

  if (appState.editingChatId === chat.id) {
    const renameForm = document.createElement('div');
    renameForm.className = 'rename-row';
    const input = document.createElement('input');
    input.className = 'text-input';
    input.value =
      appState.editingChatDraft !== ''
        ? appState.editingChatDraft
        : chat.name;
    input.placeholder = 'Chat name';
    input.oninput = (e) => {
      e.stopPropagation();
      appState = { ...appState, editingChatDraft: e.target.value, editingChatId: chat.id };
      saveState(appState);
    };

    const actions = document.createElement('div');
    actions.className = 'rename-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = (e) => {
      e.stopPropagation();
      submitChatRename(chat.id);
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ghost';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      cancelChatRename();
    };

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    renameForm.appendChild(input);
    renameForm.appendChild(actions);
    menu.appendChild(renameForm);
  } else {
    menu.appendChild(renameBtn);
  }

  menu.appendChild(deleteBtn);
  menu.appendChild(moveWrap);

  chatItem.appendChild(info);
  chatItem.appendChild(menuButton);
  chatItem.appendChild(menu);
  
  return chatItem;
}

// Render a single folder element with all its chats
function renderFolder(folder) {
    const li = document.createElement('li');
    li.className = 'folder-item';
  li.setAttribute('data-folder-id', folder.id);

    const header = document.createElement('div');
    header.className = 'folder-header';
    if (folder.id === appState.selectedFolderId) {
      header.classList.add('active');
    }
    const headerMain = document.createElement('div');
    headerMain.className = 'folder-header-main';

    const toggle = document.createElement('button');
    toggle.className = 'ghost icon folder-toggle';
    const isExpanded = appState.expandedFolders[folder.id] !== false;
    toggle.textContent = isExpanded ? '▾' : '▸';
    toggle.onclick = (e) => {
      e.stopPropagation();
      const currentlyExpanded = appState.expandedFolders[folder.id] !== false;
      setState({
        expandedFolders: {
          ...appState.expandedFolders,
          [folder.id]: !currentlyExpanded,
        },
      });
    };

    const title = document.createElement('span');
    title.textContent = folder.name;
    headerMain.appendChild(toggle);
    headerMain.appendChild(title);

    headerMain.onclick = () => setState({ selectedFolderId: folder.id });

    const actions = document.createElement('div');
    actions.className = 'folder-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'ghost icon';
    editBtn.textContent = '✎';
    editBtn.title = 'Rename folder';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      startFolderRename(folder);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ghost icon danger';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete folder';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      removeFolder(folder.id);
    };

    const hasChats = appState.chats.some((chat) => chat.folderId === folder.id);
    if (folder.id === 'root') {
      deleteBtn.disabled = true;
      deleteBtn.title = 'Default folder cannot be deleted';
    } else if (hasChats) {
      deleteBtn.title = 'Move chats out before deleting';
    }

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(headerMain);
    header.appendChild(actions);

    li.appendChild(header);

    const chatsList = document.createElement('ul');
    chatsList.className = 'chat-list';
    chatsList.style.display = appState.expandedFolders[folder.id] === false ? 'none' : 'flex';

    if (appState.editingFolderId === folder.id) {
      const renameRow = document.createElement('div');
      renameRow.className = 'folder-rename';
      renameRow.onclick = (e) => e.stopPropagation();

      const input = document.createElement('input');
      input.className = 'text-input';
      input.placeholder = 'Folder name';
      input.value =
        appState.editingFolderDraft !== '' ? appState.editingFolderDraft : folder.name;
      input.oninput = (e) => {
        e.stopPropagation();
        appState = { ...appState, editingFolderDraft: e.target.value, editingFolderId: folder.id };
        saveState(appState);
      };

      const renameActions = document.createElement('div');
      renameActions.className = 'rename-actions';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'primary';
      saveBtn.textContent = 'Save';
      saveBtn.onclick = (e) => {
        e.stopPropagation();
        submitFolderRename(folder.id);
      };

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'ghost';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cancelFolderRename();
      };

      renameActions.appendChild(saveBtn);
      renameActions.appendChild(cancelBtn);

      renameRow.appendChild(input);
      renameRow.appendChild(renameActions);
      li.appendChild(renameRow);
    }

    const chats = appState.chats.filter((chat) => chat.folderId === folder.id);
    chats.forEach((chat) => {
    const chatItem = renderChat(chat);
    chatsList.appendChild(chatItem);
  });

  li.appendChild(chatsList);
  
  return li;
}

// Update an existing folder element in place
function updateFolderElement(folderEl, folder) {
  if (!folderEl) return;
  
  // Update header active state
  const header = folderEl.querySelector('.folder-header');
  if (header) {
    header.classList.toggle('active', folder.id === appState.selectedFolderId);
  }
  
  // Update folder name
  const title = folderEl.querySelector('.folder-header-main span');
  if (title) {
    title.textContent = folder.name;
  }
  
  // Update expanded state
  const toggle = folderEl.querySelector('.folder-toggle');
  const chatsList = folderEl.querySelector('.chat-list');
  const isExpanded = appState.expandedFolders[folder.id] !== false;
  if (toggle) {
    toggle.textContent = isExpanded ? '▾' : '▸';
  }
  if (chatsList) {
    chatsList.style.display = isExpanded ? 'flex' : 'none';
  }
  
  // Handle editing state
  const existingRenameRow = folderEl.querySelector('.folder-rename');
  if (appState.editingFolderId === folder.id) {
    if (!existingRenameRow) {
      const renameRow = document.createElement('div');
      renameRow.className = 'folder-rename';
      renameRow.onclick = (e) => e.stopPropagation();

      const input = document.createElement('input');
      input.className = 'text-input';
      input.placeholder = 'Folder name';
      input.value = appState.editingFolderDraft !== '' ? appState.editingFolderDraft : folder.name;
      input.oninput = (e) => {
        e.stopPropagation();
        appState = { ...appState, editingFolderDraft: e.target.value, editingFolderId: folder.id };
        saveState(appState);
      };

      const renameActions = document.createElement('div');
      renameActions.className = 'rename-actions';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'primary';
      saveBtn.textContent = 'Save';
      saveBtn.onclick = (e) => {
        e.stopPropagation();
        submitFolderRename(folder.id);
      };

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'ghost';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cancelFolderRename();
      };

      renameActions.appendChild(saveBtn);
      renameActions.appendChild(cancelBtn);
      renameRow.appendChild(input);
      renameRow.appendChild(renameActions);
      
      const header = folderEl.querySelector('.folder-header');
      if (header) {
        header.insertAdjacentElement('afterend', renameRow);
      }
    } else {
      const input = existingRenameRow.querySelector('input');
      if (input) {
        input.value = appState.editingFolderDraft !== '' ? appState.editingFolderDraft : folder.name;
      }
    }
  } else if (existingRenameRow) {
    existingRenameRow.remove();
  }
  
  // Update delete button state
  const deleteBtn = folderEl.querySelector('.folder-actions .danger');
  if (deleteBtn) {
    const hasChats = appState.chats.some((chat) => chat.folderId === folder.id);
    if (folder.id === 'root') {
      deleteBtn.disabled = true;
      deleteBtn.title = 'Default folder cannot be deleted';
    } else if (hasChats) {
      deleteBtn.title = 'Move chats out before deleting';
    } else {
      deleteBtn.disabled = false;
      deleteBtn.title = 'Delete folder';
    }
  }
}

// Update an existing chat element in place
function updateChatElement(chatEl, chat) {
  if (!chatEl) return;
  
  // Update active state
  chatEl.classList.toggle('active', chat.id === appState.selectedChatId);
  
  // Update chat name
  const nameSpan = chatEl.querySelector('.chat-row-main span');
  if (nameSpan) {
    nameSpan.textContent = chat.name;
  }
  
  // Update menu visibility
  const menu = chatEl.querySelector('.chat-menu');
  if (menu) {
    menu.classList.toggle('show', openChatMenuId === chat.id);
  }
  
  // Update move select
  const moveSelect = chatEl.querySelector('.move-row select');
  if (moveSelect) {
    moveSelect.value = chat.folderId;
  }
  
  // Handle editing state
  const existingRenameForm = chatEl.querySelector('.rename-row');
  const chatMenu = chatEl.querySelector('.chat-menu');

      if (appState.editingChatId === chat.id) {
    if (!existingRenameForm && chatMenu) {
        const renameForm = document.createElement('div');
        renameForm.className = 'rename-row';
        const input = document.createElement('input');
        input.className = 'text-input';
      input.value = appState.editingChatDraft !== '' ? appState.editingChatDraft : chat.name;
        input.placeholder = 'Chat name';
        input.oninput = (e) => {
          e.stopPropagation();
          appState = { ...appState, editingChatDraft: e.target.value, editingChatId: chat.id };
          saveState(appState);
        };

        const actions = document.createElement('div');
        actions.className = 'rename-actions';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'primary';
        saveBtn.textContent = 'Save';
        saveBtn.onclick = (e) => {
          e.stopPropagation();
          submitChatRename(chat.id);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'ghost';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = (e) => {
          e.stopPropagation();
          cancelChatRename();
        };

        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        renameForm.appendChild(input);
        renameForm.appendChild(actions);
      
      // Remove rename button and add form
      const renameBtn = chatMenu.querySelector('button:first-child');
      if (renameBtn && renameBtn.textContent === 'Rename') {
        renameBtn.replaceWith(renameForm);
      }
    } else if (existingRenameForm) {
      const input = existingRenameForm.querySelector('input');
      if (input) {
        input.value = appState.editingChatDraft !== '' ? appState.editingChatDraft : chat.name;
      }
    }
  } else if (existingRenameForm && chatMenu) {
    // Remove rename form and restore rename button
    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Rename';
    renameBtn.onclick = (e) => {
      e.stopPropagation();
      startChatRename(chat);
    };
    existingRenameForm.replaceWith(renameBtn);
  }
}

function renderFolders() {
  // Get current folder IDs in DOM
  const existingFolderIds = new Set(
    Array.from(folderList.children)
      .map(el => el.getAttribute('data-folder-id'))
      .filter(Boolean)
  );
  const currentFolderIds = new Set(appState.folders.map(f => f.id));
  
  // Remove folders that no longer exist
  existingFolderIds.forEach(folderId => {
    if (!currentFolderIds.has(folderId)) {
      const folderEl = getFolderElement(folderId);
      if (folderEl) {
        folderEl.remove();
      }
    }
  });
  
  // Update or create folders
  appState.folders.forEach((folder, index) => {
    let folderEl = getFolderElement(folder.id);
    const isNew = !folderEl;
    
    if (isNew) {
      // Create new folder element
      folderEl = renderFolder(folder);
      // Insert at correct position
      const nextFolder = appState.folders[index + 1];
      if (nextFolder) {
        const nextEl = getFolderElement(nextFolder.id);
        if (nextEl) {
          folderList.insertBefore(folderEl, nextEl);
      } else {
          folderList.appendChild(folderEl);
        }
      } else {
        folderList.appendChild(folderEl);
      }
    } else {
      // Update existing folder element
      updateFolderElement(folderEl, folder);
      
      // Sync chats in this folder
      const existingChatIds = new Set(
        Array.from(folderEl.querySelectorAll('.chat-list > li'))
          .map(el => el.getAttribute('data-chat-id'))
          .filter(Boolean)
      );
      const currentChats = appState.chats.filter(c => c.folderId === folder.id);
      const currentChatIds = new Set(currentChats.map(c => c.id));
      
      // Remove chats that no longer belong to this folder
      existingChatIds.forEach(chatId => {
        if (!currentChatIds.has(chatId)) {
          const chatEl = getChatElement(chatId);
          if (chatEl) {
            chatEl.remove();
          }
        }
      });
      
      // Add or update chats
      const chatsList = folderEl.querySelector('.chat-list');
      if (chatsList) {
        currentChats.forEach((chat, chatIndex) => {
          let chatEl = getChatElement(chat.id);
          const isNewChat = !chatEl;
          
          if (isNewChat) {
            // Create new chat element
            chatEl = renderChat(chat);
            // Insert at correct position
            const nextChat = currentChats[chatIndex + 1];
            if (nextChat) {
              const nextChatEl = getChatElement(nextChat.id);
              if (nextChatEl && nextChatEl.parentElement === chatsList) {
                chatsList.insertBefore(chatEl, nextChatEl);
              } else {
                chatsList.appendChild(chatEl);
              }
            } else {
              chatsList.appendChild(chatEl);
            }
          } else {
            // Update existing chat element
            updateChatElement(chatEl, chat);
          }
        });
      }
    }
  });
}

let lastRenderedChatId = null;
let lastRenderedMessageCount = 0;

function updateStreamingMessage(content) {
  const messageDivs = messageContainer.querySelectorAll('.message.assistant.streaming');
  if (messageDivs.length > 0) {
    const lastMessageDiv = messageDivs[messageDivs.length - 1];
    const contentDiv = lastMessageDiv.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.textContent = content;
      // Smooth scroll to bottom
      requestAnimationFrame(() => {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    });
      return true;
    }
  }
  return false;
  }

function renderMessages() {
  const chat = getSelectedChat();
  if (!chat) return;
  
  const needsFullRender = 
    lastRenderedChatId !== chat.id ||
    lastRenderedMessageCount !== chat.messages.length ||
    chat.messages.some((msg, idx) => {
      const existingDiv = messageContainer.children[idx];
      if (!existingDiv) return true;
      const isStreaming = msg.role === 'assistant' && msg.streaming;
      if (isStreaming) return false; // Don't rebuild if streaming, we'll update in place
      return existingDiv.className !== `message ${msg.role}`;
    });

  // If we have a streaming message and it's just a content update, update in place
  const streamingMessage = chat.messages.find(m => m.role === 'assistant' && m.streaming);
  if (streamingMessage && !needsFullRender && lastRenderedChatId === chat.id) {
    if (updateStreamingMessage(streamingMessage.content)) {
      return; // Successfully updated in place
    }
  }

  // Full render needed
  lastRenderedChatId = chat.id;
  lastRenderedMessageCount = chat.messages.length;
  
  // Use DocumentFragment for batch DOM operations
  const fragment = document.createDocumentFragment();
  const lastUserIndex = findLastUserIndex(chat.messages);
  chat.messages.forEach((msg, index) => {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;

    const isEditing =
      appState.editingMessageChatId === chat.id &&
      appState.editingMessageIndex === index;

    const isStreamingAssistant = msg.role === 'assistant' && msg.streaming;

    if (isEditing) {
      div.classList.add('editing');
    }

    if (isStreamingAssistant) {
      div.classList.add('streaming');
    }

    if (isEditing) {
      const editBox = document.createElement('div');
      editBox.className = 'message-edit';

      const textarea = document.createElement('textarea');
      textarea.value =
        appState.editingMessageDraft !== ''
          ? appState.editingMessageDraft
          : msg.content;
      textarea.oninput = (e) => {
        appState = { ...appState, editingMessageDraft: e.target.value, editingMessageIndex: index };
        saveState(appState);
      };

      const actions = document.createElement('div');
      actions.className = 'message-edit-actions';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'primary';
      saveBtn.textContent = 'Save';
      saveBtn.onclick = submitMessageEdit;

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'ghost';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = cancelMessageEdit;

      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
      editBox.appendChild(textarea);
      editBox.appendChild(actions);
      div.appendChild(editBox);
    } else {
      const content = document.createElement('div');
      content.className = 'message-content';
      content.textContent = msg.content;
      div.appendChild(content);

      if (msg.role === 'assistant' && !isStreamingAssistant) {
        const copyActions = document.createElement('div');
        copyActions.className = 'message-actions assistant-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'ghost icon copy-button';
        copyBtn.title = 'Copy message';
        copyBtn.textContent = '⧉';
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(msg.content || '');
            toastMessage('Copied to clipboard');
          } catch (err) {
            console.error('Clipboard copy failed', err);
            toastMessage('Unable to copy message');
          }
        };

        copyActions.appendChild(copyBtn);
        div.appendChild(copyActions);
      }
    }

    const isLastUserMessage = index === lastUserIndex;

    if (isLastUserMessage && !isEditing) {
      const actions = document.createElement('div');
      actions.className = 'message-actions';

      const retryBtn = document.createElement('button');
      retryBtn.className = 'ghost icon retry-button';
      retryBtn.title = 'Retry last response';
      retryBtn.textContent = '↻';
      retryBtn.onclick = retryLastMessage;

      actions.appendChild(retryBtn);

      const editBtn = document.createElement('button');
      editBtn.className = 'ghost icon edit-button';
      editBtn.title = 'Edit your last message';
      editBtn.textContent = '✎';
      editBtn.onclick = editLastUserMessage;
      actions.appendChild(editBtn);
      div.appendChild(actions);
    }

    fragment.appendChild(div);
  });
  
  // Batch append all messages at once
  messageContainer.innerHTML = '';
  messageContainer.appendChild(fragment);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function renderFiles() {
  const chat = getSelectedChat();
  
  // Use DocumentFragment for batch DOM operations
  const fragment = document.createDocumentFragment();
  chat.files.forEach((file) => {
    const li = document.createElement('li');
    li.className = 'pill';
    li.textContent = file.name;
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.className = 'remove';
    remove.onclick = () => removeFile(file.id);
    li.appendChild(remove);
    fragment.appendChild(li);
  });
  
  // Batch append all files at once
  fileList.innerHTML = '';
  fileList.appendChild(fragment);
}

function renderPersonas() {
  if (!personasList) return;
  
  // Use DocumentFragment for batch DOM operations
  const fragment = document.createDocumentFragment();

  appState.personas.forEach((persona) => {
    const li = document.createElement('li');
    li.className = 'persona-item';
    const isActive = persona.id === appState.settings.activePersonaId;
    if (isActive) {
      li.classList.add('active');
    }

    const header = document.createElement('div');
    header.className = 'persona-header';

    const info = document.createElement('div');
    info.className = 'persona-info';

    const name = document.createElement('div');
    name.className = 'persona-name';
    name.textContent = persona.name;

    const content = document.createElement('div');
    content.className = 'persona-content';
    content.textContent = persona.content;

    info.appendChild(name);
    info.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'persona-actions';

    if (!isActive) {
      const activateBtn = document.createElement('button');
      activateBtn.className = 'ghost';
      activateBtn.textContent = 'Activate';
      activateBtn.onclick = () => activatePersona(persona.id);
      actions.appendChild(activateBtn);
    }

    // Don't show edit/delete buttons for default persona
    if (!persona.isDefault) {
      const editBtn = document.createElement('button');
      editBtn.className = 'ghost';
      editBtn.textContent = 'Edit';
      editBtn.onclick = () => startPersonaEdit(persona);
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'ghost danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = () => removePersona(persona.id);
      actions.appendChild(deleteBtn);
    }

    header.appendChild(info);
    header.appendChild(actions);
    li.appendChild(header);
    fragment.appendChild(li);
  });
  
  // Batch append all personas at once
  personasList.innerHTML = '';
  personasList.appendChild(fragment);
}

function getModelOptions() {
  return appState.modelOptions?.length ? appState.modelOptions : defaultModelOptions;
}

function getFilteredModels() {
  const searchTerm = (appState.modelSearch || '').toLowerCase();
  const options = getModelOptions();
  if (!searchTerm) return options;
  return options.filter((option) => option.toLowerCase().includes(searchTerm));
}

function selectModel(model) {
  const value = model || 'openrouter/auto';
  // Use setState - will be handled as model selection (no full render)
  setState({
    settings: { ...appState.settings, model: value },
    modelDropdownOpen: false,
    modelSearch: '',
  });
}

function renderModelOptions() {
  const options = getFilteredModels();

  if (modelList) {
    modelList.innerHTML = '';

    if (!options.length) {
      const empty = document.createElement('li');
      empty.className = 'model-empty';
      empty.textContent = 'No models match your search.';
      modelList.appendChild(empty);
    } else {
      options.forEach((value) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'model-option';
        button.textContent = value;
        button.onclick = () => selectModel(value);
        li.appendChild(button);
        modelList.appendChild(li);
      });
    }
  }

  if (modelDropdown) {
    modelDropdown.classList.toggle('show', appState.modelDropdownOpen);
  }

  if (modelToggleButton) {
    modelToggleButton.setAttribute('aria-expanded', appState.modelDropdownOpen ? 'true' : 'false');
    // Update toggle button icon based on state
    modelToggleButton.textContent = appState.modelDropdownOpen ? '▴' : '▾';
  }

  if (modelSearchInput) {
    modelSearchInput.value = appState.modelSearch || '';
  }

  if (refreshModelsButton) {
    refreshModelsButton.disabled = appState.modelOptionsLoading;
    refreshModelsButton.textContent = appState.modelOptionsLoading ? 'Refreshing…' : 'Refresh list';
  }
}

function render() {
  appShell.classList.toggle('sidebar-hidden', appState.sidebarHidden);
  sidebar?.setAttribute('aria-hidden', appState.sidebarHidden ? 'true' : 'false');
  renderFolders();
  renderMessages();
  renderFiles();
  renderModelOptions();
  renderPersonas();
  // On mobile (narrow screens), use down/up arrows; on desktop use left/right
  const isMobile = window.innerWidth <= 900;
  if (isMobile) {
    toggleSidebarButton.textContent = appState.sidebarHidden ? '▾' : '▴';
    toggleSidebarButton.setAttribute('aria-label', appState.sidebarHidden ? 'Show menu' : 'Hide menu');
  } else {
  toggleSidebarButton.textContent = appState.sidebarHidden ? '⟩' : '⟨';
  toggleSidebarButton.setAttribute('aria-label', appState.sidebarHidden ? 'Show menu' : 'Hide menu');
  }
  // Persona tab is now managed separately, no need to set input value here
  settingsModelInput.value = appState.settings.model || 'openrouter/auto';
  settingsApiKeyInput.value = appState.settings.apiKey || '';
  
  // Update tabs (only when full render is needed)
  renderSettingsTabs();
  
  // Update textarea expand state
  if (textareaWrapper) {
    textareaWrapper.classList.toggle('expanded', appState.textareaExpanded);
  }
  if (expandTextareaButton) {
    expandTextareaButton.classList.toggle('expanded', appState.textareaExpanded);
    expandTextareaButton.textContent = appState.textareaExpanded ? '⤡' : '⤢';
    expandTextareaButton.setAttribute('title', appState.textareaExpanded ? 'Collapse message field' : 'Expand message field');
    expandTextareaButton.setAttribute('aria-label', appState.textareaExpanded ? 'Collapse message field' : 'Expand message field');
  }
  
  // Modal visibility is now handled in setState, but keep this for initial render
  const shouldShowFolderModal = appState.newFolderModalOpen;
  if (folderOverlay) {
  folderOverlay.classList.toggle('show', shouldShowFolderModal);
  }
  if (folderNameInput) {
  folderNameInput.value = appState.newFolderDraft || '';
  }
  if (shouldShowFolderModal && !wasFolderModalOpen) {
    folderNameInput.focus();
  }
  wasFolderModalOpen = shouldShowFolderModal;

  // Update persona modal visibility
  if (personaModal) {
    personaModal.classList.toggle('show', appState.newPersonaModalOpen);
  }
}

function addChat(folderId) {
  const chat = {
    id: uuid(),
    name: 'Untitled chat',
    folderId: folderId || 'root',
    files: [],
    messages: [],
  };
  
  // Update state
  appState.chats = [...appState.chats, chat];
  appState.selectedChatId = chat.id;
  saveState(appState);
  
  // Add chat element to DOM without full re-render
  const folderEl = getFolderElement(chat.folderId);
  if (folderEl) {
    const chatsList = folderEl.querySelector('.chat-list');
    if (chatsList) {
      const chatItem = renderChat(chat);
      chatsList.appendChild(chatItem);
      // Ensure folder is expanded
      const isExpanded = appState.expandedFolders[chat.folderId] !== false;
      if (!isExpanded) {
        updateFolderExpandedState(chat.folderId, true);
        appState.expandedFolders = { ...appState.expandedFolders, [chat.folderId]: true };
        saveState(appState);
      }
      // Update active state
      updateChatActiveState(chat.id, true);
    } else {
      // Folder structure doesn't exist, need full render
      render();
      return;
    }
  } else {
    // Folder doesn't exist, need full render
    render();
    return;
  }
  
  // Render other parts that might be affected
  renderMessages();
  renderFiles();
}

function removeChat(chatId) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(chatId);
  if (!chat) return;
  openConfirmDialog({
    title: 'Delete chat',
    context: 'Chats',
    description: `Delete "${chat.name || 'Untitled chat'}"? This will remove all messages for this chat.`,
    confirmLabel: 'Delete chat',
    confirmVariant: 'danger',
    onConfirm: () => {
      const remaining = appState.chats.filter((c) => c.id !== chatId);
      if (!remaining.length) {
        const baseFolders = appState.folders.length
          ? appState.folders
          : [{ id: 'root', name: 'Unsorted' }];
        const hasRoot = baseFolders.some((f) => f.id === 'root');
        const folders = hasRoot ? baseFolders : [{ id: 'root', name: 'Unsorted' }, ...baseFolders];
        const targetFolderId =
          folders.find((f) => f.id === appState.selectedFolderId)?.id || 'root';
        const newChat = {
          id: uuid(),
          name: 'New chat',
          folderId: targetFolderId,
          files: [],
          messages: [],
        };
        openChatMenuId = null;
        // Need full render for this case
        setState({
          chats: [newChat],
          selectedChatId: newChat.id,
          folders,
          expandedFolders: { ...appState.expandedFolders, [targetFolderId]: true },
        });
        toastMessage('Chat deleted. Created a fresh chat.');
        return;
      }
      
      // Remove chat element from DOM
      const chatEl = getChatElement(chatId);
      if (chatEl) {
        chatEl.remove();
      }
      
      const newSelected =
        chatId === appState.selectedChatId ? remaining[0].id : appState.selectedChatId;
      openChatMenuId = null;
      
      // Update state
      appState.chats = remaining;
      appState.selectedChatId = newSelected;
      saveState(appState);
      
      // Update active state if needed
      if (chatId === appState.selectedChatId && newSelected) {
        updateChatActiveState(newSelected, true);
      }
      
      // Render messages and files for new selected chat
      renderMessages();
      renderFiles();
      
      toastMessage('Chat deleted');
    },
  });
}

function renameChat(chatId) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(chatId);
  if (!chat) return;
  const draft =
    appState.editingChatDraft !== '' ? appState.editingChatDraft : chat.name || '';
  const name = draft.trim();
  if (!name) {
    toastMessage('Chat name cannot be empty');
    return;
  }
  
  // Update state
  const chats = appState.chats.map((entry) =>
    entry.id === chatId ? { ...entry, name } : entry,
  );
  openChatMenuId = null;
  appState.chats = chats;
  appState.editingChatId = null;
  appState.editingChatDraft = '';
  saveState(appState);
  
  // Update chat element in DOM
  const chatEl = getChatElement(chatId);
  if (chatEl) {
    const chatMap = buildChatMap();
    updateChatElement(chatEl, chatMap.get(chatId));
  } else {
    // Element doesn't exist, need full render
    render();
  }
}

function startChatRename(chat) {
  appState.editingChatId = chat.id;
  appState.editingChatDraft = chat.name || '';
  saveState(appState);
  
  // Update chat element to show editing UI
  const chatEl = getChatElement(chat.id);
  if (chatEl) {
    updateChatElement(chatEl, chat);
  } else {
    render();
  }
}

function submitChatRename(chatId) {
  renameChat(chatId);
}

function cancelChatRename() {
  const prevEditingId = appState.editingChatId;
  openChatMenuId = null;
  appState.editingChatId = null;
  appState.editingChatDraft = '';
  saveState(appState);
  
  // Update chat element to hide editing UI
  if (prevEditingId) {
    const chat = appState.chats.find(c => c.id === prevEditingId);
    if (chat) {
      const chatEl = getChatElement(prevEditingId);
      if (chatEl) {
        updateChatElement(chatEl, chat);
      } else {
        render();
      }
    }
  }
}

function renameFolder(folderId) {
  const folderMap = buildFolderMap();
  const folder = folderMap.get(folderId);
  if (!folder) return;
  const draft =
    appState.editingFolderDraft !== '' ? appState.editingFolderDraft : folder.name || '';
  const name = draft.trim();
  if (!name) {
    toastMessage('Folder name cannot be empty');
    return;
  }
  
  // Update state
  const folders = appState.folders.map((entry) =>
    entry.id === folderId ? { ...entry, name } : entry,
  );
  appState.folders = folders;
  appState.editingFolderId = null;
  appState.editingFolderDraft = '';
  saveState(appState);
  
  // Update folder element in DOM
  const folderEl = getFolderElement(folderId);
  if (folderEl) {
    updateFolderElement(folderEl, folders.find(f => f.id === folderId));
  } else {
    // Element doesn't exist, need full render
    render();
  }
}

function startFolderRename(folder) {
  appState.editingFolderId = folder.id;
  appState.editingFolderDraft = folder.name || '';
  saveState(appState);
  
  // Update folder element to show editing UI
  const folderEl = getFolderElement(folder.id);
  if (folderEl) {
    updateFolderElement(folderEl, folder);
  } else {
    render();
  }
}

function submitFolderRename(folderId) {
  renameFolder(folderId);
}

function cancelFolderRename() {
  const prevEditingId = appState.editingFolderId;
  appState.editingFolderId = null;
  appState.editingFolderDraft = '';
  saveState(appState);
  
  // Update folder element to hide editing UI
  if (prevEditingId) {
    const folder = appState.folders.find(f => f.id === prevEditingId);
    if (folder) {
      const folderEl = getFolderElement(prevEditingId);
      if (folderEl) {
        updateFolderElement(folderEl, folder);
      } else {
        render();
      }
    }
  }
}

function openNewFolderModal() {
  setState({ newFolderModalOpen: true, newFolderDraft: '' });
}

function closeNewFolderModal() {
  setState({ newFolderModalOpen: false, newFolderDraft: '' });
}

function addFolder() {
  const name = (appState.newFolderDraft || '').trim();
  if (!name) {
    toastMessage('Folder name cannot be empty');
    return;
  }
  const folder = { id: uuid(), name };
  
  // Update state
  appState.folders = [...appState.folders, folder];
  appState.selectedFolderId = folder.id;
  appState.expandedFolders = { ...appState.expandedFolders, [folder.id]: true };
  appState.newFolderModalOpen = false;
  appState.newFolderDraft = '';
  saveState(appState);
  
  // Add folder element to DOM without full re-render
  const folderEl = renderFolder(folder);
  folderList.appendChild(folderEl);
  
  // Update active state
  updateFolderActiveState(folder.id, true);
  
  // Close modal
  const folderOverlay = document.getElementById('folder-overlay');
  if (folderOverlay) {
    folderOverlay.classList.remove('show');
  }
}

function removeFolder(folderId) {
  if (folderId === 'root') {
    toastMessage('Default folder cannot be deleted');
    return;
  }
  const folderMap = buildFolderMap();
  const folder = folderMap.get(folderId);
  if (!folder) return;
  const hasChats = appState.chats.some((chat) => chat.folderId === folderId);
  if (hasChats) {
    openConfirmDialog({
      title: 'Cannot delete folder',
      context: 'Folders',
      description: 'This folder contains chats. Move or delete them before removing the folder.',
      confirmLabel: 'Got it',
      confirmVariant: '',
      onConfirm: () => {},
    });
    return;
  }
  openConfirmDialog({
    title: 'Delete folder',
    context: 'Folders',
    description: `Are you sure you want to delete "${folder.name}"? This action cannot be undone.`,
    confirmLabel: 'Delete folder',
    confirmVariant: 'danger',
    onConfirm: () => {
      // Remove folder element from DOM
      const folderEl = getFolderElement(folderId);
      if (folderEl) {
        folderEl.remove();
      }
      
      // Update state
      const folders = appState.folders.filter((entry) => entry.id !== folderId);
      const selectedFolderId =
        appState.selectedFolderId === folderId ? 'root' : appState.selectedFolderId;
      const expandedFolders = { ...appState.expandedFolders };
      delete expandedFolders[folderId];
      const editingFolderState =
        appState.editingFolderId === folderId
          ? { editingFolderId: null, editingFolderDraft: '' }
          : {};
      
      appState.folders = folders;
      appState.selectedFolderId = selectedFolderId;
      appState.expandedFolders = expandedFolders;
      if (editingFolderState.editingFolderId !== undefined) {
        appState.editingFolderId = editingFolderState.editingFolderId;
        appState.editingFolderDraft = editingFolderState.editingFolderDraft || '';
      }
      saveState(appState);
      
      // Update active state if needed
      if (appState.selectedFolderId !== folderId) {
        updateFolderActiveState(selectedFolderId, true);
      }
      
      toastMessage('Folder deleted');
    },
  });
}

function removeFile(fileId) {
  const chat = getSelectedChat();
  chat.files = chat.files.filter((f) => f.id !== fileId);
  const chats = appState.chats.map((c) => (c.id === chat.id ? chat : c));
  setState({ chats });
}

function persistChatUpdates(partial) {
  const chats = appState.chats.map((chat) =>
    chat.id === appState.selectedChatId ? { ...chat, ...partial } : chat,
  );
  appState.chats = chats;
  saveState(appState);
  
  // For streaming updates, update in place without full render
  if (partial.messages) {
    const streamingMsg = partial.messages.find(m => m.role === 'assistant' && m.streaming);
    if (streamingMsg && lastRenderedChatId === appState.selectedChatId) {
      // Update streaming message in place
      if (updateStreamingMessage(streamingMsg.content)) {
        return; // Successfully updated in place, skip full render
      }
    }
  }
  
  // Full render needed
  render();
}

function findLastUserIndex(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      return i;
    }
  }
  return -1;
}

function moveChat(chatId, folderId) {
  const chatMap = buildChatMap();
  const chat = chatMap.get(chatId);
  if (!chat) return;
  
  // Close the menu before moving
  const chatEl = getChatElement(chatId);
  if (chatEl) {
    const menu = chatEl.querySelector('.chat-menu');
    if (menu) {
      menu.classList.remove('show');
    }
  }
  openChatMenuId = null;
  
  // Update state
  const chats = appState.chats.map((c) =>
    c.id === chatId ? { ...c, folderId } : c,
  );
  appState.chats = chats;
  appState.selectedFolderId = folderId;
  saveState(appState);
  
  // Move chat element in DOM
  if (chatEl) {
    // Remove from old folder
    chatEl.remove();
    
    // Add to new folder
    const newFolderEl = getFolderElement(folderId);
    if (newFolderEl) {
      const chatsList = newFolderEl.querySelector('.chat-list');
      if (chatsList) {
        // Update the chat element's move select to reflect new folder
        const moveSelect = chatEl.querySelector('.move-row select');
        if (moveSelect) {
          moveSelect.value = folderId;
        }
        
        chatsList.appendChild(chatEl);
        
        // Ensure folder is expanded
        const isExpanded = appState.expandedFolders[folderId] !== false;
        if (!isExpanded) {
          updateFolderExpandedState(folderId, true);
          appState.expandedFolders = { ...appState.expandedFolders, [folderId]: true };
          saveState(appState);
        }
      } else {
        // Folder structure doesn't exist, need full render
        render();
        return;
      }
    } else {
      // Folder doesn't exist, need full render
      render();
      return;
    }
  } else {
    // Chat element doesn't exist, need full render
    render();
    return;
  }
  
  // Update folder active state
  updateFolderActiveState(folderId, true);
}

async function handleSend() {
  const chat = getSelectedChat();
  if (!chat) return;
  const content = promptInput.value.trim();
  if (!content) return;
  if (isRequestPending) {
    toastMessage('Please cancel or wait for the current response first');
    return;
  }
  promptInput.value = '';
  
  // Check for canvas commands
  const canvasCommand = parseCanvasCommand(content);
  if (canvasCommand && appState.openCanvasId) {
    // Route to canvas edit flow
    requestCanvasEdit(appState.openCanvasId, content);
    
    // Also add to chat history for context
    const userMessage = { role: 'user', content };
    const messageHistory = [...chat.messages, userMessage];
    const chats = appState.chats.map((c) =>
      c.id === chat.id ? { ...c, messages: messageHistory } : c,
    );
    appState.chats = chats;
    saveState(appState);
    renderMessages();
    return;
  }
  
  // Normal chat flow
  const userMessage = { role: 'user', content };
  const messageHistory = [...chat.messages, userMessage];
  sendChatCompletion(messageHistory);
}

function setRequestPending(pending) {
  isRequestPending = pending;
  sendButton.disabled = pending;
  cancelButton.disabled = !pending;
}

async function sendChatCompletion(messageHistory) {
  const chat = getSelectedChat();
  if (!chat || !messageHistory.length) return;

  let assistantContent = '';
  const pendingMessage = { role: 'assistant', content: '', streaming: true };
  
  // Add user message and empty streaming message, then render once
  const chats = appState.chats.map((c) =>
    c.id === chat.id ? { ...c, messages: [...messageHistory, pendingMessage] } : c,
  );
  appState.chats = chats;
  saveState(appState);
  render(); // Initial render to show loading state
  
  const controller = new AbortController();
  activeAbortController = controller;
  setRequestPending(true);

  try {
    const data = await performChatRequest({
      chat,
      messageHistory,
      signal: controller.signal,
      onChunk: (chunk) => {
        if (!chunk) return;
        assistantContent += chunk;
        // Update state for persistence
        const chat = getSelectedChat();
        if (chat) {
          const updatedMessages = chat.messages.map((msg, idx) => {
            if (idx === chat.messages.length - 1 && msg.role === 'assistant' && msg.streaming) {
              return { ...msg, content: assistantContent };
            }
            return msg;
          });
          const chats = appState.chats.map((c) =>
            c.id === chat.id ? { ...c, messages: updatedMessages } : c,
          );
          appState.chats = chats;
          // Don't save state on every chunk to avoid performance issues
        }
        // Update streaming message in place without full render
        updateStreamingMessage(assistantContent);
      },
    });
    const finalContent = data?.content || assistantContent || '(no content returned)';
    const assistantMessage = { role: 'assistant', content: finalContent, streaming: false };
    const finalChats = appState.chats.map((c) =>
      c.id === chat.id ? { ...c, messages: [...messageHistory, assistantMessage] } : c,
    );
    appState.chats = finalChats;
    saveState(appState);
    render(); // Final render to remove streaming class and add copy button
  } catch (err) {
    if (err.name === 'AbortError') {
      const canceledChats = appState.chats.map((c) =>
        c.id === chat.id ? { ...c, messages: messageHistory } : c,
      );
      appState.chats = canceledChats;
      saveState(appState);
      render();
      toastMessage('Request canceled');
      return;
    }
    const errorChats = appState.chats.map((c) =>
      c.id === chat.id ? { ...c, messages: messageHistory } : c,
    );
    appState.chats = errorChats;
    saveState(appState);
    render();
    toastMessage(err.message, 3200);
  } finally {
    if (activeAbortController === controller) {
      activeAbortController = null;
    }
    setRequestPending(false);
  }
}

async function readEventStream(response, onChunk) {
  if (!response.body) {
    throw new Error('Streaming not supported in this browser');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let doneReading = false;
  let hasValidData = false;
  let hasSeenDataPrefix = false;

  while (!doneReading) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop();

    for (const event of events) {
      // Split event into lines, handling SSE format properly
      const rawLines = event.split('\n');
      const lines = [];
      
      for (const rawLine of rawLines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue; // Skip empty lines
        
        // Skip SSE comment lines (starting with :)
        if (trimmed.startsWith(':')) {
          continue;
        }
        
        // Skip SSE event type declarations
        if (trimmed.startsWith('event:')) {
          continue;
        }
        
        // Extract data from "data: ..." lines
        if (trimmed.startsWith('data:')) {
          const dataContent = trimmed.substring(5).trim();
          if (dataContent) {
            lines.push(dataContent);
            hasSeenDataPrefix = true;
          }
        } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          // Might be JSON without data: prefix
          lines.push(trimmed);
        }
        // Otherwise skip (status messages, etc.)
      }
      
      for (const line of lines) {
        if (line === '[DONE]') {
          doneReading = true;
          break;
        }
        
        try {
          const parsed = JSON.parse(line);
          // Check for error in response
          if (parsed.error) {
            const error = new Error(parsed.error.message || parsed.error || 'API error');
            error.responseContent = JSON.stringify(parsed);
            throw error;
          }
          const delta =
            parsed?.choices?.[0]?.delta?.content || parsed?.choices?.[0]?.message?.content || '';
          if (delta) {
            hasValidData = true;
            fullText += delta;
            if (onChunk) onChunk(delta, fullText);
          }
        } catch (err) {
          // If it's an error object we created, re-throw it
          if (err.responseContent) {
            throw err;
          }
          // Skip lines that don't parse as JSON (status messages, etc.)
          // Only log if it looks like it might be an actual error
          if (line.startsWith('{') || line.startsWith('[')) {
            // This looked like JSON but failed to parse - might be malformed
            console.warn('Failed to parse stream chunk as JSON:', line.substring(0, CONFIG.ERROR_MESSAGE_PREVIEW_LENGTH));
          }
          // Otherwise, it's probably a status message, just skip it
        }
      }
      if (doneReading) break;
    }
  }

  // Only throw error if we expected data but got none, and it's not just status messages
  if (!hasValidData && fullText.length === 0 && hasSeenDataPrefix) {
    const error = new Error('Stream completed but contained no valid content');
    error.responseContent = buffer;
    throw error;
  }

  // If we got some text but no valid JSON data, and it's not just status messages
  if (!hasValidData && fullText.length > 0 && !fullText.match(/^[:a-zA-Z\s]+$/)) {
    // If it doesn't look like just status messages, it might be an error
    const error = new Error('Stream did not contain valid JSON data: ' + fullText.substring(0, CONFIG.ERROR_MESSAGE_PREVIEW_LENGTH));
    error.responseContent = fullText;
    throw error;
  }

  return fullText;
}

async function performChatRequest({ chat, messageHistory, signal, onChunk }) {
  // Build canvas context for all canvases in this chat
  let canvasContext = '';
  if (chat.canvases && chat.canvases.length > 0) {
    const canvasSections = chat.canvases
      .filter(c => c && c.blocks && c.blocks.length > 0)
      .map(canvas => {
        const blocksText = canvas.blocks.map((block, idx) => {
          return `  [Block ${idx + 1}]\n  Block ID: "${block.id}"\n  Content:\n  ${block.content}`;
        }).join('\n\n');
        return `=== ${canvas.name} ===\n${blocksText}`;
      }).join('\n\n');
    
    if (canvasSections) {
      canvasContext = `\n\nCanvas Documents in this Chat:\n${canvasSections}`;
    }
  }
  
  // Prepend canvas context to the first user message if canvases exist
  let enhancedMessageHistory = [...messageHistory];
  if (canvasContext && enhancedMessageHistory.length > 0) {
    const firstUserMessage = enhancedMessageHistory.find(m => m.role === 'user');
    if (firstUserMessage) {
      const firstUserIndex = enhancedMessageHistory.indexOf(firstUserMessage);
      enhancedMessageHistory = [
        ...enhancedMessageHistory.slice(0, firstUserIndex),
        { ...firstUserMessage, content: firstUserMessage.content + canvasContext },
        ...enhancedMessageHistory.slice(firstUserIndex + 1),
      ];
    }
  }
  
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        messages: enhancedMessageHistory.map(({ role, content }) => ({ role, content })),
        model: appState.settings.model,
        persona: getActivePersona(),
        files: chat.files || [],
        stream: true,
        apiKey: appState.settings.apiKey || undefined,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    const isStream = contentType.includes('text/event-stream');

    if (response.ok && isStream) {
      const content = await readEventStream(response, onChunk);
      return { content };
    }

    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      // Ignore JSON parse issues and fall back to generic errors below.
    }

    if (response.ok) {
      if (data) return data;
      throw new Error('Invalid response from server');
    }

    const shouldRetry = response.status === CONFIG.RATE_LIMIT_STATUS && attempt < retryDelays.length;
    if (shouldRetry) {
      await wait(retryDelays[attempt]);
      continue;
    }

    const message = data?.error || `Failed to fetch response (status ${response.status})`;
    throw new Error(message);
  }

  throw new Error('Failed to fetch response');
}

async function refreshModelOptions() {
  if (appState.modelOptionsLoading) return;
  setState({ modelOptionsLoading: true });

  try {
    const response = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: appState.settings.apiKey || undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error || `Unable to refresh models (status ${response.status})`);
    }

    const models = Array.isArray(data?.models) ? data.models.filter(Boolean) : [];

    if (!models.length) {
      throw new Error('No models returned from OpenRouter');
    }

    const uniqueModels = Array.from(new Set([...models, ...defaultModelOptions]));

    setState({ modelOptions: uniqueModels, modelOptionsLoading: false });
    toastMessage('Model list refreshed');
  } catch (err) {
    console.error('Failed to refresh model options', err);
    toastMessage(err.message || 'Failed to refresh model list');
    setState({ modelOptionsLoading: false });
  }
}

function retryLastMessage() {
  const chat = getSelectedChat();
  if (!chat || !chat.messages.length) return;

  const lastUserIndex = findLastUserIndex(chat.messages);

  if (lastUserIndex === -1) {
    toastMessage('No user message to retry');
    return;
  }

  const messageHistory = chat.messages.slice(0, lastUserIndex + 1);
  sendChatCompletion(messageHistory);
}

function editLastUserMessage() {
  const chat = getSelectedChat();
  if (!chat || !chat.messages.length) return;

  const lastUserIndex = findLastUserIndex(chat.messages);
  if (lastUserIndex === -1) {
    toastMessage('No user message to edit');
    return;
  }

  const lastUserMessage = chat.messages[lastUserIndex];
  setState({
    editingMessageChatId: chat.id,
    editingMessageIndex: lastUserIndex,
    editingMessageDraft: lastUserMessage.content || '',
  });
}

function cancelMessageEdit() {
  setState({
    editingMessageChatId: null,
    editingMessageIndex: null,
    editingMessageDraft: '',
  });
}

function activatePersona(personaId) {
  setState({
    settings: { ...appState.settings, activePersonaId: personaId },
  });
  toastMessage('Persona activated');
}

function startPersonaEdit(persona) {
  if (persona.isDefault) {
    toastMessage('The default persona cannot be edited');
    return;
  }
  const draft = appState.editingPersonaDraft.name || appState.editingPersonaDraft.content
    ? appState.editingPersonaDraft
    : { name: persona.name, content: persona.content };
  setState({
    editingPersonaId: persona.id,
    editingPersonaDraft: draft,
    newPersonaModalOpen: true,
  });
  personaModalTitle.textContent = 'Edit Persona';
  personaNameInput.value = draft.name;
  personaContentInput.value = draft.content;
  personaModal.classList.add('show');
    setTimeout(() => personaNameInput.focus(), CONFIG.FOCUS_DELAY_MS);
}

function startPersonaCreate() {
  const draft = appState.editingPersonaDraft.name || appState.editingPersonaDraft.content
    ? appState.editingPersonaDraft
    : { name: '', content: '' };
  setState({
    editingPersonaId: null,
    editingPersonaDraft: draft,
    newPersonaModalOpen: true,
  });
  personaModalTitle.textContent = 'New Persona';
  personaNameInput.value = draft.name;
  personaContentInput.value = draft.content;
  personaModal.classList.add('show');
    setTimeout(() => personaNameInput.focus(), CONFIG.FOCUS_DELAY_MS);
}

function closePersonaModal() {
  personaModal.classList.remove('show');
  setState({
    editingPersonaId: null,
    editingPersonaDraft: { name: '', content: '' },
    newPersonaModalOpen: false,
  });
}

function savePersona() {
  const name = personaNameInput.value.trim();
  const content = personaContentInput.value.trim();

  if (!name) {
    toastMessage('Persona name cannot be empty');
    return;
  }

  if (!content) {
    toastMessage('Persona content cannot be empty');
    return;
  }

  if (appState.editingPersonaId) {
    // Edit existing persona
    const personas = appState.personas.map((p) =>
      p.id === appState.editingPersonaId
        ? { ...p, name, content }
        : p,
    );
    setState({ personas, editingPersonaId: null, editingPersonaDraft: { name: '', content: '' }, newPersonaModalOpen: false });
    toastMessage('Persona updated');
  } else {
    // Create new persona
    const newPersona = {
      id: uuid(),
      name,
      content,
    };
    setState({
      personas: [...appState.personas, newPersona],
      editingPersonaDraft: { name: '', content: '' },
      newPersonaModalOpen: false,
    });
    toastMessage('Persona created');
  }
  closePersonaModal();
}

function removePersona(personaId) {
  const personaMap = buildPersonaMap();
  const persona = personaMap.get(personaId);
  if (!persona) return;

  if (persona.isDefault) {
    toastMessage('The default persona cannot be deleted');
    return;
  }

  if (personaId === appState.settings.activePersonaId) {
    toastMessage('Cannot delete the active persona. Activate another persona first.');
    return;
  }

  if (appState.personas.length <= 1) {
    toastMessage('Cannot delete the last persona. At least one persona is required.');
    return;
  }

  openConfirmDialog({
    title: 'Delete persona',
    context: 'Personas',
    description: `Are you sure you want to delete "${persona.name}"? This action cannot be undone.`,
    confirmLabel: 'Delete persona',
    confirmVariant: 'danger',
    onConfirm: () => {
      const personas = appState.personas.filter((p) => p.id !== personaId);
      setState({ personas });
      toastMessage('Persona deleted');
    },
  });
}

function submitMessageEdit() {
  const { editingMessageChatId, editingMessageIndex } = appState;
  if (editingMessageIndex === null || !editingMessageChatId) return;
  const chat = appState.chats.find((c) => c.id === editingMessageChatId);
  if (!chat) return;

  const draft = appState.editingMessageDraft || '';
  const trimmed = draft.trim();

  if (!trimmed) {
    toastMessage('Message cannot be empty');
    return;
  }

  const updatedMessages = chat.messages.map((msg, idx) =>
    idx === editingMessageIndex ? { ...msg, content: trimmed } : msg,
  );

  const chats = appState.chats.map((c) =>
    c.id === chat.id ? { ...c, messages: updatedMessages } : c,
  );

  setState({
    chats,
    editingMessageChatId: null,
    editingMessageIndex: null,
    editingMessageDraft: '',
  });

  toastMessage('Message updated');
}

function cancelActiveRequest() {
  if (activeAbortController) {
    activeAbortController.abort();
  }
}

function handleFileUpload(event) {
  const files = Array.from(event.target.files || []);
  const chat = getSelectedChat();
  if (!chat) return;
  const readerPromises = files.map((file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: uuid(), name: file.name, content: reader.result });
      reader.onerror = reject;
      reader.readAsText(file);
    }),
  );

  Promise.all(readerPromises)
    .then((uploads) => {
      persistChatUpdates({ files: [...chat.files, ...uploads] });
      toastMessage('Files added to context');
      fileInput.value = '';
    })
    .catch(() => toastMessage('Failed to read file'));
}

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    handleSend();
  }
});

sendButton.addEventListener('click', handleSend);
cancelButton.addEventListener('click', cancelActiveRequest);

if (expandTextareaButton) {
  expandTextareaButton.addEventListener('click', () => {
    setState({ textareaExpanded: !appState.textareaExpanded });
  });
}
newChatButton.addEventListener('click', () => addChat(appState.selectedFolderId || 'root'));
fileInput.addEventListener('change', handleFileUpload);
newFolderButton.addEventListener('click', openNewFolderModal);
toggleSidebarButton.addEventListener('click', () => setState({ sidebarHidden: !appState.sidebarHidden }));
function switchSettingsTab(tabName) {
  setState({ activeSettingsTab: tabName });
}

settingsButton.addEventListener('click', () => {
  settingsOverlay.classList.add('show');
  // Focus on the first input of the active tab
  const activeTab = appState.activeSettingsTab || 'model';
  if (activeTab === 'model') {
    setTimeout(() => settingsModelInput.focus(), CONFIG.FOCUS_DELAY_MS);
  }
});
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) {
    settingsOverlay.classList.remove('show');
  }
});
refreshModelsButton.addEventListener('click', () => {
  refreshModelOptions();
});
folderOverlay.addEventListener('click', (e) => {
  if (e.target === folderOverlay) {
    closeNewFolderModal();
  }
});
createFolderButton.addEventListener('click', addFolder);
cancelFolderButton.addEventListener('click', closeNewFolderModal);
closeFolderButton.addEventListener('click', closeNewFolderModal);
folderNameInput.addEventListener('input', (e) => {
  setState({ newFolderDraft: e.target.value });
});
folderNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addFolder();
  } else if (e.key === 'Escape') {
    closeNewFolderModal();
  }
});
closeSettingsButtons.forEach((btn) =>
  btn.addEventListener('click', () => settingsOverlay.classList.remove('show')),
);

if (tabModelButton) {
  tabModelButton.addEventListener('click', () => switchSettingsTab('model'));
}

if (tabPersonaButton) {
  tabPersonaButton.addEventListener('click', () => switchSettingsTab('persona'));
}

if (tabThemeButton) {
  tabThemeButton.addEventListener('click', () => switchSettingsTab('theme'));
}

function renderThemeSettings() {
  if (!appState.theme) return;
  
  // Update mode buttons
  if (themeModeDarkButton && themeModeLightButton) {
    themeModeDarkButton.classList.toggle('active', appState.theme.mode === 'dark');
    themeModeLightButton.classList.toggle('active', appState.theme.mode === 'light');
  }
  
  // Update hue slider
  if (themeHueInput) {
    themeHueInput.value = appState.theme.hue;
  }
  
  // Update hue value display
  if (themeHueValue) {
    themeHueValue.textContent = `${appState.theme.hue}°`;
  }
  
  // Update hue indicator color
  if (themeHueIndicator) {
    const colors = getThemeColors(appState.theme.mode, appState.theme.hue);
    themeHueIndicator.style.background = colors.accent;
  }
}

function updateThemeMode(mode) {
  setState({ theme: { ...appState.theme, mode } });
  renderThemeSettings();
}

function updateThemeHue(hue) {
  setState({ theme: { ...appState.theme, hue: parseInt(hue, 10) } });
  renderThemeSettings();
}

if (themeModeDarkButton) {
  themeModeDarkButton.addEventListener('click', () => updateThemeMode('dark'));
}

if (themeModeLightButton) {
  themeModeLightButton.addEventListener('click', () => updateThemeMode('light'));
}

if (themeHueInput) {
  themeHueInput.addEventListener('input', (e) => {
    const hue = parseInt(e.target.value, 10);
    // Update preview immediately
    if (themeHueValue) {
      themeHueValue.textContent = `${hue}°`;
    }
    if (themeHueIndicator) {
      const isLight = appState.theme.mode === 'light';
      const accentS = isLight ? 60 : 70;
      const accentL = isLight ? 45 : 50;
      themeHueIndicator.style.background = `hsl(${hue}, ${accentS}%, ${accentL}%)`;
    }
    // Update theme
    updateThemeHue(hue);
  });
}

if (addPersonaButton) {
  addPersonaButton.addEventListener('click', startPersonaCreate);
}

if (savePersonaButton) {
  savePersonaButton.addEventListener('click', savePersona);
}

if (cancelPersonaButton) {
  cancelPersonaButton.addEventListener('click', closePersonaModal);
}

if (closePersonaModalButton) {
  closePersonaModalButton.addEventListener('click', closePersonaModal);
}

if (personaModal) {
  personaModal.addEventListener('click', (e) => {
    if (e.target === personaModal) {
      closePersonaModal();
    }
  });
}

if (personaNameInput) {
  personaNameInput.addEventListener('input', (e) => {
    appState = {
      ...appState,
      editingPersonaDraft: { ...appState.editingPersonaDraft, name: e.target.value },
    };
    saveState(appState);
  });
  personaNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      personaContentInput.focus();
    }
  });
}

if (personaContentInput) {
  personaContentInput.addEventListener('input', (e) => {
    appState = {
      ...appState,
      editingPersonaDraft: { ...appState.editingPersonaDraft, content: e.target.value },
    };
    saveState(appState);
  });
  personaContentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      savePersona();
    }
  });
}

settingsApiKeyInput.addEventListener('input', (e) => {
  // Update API key directly without triggering full render
  appState.settings.apiKey = e.target.value;
  saveState(appState);
  // No render needed - just save the value
});
settingsModelInput.addEventListener('input', (e) => {
  const value = e.target.value;
  // Use setState but it will be handled as model search only
  setState({
    settings: { ...appState.settings, model: value || 'openrouter/auto' },
    modelSearch: value,
  });
});

// Removed auto-open on focus - dropdown only opens via toggle button

if (modelSearchInput) {
  modelSearchInput.addEventListener('input', (e) => {
    // Use setState - will be handled as model search only
    setState({ modelSearch: e.target.value });
  });
}

if (modelToggleButton) {
  modelToggleButton.addEventListener('click', () => {
    setState({ modelDropdownOpen: !appState.modelDropdownOpen });
  });
}

document.addEventListener('click', (event) => {
  const target = event.target;

  if (openChatMenuId) {
    if (target.closest('.chat-menu') || target.closest('.chat-menu-trigger')) return;
    // Close menu using granular update
    const chatEl = getChatElement(openChatMenuId);
    if (chatEl) {
      const menu = chatEl.querySelector('.chat-menu');
      if (menu) {
        menu.classList.remove('show');
      }
    }
    openChatMenuId = null;
  }

  const clickedModelField = target.closest('.model-field');
  if (!clickedModelField && appState.modelDropdownOpen) {
    setState({ modelDropdownOpen: false, modelSearch: '' });
  }
});

function checkScreenWidth() {
  const isNarrow = window.innerWidth <= 900;
  if (isNarrow && !appState.sidebarHidden) {
    // Auto-collapse on narrow screens
    setState({ sidebarHidden: true });
  }
  // Re-render to update icon based on screen size
  render();
}

// Canvas event handlers
if (canvasButton) {
  canvasButton.addEventListener('click', () => {
    const chat = getSelectedChat();
    if (!chat) return;
    
    // If no canvases, create one and open it
    if (!chat.canvases || chat.canvases.length === 0) {
      const newCanvas = createCanvas(chat.id);
      if (newCanvas) {
        openCanvas(chat.id, newCanvas.id);
        renderCanvas();
      }
    } else {
      // Open canvas list
      appState.canvasListModalOpen = true;
      saveState(appState);
      renderCanvasList();
    }
  });
}

if (closeCanvasListButton) {
  closeCanvasListButton.addEventListener('click', () => {
    appState.canvasListModalOpen = false;
    saveState(appState);
    renderCanvasList();
  });
}

if (canvasListOverlay) {
  canvasListOverlay.addEventListener('click', (e) => {
    if (e.target === canvasListOverlay) {
      appState.canvasListModalOpen = false;
      saveState(appState);
      renderCanvasList();
    }
  });
}

if (newCanvasButton) {
  newCanvasButton.addEventListener('click', () => {
    const chat = getSelectedChat();
    if (!chat) return;
    const newCanvas = createCanvas(chat.id);
    if (newCanvas) {
      openCanvas(chat.id, newCanvas.id);
      renderCanvas();
      renderCanvasList();
    }
  });
}

if (closeCanvasButton) {
  closeCanvasButton.addEventListener('click', () => {
    closeCanvas();
  });
}

if (canvasOverlay) {
  canvasOverlay.addEventListener('click', (e) => {
    if (e.target === canvasOverlay) {
      closeCanvas();
    }
  });
}

if (canvasNameInput) {
  canvasNameInput.addEventListener('blur', () => {
    if (!appState.openCanvasId || !appState.openCanvasChatId) return;
    const newName = canvasNameInput.value.trim();
    if (newName) {
      renameCanvas(appState.openCanvasChatId, appState.openCanvasId, newName);
    }
  });
  
  canvasNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      canvasNameInput.blur();
    }
  });
}

if (canvasNewBlockButton) {
  canvasNewBlockButton.addEventListener('click', () => {
    if (!appState.openCanvasId) return;
    
    // Find position after selected block, or at the end if no selection
    // Find position after last selected block, or at the end if no selection
    let insertPosition = undefined;
    if (appState.selectedBlockIds && appState.selectedBlockIds.length > 0) {
      const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
      if (canvas) {
        // Find the last selected block's index
        let lastSelectedIndex = -1;
        appState.selectedBlockIds.forEach(blockId => {
          const index = canvas.blocks.findIndex(b => b.id === blockId);
          if (index > lastSelectedIndex) {
            lastSelectedIndex = index;
          }
        });
        if (lastSelectedIndex >= 0) {
          insertPosition = lastSelectedIndex + 1;
        }
      }
    }
    
    createBlock(appState.openCanvasId, '', 'text', insertPosition);
    const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
    if (canvas) {
      renderCanvasBlocks(canvas);
      // Focus the newly created block
      setTimeout(() => {
        const newBlockIndex = insertPosition !== undefined ? insertPosition : canvas.blocks.length - 1;
        const blockEl = document.querySelector(`.canvas-block[data-block-id="${canvas.blocks[newBlockIndex]?.id}"]`);
        if (blockEl) {
          blockEl.focus();
          // Place cursor at the start
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(blockEl);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }, CONFIG.ANIMATION_DELAY_MS);
    }
  });
}

if (canvasUndoButton) {
  canvasUndoButton.addEventListener('click', () => {
    if (!appState.openCanvasId) return;
    if (undoCanvasEdit(appState.openCanvasId)) {
      const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
      if (canvas) {
        renderCanvasBlocks(canvas);
      }
    }
  });
}

if (canvasRedoButton) {
  canvasRedoButton.addEventListener('click', () => {
    if (!appState.openCanvasId) return;
    if (redoCanvasEdit(appState.openCanvasId)) {
      const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
      if (canvas) {
        renderCanvasBlocks(canvas);
      }
    }
  });
}

if (canvasAiEditButton) {
  canvasAiEditButton.addEventListener('click', () => {
    if (!appState.openCanvasId) return;
    
    // Check for pending changes
    if (hasPendingCanvasChanges(appState.openCanvasId)) {
      toastMessage('Cannot edit while changes are pending review. Please accept or decline all pending changes first.', CONFIG.ERROR_TOAST_TIMEOUT_MS);
      return;
    }
    
    // Save current selection state before opening modal
    appState.canvasAiEditSelection = {
      blockIds: appState.selectedBlockIds ? [...appState.selectedBlockIds] : [],
    };
    saveState(appState);
    
    // Open AI edit modal
    if (canvasAiEditOverlay) {
      canvasAiEditOverlay.classList.add('show');
      if (canvasAiInstructionInput) {
        // Restore draft if available
        canvasAiInstructionInput.value = appState.canvasAiEditDraft || '';
        setTimeout(() => canvasAiInstructionInput.focus(), 100);
      }
    }
  });
}

if (canvasListFromCanvasButton) {
  canvasListFromCanvasButton.addEventListener('click', () => {
    // Close canvas and open canvas list
    closeCanvas();
    appState.canvasListModalOpen = true;
    saveState(appState);
    renderCanvasList();
  });
}

// Select all blocks
if (canvasSelectAllButton) {
  canvasSelectAllButton.addEventListener('click', () => {
    if (!appState.openCanvasId || !appState.openCanvasChatId) return;
    
    const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
    if (!canvas || !canvas.blocks) return;
    
    // Select all block IDs
    appState.selectedBlockIds = canvas.blocks.map(block => block.id);
    saveState(appState);
    
    // Re-render to show selection
    renderCanvasBlocks(canvas);
    toastMessage(`Selected ${canvas.blocks.length} block${canvas.blocks.length !== 1 ? 's' : ''}`, CONFIG.INFO_TOAST_TIMEOUT_MS);
  });
}

// Deselect all blocks
if (canvasDeselectAllButton) {
  canvasDeselectAllButton.addEventListener('click', () => {
    if (!appState.openCanvasId) return;
    
    appState.selectedBlockIds = [];
    saveState(appState);
    
    // Re-render to show deselection
    const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
    if (canvas) {
      renderCanvasBlocks(canvas);
    }
    toastMessage('All blocks deselected', CONFIG.INFO_TOAST_TIMEOUT_MS);
  });
}

// Copy all blocks as text
if (canvasCopyAllButton) {
  canvasCopyAllButton.addEventListener('click', () => {
    if (!appState.openCanvasId || !appState.openCanvasChatId) return;
    
    // Check for pending changes
    if (hasPendingCanvasChanges(appState.openCanvasId)) {
      toastMessage('Cannot copy while changes are pending review', CONFIG.INFO_TOAST_TIMEOUT_MS);
      return;
    }
    
    const canvas = getCanvas(appState.openCanvasChatId, appState.openCanvasId);
    if (!canvas || !canvas.blocks || canvas.blocks.length === 0) {
      toastMessage('No blocks to copy', CONFIG.INFO_TOAST_TIMEOUT_MS);
      return;
    }
    
    // Combine all block contents with double newlines between blocks
    const allText = canvas.blocks.map(block => block.content).join('\n\n');
    
    // Copy to clipboard
    navigator.clipboard.writeText(allText).then(() => {
      toastMessage(`Copied ${canvas.blocks.length} block${canvas.blocks.length !== 1 ? 's' : ''} to clipboard`, CONFIG.INFO_TOAST_TIMEOUT_MS);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      toastMessage('Failed to copy to clipboard', CONFIG.INFO_TOAST_TIMEOUT_MS);
    });
  });
}

if (closeCanvasAiEditButton) {
  closeCanvasAiEditButton.addEventListener('click', () => {
    if (canvasAiEditOverlay) {
      canvasAiEditOverlay.classList.remove('show');
    }
    // Don't clear draft - keep it for retry
  });
}

if (cancelCanvasAiEditButton) {
  cancelCanvasAiEditButton.addEventListener('click', () => {
    if (canvasAiEditOverlay) {
      canvasAiEditOverlay.classList.remove('show');
    }
    // Don't clear draft - keep it for retry
  });
}

if (applyCanvasAiEditButton) {
  applyCanvasAiEditButton.addEventListener('click', () => {
    if (!appState.openCanvasId || !canvasAiInstructionInput) return;
    
    const instruction = canvasAiInstructionInput.value.trim();
    if (!instruction) {
      toastMessage('Please enter an edit instruction');
      return;
    }
    
    // Save draft before attempting edit
    appState.canvasAiEditDraft = instruction;
    saveState(appState);
    
    // Close modal
    if (canvasAiEditOverlay) {
      canvasAiEditOverlay.classList.remove('show');
    }
    
    // Request edit (no selection parameter needed - uses selectedBlockIds from state)
    requestCanvasEdit(appState.openCanvasId, instruction);
  });
}

if (canvasAiEditOverlay) {
  canvasAiEditOverlay.addEventListener('click', (e) => {
    if (e.target === canvasAiEditOverlay) {
      canvasAiEditOverlay.classList.remove('show');
      // Don't clear draft - keep it for retry
    }
  });
}

if (canvasAiInstructionInput) {
  canvasAiInstructionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (applyCanvasAiEditButton) {
        applyCanvasAiEditButton.click();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (cancelCanvasAiEditButton) {
        cancelCanvasAiEditButton.click();
      }
    }
  });
}

// Block deletion modal handlers
if (closeCanvasDeleteBlockButton) {
  closeCanvasDeleteBlockButton.addEventListener('click', () => {
    if (canvasDeleteBlockOverlay) {
      canvasDeleteBlockOverlay.classList.remove('show');
    }
    appState.pendingDeleteBlock = null;
  });
}

if (cancelCanvasDeleteBlockButton) {
  cancelCanvasDeleteBlockButton.addEventListener('click', () => {
    if (canvasDeleteBlockOverlay) {
      canvasDeleteBlockOverlay.classList.remove('show');
    }
    appState.pendingDeleteBlock = null;
  });
}

if (confirmCanvasDeleteBlockButton) {
  confirmCanvasDeleteBlockButton.addEventListener('click', () => {
    if (!appState.pendingDeleteBlock) return;
    
    const { canvasId, blockId } = appState.pendingDeleteBlock;
    deleteBlock(canvasId, blockId);
    
    // Close modal
    if (canvasDeleteBlockOverlay) {
      canvasDeleteBlockOverlay.classList.remove('show');
    }
    appState.pendingDeleteBlock = null;
    
    // Re-render canvas
    const canvas = getCanvas(appState.openCanvasChatId, canvasId);
    if (canvas) {
      renderCanvasBlocks(canvas);
    }
  });
}

if (canvasDeleteBlockOverlay) {
  canvasDeleteBlockOverlay.addEventListener('click', (e) => {
    if (e.target === canvasDeleteBlockOverlay) {
      canvasDeleteBlockOverlay.classList.remove('show');
      appState.pendingDeleteBlock = null;
    }
  });
}

// Check on load and resize
checkScreenWidth();
window.addEventListener('resize', checkScreenWidth);

// Apply initial theme
applyTheme(appState.theme);

render();
refreshModelOptions();
toastMessage('Ready to chat! Upload files or set a persona before sending.');
