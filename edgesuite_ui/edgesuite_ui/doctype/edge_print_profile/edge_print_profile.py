from __future__ import annotations

from edgesuite_ui.api.product_context import get_available_products

import frappe
from frappe.model.document import Document


SUPPORTED_PURPOSE = "Receipt"
SUPPORTED_TRANSPORT = "Serial"
SUPPORTED_PROTOCOL = "ESC/POS"
_SCOPE_DOCTYPES = {
	"Global": "",
	"Company": "Company",
	"Branch": "Branch",
	"User": "User",
}


def _normalize_product_key(value: object) -> str:
	return "-".join(
		part
		for part in "".join(
			character.lower() if character.isalnum() or character in {"_", "-"} else "-"
			for character in str(value or "").strip()
		).split("-")
		if part
	)


class EdgePrintProfile(Document):
	def before_validate(self) -> None:
		self.profile_name = (self.profile_name or "").strip()
		self.product_key = _normalize_product_key(self.product_key)
		self.scope_value = (self.scope_value or "").strip()
		self.scope_doctype = _SCOPE_DOCTYPES.get(self.scope_type, "")
		if self.scope_type == "Global":
			self.scope_value = ""

	def validate(self) -> None:
		self._validate_v1_capabilities()
		self._validate_product_key()
		self._validate_scope()
		self._validate_physical_settings()
		self._validate_effective_rank_is_unique()

	def _validate_v1_capabilities(self) -> None:
		if self.purpose != SUPPORTED_PURPOSE:
			frappe.throw("Printing V1 currently supports Receipt profiles only.")
		if self.transport != SUPPORTED_TRANSPORT:
			frappe.throw("Printing V1 currently supports Serial / Bluetooth receipt printers only.")
		if self.protocol != SUPPORTED_PROTOCOL:
			frappe.throw("Serial printer profiles must use the ESC/POS protocol.")

		# Logo raster preprocessing is not part of V1 yet. Keep the stored field
		# fail-closed so configuration never promises an output the runtime ignores.
		self.print_logo = 0

	def _validate_product_key(self) -> None:
		if not self.product_key:
			return
		available = {str(row.get("key") or "") for row in get_available_products()}
		if self.product_key not in available:
			frappe.throw(
				f"Product {self.product_key} is not currently available to configure for printing."
			)

	def _validate_scope(self) -> None:
		scope_doctype = _SCOPE_DOCTYPES.get(self.scope_type)
		if scope_doctype is None:
			frappe.throw("Unsupported print profile scope.")
		self.scope_doctype = scope_doctype

		if self.scope_type == "Global":
			self.scope_value = ""
			return
		if not self.scope_value:
			frappe.throw("Scope Value is required for non-global print profiles.")
		if not frappe.db.exists("DocType", scope_doctype):
			frappe.throw(f"{scope_doctype} is not available on this site.")
		if not frappe.db.exists(scope_doctype, self.scope_value):
			frappe.throw(f"{scope_doctype} {self.scope_value} does not exist.")

	def _validate_physical_settings(self) -> None:
		if self.text_encoding not in {"ASCII Safe", "UTF-8"}:
			frappe.throw("Text Encoding must be ASCII Safe or UTF-8.")

		paper_width = int(self.paper_width or 0)
		if paper_width not in {58, 80}:
			frappe.throw("Paper Width must be 58 or 80 mm.")

		characters_per_line = int(self.characters_per_line or 0)
		if not 16 <= characters_per_line <= 80:
			frappe.throw("Characters per Line must be between 16 and 80.")

		baud_rate = int(self.baud_rate or 0)
		if not 300 <= baud_rate <= 1_000_000:
			frappe.throw("Baud Rate must be between 300 and 1000000.")

		feed_lines = int(self.feed_lines or 0)
		if not 0 <= feed_lines <= 20:
			frappe.throw("Feed Lines must be between 0 and 20.")

		copies = int(self.copies or 0)
		if not 1 <= copies <= 10:
			frappe.throw("Copies must be between 1 and 10.")

	def _validate_effective_rank_is_unique(self) -> None:
		if not self.enabled:
			return
		filters = {
			"name": ["!=", self.name or ""],
			"enabled": 1,
			"purpose": self.purpose,
			"product_key": self.product_key,
			"scope_type": self.scope_type,
			"scope_value": self.scope_value,
			"priority": int(self.priority or 0),
		}
		if frappe.db.exists("Edge Print Profile", filters):
			frappe.throw(
				"Another enabled Edge Print Profile has the same purpose, product, scope, and priority. "
				"Change its priority or disable one profile so resolution is deterministic."
			)
