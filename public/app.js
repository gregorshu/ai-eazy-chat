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
const tabPanelModel = document.getElementById('tab-panel-model');
const tabPanelPersona = document.getElementById('tab-panel-persona');
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

function setState(update) {
  appState = { ...appState, ...update };
  saveState(appState);
  render();
}

function getSelectedChat() {
  return appState.chats.find((c) => c.id === appState.selectedChatId) || appState.chats[0];
}

function getActivePersona() {
  const activePersona = appState.personas.find((p) => p.id === appState.settings.activePersonaId);
  return activePersona ? activePersona.content : '';
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

function renderFolders() {
  folderList.innerHTML = '';
  appState.folders.forEach((folder) => {
    const li = document.createElement('li');
    li.className = 'folder-item';

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
      const chatItem = document.createElement('li');
      chatItem.className = chat.id === appState.selectedChatId ? 'active chat-row' : 'chat-row';
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
        openChatMenuId = openChatMenuId === chat.id ? null : chat.id;
        renderFolders();
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
        chatsList.appendChild(chatItem);
      });

      li.appendChild(chatsList);
      folderList.appendChild(li);
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
  
  // Update tabs
  const activeTab = appState.activeSettingsTab || 'model';
  if (tabModelButton) {
    tabModelButton.classList.toggle('active', activeTab === 'model');
  }
  if (tabPersonaButton) {
    tabPersonaButton.classList.toggle('active', activeTab === 'persona');
  }
  if (tabPanelModel) {
    tabPanelModel.classList.toggle('active', activeTab === 'model');
  }
  if (tabPanelPersona) {
    tabPanelPersona.classList.toggle('active', activeTab === 'persona');
  }
  
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
  
  const shouldShowFolderModal = appState.newFolderModalOpen;
  folderOverlay.classList.toggle('show', shouldShowFolderModal);
  folderNameInput.value = appState.newFolderDraft || '';
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
  setState({
    chats: [...appState.chats, chat],
    selectedChatId: chat.id,
  });
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
        setState({
          chats: [newChat],
          selectedChatId: newChat.id,
          folders,
          expandedFolders: { ...appState.expandedFolders, [targetFolderId]: true },
        });
        toastMessage('Chat deleted. Created a fresh chat.');
        return;
      }
      const newSelected =
        chatId === appState.selectedChatId ? remaining[0].id : appState.selectedChatId;
      openChatMenuId = null;
      setState({ chats: remaining, selectedChatId: newSelected });
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
  const chats = appState.chats.map((entry) =>
    entry.id === chatId ? { ...entry, name } : entry,
  );
  openChatMenuId = null;
  setState({ chats, editingChatId: null, editingChatDraft: '' });
}

function startChatRename(chat) {
  setState({ editingChatId: chat.id, editingChatDraft: chat.name || '' });
}

function submitChatRename(chatId) {
  renameChat(chatId);
}

function cancelChatRename() {
  openChatMenuId = null;
  setState({ editingChatId: null, editingChatDraft: '' });
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
  const folders = appState.folders.map((entry) =>
    entry.id === folderId ? { ...entry, name } : entry,
  );
  setState({ folders, editingFolderId: null, editingFolderDraft: '' });
}

function startFolderRename(folder) {
  setState({ editingFolderId: folder.id, editingFolderDraft: folder.name || '' });
}

function submitFolderRename(folderId) {
  renameFolder(folderId);
}

function cancelFolderRename() {
  setState({ editingFolderId: null, editingFolderDraft: '' });
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
  setState({
    folders: [...appState.folders, folder],
    selectedFolderId: folder.id,
    expandedFolders: { ...appState.expandedFolders, [folder.id]: true },
    newFolderModalOpen: false,
    newFolderDraft: '',
  });
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
      const folders = appState.folders.filter((entry) => entry.id !== folderId);
      const selectedFolderId =
        appState.selectedFolderId === folderId ? 'root' : appState.selectedFolderId;
      const expandedFolders = { ...appState.expandedFolders };
      delete expandedFolders[folderId];
      const editingFolderState =
        appState.editingFolderId === folderId
          ? { editingFolderId: null, editingFolderDraft: '' }
          : {};
      setState({ folders, selectedFolderId, expandedFolders, ...editingFolderState });
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
  const chats = appState.chats.map((chat) =>
    chat.id === chatId ? { ...chat, folderId } : chat,
  );
  openChatMenuId = null;
  setState({ chats, selectedFolderId: folderId });
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
  setState({ settings: { ...appState.settings, apiKey: e.target.value } });
});
settingsModelInput.addEventListener('input', (e) => {
  const value = e.target.value;
  setState({
    settings: { ...appState.settings, model: value || 'openrouter/auto' },
    modelSearch: value,
    modelDropdownOpen: true,
  });
});

settingsModelInput.addEventListener('focus', () => {
  if (!appState.modelDropdownOpen) {
    setState({ modelDropdownOpen: true });
  }
});

if (modelSearchInput) {
  modelSearchInput.addEventListener('input', (e) => {
    setState({ modelSearch: e.target.value, modelDropdownOpen: true });
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
    openChatMenuId = null;
    renderFolders();
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

render();
refreshModelOptions();
toastMessage('Ready to chat! Upload files or set a persona before sending.');
