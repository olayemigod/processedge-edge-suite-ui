from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]


def test_user_settings_uses_current_user_form_not_missing_page():
	compat = (APP_ROOT / "public/js/edgeui/frappe_compat.js").read_text(encoding="utf-8")
	bundle = (APP_ROOT / "public/js/edgeui.bundle.js").read_text(encoding="utf-8")
	version = (APP_ROOT / "__init__.py").read_text(encoding="utf-8")

	assert "applyFrappeCompatibility" in compat
	assert "components?.EdgeAppShell" in compat
	assert "globalThis.frappe?.session?.user" in compat
	assert "`/app/user/${encodeURIComponent(user)}`" in compat
	assert "/app/user-settings" not in compat
	assert "applyFrappeCompatibility(professionalComponents)" in bundle
	assert 'EDGE_SUITE_UI_VERSION = "0.2.1"' in bundle
	assert '__version__ = "0.2.1"' in version
