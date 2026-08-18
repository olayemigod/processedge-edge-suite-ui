from edgesuite_ui.search_ranking import rank_search_records, score_search_record


def test_exact_identifier_outranks_label_similarity():
	records = [
		{"value": "CF034R-18-C", "label": "Lontor Rechargeable Standing Fan"},
		{"value": "OTHER", "label": "CF034R 18 C replacement fan"},
	]

	ranked = rank_search_records(records, "CF034R-18-C")

	assert ranked[0]["value"] == "CF034R-18-C"


def test_typo_similarity_recovers_close_label_match():
	records = [
		{"value": "CF034R-18-C", "label": "Lontor Rechargeable Standing Fan"},
		{"value": "CF026-12", "label": "Lontor Ceiling Fan"},
	]

	ranked = rank_search_records(records, "lontor rechargable standing fan")

	assert ranked[0]["value"] == "CF034R-18-C"


def test_aliases_are_searchable_but_do_not_beat_exact_identifier():
	records = [
		{"value": "PETROL", "label": "Premium Motor Spirit", "aliases": ["fuel", "pms"]},
		{"value": "FUEL", "label": "Fuel Expense"},
	]

	ranked = rank_search_records(
		records,
		"fuel",
		alias_fields=("aliases",),
	)

	assert ranked[0]["value"] == "FUEL"
	assert ranked[1]["value"] == "PETROL"


def test_multi_token_query_matches_tokens_in_different_order():
	record = {"value": "PAT-001", "label": "Bruno Okafor", "description": "Owner John Okafor"}

	assert score_search_record(record, "okafor bruno") >= 800


def test_weak_unrelated_matches_are_rejected_by_threshold():
	records = [
		{"value": "PAT-001", "label": "Bruno"},
		{"value": "PAT-002", "label": "Bella"},
	]

	assert rank_search_records(records, "invoice", min_score=300) == []


def test_result_limit_is_bounded_to_one_hundred():
	records = [{"value": f"ITEM-{index}", "label": "Common item"} for index in range(150)]

	assert len(rank_search_records(records, "common", limit=500)) == 100


def test_empty_query_preserves_candidate_order():
	records = [
		{"value": "A", "label": "Alpha"},
		{"value": "B", "label": "Beta"},
	]

	assert rank_search_records(records, "") == records
