# AI Agent — Autonomous Workspace

A production-grade, open-ended AI agent that runs locally on your machine.
It writes code, researches the web, generates images, manages files, talks to
GitHub, and reads your projects via retrieval-augmented context — all from a
single chat interface.

## What's new in this version

The agent is now **intent-aware**. Earlier versions ran the full planning /
task-decomposition / multi-agent pipeline for *every* message, which meant
typing "hello" triggered a full plan with steps and tools. That is now fixed:

- A zero-latency **intent classifier** (`src/agent/intent_classifier.ts`)
  inspects each message and decides whether it's smalltalk, a single
  question, or a multi-step task.
- The agent loop reads the verdict and selectively enables planning,
  decomposition, multi-agent orchestration, RAG retrieval and long-term
  memory — none of which run for casual chat.
- A **response-mode selector** in the input lets you override the verdict
  with `Auto`, `Quick`, `Smart`, or `Deep`.

The rest of the UI was refreshed: the chat input supports **drag-and-drop and
paste** for files, the tool-call cards are denser and more elegant, the
welcome screen highlights light/quick examples next to heavy ones, and the
whole app now ships with **a real dark mode** (toggle in the top bar).

## Tech stack

- **Next.js 16** (App Router) + React 19
- **Tailwind CSS 4** with a refined design-token system and gradient accents
- **TypeScript** end-to-end
- **LangChain.js** (`@langchain/openai`, `@langchain/core`) — custom ReAct
  loop with streaming, parallel tool execution, retries, reflection
- **Zustand** for client state
- **Sonner** + **next-themes** for toasts and theming
- **shadcn/ui** for the primitive component layer
- Local **keyword / TF-cosine retrieval** for project RAG (in-memory, no
  external embedding service required)
- **Puppeteer**, **pdf-parse**, **cheerio**, **mathjs**, **jszip**,
  **sharp** for the tool layer

## Architecture

```
src/
├── agent/
│   ├── index.ts                # Main ReAct loop (intent-gated)
│   ├── intent_classifier.ts    # NEW: routes chat vs task
│   ├── planner.ts              # Heuristic planner
│   ├── task_decomposer.ts      # Subtask decomposition
│   ├── reflection.ts           # Post-tool self-reflection
│   ├── executor.ts             # Parallel tool batching
│   ├── error_handler.ts        # Exponential-backoff retry
│   ├── security.ts             # Per-session safety + rate limiting
│   ├── system_prompt.ts        # Mode-aware system prompt
│   ├── memory/                 # Short- and long-term memory
│   ├── multi_agent/            # Planner / Executor / Reviewer roles
│   ├── reliability/            # Health monitor, retries, fallbacks
│   ├── rag/                    # Local vector indexing + retrieval
│   ├── skills/                 # 10 skill profiles (Android, Web, ...)
│   └── tools/                  # 25+ tools (file, web, github, image, ...)
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # SSE chat endpoint (accepts mode)
│   │   ├── history/route.ts    # Chat history persistence
│   │   ├── workspace/route.ts  # Workspace files
│   │   ├── project/route.ts    # Project upload (ZIP)
│   │   ├── rag/route.ts        # RAG indexing
│   │   └── zip/route.ts        # Export workspace as ZIP
│   ├── layout.tsx              # Theme + Sonner toaster
│   ├── globals.css             # Light + dark design tokens
│   └── page.tsx                # Top-level layout (3-panel)
├── components/
│   ├── ChatWindow/             # Chat, tool panels, input (drag-drop)
│   ├── WelcomeScreen.tsx       # Onboarding cards
│   ├── ThemeToggle.tsx         # NEW: light/dark switch
│   ├── ChatSidebar/            # Conversation history
│   ├── Settings/               # API / GitHub / image-API settings
│   ├── ToolPanel/              # Tool execution timeline
│   ├── FileExplorer/           # Workspace file tree
│   ├── ProjectExplorer/        # Connected project tree
│   ├── CodeEditor/             # Monaco-based editor for project files
│   ├── SkillIndicator/         # Active-skill pill
│   └── SkillSelector/          # Manual skill override
├── hooks/
│   ├── useChatStream.ts        # SSE consumer
│   └── useKeyboardShortcuts.ts # ⌘B / ⌘K / Esc
├── lib/store.ts                # Zustand store (incl. responseMode)
└── types/index.ts              # Shared TS types
```

## Response modes

| Mode    | When to use                              | What it does                                                      |
| ------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `Auto`  | Default — let the agent decide           | Runs the intent classifier and picks the best mode                |
| `Quick` | Greetings, single short questions        | Skips planner, decomposition, multi-agent, RAG; caps at 3 loops   |
| `Smart` | Most real tasks                          | Enables planner + memory; decomposition only when needed          |
| `Deep`  | Complex multi-step work, refactors       | Raises the iteration budget, runs task decomposition, and surfaces planner/executor/reviewer activity alongside the main loop |

The classifier is heuristic and language-aware (English and Hebrew). It
considers length, action verbs, multi-step hints, and attachments to choose
defaults.

## Setup

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, click the settings icon, paste your API key,
and start chatting.

### Configure providers

Open the **Settings** sheet (gear icon, top-right) and fill in:

- **Primary API** — any OpenAI-compatible endpoint
  (`https://integrate.api.nvidia.com/v1`, `https://api.openai.com/v1`, …)
- **Image API** — same shape, used by the `generate_image` tool
- **GitHub token** (optional) — enables the 12 GitHub tools

Settings persist in `localStorage`; they never leave the browser except as
part of an API request to your chosen provider.

## Testing the new features

### 1. Intent classifier / fast path

Send `hello` (or `שלום`). The agent should reply within a second or two
with a short greeting — **no plan card, no tool calls, no decomposition**.

Then send: *"Build a Next.js dashboard with auth, dark mode, and a Postgres
backend, and write integration tests for the auth flow."* The Plan card
should appear and the multi-agent orchestrator should run.

### 2. Response-mode override

Click the mode chip next to the paperclip in the input. Switch to **Quick**
and ask anything — even complex questions get a fast direct reply with no
planning. Switch to **Deep** for the heaviest tasks.

### 3. File upload UX

Drop a `.ts` file, a `.png` image, or paste an image from the clipboard into
the input. They appear as chips with size and an icon. Up to 8 attachments;
text is capped at 200 KB, images at 4 MB. Once sent, attachments render on
your message as **cards** — a thumbnail (click to zoom) for images, an icon
plus extension badge for text files.

ZIP archives go through the folder-archive icon and become a **connected
project** (indexed for RAG).

### 4. Theme toggle

Click the sun/moon icon in the top bar. The whole app — including syntax
highlighting and the Sonner toast — re-themes immediately.

### 5. Tool-call cards

Send: *"Search the web for 'Anthropic Claude 4.7' and summarize the top three
results."* Watch the tool cards stream in. Each card shows the input
summary, status pill (running / done / failed), and timing. Click to expand
the input/output payload.

## Adding a tool

Tools live in `src/agent/tools/` and follow the LangChain
`StructuredToolInterface` convention. Add the new tool to the array
returned by `getAllTools` in `src/agent/tools/index.ts`. The agent picks it
up on the next request.

## Adding a skill

Skills live in `src/agent/skills/modules/`. Each module exports a
`SkillModule` with `name`, `displayName`, `icon`, `preferredTools`,
`avoidedTools`, `systemPrompt`, and `detectionKeywords`. Register the module
in `skill_detector.ts` and add a detection rule.

## Building

```bash
npm run build       # production build (standalone output)
npm start           # serve the standalone build with Bun
npm run lint        # ESLint
```

## License

MIT.
