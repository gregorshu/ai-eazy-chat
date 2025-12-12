const stateKey = 'ai-eazy-chat-state';
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
const retryDelays = [3000, 5000, 7000];
let activeAbortController = null;
let isRequestPending = false;
let wasFolderModalOpen = false;
let activeConfirmHandler = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function uuid() {
  return crypto.randomUUID();
}

function loadState() {
  const raw = localStorage.getItem(stateKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse state', e);
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(stateKey, JSON.stringify(state));
}

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
    }
  : baseDefaults;

if (!appState.settings.model) {
  appState = {
    ...appState,
    settings: { ...appState.settings, model: 'openrouter/auto' },
  };
  saveState(appState);
}

// Ensure activePersonaId exists in personas array
if (appState.personas.length > 0 && !appState.personas.find(p => p.id === appState.settings.activePersonaId)) {
  appState.settings.activePersonaId = appState.personas[0].id;
  saveState(appState);
}

// Track previous state for change detection
let prevState = null;

function setState(update) {
  prevState = { ...appState };
  appState = { ...appState, ...update };
  saveState(appState);
  
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
        setTimeout(() => folderNameInput.focus(), 100);
      }
    }
    
    if (update.newPersonaModalOpen !== undefined && personaModal) {
      personaModal.classList.toggle('show', update.newPersonaModalOpen);
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
      const prevFolder = appState.folders.find(f => f.id === prevState.editingFolderId);
      if (prevFolder) {
        const folderEl = getFolderElement(prevFolder.id);
        updateFolderElement(folderEl, prevFolder);
      }
    }
    if (update.editingFolderId) {
      const folder = appState.folders.find(f => f.id === update.editingFolderId);
      if (folder) {
        const folderEl = getFolderElement(folder.id);
        updateFolderElement(folderEl, folder);
      }
    }
  }
  
  // Update chat editing state
  if (update.editingChatId !== undefined) {
    if (prevState.editingChatId) {
      const prevChat = appState.chats.find(c => c.id === prevState.editingChatId);
      if (prevChat) {
        const chatEl = getChatElement(prevChat.id);
        updateChatElement(chatEl, prevChat);
      }
    }
    if (update.editingChatId) {
      const chat = appState.chats.find(c => c.id === update.editingChatId);
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

function getSelectedChat() {
  return appState.chats.find((c) => c.id === appState.selectedChatId) || appState.chats[0];
}

function getActivePersona() {
  const activePersona = appState.personas.find((p) => p.id === appState.settings.activePersonaId);
  return activePersona ? activePersona.content : '';
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

function toastMessage(message, timeout = 2200) {
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
  
  messageContainer.innerHTML = '';
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

    messageContainer.appendChild(div);
  });
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function renderFiles() {
  const chat = getSelectedChat();
  fileList.innerHTML = '';
  chat.files.forEach((file) => {
    const li = document.createElement('li');
    li.className = 'pill';
    li.textContent = file.name;
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.className = 'remove';
    remove.onclick = () => removeFile(file.id);
    li.appendChild(remove);
    fileList.appendChild(li);
  });
}

function renderPersonas() {
  if (!personasList) return;
  personasList.innerHTML = '';
  
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
    personasList.appendChild(li);
  });
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
  const chat = appState.chats.find((entry) => entry.id === chatId);
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
  const chat = appState.chats.find((c) => c.id === chatId);
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
    updateChatElement(chatEl, chats.find(c => c.id === chatId));
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
  const folder = appState.folders.find((f) => f.id === folderId);
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
  const folder = appState.folders.find((entry) => entry.id === folderId);
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
  const chat = appState.chats.find(c => c.id === chatId);
  if (!chat) return;
  
  // Update state
  const chats = appState.chats.map((c) =>
    c.id === chatId ? { ...c, folderId } : c,
  );
  openChatMenuId = null;
  appState.chats = chats;
  appState.selectedFolderId = folderId;
  saveState(appState);
  
  // Move chat element in DOM
  const chatEl = getChatElement(chatId);
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

  while (!doneReading) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop();

    for (const event of events) {
      const lines = event
        .split('\n')
        .map((line) => line.replace(/^data:\s?/, '').trim())
        .filter(Boolean);
      for (const line of lines) {
        if (line === '[DONE]') {
          doneReading = true;
          break;
        }
        try {
          const parsed = JSON.parse(line);
          const delta =
            parsed?.choices?.[0]?.delta?.content || parsed?.choices?.[0]?.message?.content || '';
          if (delta) {
            fullText += delta;
            if (onChunk) onChunk(delta, fullText);
          }
        } catch (err) {
          console.error('Failed to parse stream chunk', err, line);
        }
      }
      if (doneReading) break;
    }
  }

  return fullText;
}

async function performChatRequest({ chat, messageHistory, signal, onChunk }) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        messages: messageHistory.map(({ role, content }) => ({ role, content })),
        model: appState.settings.model,
        persona: getActivePersona(),
        files: chat.files,
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

    const shouldRetry = response.status === 429 && attempt < retryDelays.length;
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
  setTimeout(() => personaNameInput.focus(), 100);
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
  setTimeout(() => personaNameInput.focus(), 100);
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
  const persona = appState.personas.find((p) => p.id === personaId);
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
    setTimeout(() => settingsModelInput.focus(), 100);
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

// Check on load and resize
checkScreenWidth();
window.addEventListener('resize', checkScreenWidth);

// Apply initial theme
applyTheme(appState.theme);

render();
refreshModelOptions();
toastMessage('Ready to chat! Upload files or set a persona before sending.');
