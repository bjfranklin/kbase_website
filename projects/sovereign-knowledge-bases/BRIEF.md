# Obsidian Knowledge Base → RAG + Agents

**Author:** Bradley Franklin  
**Vault:** `kbase_professional` (PARA Obsidian vault; Git = system of record)  
**Updated:** 2026-07-14

A short overview of how a personal Obsidian vault became a production RAG stack with PostgreSQL/pgvector, and how AI agents use MCP to work against that knowledge base.

---

## 1. The knowledge base

The vault (`kbase_professional`) is a PARA-structured Obsidian knowledge base: projects, areas, resources, and archive, with YAML frontmatter, path-qualified wikilinks, and CI (`check_vault.py`) as the quality gate. Markdown in Git is the source of truth; Obsidian is the editing surface.

Repo context lives in the `kbase_dev` monorepo (`obsidian-rag`, `obsidian-rag-postgres`, `obsidian-mcp-server`, `obsidian-devops-copilot`, and related tooling).

---

## 2. From notes to RAG

### v1–v2: local semantic RAG

Built during an AI literacy build cycle, then hardened to **Obsidian RAG v2.0** (production):

| Layer | What it does |
|-------|----------------|
| **Embeddings** | `sentence-transformers/all-MiniLM-L6-v2` (384-dim), cached locally |
| **Hybrid search** | Tags (TF-IDF) + semantic similarity; modes: Auto / Hybrid / Tags / Semantic |
| **Generation** | Claude via Anthropic API on retrieved snippets |
| **Web enhancement** | Optional Brave Search, merged with vault hits (vault preferred) |
| **Interfaces** | FastAPI (`:8000`), CLI (`ask`), web UI, cost tracking |

Vault content stays local; only query context and truncated matches go to the LLM.

### Postgres + pgvector (homelab)

File/pickle caches were replaced by **PostgreSQL 16 + pgvector** (`obsidian-rag-postgres`), running on the homelab Teleport stack (`192.168.1.51:8000`):

- **`notes`** — one row per file; frontmatter columns + JSONB; weighted `tsvector` (title / type / content)
- **`chunks`** — heading-aware segments with embedding vectors
- **`tags` / `note_tags`** — normalized tag graph
- **`note_links`** — resolved wikilink graph
- **`vault-indexer`** — full + incremental indexing via content hashes (unchanged files skipped)

Search combines structured filters, full-text ranking, and vector similarity. Docker Compose phases delivered schema → indexer → RAG API wired to the DB.

### Offline continuity

When the live API is unreachable, **snapshot export** (`POST /export-snapshot`) writes a portable index into `.copilot/rag-snapshot/` for the DevOps Copilot plugin (live server → snapshot → vault-native fallback).

---

## 3. AI / MCP / agent processes

Agents do not scrape the vault blindly. They use a deliberate tool stack:

### Obsidian MCP server (hardened)

**`obsidian-mcp-server`** — FastMCP tools in a distroless Docker image (non-root, path traversal guards, extension allowlists). Agents get read/search/write tools (e.g. `get_file_contents`, `simple_search`, `create_file`, periodic notes, HTML deliverable planner) against the vault mount.

Cursor (and other MCP hosts) call these tools for session context: load project trackers from vault paths, search notes, and—under write contract—stage or update markdown.

### Agent operating model

| Piece | Role |
|-------|------|
| **Cursor** | Daily frontier-model coding + MCP (`user-obsidian`) |
| **Vault write contract** | Git = SoR; Slack/cloud agents stage to `0-inbox/` only; Desktop promotes to PARA |
| **AGENTS.md / CLAUDE.md** | Session-start: read monorepo + project trackers via MCP |
| **DevOps Copilot** | Obsidian plugin with multi-tier RAG retrieval (live / snapshot / vault) |
| **Homelab inference** | Ollama / `ai-api-proxy` for local models where configured |
| **Ticket agent** | Separate MCP agent for PDF/ticket workflows (same vault ecosystem) |

Typical loop: agent reads the project tracker via MCP → uses RAG or vault search for deep context → proposes or applies changes under the write policy → human reviews Git and pushes.

---

## 4. Stack at a glance

```
Obsidian vault (PARA markdown / Git)
        │
        ├─► vault-indexer ──► PostgreSQL + pgvector ──► RAG API (homelab)
        │                                              ├─ CLI / Web UI
        │                                              └─ snapshot → Copilot offline
        │
        └─► Obsidian MCP (Docker) ──► Cursor / agents (read, search, governed write)
```

---

## 5. Why it matters

Personal notes become **queryable knowledge** (hybrid + vector), **durable** (Postgres + incremental index), **agent-operable** (MCP with security boundaries), and **usable offline** (snapshot tiers)—without treating the LLM as the system of record.
