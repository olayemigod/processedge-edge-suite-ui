import unittest
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]


class TestProductMenuContract(unittest.TestCase):
	def test_runtime_exposes_product_context_and_menu_api(self):
		runtime = (APP_ROOT / "public/js/edgeui/runtime.js").read_text(encoding="utf-8")
		for expected in (
			"createProductContextController",
			"registerProduct(descriptor)",
			"setAvailableProducts(payload)",
			"getAvailableProducts()",
			"getActiveProduct()",
			"switchProduct(productKey, options = {})",
			"registerProductMenu(config)",
			"mountProductMenu()",
			"refreshProductMenu()",
			"closeProductMenu()",
		):
			self.assertIn(expected, runtime)

	def test_product_context_uses_authoritative_availability(self):
		context = (APP_ROOT / "public/js/edgeui/product_context.js").read_text(encoding="utf-8")
		for expected in (
			"authoritativeAvailability",
			"availabilityResolved",
			"available_products",
			"This product is not currently available.",
			"resolveProductFromRoute",
			"activateFromRoute",
			"edgesuite:product-context-changed",
		):
			self.assertIn(expected, context)
		self.assertNotIn("installed_apps", context)
		self.assertNotIn("has_permission", context)

	def test_renderer_uses_one_active_menu_and_product_switcher(self):
		renderer = (APP_ROOT / "public/js/edgeui/product_menu_v2.js").read_text(encoding="utf-8")
		for expected in (
			"edgeIconMarkup",
			"edge-product-app-switcher",
			"edge-product-switcher__select",
			"productContext?.switchProduct",
			"productContext?.activateFromRoute",
			"edge-product-menu__search",
			"edge-product-menu__section-heading",
			"edge-product-menu__item-copy",
			"desktop_screen",
			"sidebar_setup",
			"toolbar_setup",
			"page-change",
			"MutationObserver",
		):
			self.assertIn(expected, renderer)
		self.assertIn("products.length <= 1", renderer)
		self.assertNotIn(">▦<", renderer)

	def test_product_menu_styles_include_switcher_and_professional_menu(self):
		hooks = (APP_ROOT / "hooks.py").read_text(encoding="utf-8")
		menu_styles = (APP_ROOT / "public/css/edgeui_product_menu.css").read_text(encoding="utf-8")
		styles = (APP_ROOT / "public/css/edgeui_professional.css").read_text(encoding="utf-8")
		self.assertIn("edgeui_product_menu.css", hooks)
		self.assertIn("edgeui_professional.css", hooks)
		for expected in (
			".edge-product-switcher",
			".edge-product-switcher__select",
			".edge-product-menu__trigger",
		):
			self.assertIn(expected, menu_styles)
		for expected in (
			".edge-product-menu__header",
			".edge-product-menu__search-wrap",
			"grid-template-columns: repeat(2, minmax(0, 1fr))",
			".edge-product-menu__section-heading",
			".edge-product-menu__item-copy",
			".edge-product-menu__item-icon svg",
		):
			self.assertIn(expected, styles)

	def test_runtime_bundle_exports_product_context(self):
		bundle = (APP_ROOT / "public/js/edgeui.bundle.js").read_text(encoding="utf-8")
		self.assertIn('export * from "./edgeui/product_context"', bundle)
		self.assertIn('EDGE_SUITE_UI_VERSION = "0.6.0"', bundle)


if __name__ == "__main__":
	unittest.main()
