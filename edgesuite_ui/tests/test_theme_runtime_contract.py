from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
RUNTIME = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "theme_runtime.js"
BOOTSTRAP = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui_theme_bootstrap.js"
STYLES = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_theme.css"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_theme_assets_are_exported_and_loaded_globally():
	for path in (RUNTIME, BOOTSTRAP, STYLES):
		assert path.exists(), path

	bundle = read(BUNDLE)
	hooks = read(HOOKS)
	assert 'import { installThemeRuntime } from "./edgeui/theme_runtime"' in bundle
	assert "installThemeRuntime(runtime, globalThis)" in bundle
	assert 'export * from "./edgeui/theme_runtime"' in bundle
	assert "/assets/edgesuite_ui/js/edgeui_theme_bootstrap.js" in hooks
	assert "/assets/edgesuite_ui/css/edgeui_theme.css" in hooks
	assert hooks.index("edgeui_theme_bootstrap.js") < hooks.index("edgesuite_ui.bundle.js")
	assert hooks.index("edgeui_density.css") < hooks.index("edgeui_theme.css")


def test_theme_runtime_supports_approved_appearance_modes_and_processedge_palettes():
	content = read(RUNTIME)
	for appearance in ("light", "dark", "auto", "system"):
		assert f'{{ id: "{appearance}"' in content

	for palette in ("edge-blue", "edge-indigo", "edge-teal", "edge-emerald", "edge-slate"):
		assert f'{{ id: "{palette}"' in content

	for contract in (
		"setThemeAppearance",
		"setThemePalette",
		"setThemeAutoSchedule",
		"resetThemePreference",
		"onThemeChange",
		"getResolvedThemeAppearance",
	):
		assert contract in content


def test_theme_preference_is_local_first_user_scoped_and_cross_tab_aware():
	content = read(RUNTIME)
	for contract in (
		'const STORAGE_PREFIX = "edgeui:theme:v1"',
		"frappe?.session?.user",
		"localStorage?.getItem",
		"localStorage?.setItem",
		'addEventListener?.("storage", handleStorage)',
		'new target.CustomEvent(THEME_EVENT',
		"MutationObserver",
	):
		assert contract in content

	assert "frappe.call" not in content
	assert "coreedge" not in content.lower()


def test_auto_and_system_modes_resolve_in_the_browser():
	content = read(RUNTIME)
	for contract in (
		'autoLightStart: "06:00"',
		'autoDarkStart: "18:00"',
		'matchMedia?.("(prefers-color-scheme: dark)")',
		"now.getHours() * 60 + now.getMinutes()",
		"scheduleAutoRefresh",
	):
		assert contract in content


def test_theme_runtime_applies_semantic_root_attributes_and_avatar_menu_controls():
	content = read(RUNTIME)
	for contract in (
		"root.dataset.edgePalette",
		"root.dataset.edgeAppearanceMode",
		"root.dataset.edgeAppearance",
		'querySelector(".edge-user-menu .edge-user-menu__items")',
		'appearanceLabel.textContent = "Appearance"',
		'paletteLabel.textContent = "Theme"',
		'wrapper.setAttribute("aria-label", "Theme preferences")',
	):
		assert contract in content


def test_theme_styles_define_light_dark_tokens_and_override_legacy_product_palettes():
	content = read(STYLES)
	for contract in (
		':root[data-edge-palette="edge-blue"]',
		':root[data-edge-palette="edge-indigo"]',
		':root[data-edge-palette="edge-teal"]',
		':root[data-edge-palette="edge-emerald"]',
		':root[data-edge-palette="edge-slate"]',
		':root[data-edge-appearance="dark"]',
		"--edge-color-surface: #111b26",
		"--edge-color-ink-950: #f1f6fb",
		":root[data-edge-palette] .edge-app-shell[data-edge-product]",
		"--edge-color-brand-600: inherit",
		".edge-theme-menu__choices",
		".edge-theme-menu__palette-list",
	):
		assert contract in content


def test_bootstrap_can_apply_remembered_theme_before_main_runtime():
	content = read(BOOTSTRAP)
	for contract in (
		'const STORAGE_PREFIX = "edgeui:theme:v1"',
		"frappe.session?.user",
		"frappe.boot?.user?.name",
		"frappe.boot?.user?.email",
		"localStorage?.getItem(storageKey())",
		"root.dataset.edgePalette",
		"root.dataset.edgeAppearanceMode",
		"root.dataset.edgeAppearance",
		"resolveAppearance(preference)",
	):
		assert contract in content

	assert ":last" not in content
