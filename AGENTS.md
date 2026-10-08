# ProcessEdge Repository Instructions

## Mandatory canonical skill
Before planning, editing, implementing, reviewing, testing, creating a branch/PR, performing QA, migration, release, or any other repository operation, load and follow the canonical ProcessEdge Frappe/ERPNext Product Engineering Skill:

https://github.com/olayemigod/processedge-qa/blob/main/skills/processedge-frappe-product-engineering/SKILL.md

The canonical skill is the shared engineering authority for ProcessEdge Frappe/ERPNext + EdgeSuite work. Re-read it at the start of each new work session and whenever the task changes materially.

## Pre-work gate
Do not modify code until you have checked:
1. canonical skill;
2. repository-specific instructions/docs;
3. current authoritative branch/base;
4. outstanding PRs and whether the work belongs in one of them;
5. existing ERPNext/Frappe behavior and governance;
6. existing EdgeSuite/shared implementation before creating product-local behavior;
7. required role/permission personas and tests;
8. the smallest bounded mergeable implementation slice.

## Local scope
This repository owns shared EdgeSuite UI primitives and runtime behavior. Product-neutral UI behavior should be implemented here rather than duplicated across product apps. Repository-specific instructions extend the canonical skill; they must not silently weaken its ERPNext governance, permissions, workflow, cascade, draft-editability, semantic-component, theme/dark-mode, testing, QA, or PR-discipline rules.
