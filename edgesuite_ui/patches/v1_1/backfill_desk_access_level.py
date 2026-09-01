from __future__ import annotations

import frappe

from edgesuite_ui.access_control import (
	ACCESS_FIELD,
	ACCESS_NATIVE_DESK,
	ensure_desk_access_field,
)


def execute() -> None:
	"""Preserve native Desk visibility for existing enabled System Users."""
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
