# EdgeSuite fuzzy search contract

EdgeSuite UI already provides `EdgeLinkField`, `EdgeDropdown`, `fuzzyOptionScore` and `fuzzyFilterOptions`. This contract strengthens that foundation without introducing a competing search control.

## Component responsibilities

### EdgeLinkField

Use for selecting one record/entity. It owns search UX: debouncing, stale-response protection, keyboard navigation, loading and empty states, clear/select behavior, create-new behavior and client-side re-ranking of returned options.

A product-provided `searcher(query, context)` remains responsible for server retrieval. Product apps should return a bounded list of options shaped as `value`, `label`, optional `description`, optional aliases/raw metadata.

### EdgeDropdown

Use for finite, already-known choices such as statuses, modes and yes/no style selections. It must not become a generic server-side entity lookup. Searchable filtering, when added, should remain opt-in and local to the supplied option list.

### Page/report search

Free-text page and report filters remain search inputs, not `EdgeLinkField`. They may reuse the same ranking utilities on the server.

## Ranking order

Product searchers should preserve deterministic business identifiers ahead of fuzzy text matches:

1. exact identifier/code
2. exact label
3. identifier/code prefix
4. label prefix
5. whole-token match
6. token-prefix match
7. substring match
8. typo similarity
9. subsequence fallback
10. optional alias/synonym match, with a small penalty versus canonical text

Identifiers include fields such as item code, barcode, patient ID, student ID, invoice number and payment reference.

## Server contract

The shared `edgesuite_ui.search_ranking` helper ranks an already bounded and permission-filtered candidate pool. It deliberately does not expose a generic arbitrary-DocType search endpoint.

Product searchers must:

1. enforce normal Frappe permissions before ranking;
2. enforce product context such as company, branch, warehouse, clinic or institution;
3. retrieve a bounded candidate pool using exact, prefix and token-aware database conditions;
4. avoid loading entire master tables into the browser;
5. pass the candidate pool through `rank_search_records`;
6. return at most the UI result limit;
7. never use fuzzy similarity alone to authorize, reconcile or financially identify a record.

Example:

```python
from edgesuite_ui.search_ranking import rank_search_records

rows = get_permission_filtered_candidates(...)
return rank_search_records(
    rows,
    query,
    exact_fields=("item_code", "barcode"),
    search_fields=("item_name", "description"),
    alias_fields=("aliases",),
    limit=20,
)
```

## Product adoption

Recommended first profiles:

- RetailEdge Item: exact `item_code`, `barcode`; fuzzy `item_name`, `description`; context `company`, `warehouse`.
- RetailEdge Customer/Supplier: exact code/mobile where appropriate; fuzzy party name and contact text; context `company`.
- VetEdge Patient: exact patient ID/microchip; fuzzy patient name and owner labels; context `branch`.
- VetEdge Practitioner: exact practitioner identifier; fuzzy practitioner name; context `branch`.
- EduEdge Student: exact student ID; fuzzy student name/guardian; context institution/campus/programme.
- AgricEdge Participant/Product: exact record code; fuzzy names and aliases; context organisation/location.
- EdgePay operations: exact provider/merchant/payment reference; fuzzy customer/payer labels. Fuzzy results are discovery aids only, not settlement or authorization evidence.

## Compatibility

Existing `EdgeLinkField` and `EdgeDropdown` usages remain valid. Product apps can adopt server-side ranking one search endpoint at a time. No product is required to replace the existing shared controls.
