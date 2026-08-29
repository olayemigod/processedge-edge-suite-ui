from __future__ import annotations

import re
from collections.abc import Iterable, Mapping, Sequence
from difflib import SequenceMatcher
from typing import Any

_WHITESPACE = re.compile(r"\s+")
_TOKEN_SPLIT = re.compile(r"[^\w]+", flags=re.UNICODE)


def normalize_search_text(value: Any) -> str:
	"""Normalize user-facing search text without changing stored values."""
	return _WHITESPACE.sub(" ", str(value or "").strip().casefold())


def search_tokens(value: Any) -> tuple[str, ...]:
	return tuple(token for token in _TOKEN_SPLIT.split(normalize_search_text(value)) if token)


def _iter_values(record: Mapping[str, Any], fields: Sequence[str]) -> Iterable[str]:
	for field in fields:
		value = record.get(field)
		if value is None:
			continue
		if isinstance(value, (list, tuple, set, frozenset)):
			for item in value:
				normalized = normalize_search_text(item)
				if normalized:
					yield normalized
			continue
		normalized = normalize_search_text(value)
		if normalized:
			yield normalized


def _subsequence_score(source: str, query: str) -> float:
	if not source or not query or len(query) > len(source):
		return -1
	position = 0
	last_match = -1
	gap_penalty = 0
	for character in query:
		position = source.find(character, position)
		if position < 0:
			return -1
		if last_match >= 0:
			gap_penalty += max(0, position - last_match - 1)
		last_match = position
		position += 1
	return max(60.0, 180.0 - min(120.0, gap_penalty * 4.0))


def _candidate_score(candidate: str, query: str, *, exact_identifier: bool = False) -> float:
	if candidate == query:
		return 1400.0 if exact_identifier else 1200.0
	if candidate.startswith(query):
		return (1120.0 if exact_identifier else 1000.0) - min(120.0, len(candidate) - len(query))

	candidate_tokens = search_tokens(candidate)
	query_tokens = search_tokens(query)
	if query_tokens and all(token in candidate_tokens for token in query_tokens):
		return 900.0 - min(120.0, len(candidate_tokens) - len(query_tokens))
	if query_tokens and all(
		any(word.startswith(token) for word in candidate_tokens) for token in query_tokens
	):
		return 820.0
	if query in candidate:
		return 720.0 - min(120.0, candidate.index(query))

	ratio = SequenceMatcher(None, candidate, query).ratio()
	if ratio >= 0.84:
		return 650.0 + ratio * 100.0
	if ratio >= 0.72:
		return 520.0 + ratio * 100.0

	if len(query) >= 3:
		return _subsequence_score(candidate, query)
	return -1


def score_search_record(
	record: Mapping[str, Any],
	query: Any,
	*,
	exact_fields: Sequence[str] = ("value", "name"),
	search_fields: Sequence[str] = ("label", "description"),
	alias_fields: Sequence[str] = (),
) -> float:
	"""Return the best deterministic fuzzy score for one record."""
	term = normalize_search_text(query)
	if not term:
		return 1.0

	best = -1.0
	for candidate in _iter_values(record, exact_fields):
		best = max(best, _candidate_score(candidate, term, exact_identifier=True))
	for candidate in _iter_values(record, search_fields):
		best = max(best, _candidate_score(candidate, term))
	for candidate in _iter_values(record, alias_fields):
		alias_score = _candidate_score(candidate, term)
		if alias_score >= 0:
			best = max(best, alias_score - 40.0)
	return best


def rank_search_records(
	records: Iterable[Mapping[str, Any]],
	query: Any,
	*,
	exact_fields: Sequence[str] = ("value", "name"),
	search_fields: Sequence[str] = ("label", "description"),
	alias_fields: Sequence[str] = (),
	limit: int = 20,
	min_score: float = 180.0,
) -> list[Mapping[str, Any]]:
	"""Rank an already bounded, permission-filtered candidate pool.

	This helper deliberately does not query DocTypes. Product apps remain responsible
	for permission, company/branch context and bounded candidate retrieval.
	"""
	bounded_limit = max(0, min(int(limit or 0), 100))
	if bounded_limit == 0:
		return []

	materialized = list(records)
	if not normalize_search_text(query):
		return materialized[:bounded_limit]

	scored = []
	for index, record in enumerate(materialized):
		score = score_search_record(
			record,
			query,
			exact_fields=exact_fields,
			search_fields=search_fields,
			alias_fields=alias_fields,
		)
		if score >= min_score:
			scored.append((score, index, record))

	scored.sort(key=lambda item: (-item[0], item[1]))
	return [record for _, _, record in scored[:bounded_limit]]
