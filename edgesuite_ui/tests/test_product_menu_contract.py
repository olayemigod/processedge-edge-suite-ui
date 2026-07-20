import unittest
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]


class TestProductMenuContract(unittest.TestCase):
	def test_runtime_exposes_product_menu_api(self):
		runtime = (APP_ROOT / "public/js/edgeui/runtime.js").read_text(encoding="utf-8")
		for expected in (
			"createProductMenuController",
			"registerProductMenu(config)",
			"mountProductMenu()",
			"refreshProductMenu()",
			"closeProductMenu()",
		):
			self.assertIn(expected, runtime)

	def test_renderer_uses_svg_icons_search_and_desk_lifecycle_events(self):
		renderer = (APP_ROOT / "public/js/edgeui/product_menu_v2.js").read_text(encoding="utf-8")
		for expected in (
			"edgeIconMarkup",
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
		self.assertNotIn(">▦<", renderer)

	def test_product_menu_styles_are_loaded_and_professional(self):
		hooks = (APP_ROOT / "hooks.py").read_text(encoding="utf-8")
		styles = (APP_ROOT / "public/css/edgeui_professional.css").read_text(encoding="utf-8")
		self.assertIn("edgeui_product_menu.css", hooks)
		self.assertIn("edgeui_professional.css", hooks)
		for expected in (
			".edge-product-menu__header",
			".edge-product-menu__search-wrap",
			"grid-template-columns: repeat(2, minmax(0, 1fr))",
			".edge-product-menu__section-heading",
			".edge-product-menu__item-copy",
			".edge-product-menu__item-icon svg",
		):
			self.assertIn(expected, styles)


if __name__ == "__main__":
	unittest.main()
