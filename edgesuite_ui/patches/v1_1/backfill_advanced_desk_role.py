from __future__ import annotations

import frappe

from edgesuite_ui.access_control import ADVANCED_DESK_ROLE, ensure_advanced_desk_role


def execute() -> None:
	"""Preserve pre-feature Desk visibility for existing enabled System Users.

	The marker role has no DocType permissions and desk_access=0. Adding it only
	prevents the new EdgeSuite-only presentation restriction from changing the
	current experience during rollout.
	"""
	ensure_advanced_desk_role()

	users = frappe.get_all(
		"User",
		filters={"enabled": 1, "user_type": "System User"},
		pluck="name",
	)
	for user_name in users:
		if user_name in {"Administrator", "Guest"}:
			continue
		if frappe.db.exists(
			"Has Role",
			{
				"parent": user_name,
				"parenttype": "User",
				"parentfield": "roles",
				"role": ADVANCED_DESK_ROLE,
			},
		):
			continue

		user = frappe.get_doc("User", user_name)
		user.append("roles", {"role": ADVANCED_DESK_ROLE})
		user.save(ignore_permissions=True)
