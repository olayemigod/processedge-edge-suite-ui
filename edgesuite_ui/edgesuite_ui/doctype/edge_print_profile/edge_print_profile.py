from __future__ import annotations

import frappe
from frappe.model.document import Document


class EdgePrintProfile(Document):
	def validate(self) -> None:
		self.profile_name = (self.profile_name or "").strip()
		self.product_key = (self.product_key or "").strip()
		self.scope_value = (self.scope_value or "").strip()

		if self.scope_type == "Global":
			self.scope_value = ""
		elif not self.scope_value:
			frappe.throw("Scope Value is required for non-global print profiles.")

		if self.transport == "Serial" and self.protocol != "ESC/POS":
			frappe.throw("Serial printer profiles must use the ESC/POS protocol.")

		if self.transport in {"System", "Browser"} and self.protocol != "System":
			self.protocol = "System"

		paper_width = int(self.paper_width or 0)
		if paper_width not in {58, 80}:
			frappe.throw("Paper Width must be 58 or 80 mm.")

		characters_per_line = int(self.characters_per_line or 0)
		if not 16 <= characters_per_line <= 80:
			frappe.throw("Characters per Line must be between 16 and 80.")

		if self.transport == "Serial":
			baud_rate = int(self.baud_rate or 0)
			if not 300 <= baud_rate <= 1_000_000:
				frappe.throw("Baud Rate must be between 300 and 1000000.")

		feed_lines = int(self.feed_lines or 0)
		if not 0 <= feed_lines <= 20:
			frappe.throw("Feed Lines must be between 0 and 20.")

		copies = int(self.copies or 0)
		if not 1 <= copies <= 10:
			frappe.throw("Copies must be between 1 and 10.")
