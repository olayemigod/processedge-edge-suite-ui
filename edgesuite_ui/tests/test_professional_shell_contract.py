from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]


def test_professional_shell_groups_navigation_and_uses_svg_icons():
	component = (APP_ROOT / "public/js/edgeui/professional_components.js").read_text(encoding="utf-8")
	for expected in (
		"normalizedGroups",
		"EdgeIcon",
		"edge-sidebar__section",
		"edge-sidebar-item__description",
		"edge-sidebar-toggle",
		"edge-sidebar-backdrop",
	):
		assert expected in component
	assert "item.icon)" not in component


def test_professional_shell_is_safe_across_product_vue_bundles():
	component = (APP_ROOT / "public/js/edgeui/professional_components.js").read_text(encoding="utf-8")
	assert 'import { defineComponent, h } from "vue"' in component
	assert "onMounted" not in component
	assert "ref(" not in component
	assert "watch(" not in component
	assert "data()" in component
	assert "mounted()" in component
	assert "beforeUnmount()" in component
	assert "this.collapsedSections" in component
	assert 'emits: ["navigate"]' in component


def test_professional_design_has_spacing_responsive_and_native_sidebar_contracts():
	styles = (APP_ROOT / "public/css/edgeui_professional.css").read_text(encoding="utf-8")
	for expected in (
		"--edge-page-padding",
		"--edge-section-gap",
		"--edge-content-max-width",
		"@media (max-width: 61.99rem)",
		"@media (max-width: 47.99rem)",
		'[data-title="EduEdge"]',
		".sidebar-item-icon svg",
	):
		assert expected in styles


def test_flat_shell_hides_native_sidebar_and_removes_elevation():
	styles = (APP_ROOT / "public/css/edgeui_flat_chrome.css").read_text(encoding="utf-8")
	hooks = (APP_ROOT / "hooks.py").read_text(encoding="utf-8")
	for expected in (
		"--edge-shadow-xs: none",
		"box-shadow: none !important",
		"edge-suite-native-sidebar-hidden",
		".body-sidebar-container",
		".edge-notification-bell",
		".edge-user-avatar-button",
		".edge-user-menu",
	):
		assert expected in styles
	assert "edgeui_flat_chrome.css" in hooks


def test_shell_provides_notifications_profile_menu_and_user_images():
	component = (APP_ROOT / "public/js/edgeui/professional_components.js").read_text(encoding="utf-8")
	for expected in (
		"EdgeNotificationBell",
		"get_notification_logs",
		"mark_all_as_read",
		"edge-suite-native-sidebar-hidden",
		"userImage",
		"bootInfo.image",
		"edge-user-avatar__image",
		"My profile",
		"User settings",
		"Log out",
	):
		assert expected in component


def test_shared_modal_is_accessible_flat_product_neutral_and_runtime_safe():
	component = (APP_ROOT / "public/js/edgeui/modal_components.js").read_text(encoding="utf-8")
	styles = (APP_ROOT / "public/css/edgeui_modal.css").read_text(encoding="utf-8")
	bundle = (APP_ROOT / "public/js/edgeui.bundle.js").read_text(encoding="utf-8")
	hooks = (APP_ROOT / "hooks.py").read_text(encoding="utf-8")
	for expected in (
		"EdgeModal",
		"EdgeFormDialog",
		'role: "dialog"',
		'"aria-modal": "true"',
		"onDocumentKeydown",
		"field-change",
		"search-options",
		"open-full-form",
		"portalToBody",
		"document.body.appendChild(root)",
		"root.parentNode !== document.body",
	):
		assert expected in component
	assert "Teleport" not in component
	assert "modal_portal" not in bundle
	assert "modalPortalComponents" not in bundle
	assert "...modalComponents" in bundle
	assert "ignore_permissions" not in component
	assert "eduedge" not in component.lower()
	assert "box-shadow: none !important" in styles
	assert "@media (max-width: 47.99rem)" in styles
	assert "edgeui_modal.css" in hooks


def test_primary_actions_keep_accessible_text_contrast():
	styles = (APP_ROOT / "public/css/edgeui_action_contrast.css").read_text(encoding="utf-8")
	hooks = (APP_ROOT / "hooks.py").read_text(encoding="utf-8")
	assert ".edge-button--primary" in styles
	assert "color: #fff" in styles
	assert "edgeui_action_contrast.css" in hooks


def test_icon_library_is_independent_and_has_brand_relevant_icons():
	icons = (APP_ROOT / "public/js/edgeui/icons.js").read_text(encoding="utf-8")
	for expected in (
		"graduation",
		"students",
		"assessment",
		"settings",
		"shield",
		"bell",
		"user",
		"edgeIconMarkup",
		"frappe?.utils?.icon",
	):
		assert expected in icons
