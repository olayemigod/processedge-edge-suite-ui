from __future__ import annotations

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

ACCESS_BOOT_KEY = "edgesuite_ui_access"
ACCESS_FIELD = "edgesuite_desk_access_level"
ACCESS_EDGESUITE_ONLY = "EdgeSuite Only"
ACCESS_NATIVE_DESK = "Native Desk + EdgeSuite"
MODE_NATIVE_DESK = "native_desk"
MODE_EDGESUITE_ONLY = "edgesuite_only"
MODE_WEBSITE = "website"


def ensure_desk_access_field() -> None:
	"""Install the per-user UI exposure control without changing any roles."""
	create_custom_fields(
		{
			"User": [
				{
					"fieldname": ACCESS_FIELD,
					"label": "EdgeSuite Desk Access",
					"fieldtype": "Select",
					"options": f"{ACCESS_EDGESUITE_ONLY}\n{ACCESS_NATIVE_DESK}",
					"default": ACCESS_EDGESUITE_ONLY,
					"insert_after": "role_profiles",
					"permlevel": 1,
					"depends_on": "eval:doc.user_type == 'System User'",
					"description": (
						"Controls native ERPNext/Frappe Desk visibility only. "
						"It does not grant roles, DocType permissions, User Permissions, "
						"Company/Branch access, report access, or workflow authority."
					),
				},
			]
		},
		update=True,
	)


def preserve_existing_system_users_native_desk() -> None:
	"""Preserve the pre-feature interface for users who already had Desk access.

	This helper is intentionally called only from one-time installation/migration
	paths. Normal migrations must not continually overwrite a tenant's later
	advanced/everyday user choices.
	"""
	ensure_desk_access_field()
	users = frappe.get_all(
		"User",
		filters={"enabled": 1, "user_type": "System User"},
		pluck="name",
	)
	for user_name in users:
		if user_name in {"Administrator", "Guest"}:
			continue
		frappe.db.set_value(
			"User",
			user_name,
			ACCESS_FIELD,
			ACCESS_NATIVE_DESK,
			update_modified=False,
		)


def initialize_desk_access_on_install() -> None:
	"""Safely initialize an already-populated site on first app installation."""
	preserve_existing_system_users_native_desk()


def _desk_access_field_available() -> bool:
	"""Avoid a deploy-before-migrate lockout while the custom column is absent."""
	return ACCESS_FIELD in frappe.db.get_table_columns("User")


def get_access_mode(user: str | None = None) -> str:
	"""Return the additional UI exposure mode without changing Frappe permissions."""
	user = user or frappe.session.user
	if not user or user == "Guest":
		return MODE_WEBSITE
	if user == "Administrator":
		return MODE_NATIVE_DESK

	user_type = frappe.db.get_value("User", user, "user_type")
	if user_type != "System User":
		return MODE_WEBSITE

	# System Managers retain a recovery path independent of the tenant-facing
	# access selector. This does not alter their existing Frappe permissions.
	if "System Manager" in set(frappe.get_roles(user)):
		return MODE_NATIVE_DESK

	# During a rolling deploy, preserve the pre-feature interface until migrate
	# creates the field. Backend permissions remain authoritative either way.
	if not _desk_access_field_available():
		return MODE_NATIVE_DESK

	access_level = frappe.db.get_value("User", user, ACCESS_FIELD)
	if access_level == ACCESS_NATIVE_DESK:
		return MODE_NATIVE_DESK
	return MODE_EDGESUITE_ONLY


def get_access_context(user: str | None = None) -> dict[str, object]:
	mode = get_access_mode(user)
	return {
		"mode": mode,
		"restricted_to_edgesuite": mode == MODE_EDGESUITE_ONLY,
		"can_use_native_desk": mode == MODE_NATIVE_DESK,
		"access_field": ACCESS_FIELD,
		"access_level_edgesuite_only": ACCESS_EDGESUITE_ONLY,
		"access_level_native_desk": ACCESS_NATIVE_DESK,
		# This layer is intentionally additive. It never represents or replaces
		# DocType, Page, Report, User Permission, Company, Branch or workflow auth.
		"authorization_source": "frappe_permissions",
	}


def extend_bootinfo(bootinfo) -> None:
	"""Expose a server-derived UI mode to the shared Desk runtime."""
	bootinfo[ACCESS_BOOT_KEY] = get_access_context()
