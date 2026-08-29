## Scope

<!-- What shared EdgeSuite capability changes in this PR? -->

## Lineage

Integration mode: continue
Authoritative predecessor: main
Capability preservation: Existing accepted shared capability is preserved unless explicitly documented below.
Divergence check: Open EdgeSuite UI PRs/branches were reviewed before implementation; this work does not create an independent competing release line.
Version impact: No regression. Keep current version or increase according to SemVer and `release-governance.json`.
Release authority: yes

<!-- Required only when Integration mode is reconcile -->
Source lines: N/A

## Intentional removals

<!-- List any accepted capability intentionally removed/replaced and the regression coverage proving the replacement is safe. Use None when applicable. -->

## Shared safety boundaries

- EdgeSuite UI remains product-neutral.
- Product apps remain authoritative for business permissions, tenant/company/branch scope and domain mutations.
- No accepted shared capability is silently dropped during reconciliation.
- Version surfaces remain aligned and monotonic.

## Validation

- [ ] Release/version governance
- [ ] Fast contracts
- [ ] Frontend validation
- [ ] Browser smoke where applicable
- [ ] Frappe v16 integration where applicable
- [ ] Direct consumer compatibility where applicable
