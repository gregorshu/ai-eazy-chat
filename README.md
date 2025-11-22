# AI Eazy Chat

A lightweight, dependency-free web app for chatting with OpenRouter models. It supports multi-chat workflows, persona prompts, folders, and adding local text files to the chat context.

## Features
- Multiple chats with create, rename, and delete controls
- Organize chats into folders
- Per-chat persona/system prompt
- Attach text files (txt, md, csv, json) to include their content in the context
- Choose an OpenRouter model per chat
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
- When you send a message, the persona text and file contents are merged into the system prompt that is sent with your conversation history.

## Security
- Your API key stays on the server; the browser never sees it.
- File contents are kept in localStorage and sent only with the current chat request.

## Notes
- No npm dependencies are required. If you add packages later, update `package.json` accordingly.
- Models listed in the selector are examples; you can adjust them in `public/index.html` if needed.
