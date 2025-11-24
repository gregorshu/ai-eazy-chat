const stateKey = 'ai-eazy-chat-state';
const appShell = document.querySelector('.app-shell');
const sidebar = document.querySelector('.sidebar');
const messageContainer = document.getElementById('messages');
const folderList = document.getElementById('folder-list');
const promptInput = document.getElementById('prompt');
const sendButton = document.getElementById('send');
const cancelButton = document.getElementById('cancel');
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
const settingsPersonaInput = document.getElementById('settings-persona');
const settingsModelInput = document.getElementById('settings-model');
const modelOptionsList = document.getElementById('model-options');
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
    settings: { persona: '', model: 'openrouter/auto' },
    modelOptions: defaultModelOptions,
    modelOptionsLoading: false,
  };
};

const storedState = loadState();
const baseDefaults = defaultState();
const fallbackSettings =
  storedState?.settings || {
    persona: storedState?.chats?.[0]?.persona || '',
    model: storedState?.chats?.[0]?.model || 'openrouter/auto',
  };

let appState = storedState
  ? {
      ...baseDefaults,
      ...storedState,
      sidebarHidden: storedState.sidebarHidden ?? false,
      expandedFolders: { root: true, ...(storedState.expandedFolders || {}) },
      editingChatId: null,
      editingChatDraft: '',
      editingFolderId: null,
      editingFolderDraft: '',
      editingMessageChatId: null,
      editingMessageIndex: null,
      editingMessageDraft: '',
      newFolderModalOpen: false,
      newFolderDraft: '',
      modelOptions: storedState.modelOptions || defaultModelOptions,
      modelOptionsLoading: false,
      settings: { ...baseDefaults.settings, ...fallbackSettings },
    }
  : baseDefaults;

function setState(update) {
  appState = { ...appState, ...update };
  saveState(appState);
  render();
}

function getSelectedChat() {
  return appState.chats.find((c) => c.id === appState.selectedChatId) || appState.chats[0];
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

function renderMessages() {
  messageContainer.innerHTML = '';
  const chat = getSelectedChat();
  if (!chat) return;
  const lastUserIndex = findLastUserIndex(chat.messages);
  chat.messages.forEach((msg, index) => {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;

    const isEditing =
      appState.editingMessageChatId === chat.id &&
      appState.editingMessageIndex === index;

    if (isEditing) {
      div.classList.add('editing');
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

      const isStreamingAssistant = msg.role === 'assistant' && msg.streaming;

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

function renderModelOptions() {
  const fragment = document.createDocumentFragment();
  const options = appState.modelOptions?.length ? appState.modelOptions : defaultModelOptions;

  options.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    fragment.appendChild(option);
  });

  modelOptionsList.innerHTML = '';
  modelOptionsList.appendChild(fragment);

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
  toggleSidebarButton.textContent = appState.sidebarHidden ? '⟩' : '⟨';
  toggleSidebarButton.setAttribute('aria-label', appState.sidebarHidden ? 'Show menu' : 'Hide menu');
  settingsPersonaInput.value = appState.settings.persona || '';
  settingsModelInput.value = appState.settings.model || 'openrouter/auto';
  const shouldShowFolderModal = appState.newFolderModalOpen;
  folderOverlay.classList.toggle('show', shouldShowFolderModal);
  folderNameInput.value = appState.newFolderDraft || '';
  if (shouldShowFolderModal && !wasFolderModalOpen) {
    folderNameInput.focus();
  }
  wasFolderModalOpen = shouldShowFolderModal;
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
  setState({ chats });
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
  const pendingMessage = { role: 'assistant', content: assistantContent, streaming: true };
  persistChatUpdates({ messages: [...messageHistory, pendingMessage] });
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
        persistChatUpdates({
          messages: [
            ...messageHistory,
            { role: 'assistant', content: assistantContent, streaming: true },
          ],
        });
      },
    });
    const finalContent = data?.content || assistantContent || '(no content returned)';
    const assistantMessage = { role: 'assistant', content: finalContent, streaming: false };
    persistChatUpdates({ messages: [...messageHistory, assistantMessage] });
  } catch (err) {
    if (err.name === 'AbortError') {
      persistChatUpdates({ messages: messageHistory });
      toastMessage('Request canceled');
      return;
    }
    persistChatUpdates({ messages: messageHistory });
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
        persona: appState.settings.persona,
        files: chat.files,
        stream: true,
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
    const response = await fetch('/api/models');
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

  promptInput.value = trimmed;
  toastMessage('Updated last message. Use retry to resend.');
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
newChatButton.addEventListener('click', () => addChat(appState.selectedFolderId || 'root'));
fileInput.addEventListener('change', handleFileUpload);
newFolderButton.addEventListener('click', openNewFolderModal);
toggleSidebarButton.addEventListener('click', () => setState({ sidebarHidden: !appState.sidebarHidden }));
settingsButton.addEventListener('click', () => {
  settingsOverlay.classList.add('show');
  settingsPersonaInput.focus();
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
settingsPersonaInput.addEventListener('input', (e) => {
  setState({ settings: { ...appState.settings, persona: e.target.value } });
});
settingsModelInput.addEventListener('input', (e) => {
  setState({ settings: { ...appState.settings, model: e.target.value } });
});

document.addEventListener('click', (event) => {
  if (!openChatMenuId) return;
  const target = event.target;
  if (target.closest('.chat-menu') || target.closest('.chat-menu-trigger')) return;
  openChatMenuId = null;
  renderFolders();
});

render();
refreshModelOptions();
toastMessage('Ready to chat! Upload files or set a persona before sending.');
