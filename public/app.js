const stateKey = 'ai-eazy-chat-state';
const messageContainer = document.getElementById('messages');
const chatList = document.getElementById('chat-list');
const folderList = document.getElementById('folder-list');
const chatNameInput = document.getElementById('chat-name');
const personaInput = document.getElementById('persona');
const promptInput = document.getElementById('prompt');
const sendButton = document.getElementById('send');
const newChatButton = document.getElementById('new-chat');
const deleteChatButton = document.getElementById('delete-chat');
const renameChatButton = document.getElementById('rename-chat');
const modelSelect = document.getElementById('model');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const folderSelect = document.getElementById('chat-folder');
const toast = document.getElementById('toast');
const newFolderButton = document.getElementById('new-folder');

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
        persona: '',
        model: 'openrouter/auto',
        files: [],
        messages: [],
      },
    ],
    selectedChatId: chatId,
    selectedFolderId: defaultFolder.id,
  };
};

let appState = loadState() || defaultState();

function setState(update) {
  appState = { ...appState, ...update };
  saveState(appState);
  render();
}

function getSelectedChat() {
  return appState.chats.find((c) => c.id === appState.selectedChatId);
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
    li.textContent = folder.name;
    li.className = folder.id === appState.selectedFolderId ? 'active' : '';
    li.onclick = () => setState({ selectedFolderId: folder.id });
    folderList.appendChild(li);
  });

  folderSelect.innerHTML = '';
  appState.folders.forEach((folder) => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.name;
    folderSelect.appendChild(option);
  });
}

function renderChats() {
  chatList.innerHTML = '';
  const chats = appState.chats.filter((chat) => {
    if (!appState.selectedFolderId || appState.selectedFolderId === 'root') return true;
    return chat.folderId === appState.selectedFolderId;
  });
  chats.forEach((chat) => {
    const li = document.createElement('li');
    li.className = chat.id === appState.selectedChatId ? 'active' : '';
    li.onclick = () => setState({ selectedChatId: chat.id });
    const name = document.createElement('span');
    name.textContent = chat.name;
    const folder = appState.folders.find((f) => f.id === chat.folderId);
    const badge = document.createElement('span');
    badge.className = 'muted';
    badge.textContent = folder ? folder.name : 'Unsorted';
    li.appendChild(name);
    li.appendChild(badge);
    chatList.appendChild(li);
  });
}

function renderMessages() {
  messageContainer.innerHTML = '';
  const chat = getSelectedChat();
  chat.messages.forEach((msg) => {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    div.textContent = msg.content;
    messageContainer.appendChild(div);
  });
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function renderChatMeta() {
  const chat = getSelectedChat();
  chatNameInput.value = chat.name;
  personaInput.value = chat.persona || '';
  modelSelect.value = chat.model || 'openrouter/auto';
  folderSelect.value = chat.folderId || 'root';
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
  renderFolders();
  renderChats();
  renderMessages();
  renderChatMeta();
}

function addChat(folderId) {
  const chat = {
    id: uuid(),
    name: 'Untitled chat',
    folderId: folderId || 'root',
    persona: '',
    model: 'openrouter/auto',
    files: [],
    messages: [],
  };
  setState({
    chats: [...appState.chats, chat],
    selectedChatId: chat.id,
  });
}

function removeChat() {
  if (!confirm('Delete this chat?')) return;
  const remaining = appState.chats.filter((c) => c.id !== appState.selectedChatId);
  if (!remaining.length) {
    setState(defaultState());
    toastMessage('Chat deleted. Created a fresh chat.');
    return;
  }
  setState({ chats: remaining, selectedChatId: remaining[0].id });
  toastMessage('Chat deleted');
}

function renameChat() {
  const name = prompt('New chat name?', getSelectedChat().name);
  if (!name) return;
  const chats = appState.chats.map((chat) =>
    chat.id === appState.selectedChatId ? { ...chat, name } : chat,
  );
  setState({ chats });
}

function addFolder() {
  const name = prompt('Folder name');
  if (!name) return;
  const folder = { id: uuid(), name };
  setState({ folders: [...appState.folders, folder], selectedFolderId: folder.id });
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

async function handleSend() {
  const chat = getSelectedChat();
  const content = promptInput.value.trim();
  if (!content) return;
  promptInput.value = '';
  const userMessage = { role: 'user', content };
  const pendingMessage = { role: 'assistant', content: 'Thinking…' };
  persistChatUpdates({ messages: [...chat.messages, userMessage, pendingMessage] });

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...chat.messages, userMessage].map(({ role, content }) => ({ role, content })),
        model: chat.model,
        persona: chat.persona,
        files: chat.files,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch response');
    }
    const assistantMessage = { role: 'assistant', content: data.content || '(no content returned)' };
    const withoutPending = getSelectedChat().messages.slice(0, -1);
    persistChatUpdates({ messages: [...withoutPending, assistantMessage] });
  } catch (err) {
    const withoutPending = getSelectedChat().messages.slice(0, -1);
    persistChatUpdates({ messages: withoutPending });
    toastMessage(err.message, 3200);
  }
}

function handleFileUpload(event) {
  const files = Array.from(event.target.files || []);
  const chat = getSelectedChat();
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

chatNameInput.addEventListener('input', (e) => {
  persistChatUpdates({ name: e.target.value || 'Untitled chat' });
});

personaInput.addEventListener('input', (e) => {
  persistChatUpdates({ persona: e.target.value });
});

modelSelect.addEventListener('change', (e) => {
  persistChatUpdates({ model: e.target.value });
});

folderSelect.addEventListener('change', (e) => {
  persistChatUpdates({ folderId: e.target.value });
});

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    handleSend();
  }
});

sendButton.addEventListener('click', handleSend);
newChatButton.addEventListener('click', () => addChat(appState.selectedFolderId || 'root'));
deleteChatButton.addEventListener('click', removeChat);
renameChatButton.addEventListener('click', renameChat);
fileInput.addEventListener('change', handleFileUpload);
newFolderButton.addEventListener('click', addFolder);

render();
toastMessage('Ready to chat! Upload files or set a persona before sending.');
