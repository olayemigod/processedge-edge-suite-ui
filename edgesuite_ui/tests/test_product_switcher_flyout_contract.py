from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_product_switcher_uses_icon_launcher_and_permission_bounded_source_select():
    runtime = read(APP / "public/js/edgeui_product_switcher_flyout.js")

    for expected in (
        'const SOURCE_SELECT_ID = "edge-product-app-switcher"',
        'const LAUNCHER_ID = "edge-product-switcher-launcher"',
        'const FLYOUT_ID = "edge-product-switcher-flyout"',
        'const ASSET_URL = "/assets/edgesuite_ui/images/product-switcher.png"',
        'activeEdgeShell()',
        'Array.from(select.options || [])',
        '.filter((option) => option.value && !option.disabled)',
        'select.dispatchEvent(new global.Event("change", { bubbles: true }))',
        'role="menuitemradio"',
        'aria-checked=',
        'global.EdgeSuiteUI?.closeProductMenu?.()',
        'event.key === "Escape"',
        'global.frappe?.router?.on?.("change", scheduleReconcile)',
        'attributeFilter: ["class", "style", "hidden", "aria-hidden", "disabled"]',
    ):
        assert expected in runtime

    for forbidden in (
        '".page-actions"',
        '".navbar-right"',
        'window.location.href =',
        'fetch(',
    ):
        assert forbidden not in runtime


def test_product_switcher_is_mobile_capable_and_flyout_is_compact():
    styles = read(APP / "public/css/edgeui_product_switcher_flyout.css")

    for expected in (
        ".edge-product-switcher.edge-product-switcher--launcher",
        "display: inline-flex !important",
        ".edge-product-switcher__select",
        "display: none !important",
        ".edge-product-switcher__launcher img",
        ".edge-product-switcher-flyout",
        "position: fixed",
        "grid-template-columns: repeat(2, minmax(0, 1fr))",
        "@keyframes edge-product-switcher-flyout-in",
        "@media (max-width: 48rem)",
        "@media (max-width: 28rem)",
    ):
        assert expected in styles


def test_product_switcher_assets_are_loaded_globally_and_png_is_valid():
    hooks = read(APP / "hooks.py")
    asset = APP / "public/images/product-switcher.png"

    assert '"/assets/edgesuite_ui/css/edgeui_product_switcher_flyout.css"' in hooks
    assert '"/assets/edgesuite_ui/js/edgeui_product_switcher_flyout.js"' in hooks
    assert asset.exists()
    assert asset.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
