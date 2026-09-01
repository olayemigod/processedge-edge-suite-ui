from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOOKS = (ROOT / "hooks.py").read_text()
ACCESS = (ROOT / "access_control.py").read_text()
PATCHES = (ROOT / "patches.txt").read_text()
PATCH = (ROOT / "patches" / "v1_1" / "backfill_advanced_desk_role.py").read_text()
GUARD = (ROOT / "public" / "js" / "edgeui_desk_access_guard.js").read_text()
CSS = (ROOT / "public" / "css" / "edgeui_desk_access_guard.css").read_text()


def test_advanced_desk_role_is_non_granting_marker():
	assert 'ADVANCED_DESK_ROLE = "EdgeSuite Advanced Desk User"' in ACCESS
	assert '"desk_access": 0' in ACCESS
	assert '"authorization_source": "frappe_permissions"' in ACCESS
	assert 'user == "Administrator"' in ACCESS
	assert '"System Manager" in roles' in ACCESS
	assert 'ADVANCED_DESK_ROLE in roles' in ACCESS
	assert 'return MODE_EDGESUITE_ONLY' in ACCESS


def test_boot_and_assets_enable_additive_access_layer():
	assert 'extend_bootinfo = "edgesuite_ui.access_control.extend_bootinfo"' in HOOKS
	assert 'after_install = "edgesuite_ui.access_control.ensure_advanced_desk_role"' in HOOKS
	assert 'after_migrate = "edgesuite_ui.access_control.ensure_advanced_desk_role"' in HOOKS
	assert 'edgeui_desk_access_guard.css' in HOOKS
	assert 'edgeui_desk_access_guard.js' in HOOKS


def test_existing_system_users_keep_pre_feature_native_desk_visibility():
	assert "edgesuite_ui.patches.v1_1.backfill_advanced_desk_role" in PATCHES
	assert '"user_type": "System User"' in PATCH
	assert '"enabled": 1' in PATCH
	assert 'user.append("roles", {"role": ADVANCED_DESK_ROLE})' in PATCH
	assert 'user_name in {"Administrator", "Guest"}' in PATCH


def test_restricted_runtime_allows_only_rendered_edgesuite_pages():
	assert 'RESTRICTED_MODE = "edgesuite_only"' in GUARD
	assert 'MAX_EDGE_ROUTE_VERIFY_ATTEMPTS = 4' in GUARD
	assert '"form"' in GUARD
	assert '"list"' in GUARD
	assert '"query-report"' in GUARD
	assert '"workspace"' in GUARD
	assert '/^(?:app|desk)' in GUARD or '(?:app|desk)' in GUARD
	assert '.edge-app-shell[data-edge-product]' in GUARD
	assert 'Storage is a convenience only; it is never an authorization source.' in GUARD
	assert 'data-edgesuite-route-approved' in GUARD
	assert 'redirectToFallback("native-desk-route")' in GUARD
	assert 'scheduleVerification(VERIFY_RETRY_MS)' in GUARD


def test_restricted_runtime_filters_native_product_menu_entries():
	assert 'NATIVE_MENU_LINK_TYPES = new Set(["doctype", "report", "workspace"])' in GUARD
	assert "function menuItemAllowed(item)" in GUARD
	assert "function filterMenuConfig(config)" in GUARD
	assert "function filterMenuItems(items)" in GUARD
	assert "routeExplicitlyNative(item.route)" in GUARD
	assert "const filteredConfig = filterMenuConfig(config)" in GUARD
	assert "originalRegister(filteredConfig)" in GUARD
	assert "function wrapShellComponent(edgeUI, component)" in GUARD
	assert 'name === "EdgeAppShell"' in GUARD
	assert "menuItems: filterMenuItems(attrs.menuItems)" in GUARD


def test_native_desk_content_is_cloaked_until_edgesuite_shell_is_verified():
	assert 'data-edgesuite-access-mode="edgesuite_only"' in CSS
	assert ':not([data-edgesuite-route-approved="true"]) .layout-main-section' in CSS
	assert ".desk-sidebar" in CSS
	assert ".workspace-sidebar" in CSS
	assert ".edgesuite-access-blocked" in CSS
