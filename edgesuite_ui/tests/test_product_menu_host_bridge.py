from __future__ import annotations

from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]


def test_frappe_v16_product_menu_host_bridge_is_loaded_after_runtime():
	hooks = (APP_ROOT / "hooks.py").read_text()
	assert hooks.index('"edgeui.bundle.js"') < hooks.index("edgeui_product_menu_host_bridge.js")
	assert "edgeui_product_menu_host_bridge.css" in hooks


def test_host_bridge_supports_sidebar_and_safe_floating_fallbacks():
	source = (APP_ROOT / "public" / "js" / "edgeui_product_menu_host_bridge.js").read_text()
	assert ".desk-sidebar .sidebar-header" in source
	assert ".workspace-sidebar" in source
	assert ".layout-side-section" in source
	assert "edge-product-menu-navbar-bridge--floating" in source
	assert "mountProductMenu" in source
	assert "MutationObserver" in source


def test_host_bridge_does_not_depend_on_coreedge():
	source = (APP_ROOT / "public" / "js" / "edgeui_product_menu_host_bridge.js").read_text().lower()
	assert "coreedge" not in source
	assert "switch_product_app" not in source
