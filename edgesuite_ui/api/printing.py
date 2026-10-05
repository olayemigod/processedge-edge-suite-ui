from __future__ import annotations

from typing import Any

import frappe
from frappe import _

from edgesuite_ui.api.product_context import get_available_products

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
	"text_encoding",
	"auto_cut",
	"cut_mode",
	"cash_drawer",
	"drawer_pin",
	"feed_lines",
	"copies",
	"print_logo",
	"print_qr",
)
MANAGED_PRINT_PROFILE_FIELDS = (
	"name",
	"profile_name",
	"enabled",
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
	"text_encoding",
	"auto_cut",
	"cut_mode",
	"cash_drawer",
	"drawer_pin",
	"feed_lines",
	"copies",
	"print_logo",
	"print_qr",
	"notes",
	"modified",
)

_SCOPE_SPECIFICITY = {
	"Global": 100,
	"Company": 200,
	"Branch": 300,
	"User": 400,
}
_SCOPE_DOCTYPES = {
	"Company": "Company",
	"Branch": "Branch",
	"User": "User",
}
PRINT_CONTEXT_VALIDATOR_HOOK = "edgesuite_print_context_validators"


def _require_authenticated_user() -> str:
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw("Authentication is required to resolve print profiles.", frappe.PermissionError)
	return user


def _require_print_profile_manager() -> str:
	user = _require_authenticated_user()
	if user != "Administrator" and "System Manager" not in frappe.get_roles(user):
		frappe.throw(_("System Manager permission is required to manage printer profiles."), frappe.PermissionError)
	return user


def _normalize(value: Any) -> str:
	return str(value or "").strip()


def _normalize_product_key(value: Any) -> str:
	return "-".join(
		part
		for part in "".join(
			character.lower() if character.isalnum() or character in {"_", "-"} else "-"
			for character in _normalize(value)
		).split("-")
		if part
	)


def _require_product_available(product_key: str) -> str:
	key = _normalize_product_key(product_key)
	if not key:
		return ""
	available = {str(product.get("key") or "") for product in get_available_products()}
	if key not in available:
		frappe.throw(_("This product is not currently available."), frappe.PermissionError)
	return key


def _profile_matches(
	profile: dict[str, Any],
	*,
	user: str,
	product_key: str,
	company: str,
	branch: str,
) -> bool:
	profile_product = _normalize_product_key(profile.get("product_key"))
	if profile_product and profile_product != product_key:
		return False

	scope_type = _normalize(profile.get("scope_type")) or "Global"
	scope_value = _normalize(profile.get("scope_value"))
	if scope_type in {"Company", "Branch"} and not profile_product:
		return False
	if scope_type == "Global":
		return True
	if scope_type == "Company":
		return bool(company) and scope_value == company
	if scope_type == "Branch":
		return bool(branch) and scope_value == branch
	if scope_type == "User":
		return scope_value == user
	return False


def _profile_effective_rank(profile: dict[str, Any], product_key: str) -> tuple[int, int, int]:
	scope_type = _normalize(profile.get("scope_type")) or "Global"
	specificity = _SCOPE_SPECIFICITY.get(scope_type, 0)
	product_specific = (
		1 if _normalize_product_key(profile.get("product_key")) == product_key and product_key else 0
	)
	priority = int(profile.get("priority") or 0)
	return specificity, product_specific, priority


def _profile_rank(profile: dict[str, Any], product_key: str) -> tuple[int, int, int, str]:
	return (*_profile_effective_rank(profile, product_key), _normalize(profile.get("name")))


def _validate_product_scope(
	*,
	user: str,
	purpose: str,
	product_key: str,
	company: str,
	branch: str,
) -> tuple[str, str]:
	if not product_key or not (company or branch):
		return company, branch

	validators = frappe.get_hooks(PRINT_CONTEXT_VALIDATOR_HOOK, default=[]) or []
	for validator_path in validators:
		try:
			validator = frappe.get_attr(validator_path)
			result = validator(
				product_key=product_key,
				company=company,
				branch=branch,
				purpose=purpose,
				user=user,
			)
		except frappe.PermissionError:
			raise
		except Exception:
			frappe.log_error(
				title=f"EdgeSuite print context validator failed: {validator_path}",
				message=frappe.get_traceback(),
			)
			continue

		if not isinstance(result, dict) or not result.get("handled"):
			continue
		if result.get("allowed") is False:
			frappe.throw(
				result.get("reason") or _("You do not have access to this printing context."),
				frappe.PermissionError,
			)
		return (
			_normalize(result.get("company")) or company,
			_normalize(result.get("branch")) or branch,
		)

	frappe.throw(
		_("This product does not provide a validated Company/Branch printing context."),
		frappe.PermissionError,
	)
	return company, branch


def _safe_profile(profile: dict[str, Any]) -> dict[str, Any]:
	result = {field: profile.get(field) for field in PRINT_PROFILE_FIELDS}
	result["product_key"] = _normalize_product_key(profile.get("product_key"))
	result["text_encoding"] = _normalize(profile.get("text_encoding")) or "ASCII Safe"
	# Logo raster preprocessing is deliberately outside V1. Existing rows created
	# before this hardening may still contain print_logo=1, so never expose that
	# stale flag as an active runtime capability.
	result["print_logo"] = 0
	return result


def _managed_profile(profile: dict[str, Any]) -> dict[str, Any]:
	result = {field: profile.get(field) for field in MANAGED_PRINT_PROFILE_FIELDS}
	result["product_key"] = _normalize_product_key(profile.get("product_key"))
	result["text_encoding"] = _normalize(profile.get("text_encoding")) or "ASCII Safe"
	result["print_logo"] = 0
	return result


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
	if purpose != "Receipt":
		frappe.throw(_("Printing V1 currently supports Receipt profiles only."))
	product_key = _require_product_available(_normalize(product_key))
	company = _normalize(company)
	branch = _normalize(branch)
	company, branch = _validate_product_scope(
		user=user,
		purpose=purpose,
		product_key=product_key,
		company=company,
		branch=branch,
	)

	profiles = frappe.get_all(
		"Edge Print Profile",
		filters={
			"enabled": 1,
			"purpose": purpose,
			"transport": "Serial",
			"protocol": "ESC/POS",
		},
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
	if not profiles:
		return None

	normalized_product_key = _normalize_product_key(product_key)
	if len(profiles) > 1 and _profile_effective_rank(
		profiles[0], normalized_product_key
	) == _profile_effective_rank(profiles[1], normalized_product_key):
		frappe.throw(
			_(
				"Multiple active printer profiles match this context with the same effective priority. "
				"Disable one profile or assign distinct priorities."
			)
		)
	return profiles[0]


@frappe.whitelist()
def get_print_profile_manager_context() -> dict[str, Any]:
	"""Return EdgeSuite profile-manager data for System Manager users.

	Product selection is deliberately not defaulted. The user chooses a Product
	only when the policy is product-owned; Global/User policies may remain shared.
	"""

	_require_print_profile_manager()
	products = [
		{
			"key": _normalize_product_key(product.get("key")),
			"label": _normalize(product.get("label") or product.get("product") or product.get("key")),
		}
		for product in get_available_products()
		if _normalize_product_key(product.get("key"))
	]
	profiles = frappe.get_all(
		"Edge Print Profile",
		fields=list(MANAGED_PRINT_PROFILE_FIELDS),
		order_by="enabled desc, priority desc, modified desc",
	)
	return {
		"products": products,
		"profiles": [_managed_profile(profile) for profile in profiles],
		"defaults": {
			"enabled": 1,
			"purpose": "Receipt",
			"product_key": "",
			"scope_type": "Global",
			"scope_value": "",
			"priority": 0,
			"transport": "Serial",
			"protocol": "ESC/POS",
			"paper_width": 80,
			"characters_per_line": 48,
			"baud_rate": 9600,
			"text_encoding": "ASCII Safe",
			"auto_cut": 1,
			"cut_mode": "Partial",
			"cash_drawer": 0,
			"drawer_pin": 0,
			"feed_lines": 3,
			"copies": 1,
			"print_qr": 1,
			"notes": "",
		},
	}


@frappe.whitelist()
def search_print_scope_values(scope_type: str, txt: str | None = None) -> list[dict[str, str]]:
	_require_print_profile_manager()
	scope_type = _normalize(scope_type)
	doctype = _SCOPE_DOCTYPES.get(scope_type)
	if not doctype:
		return []
	filters: dict[str, Any] = {}
	if txt:
		filters["name"] = ["like", f"%{_normalize(txt)}%"]
	if doctype == "User":
		filters["enabled"] = 1
	rows = frappe.get_all(doctype, filters=filters, fields=["name"], order_by="name asc", limit=40)
	return [{"value": row.name, "label": row.name} for row in rows]


@frappe.whitelist()
def save_print_profile(profile: dict[str, Any] | str) -> dict[str, Any]:
	_require_print_profile_manager()
	if isinstance(profile, str):
		profile = frappe.parse_json(profile)
	if not isinstance(profile, dict):
		frappe.throw(_("Printer profile data is required."))

	existing_name = _normalize(profile.get("name"))
	profile_name = _normalize(profile.get("profile_name"))
	if not profile_name:
		frappe.throw(_("Profile Name is required."))

	if existing_name:
		doc = frappe.get_doc("Edge Print Profile", existing_name)
		if profile_name != doc.profile_name:
			frappe.throw(_("Profile Name cannot be changed after creation because local device bindings use it as a stable identifier."))
	else:
		doc = frappe.new_doc("Edge Print Profile")
		doc.profile_name = profile_name

	managed_values = {
		"enabled": int(bool(profile.get("enabled"))),
		"purpose": "Receipt",
		"product_key": _normalize_product_key(profile.get("product_key")),
		"scope_type": _normalize(profile.get("scope_type")) or "Global",
		"scope_value": _normalize(profile.get("scope_value")),
		"priority": int(profile.get("priority") or 0),
		"transport": "Serial",
		"protocol": "ESC/POS",
		"paper_width": int(profile.get("paper_width") or 80),
		"characters_per_line": int(profile.get("characters_per_line") or 48),
		"baud_rate": int(profile.get("baud_rate") or 9600),
		"text_encoding": _normalize(profile.get("text_encoding")) or "ASCII Safe",
		"auto_cut": int(bool(profile.get("auto_cut"))),
		"cut_mode": _normalize(profile.get("cut_mode")) or "Partial",
		"cash_drawer": int(bool(profile.get("cash_drawer"))),
		"drawer_pin": int(profile.get("drawer_pin") or 0),
		"feed_lines": int(profile.get("feed_lines") if profile.get("feed_lines") is not None else 3),
		"copies": int(profile.get("copies") or 1),
		"print_logo": 0,
		"print_qr": int(bool(profile.get("print_qr"))),
		"notes": _normalize(profile.get("notes")),
	}
	for fieldname, value in managed_values.items():
		doc.set(fieldname, value)

	doc.save()
	return _managed_profile(doc.as_dict())
