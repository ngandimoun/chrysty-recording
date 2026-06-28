# Chrysty Recording Architecture

## Chrysty Recording Core Principle

Chrysty Recording does not extract only tasks, summaries, or documents.

Its primary responsibility is to continuously build and maintain an accurate model of the user's world.

Every recording should be treated as a source of new knowledge.

The Observation Agent must behave like an experienced intelligence analyst, chief of staff, researcher, and archivist combined. It should identify not only explicit requests, but also implicit relationships, evolving situations, future intentions, personal context, professional context, decisions, changes, trends, preferences, commitments, opportunities, risks, and historical facts.

The system should assume that any observation may become valuable months or years later.

Every downstream capability—documents, reminders, tasks, charts, insights, search, memory, and future AI interactions—must be built from this structured observation layer rather than directly from the transcript.

The objective is not to generate documents.

The objective is to understand the user's world with increasing accuracy over time.

Most AI recorders ask: *"What should I output from this recording?"*  
Chrysty asks: *"What have I learned about this person's world, and how should that knowledge evolve?"*

## Pipeline

```
Recording → Transcript → Observation Agent → Significance Scorer → Planner → Specialized Agents → Presentation Engine
```

## Data hierarchy

```
Recording → Observations → Entities → Knowledge Graph → Generated Artifacts → Insights
```

The transcript is raw input. **Observations are the canonical source of truth.**

## Agents

| Agent | Responsibility |
|-------|----------------|
| **Observation** | Analyst-style world understanding; domain-agnostic; mandatory checklist |
| **Significance Scorer** | Importance, novelty, routing flags per observation |
| **Planner** | Decides which specialized agents run; does not extract |
| **Entity** | People, orgs, places, relationships |
| **Timeline** | Events, future/historical timeline |
| **Task** | Reminders and todos |
| **Memory** | Changes, trends, preferences |
| **Document stub** | Register documents for Presentation Engine |
| **Presentation Engine** | Document DSL formatting only |

See [`AGENTS.md`](AGENTS.md) for Supabase and deployment conventions.
