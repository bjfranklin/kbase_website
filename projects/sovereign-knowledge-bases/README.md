# Sovereign Knowledge Bases

Public HTML slide deck: how a personal Obsidian vault became production RAG (PostgreSQL/pgvector), MCP agents, and offline continuity — without treating the LLM as the system of record.

**End-user URL:** [https://www.chairmanx.tech/projects/sovereign-knowledge-bases/](https://www.chairmanx.tech/projects/sovereign-knowledge-bases/)

## Contents

| File | Purpose |
|------|---------|
| `index.html` | 10-slide keyboard-navigable presentation (self-contained CSS/JS) |
| `BRIEF.md` | Companion narrative used to author the deck |

## Local preview

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765 --directory sovereign-knowledge-bases
# then http://localhost:8765/
```

Navigation: Arrow keys / Space · Home / End · Previous / Next buttons.

## Publishing (GitHub Pages)

Canonical source: **kbase_dev** → synced to **kbase_website** (`projects/sovereign-knowledge-bases/`).

```bash
./scripts/sync-kbase-website-projects.sh
```

Then commit and push `kbase_website`, or push `main` on this monorepo with `KBASE_WEBSITE_SYNC_TOKEN` set.

## Related vault notes

- `2-projects/dev-ops/sovereign-knowledge-bases.md` — project note + hosted URL
- `2-projects/dev-ops/kbase-website-github-pages-sync.md` — Pages sync hub
- `2-projects/dev-ops/obsidian-rag/` — RAG tracker / README
- `2-projects/dev-ops/obsidian-mcp-server/` — MCP server tracker
- `2-projects/self-hosted-services-stack.md` — homelab context
