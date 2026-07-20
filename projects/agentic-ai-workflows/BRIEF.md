# Agentic AI Workflows — Brief

**Author:** Bradley Franklin  
**Updated:** 2026-07-20  
**Companion vault note:** `2-projects/dev-ops/AI-Powered-Practitioner-Proficiency-Review-2026-07-20.md`

How I design agentic workflows and LLM tooling — methodology, skill set, and operating model — without treating the model as the system of record.

---

## 1. Thesis

I operate as an **AI platform owner**, not a chat-box consumer. The scarce skill is designing the envelope agents must obey: contracts, tool roles, trust boundaries, and human review gates. Models are instruments. Git and the vault remain truth.

Evidence baseline (Jun–Jul 2026): ~72 Cursor sessions; overall proficiency **8.5 / 10** across developer, professional, and administrator roles.

---

## 2. Skill set

| Role | Score | Emphasis |
|------|-------|----------|
| AI-powered developer | 8.4 | Production MCP/RAG/proxy; multi-phase product work with confirmation gates |
| Professional (higher-ed) | 8.1 | Exec briefs, ACES/ZTC deliverables, WCAG-aware HTML; agent as capacity, human judgment |
| Administrator (AI ops) | 9.0 | Layered governance, inference roles, no-push enforcement, inbox staging |

---

## 3. Methodology

### Layered agent contracts

`AGENTS.md` → `CLAUDE.md` → `.cursor/rules` → vault write contract. Session-start reads project trackers via Obsidian MCP. Cloud/Slack agents stage to `0-inbox/` only; Desktop promotes to PARA.

### Tool-role separation

| Surface | Role |
|---------|------|
| **Cursor** | Daily frontier models, Agent, MCP |
| **Ollama (docker-host)** | Production open models |
| **LM Studio (Mac)** | Eval + offline travel only |
| **Pi / ollmcp** | Sensitive CLI / vault chat on homelab models |
| **ai-api-proxy** | Unified OpenAI-compatible routing |

### Trust boundaries

- Cloud agents never push (pre-push hooks)
- GitLab = system of record; GitHub mirror
- Credential hygiene + PII rules for institutional work
- Human reviews Git and pushes

### Operating loop

1. Establish baseline / read tracker via MCP  
2. One goal or explicit phases per turn  
3. Confirm gate before next phase  
4. MCP-16 session JSON + vault/daily notes  
5. Human push to origin  

---

## 4. Architecture (agent path)

```
Human intent
    │
    ├─► Cursor Agent (frontier) ──► Obsidian MCP (Docker) ──► Vault (Git SoR)
    │                                      │
    │                                      └─► Write contract (inbox vs PARA)
    │
    ├─► Homelab Ollama / ai-api-proxy ──► Pi · ollmcp · apps
    │
    └─► Trackers · MCP-16 JSON · check_vault.py ──► Durable memory
```

---

## 5. Why it matters

Agentic work scales when **policy is encoded** — not when prompts get longer. The methodology keeps models replaceable, knowledge durable, and institutional risk bounded.
