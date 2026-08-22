# Context Index — DragonFable Companion

Static project reference, split out of the former monolithic `AGENTS.md`. Load only the file you need.

`AGENTS.md` at the repo root is now the **dynamic handover orchestrator** (active status, live Kanban,
handover protocol, handover log). It intentionally contains no static reference content.

| File | Load when you need | Source sections from old AGENTS.md |
| ------ | -------------------- | ------------------------------------- |
| [`architecture.md`](./architecture.md) | Platform decisions, stack, hosting, perf budgets | Project Overview, Architecture, Tech Stack, Deployment, Constraints and Decisions, Performance Targets |
| [`project_structure.md`](./project_structure.md) | Where a file lives, naming rules | Project Structure, File Naming |
| [`data_reference.md`](./data_reference.md) | Dataset shapes, counts, glossary, access flags | Data Sources, Content Sections, Glossary, Price Types, Access Flag Computation, Shared Variant Ordering, Pets Data, Key Types, Slug convention, Badge Categories, badge dataset, Shared Reusable Components, Notes on data quality |
| [`engineering_guidelines.md`](./engineering_guidelines.md) | TS/React/styling/doc conventions | Documentation Policy, TypeScript, React Patterns, Styling, Design Token Reference, Responsive Breakpoints, File Naming, Item Title Display and Sorting, Forum Description Copy |
| [`ui_patterns.md`](./ui_patterns.md) | Building or changing any UI surface | Card Components, Obtain Cards, Detail Page Section Order, image rules, Also See, Expandable attack/skill cards, Filter Pills Pattern, per-page filters + URL params, detail metadata pills, Stats tables, Future sections |
| [`category_playbooks.md`](./category_playbooks.md) | Category-specific consolidation/split rules | Weapons Section, Housing Section, Pets Section, accessory consolidation + helm splits, badge curation, all documented special cases |
| [`scraper_operations.md`](./scraper_operations.md) | Running or modifying a scraper | Development Commands, Scraping Workflows, scraper notes, Other Commands, Dataset verification, Scraper Structure Guidelines, Python Environment |

## Conventions for these files

- These files are **durable knowledge**. Update them when a rule changes, not when a task progresses.
- Task/session state belongs in root `AGENTS.md` only.
- Feature-scoped working docs belong in `.kiro/specs/{feature}/STATUS.md`.
- Do not create new markdown files in the repo root.
