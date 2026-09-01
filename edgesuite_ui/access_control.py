from __future__ import annotations

import frappe

ADVANCED_DESK_ROLE = "EdgeSuite Advanced Desk User"
ACCESS_BOOT_KEY = "edgesuite_ui_access"
MODE_NATIVE_DESK = "native_desk"
MODE_EDGESUITE_ONLY = "edgesuite_only"
MODE_WEBSITE = "website"


def ensure_advanced_desk_role() -> None:
	"""Ensure the non-granting marker role exists on the local Frappe site."""
	if frappe.db.exists("Role", ADVANCED_DESK_ROLE):
		return

	frappe.get_doc(
		{
			"doctype": "Role",
			"role_name": ADVANCED_DESK_ROLE,
			# Deliberately false. This role is an EdgeSuite visibility marker only;
			# it must never promote a Website User to System User by itself.
			"desk_access": 0,
			"disabled": 0,
		}
	).insert(ignore_permissions=True)


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

	roles = set(frappe.get_roles(user))
	if "System Manager" in roles or ADVANCED_DESK_ROLE in roles:
		return MODE_NATIVE_DESK
	return MODE_EDGESUITE_ONLY


def get_access_context(user: str | None = None) -> dict[str, object]:
	mode = get_access_mode(user)
	return {
		"mode": mode,
		"restricted_to_edgesuite": mode == MODE_EDGESUITE_ONLY,
		"can_use_native_desk": mode == MODE_NATIVE_DESK,
		"advanced_desk_role": ADVANCED_DESK_ROLE,
		# This layer is intentionally additive. It never represents or replaces
		# DocType, Page, Report, User Permission, Company, Branch or workflow auth.
		"authorization_source": "frappe_permissions",
	}


def extend_bootinfo(bootinfo) -> None:
	"""Expose a server-derived UI mode to the shared Desk runtime."""
	bootinfo[ACCESS_BOOT_KEY] = get_access_context()
