from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
SHELL = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "shell_enhancements.js"
CONTEXT_IDENTITY = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "context_identity.js"
NOTIFICATION_RUNTIME = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "notification_runtime.js"
STYLES = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_shell_enhancements.css"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_shared_shell_enhancements_are_exported_and_loaded():
	for path in (SHELL, CONTEXT_IDENTITY, NOTIFICATION_RUNTIME, STYLES):
		assert path.exists(), path

	bundle = read(BUNDLE)
	hooks = read(HOOKS)
	assert 'EDGE_SUITE_UI_VERSION = "0.3.0"' in bundle
	assert "installSharedShellEnhancements(runtime)" in bundle
	assert "suppressNativeNotificationRuntime(runtime)" in bundle
	assert "installContextIdentityResolver()" in bundle
	assert 'export * from "./edgeui/shell_enhancements"' in bundle
	assert 'export * from "./edgeui/context_identity"' in bundle
	assert 'export * from "./edgeui/notification_runtime"' in bundle
	assert "edgeui_shell_enhancements.css" in hooks


def test_identity_contract_separates_tenant_and_product_branding():
	content = read(SHELL)
	for contract in (
		"edgesuite_ui_identity",
		"tenant_name",
		"tenant_logo",
		"tenant_subtitle",
		"product_name",
		"product_logo",
		"product_icon",
		"product_subtitle",
		".edge-topbar__brand",
		".edge-sidebar__brand",
	):
		assert contract in content


def test_context_identity_tracks_active_company_without_product_specific_observers():
	content = read(CONTEXT_IDENTITY)
	for contract in (
		"identity.companies",
		"resolveCompany",
		"edge-topbar-context",
		"identity.tenant_name = company.label",
		"identity.tenant_logo = company.logo",
		"data-edge-tenant-chip",
		"edgesuite-context-changed",
		"MutationObserver",
	):
		assert contract in content


def test_product_menu_uses_deployment_aware_product_identity():
	content = read(CONTEXT_IDENTITY)
	for contract in (
		"applyProductMenuIdentity",
		"getProductMenuConfig",
		"identity.product_name",
		"identity.product_logo",
		"identity.product_icon",
		"edge-product-menu__brand-mark",
		"edge-product-menu__product",
		"edge-product-menu-trigger",
	):
		assert contract in content


def test_notification_center_uses_shared_renderer_and_pluggable_provider():
	content = read(SHELL)
	for contract in (
		"EdgeNotificationCenter",
		"notifications:default",
		"notifications:${key}",
		"getCount",
		"getItems",
		"markAllRead",
		"performAction",
		"edge-shared-notification-panel",
		"openInNewTab",
	):
		assert contract in content
	assert "coreedge/" not in content.lower()


def test_shared_notifications_disable_hidden_native_polling():
	content = read(NOTIFICATION_RUNTIME)
	for contract in (
		"suppressNativeNotificationRuntime",
		"attrs.useSharedNotifications !== false",
		"attrs.showNotifications = false",
		"SharedNotificationShell",
		'edgeUI.registerComponent("EdgeAppShell"',
	):
		assert contract in content


def test_navigation_adapter_can_preserve_product_pages_or_open_external_desk_views():
	content = read(SHELL)
	assert "navigation:${product}" in content
	assert "adapter?.open?.(route" in content
	assert "invokeListeners(suppliedNavigate, route)" in content


def test_compact_density_and_five_card_grid_are_shared():
	content = read(STYLES)
	for contract in (
		"--edge-page-padding: clamp(.625rem, 1.2vw, 1rem)",
		"--edge-dashboard-min-column: 10.75rem",
		"repeat(auto-fit, minmax(min(100%, var(--edge-dashboard-min-column)), 1fr))",
		"body.edge-suite-shell-active #veterinary-unread-bell-badge",
		".edge-identity-logo",
	):
		assert contract in content
