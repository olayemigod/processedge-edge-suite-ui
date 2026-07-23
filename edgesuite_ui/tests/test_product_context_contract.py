import unittest
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]


class TestProductContextContract(unittest.TestCase):
	def test_server_aggregates_final_product_availability(self):
		source = (APP_ROOT / "api/product_context.py").read_text(encoding="utf-8")
		for expected in (
			"get_available_products",
			"get_product_context",
			"switch_product",
			"get_product_availability",
			"available_products",
			"This product is not currently available.",
			"frappe.PermissionError",
		):
			self.assertIn(expected, source)
		self.assertIn("Each product provider owns those rules", source)
		self.assertNotIn("has_permission(doctype", source)
		self.assertNotIn("activation_status", source)

	def test_browser_bridge_uses_server_context_for_switching(self):
		bridge = (APP_ROOT / "public/js/edgeui/product_context_bridge.js").read_text(
			encoding="utf-8"
		)
		for expected in (
			"edgesuite_ui.api.product_context.get_product_context",
			"edgesuite_ui.api.product_context.switch_product",
			"runtime.setAvailableProducts",
			"runtime.setProductSwitchHandler",
			"runtime.refreshAvailableProducts",
		):
			self.assertIn(expected, bridge)

	def test_product_context_keeps_availability_separate_from_registration(self):
		source = (APP_ROOT / "public/js/edgeui/product_context.js").read_text(encoding="utf-8")
		self.assertIn("const descriptors = new Map()", source)
		self.assertIn("const authoritativeAvailability = new Map()", source)
		self.assertIn("availabilityResolved", source)
		self.assertIn("setSwitchHandler", source)
		self.assertIn("resolveProductFromRoute", source)
		self.assertNotIn("installed_apps", source)

	def test_product_routes_normalize_browser_and_frappe_desk_shapes(self):
		source = (APP_ROOT / "public/js/edgeui/product_context.js").read_text(encoding="utf-8")
		self.assertIn('.replace(/^app\\//i, "")', source)
		self.assertIn("frappe?.get_route", source)
		self.assertIn("routeMatches(pattern, normalizedRoute)", source)


if __name__ == "__main__":
	unittest.main()
