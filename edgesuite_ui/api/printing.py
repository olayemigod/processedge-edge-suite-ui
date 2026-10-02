from __future__ import annotations

from typing import Any

import frappe

PRINT_PROFILE_FIELDS = (
	"name",
	"profile_name",
	"purpose",
	"product_key",
	"scope_type",
	"scope_value",
	"priority",
	"transport",
	"protocol",
	"paper_width",
	"characters_per_line",
	"baud_rate",
	"auto_cut",
	"cut_mode",
	"cash_drawer",
	"drawer_pin",
	"feed_lines",
	"copies",
	"print_logo",
	"print_qr",
)

_SCOPE_SPECIFICITY = {
	"Global": 100,
	"Company": 200,
	"Branch": 300,
	"User": 400,
}


def _require_authenticated_user() -> str:
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw("Authentication is required to resolve print profiles.", frappe.PermissionError)
	return user


def _normalize(value: Any) -> str:
	return str(value or "").strip()


def _profile_matches(
	profile: dict[str, Any],
	*,
	user: str,
	product_key: str,
	company: str,
	branch: str,
) -> bool:
	profile_product = _normalize(profile.get("product_key"))
	if profile_product and profile_product != product_key:
		return False

	scope_type = _normalize(profile.get("scope_type")) or "Global"
	scope_value = _normalize(profile.get("scope_value"))
	if scope_type == "Global":
		return True
	if scope_type == "Company":
		return bool(company) and scope_value == company
	if scope_type == "Branch":
		return bool(branch) and scope_value == branch
	if scope_type == "User":
		return scope_value == user
	return False


def _profile_rank(profile: dict[str, Any], product_key: str) -> tuple[int, int, int, str]:
	scope_type = _normalize(profile.get("scope_type")) or "Global"
	specificity = _SCOPE_SPECIFICITY.get(scope_type, 0)
	product_specific = 1 if _normalize(profile.get("product_key")) == product_key and product_key else 0
	priority = int(profile.get("priority") or 0)
	return specificity, product_specific, priority, _normalize(profile.get("name"))


def _safe_profile(profile: dict[str, Any]) -> dict[str, Any]:
	return {field: profile.get(field) for field in PRINT_PROFILE_FIELDS}


@frappe.whitelist()
def get_active_print_profiles(
	purpose: str = "Receipt",
	product_key: str | None = None,
	company: str | None = None,
	branch: str | None = None,
) -> list[dict[str, Any]]:
	"""Return non-sensitive printer policy visible to an authenticated EdgeSuite user.

	This endpoint does not grant product, company, branch, document, or workflow access.
	Product applications remain authoritative for the business context they supply.
	"""

	user = _require_authenticated_user()
	purpose = _normalize(purpose) or "Receipt"
	product_key = _normalize(product_key)
	company = _normalize(company)
	branch = _normalize(branch)

	profiles = frappe.get_all(
		"Edge Print Profile",
		filters={"enabled": 1, "purpose": purpose},
		fields=list(PRINT_PROFILE_FIELDS),
		order_by="priority desc, modified desc",
	)

	matches = [
		profile
		for profile in profiles
		if _profile_matches(
			profile,
			user=user,
			product_key=product_key,
			company=company,
			branch=branch,
		)
	]
	matches.sort(key=lambda profile: _profile_rank(profile, product_key), reverse=True)
	return [_safe_profile(profile) for profile in matches]


@frappe.whitelist()
def resolve_print_profile(
	purpose: str = "Receipt",
	product_key: str | None = None,
	company: str | None = None,
	branch: str | None = None,
) -> dict[str, Any] | None:
	profiles = get_active_print_profiles(
		purpose=purpose,
		product_key=product_key,
		company=company,
		branch=branch,
	)
	return profiles[0] if profiles else None
