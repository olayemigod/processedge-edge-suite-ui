from __future__ import annotations

from collections.abc import Iterable, Mapping

import frappe
from frappe import _

PRODUCT_PROVIDER_HOOK = "edgesuite_product_availability_providers"
CONVENTIONAL_PROVIDER_SUFFIX = "api.product_context.get_product_availability"
ACTIVE_PRODUCT_CACHE_PREFIX = "edgesuite:active-product"
PUBLIC_PRODUCT_FIELDS = (
	"key",
	"product_key",
	"label",
	"product",
	"icon",
	"home_route",
	"route_patterns",
	"order",
)


def _normalize_key(value: object) -> str:
	return "-".join(
		part
		for part in "".join(
			character.lower() if character.isalnum() or character in {"_", "-"} else "-"
			for character in str(value or "").strip()
		).split("-")
		if part
	)


def _flatten_provider_paths(value: object) -> list[str]:
	if isinstance(value, str):
		return [value] if value.strip() else []
	if isinstance(value, Iterable) and not isinstance(value, (bytes, Mapping)):
		result: list[str] = []
		for item in value:
			result.extend(_flatten_provider_paths(item))
		return result
	return []


def _provider_paths() -> tuple[list[str], set[str]]:
	explicit_paths = set(
		_flatten_provider_paths(frappe.get_hooks(PRODUCT_PROVIDER_HOOK, default=[]))
	)
	paths = list(explicit_paths)
	for app_name in frappe.get_installed_apps():
		paths.append(f"{app_name}.{CONVENTIONAL_PROVIDER_SUFFIX}")
	return list(dict.fromkeys(path for path in paths if path)), explicit_paths


def _normalize_product(value: Mapping) -> dict | None:
	if not isinstance(value, Mapping) or value.get("available") is False:
		return None
	key = _normalize_key(
		value.get("key")
		or value.get("product_key")
		or value.get("product")
		or value.get("label")
	)
	if not key:
		return None
	label = str(value.get("label") or value.get("product") or key).strip() or key
	route_patterns = value.get("route_patterns") or value.get("routePatterns") or []
	if isinstance(route_patterns, str):
		route_patterns = [route_patterns]
	elif not isinstance(route_patterns, (list, tuple)):
		route_patterns = []
	product = {
		"key": key,
		"product_key": key,
		"label": label,
		"product": str(value.get("product") or label).strip() or label,
		"icon": str(value.get("icon") or "apps").strip() or "apps",
		"home_route": str(value.get("home_route") or value.get("homeRoute") or "").strip(),
		"route_patterns": [str(route).strip() for route in route_patterns if str(route).strip()],
		"order": int(value.get("order") or 100),
		"default": bool(value.get("default")),
	}
	return product


def _provider_products(result: object) -> list[Mapping]:
	if isinstance(result, Mapping):
		return [result]
	if isinstance(result, Iterable) and not isinstance(result, (str, bytes)):
		return [item for item in result if isinstance(item, Mapping)]
	return []


def _log_provider_failure(provider_path: str) -> None:
	frappe.log_error(
		title=f"EdgeSuite product availability provider failed: {provider_path}",
		message=frappe.get_traceback(),
	)


def get_available_products() -> list[dict]:
	"""Return the final product availability list supplied by product apps.

	Installed apps are used only to discover the conventional provider path. The
	shared UI layer does not infer availability from installation, roles, activation,
	or subscription state. Each product provider owns those rules and returns a
	descriptor only when that product is available to the current user.
	"""
	products: dict[str, dict] = {}
	provider_paths, explicit_paths = _provider_paths()
	for provider_path in provider_paths:
		try:
			provider = frappe.get_attr(provider_path)
		except (AttributeError, ImportError, ModuleNotFoundError):
			if provider_path in explicit_paths:
				_log_provider_failure(provider_path)
			continue
		try:
			for candidate in _provider_products(provider()):
				normalized = _normalize_product(candidate)
				if normalized:
					products[normalized["key"]] = normalized
		except Exception:
			_log_provider_failure(provider_path)
	return sorted(products.values(), key=lambda product: (product["order"], product["label"].lower()))


def _cache_key(user: str | None = None) -> str:
	return f"{ACTIVE_PRODUCT_CACHE_PREFIX}:{user or frappe.session.user}"


def _get_cached_active_product() -> str:
	value = frappe.cache.get_value(_cache_key())
	if isinstance(value, bytes):
		value = value.decode()
	return _normalize_key(value)


def _set_cached_active_product(product_key: str) -> None:
	frappe.cache.set_value(_cache_key(), _normalize_key(product_key))


def _active_product(products: list[dict], preferred: str | None = None) -> str:
	available_keys = {product["key"] for product in products}
	for candidate in (preferred, _get_cached_active_product()):
		key = _normalize_key(candidate)
		if key and key in available_keys:
			return key
	default_product = next((product for product in products if product.get("default")), None)
	return str((default_product or (products[0] if products else {})).get("key") or "")


def _public_product(product: Mapping) -> dict:
	return {field: product.get(field) for field in PUBLIC_PRODUCT_FIELDS if field in product}


@frappe.whitelist()
def get_product_context() -> dict:
	products = get_available_products()
	active_product = _active_product(products)
	if active_product:
		_set_cached_active_product(active_product)
	return {
		"active_product": active_product or None,
		"available_products": [_public_product(product) for product in products],
	}


@frappe.whitelist()
def switch_product(product_key: str) -> dict:
	products = get_available_products()
	key = _normalize_key(product_key)
	selected = next((product for product in products if product["key"] == key), None)
	if not selected:
		frappe.throw(_("This product is not currently available."), frappe.PermissionError)
	_set_cached_active_product(key)
	return {
		"active_product": key,
		"available_products": [_public_product(product) for product in products],
		"home_route": selected.get("home_route") or "",
	}
