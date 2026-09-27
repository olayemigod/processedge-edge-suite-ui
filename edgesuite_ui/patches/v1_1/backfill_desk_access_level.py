from __future__ import annotations

from edgesuite_ui.access_control import preserve_existing_system_users_native_desk


def execute() -> None:
	"""Preserve native Desk visibility for existing enabled System Users."""
	preserve_existing_system_users_native_desk()
