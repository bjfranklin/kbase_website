# Agentic AI Workflows

Public HTML slide deck: methodology, skill set, and operating model for agentic LLM work — Cursor-dark aesthetic, self-contained CSS/JS.

**End-user URL (after Pages sync):** [https://www.chairmanx.tech/projects/agentic-ai-workflows/](https://www.chairmanx.tech/projects/agentic-ai-workflows/)

Companion deck: [Sovereign Knowledge Bases](https://www.chairmanx.tech/projects/sovereign-knowledge-bases/) (Obsidian → RAG → MCP product story).

## Contents

| File | Purpose |
|------|---------|
| `index.html` | 10-slide keyboard-navigable presentation |
| `BRIEF.md` | Source narrative for the deck |

## Local preview

```bash
python3 -m http.server 8766 --directory agentic-ai-workflows
# http://localhost:8766/
```

Navigation: Arrow keys / Space · Home / End · Previous / Next.

## Publishing (GitHub Pages)

Canonical source: **kbase_dev** → synced to **kbase_website** (`projects/agentic-ai-workflows/`).

```bash
./scripts/sync-kbase-website-projects.sh
```

Then commit and push `kbase_website`, or push `main` on this monorepo with `KBASE_WEBSITE_SYNC_TOKEN` set.

## Related vault notes

- `2-projects/dev-ops/AI-Powered-Practitioner-Proficiency-Review-2026-07-20.md` — proficiency baseline
- `2-projects/ai-inference-stack-policy.md` — tool-role matrix
- `2-projects/dev-ops/cursor-tool-stack-migration.md` — Cursor consolidation
- `2-projects/dev-ops/kbase-website-github-pages-sync.md` — Pages sync hub
- `2-projects/dev-ops/sovereign-knowledge-bases.md` — sibling deck
