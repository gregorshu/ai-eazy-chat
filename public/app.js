const stateKey = 'ai-eazy-chat-state';
const appShell = document.querySelector('.app-shell');
const sidebar = document.querySelector('.sidebar');
const messageContainer = document.getElementById('messages');
const folderList = document.getElementById('folder-list');
const promptInput = document.getElementById('prompt');
const sendButton = document.getElementById('send');
const newChatButton = document.getElementById('new-chat');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const chatTitle = document.getElementById('chat-title');
const chatFolderLabel = document.getElementById('chat-folder-label');
const toast = document.getElementById('toast');
const newFolderButton = document.getElementById('new-folder');
const toggleSidebarButton = document.getElementById('sidebar-toggle');
const settingsButton = document.getElementById('settings-button');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsPersonaInput = document.getElementById('settings-persona');
const settingsModelInput = document.getElementById('settings-model');
const closeSettingsButtons = [
  document.getElementById('close-settings'),
  document.getElementById('close-settings-cta'),
];
let openChatMenuId = null;
const retryDelays = [3000, 5000, 7000];

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
    selectedChatId: chatId,
    selectedFolderId: defaultFolder.id,
    sidebarHidden: false,
    expandedFolders: { root: true },
    settings: { persona: '', model: 'openrouter/auto' },
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
    const toggle = document.createElement('button');
    toggle.className = 'ghost icon folder-toggle';
    toggle.textContent = appState.expandedFolders[folder.id] === false ? '▸' : '▾';
    toggle.onclick = (e) => {
      e.stopPropagation();
      setState({
        expandedFolders: {
          ...appState.expandedFolders,
          [folder.id]: !(appState.expandedFolders[folder.id] === false),
        },
      });
    };

    const title = document.createElement('span');
    title.textContent = folder.name;
    header.appendChild(toggle);
    header.appendChild(title);

    header.onclick = () => setState({ selectedFolderId: folder.id });

    const chatsList = document.createElement('ul');
    chatsList.className = 'chat-list';
    chatsList.style.display = appState.expandedFolders[folder.id] === false ? 'none' : 'flex';

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

      const renameBtn = document.createElement('button');
      renameBtn.textContent = 'Rename';
      renameBtn.onclick = (e) => {
        e.stopPropagation();
        renameChat(chat.id);
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
      const moveLabel = document.createElement('span');
      moveLabel.textContent = 'Move to:';
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
      moveWrap.appendChild(moveLabel);
      moveWrap.appendChild(moveSelect);

      menu.appendChild(renameBtn);
      menu.appendChild(deleteBtn);
      menu.appendChild(moveWrap);

      chatItem.appendChild(info);
      chatItem.appendChild(menuButton);
      chatItem.appendChild(menu);
      chatsList.appendChild(chatItem);
    });

    li.appendChild(header);
    li.appendChild(chatsList);
    folderList.appendChild(li);
  });
}

function renderMessages() {
  messageContainer.innerHTML = '';
  const chat = getSelectedChat();
  if (!chat) return;
  chat.messages.forEach((msg, index) => {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = msg.content;
    div.appendChild(content);

    const isLastMessage = index === chat.messages.length - 1;
    const isRetryableAssistant = msg.role === 'assistant' && isLastMessage;
    const isRetryableUser = msg.role === 'user' && isLastMessage;

    if (isRetryableAssistant || isRetryableUser) {
      const actions = document.createElement('div');
      actions.className = 'message-actions';

      const retryBtn = document.createElement('button');
      retryBtn.className = 'ghost icon retry-button';
      retryBtn.title = 'Retry last response';
      retryBtn.textContent = '↻';
      retryBtn.onclick = retryLastMessage;

      actions.appendChild(retryBtn);

      const lastUserIndex = findLastUserIndex(chat.messages);
      if (lastUserIndex !== -1) {
        const editBtn = document.createElement('button');
        editBtn.className = 'ghost icon edit-button';
        editBtn.title = 'Edit your last message';
        editBtn.textContent = '✎';
        editBtn.onclick = editLastUserMessage;
        actions.appendChild(editBtn);
      }
      div.appendChild(actions);
    }

    messageContainer.appendChild(div);
  });
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function renderChatMeta() {
  const chat = getSelectedChat();
  if (!chat) return;
  chatTitle.textContent = chat.name;
  const folder = appState.folders.find((f) => f.id === chat.folderId);
  chatFolderLabel.textContent = folder ? folder.name : 'Unsorted';
  renderFiles();
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

function render() {
  appShell.classList.toggle('sidebar-hidden', appState.sidebarHidden);
  sidebar?.setAttribute('aria-hidden', appState.sidebarHidden ? 'true' : 'false');
  renderFolders();
  renderMessages();
  renderChatMeta();
  toggleSidebarButton.textContent = appState.sidebarHidden ? '☰' : '⟨';
  toggleSidebarButton.setAttribute('aria-label', appState.sidebarHidden ? 'Show menu' : 'Hide menu');
  settingsPersonaInput.value = appState.settings.persona || '';
  settingsModelInput.value = appState.settings.model || 'openrouter/auto';
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
  if (!confirm('Delete this chat?')) return;
  const remaining = appState.chats.filter((c) => c.id !== chatId);
  if (!remaining.length) {
    setState(defaultState());
    toastMessage('Chat deleted. Created a fresh chat.');
    return;
  }
  const newSelected =
    chatId === appState.selectedChatId ? remaining[0].id : appState.selectedChatId;
  openChatMenuId = null;
  setState({ chats: remaining, selectedChatId: newSelected });
  toastMessage('Chat deleted');
}

function renameChat(chatId) {
  const chat = appState.chats.find((c) => c.id === chatId);
  const name = prompt('New chat name?', chat?.name || '');
  if (!name) return;
  const chats = appState.chats.map((chat) =>
    chat.id === chatId ? { ...chat, name } : chat,
  );
  openChatMenuId = null;
  setState({ chats });
}

function addFolder() {
  const name = prompt('Folder name');
  if (!name) return;
  const folder = { id: uuid(), name };
  setState({
    folders: [...appState.folders, folder],
    selectedFolderId: folder.id,
    expandedFolders: { ...appState.expandedFolders, [folder.id]: true },
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
  promptInput.value = '';
  const userMessage = { role: 'user', content };
  const messageHistory = [...chat.messages, userMessage];
  sendChatCompletion(messageHistory);
}

async function sendChatCompletion(messageHistory) {
  const chat = getSelectedChat();
  if (!chat || !messageHistory.length) return;

  const pendingMessage = { role: 'assistant', content: 'Thinking…' };
  persistChatUpdates({ messages: [...messageHistory, pendingMessage] });

  try {
    const data = await performChatRequest({ chat, messageHistory });
    const assistantMessage = { role: 'assistant', content: data.content || '(no content returned)' };
    persistChatUpdates({ messages: [...messageHistory, assistantMessage] });
  } catch (err) {
    persistChatUpdates({ messages: messageHistory });
    toastMessage(err.message, 3200);
  }
}

async function performChatRequest({ chat, messageHistory }) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messageHistory.map(({ role, content }) => ({ role, content })),
        model: appState.settings.model,
        persona: appState.settings.persona,
        files: chat.files,
      }),
    });

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
  const edited = prompt('Edit your last message:', lastUserMessage.content || '');
  if (edited === null) return;

  const trimmed = edited.trim();
  if (!trimmed) {
    toastMessage('Message cannot be empty');
    return;
  }

  const updatedMessages = chat.messages.map((msg, idx) =>
    idx === lastUserIndex ? { ...msg, content: trimmed } : msg,
  );

  persistChatUpdates({ messages: updatedMessages });
  promptInput.value = trimmed;
  toastMessage('Updated last message. Use retry to resend.');
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
newChatButton.addEventListener('click', () => addChat(appState.selectedFolderId || 'root'));
fileInput.addEventListener('change', handleFileUpload);
newFolderButton.addEventListener('click', addFolder);
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
closeSettingsButtons.forEach((btn) =>
  btn.addEventListener('click', () => settingsOverlay.classList.remove('show')),
);
settingsPersonaInput.addEventListener('input', (e) => {
  setState({ settings: { ...appState.settings, persona: e.target.value } });
});
settingsModelInput.addEventListener('input', (e) => {
  setState({ settings: { ...appState.settings, model: e.target.value } });
});

document.addEventListener('click', () => {
  if (openChatMenuId) {
    openChatMenuId = null;
    renderFolders();
  }
});

render();
toastMessage('Ready to chat! Upload files or set a persona before sending.');
