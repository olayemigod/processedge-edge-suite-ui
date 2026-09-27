# EdgeSuite UI Development Lineage and Release Governance

EdgeSuite UI is a shared runtime. Its development must remain progressive, monotonic and consolidated so every ProcessEdge product can consume one authoritative shared implementation.

## Version rule

1. EdgeSuite UI is on the `1.x` release line.
2. A newer implementation must never declare a package/runtime version lower than the highest established version.
3. `release-governance.json` records the highest established version and minimum supported version.
4. Python package version, npm package version and browser runtime version must be identical to the release ledger.
5. A pull request may retain the current version while adding unreleased work, or increase it according to semantic versioning. It may never decrease it.
6. The CI governance check compares the candidate ledger with the target branch ledger/history and fails closed on a version regression.
7. Feature-contract labels such as Reporting Standard V1 or Navigation Shell V2 do not determine the EdgeSuite UI package version.

## Progressive development rule

Before implementation starts, audit the current `main`, open PRs and active release candidate.

Use this order of preference:

1. **Continue** the current authoritative implementation line when the work belongs to it.
2. **Stack** a successor branch on the exact required predecessor when the new scope must remain separately reviewable.
3. **Reconcile** only when historical divergence already exists. The reconciliation branch must preserve accepted capability from all source lines unless an intentional removal is documented and tested.

Do not create a parallel branch from an older baseline merely because it is convenient. A branch that does not include its required predecessor cannot become release authority.

## One release authority

Only one PR targeting `main` should act as the current EdgeSuite UI release authority for a development programme. Stacked feature PRs should target their predecessor or remain source/reference lines until they are reconciled into the authoritative candidate.

A release-authority PR must declare in its body:

- `Integration mode: continue|stack|reconcile`
- `Authoritative predecessor: ...`
- `Capability preservation: ...`
- `Divergence check: ...`
- `Version impact: ...`
- `Release authority: yes`
- `Source lines: ...` when the mode is `reconcile`

CI rejects a PR to `main` when this lineage metadata is absent.

## Capability preservation

Reconciliation must be behavior-led rather than branch-preference-led. For every source line:

- identify the accepted capabilities;
- compare overlapping files and contracts;
- preserve later safety, permission, dark-mode, Frappe-compatibility and performance fixes;
- do not overwrite newer code merely to make Git history linear;
- record intentional removals and add regression tests for them;
- run EdgeSuite UI standalone validation plus direct-consumer compatibility before promotion.

## Product consumption

VetEdge, RetailEdge, EduEdge, CoreEdge, EdgePay and future products must consume the accepted EdgeSuite UI release line rather than independently copying shared UI behavior into product repositories. Product-specific permissions and business rules remain in the product app; shared visual/runtime behavior belongs here.

## Release sequence

1. Determine predecessor and integration mode.
2. Implement on the correct progressive line.
3. Reconcile shared work into one release candidate when required.
4. Pass version/lineage governance, contracts, frontend, browser and Frappe integration checks.
5. Validate direct consumer applications against the exact candidate SHA.
6. Complete shared browser QA.
7. Promote the authoritative candidate to `main`.
8. Close/supersede source PRs that are fully represented by the promoted candidate.
9. Begin the next work from the promoted `main` or an explicitly stacked successor—not from an older isolated branch.
