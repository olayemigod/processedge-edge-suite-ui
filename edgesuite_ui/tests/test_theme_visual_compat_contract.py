from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui.bundle.css"
COMPAT = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_theme_dark_compat.css"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_dark_theme_compatibility_layer_is_loaded_after_theme_registry():
	assert COMPAT.exists(), COMPAT
	hooks = read(HOOKS)
	assert "/assets/edgesuite_ui/css/edgeui_theme_dark_compat.css" in hooks
	assert hooks.index("edgeui_theme.css") < hooks.index("edgeui_theme_dark_compat.css")


def test_filter_title_uses_semantic_foreground_token():
	content = read(BASE)
	assert ".edge-filter-title" in content
	assert "color: var(--edge-color-ink-950);" in content


def test_every_approved_palette_has_dark_specific_soft_brand_tokens():
	content = read(COMPAT)
	for palette in ("edge-blue", "edge-indigo", "edge-teal", "edge-emerald", "edge-slate"):
		selector = f':root[data-edge-appearance="dark"][data-edge-palette="{palette}"]'
		assert selector in content

	for token in (
		"--edge-color-brand-25:",
		"--edge-color-brand-50:",
		"--edge-color-brand-100:",
		"--edge-color-brand-200:",
		"--edge-color-brand-text:",
	):
		assert content.count(token) >= 5


def test_dark_theme_uses_semantic_action_and_error_contrast_overrides():
	content = read(COMPAT)
	for contract in (
		"--edge-color-danger-surface:",
		"--edge-color-danger-border:",
		"--edge-color-danger-text:",
		".edge-sidebar-item.active",
		".edge-product-menu__item.is-active",
		".edge-topbar-menu__link",
		".edge-notification-text-action",
		".edge-modal__full-form",
		".edge-link-field__create",
		".edge-form-global-error",
		".edge-topbar-menu__state--error",
		".edge-shared-notification-state.is-error",
		".edge-user-menu__logout",
	):
		assert contract in content


def test_dark_theme_preserves_focus_and_input_visibility():
	content = read(COMPAT)
	for contract in (
		".edge-product-switcher__select",
		".edge-form-control",
		".edge-input__control",
		".edge-textarea__control",
		"caret-color:",
		"::selection",
	):
		assert contract in content
