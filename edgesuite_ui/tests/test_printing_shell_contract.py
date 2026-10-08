from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EDGEUI_BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
SHARED_SHELL = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "shared_page_shell.js"
DEVICES_PAGE = (
    ROOT
    / "edgesuite_ui"
    / "edgesuite_ui"
    / "page"
    / "edge_printing"
    / "edge_printing.js"
)
PROFILES_PAGE = (
    ROOT
    / "edgesuite_ui"
    / "edgesuite_ui"
    / "page"
    / "edge_print_profiles"
    / "edge_print_profiles.js"
)


def test_shared_runtime_exposes_real_edgesuite_page_shell_host():
    bundle = EDGEUI_BUNDLE.read_text()
    shell = SHARED_SHELL.read_text()

    assert 'from "./edgeui/shared_page_shell"' in bundle
    assert "runtime.mountSharedPageShell" in bundle
    assert "runtime.suppressNativeDeskPageChrome" in bundle
    assert 'getComponent?.("EdgeAppShell")' in shell or 'getComponent("EdgeAppShell")' in shell
    assert "edge-shared-page-content-host" in shell
    assert "shell:${key}" in shell
    assert "suppressNativeDeskPageChrome" in shell
    assert 'pageHead.hidden = true' in shell
    assert 'sideSection.hidden = true' in shell


def test_full_shared_shell_suppresses_and_restores_native_frappe_sidebar():
    shell = SHARED_SHELL.read_text()

    for expected in (
        'querySelector?.(".body-sidebar-container")',
        'sidebar.style.setProperty("display", "none", "important")',
        'sidebar.setAttribute("aria-hidden", "true")',
        'body?.classList?.add("edge-shared-shell-active")',
        'body?.classList?.remove("edge-shared-shell-active")',
        'router.on("change"',
        "syncNativeDeskSidebarSuppression",
        "sharedShellPageIsVisible",
    ):
        assert expected in shell

    assert "nativeDeskSidebarState" in shell
    assert "sidebar.style.removeProperty(\"display\")" in shell


def test_devices_and_printing_mounts_inside_shared_shell_and_preserves_context():
    source = DEVICES_PAGE.read_text()

    for expected in (
        'const EDGE_SUITE_ASSET = "edgesuite_ui.bundle.js"',
        "suppressNativePageChrome(wrapper)",
        "edgeUI.mountSharedPageShell",
        'activeRoute: pageUrl("edge-printing", context)',
        "fallbackMenuItems: printingFallbackMenu(context)",
        'globalThis.location.assign(pageUrl("edge-print-profiles", context))',
        'params.set("product_key", context.productKey)',
        'params.set("company", context.company)',
        'params.set("branch", context.branch)',
    ):
        assert expected in source


def test_print_profiles_mounts_inside_shared_shell_and_cannot_repeat_blank_page_bug():
    source = PROFILES_PAGE.read_text()

    for expected in (
        'const EDGE_SUITE_ASSET = "edgesuite_ui.bundle.js"',
        "pageBodyElement(page)",
        "suppressNativePageChrome(wrapper)",
        "edgeUI.mountSharedPageShell",
        'activeRoute: pageUrl("edge-print-profiles", route)',
        "fallbackMenuItems: printingFallbackMenu(route)",
        'globalThis.location.assign(pageUrl("edge-printing", route || {}))',
        "body?.appendChild?.(chrome.root)",
    ):
        assert expected in source

    assert "page.body.appendChild(chrome.root)" not in source


def test_shared_printing_pages_do_not_implement_product_specific_sidebar_content():
    devices = DEVICES_PAGE.read_text().lower()
    profiles = PROFILES_PAGE.read_text().lower()

    for product_name in ("retailedge", "vetedge", "eduedge"):
        assert product_name not in devices
        assert product_name not in profiles
