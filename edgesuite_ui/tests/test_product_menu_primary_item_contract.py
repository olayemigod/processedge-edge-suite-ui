from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MENU = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "product_menu_v2.js"
STYLES = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_product_menu.css"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_product_menu_supports_one_standalone_primary_item():
	menu = read(MENU)
	for contract in (
		"config.primary_item || config.primaryItem",
		"primary_item:",
		"visiblePrimaryItem",
		"edge-product-menu__primary-wrap",
		"edge-product-menu__primary",
		'event.target.closest(".edge-product-menu__primary, .edge-product-menu__item")',
		"(!config.sections.length && !config.primary_item)",
	):
		assert contract in menu


def test_product_menu_hides_technical_description_tokens():
	menu = read(MENU)
	assert "TECHNICAL_DESCRIPTIONS" in menu
	for value in ("page", "doctype", "report", "workspace", "link"):
		assert f'"{value}"' in menu
	assert "normalizeDescription(item.description || item.subtitle)" in menu


def test_primary_item_has_distinct_shared_styles():
	styles = read(STYLES)
	for contract in (
		".edge-product-menu__primary-wrap",
		".edge-product-menu__primary",
		".edge-product-menu__primary-icon",
		"grid-template-columns: 2rem minmax(0, 1fr) auto",
	):
		assert contract in styles
