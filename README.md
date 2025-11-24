# AI Eazy Chat

A lightweight, dependency-free web app for chatting with OpenRouter models. It supports multi-chat workflows, persona prompts, folders, and adding local text files to the chat context.

## Features
- Multi-chat workspace with folder organization, rename, move, and delete controls
- Workspace-level model + persona settings that apply to every chat
- Context files per chat (txt, md, csv, json) included with each request
- Streaming responses with cancel, retry last response, and edit-last-message flows
- Copy assistant replies with one click
- Sidebar hide/show toggle for compact layouts
- Local persistence via `localStorage` so chats and folders survive refreshes
- Keyboard shortcut: <kbd>Ctrl/Cmd + Enter</kbd> to send

## Setup
1. Create an OpenRouter API key at https://openrouter.ai/
2. Export it in your environment:

```bash
export OPENROUTER_API_KEY="your_key_here"
```

3. Start the server:

```bash
node server.js
```

4. Visit http://localhost:3000 in your browser.

## How it works
- The Node server (`server.js`) serves the static front-end from `public/` and proxies chat requests to OpenRouter using your `OPENROUTER_API_KEY`.
- The front-end stores chats, folders, personas, and file attachments in `localStorage` so your workspace persists across refreshes.
- Use the settings dialog to pick a model and set a persona; both are applied to every chat.
- When you send a message, any attached files for that chat are merged into the system prompt along with the persona text.
- Responses stream in real time; you can cancel an in-flight request, retry after editing your last user message, or copy an assistant reply.

## Security
- Your API key stays on the server; the browser never sees it.
- File contents are kept in localStorage and sent only with the current chat request.

## Notes
- No npm dependencies are required. If you add packages later, update `package.json` accordingly.
- Models listed in the selector are examples; you can adjust them in `public/index.html` if needed.
