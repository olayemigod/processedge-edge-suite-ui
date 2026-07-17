from pathlib import Path

from edgesuite_ui import __version__

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
JS_ROOT = PACKAGE_ROOT / "public" / "js"
CSS_BUNDLE = PACKAGE_ROOT / "public" / "css" / "edgeui.bundle.css"
HOOKS = PACKAGE_ROOT / "hooks.py"


def _javascript_source() -> str:
	return "\n".join(path.read_text(encoding="utf-8") for path in sorted(JS_ROOT.rglob("*.js")))


def test_runtime_exports_the_compatibility_contract():
	source = _javascript_source()

	for required_symbol in (
		"EdgeSuiteUI",
		"EdgeUI",
		"createEdgeApp",
		"components",
		"EdgeAppShell",
		"EdgePageLayout",
		"EdgePageHeader",
		"EdgeStatCard",
		"EdgeStatusBadge",
		"EdgeEmptyState",
		"EdgeLoadingState",
		"EdgeErrorState",
	):
		assert required_symbol in source


def test_runtime_does_not_import_platform_or_product_apps():
	source = _javascript_source().lower()

	for forbidden_import in ("coreedge/", "vetedge/", "retailedge/", "edgepay/"):
		assert forbidden_import not in source


def test_runtime_version_matches_python_package_version():
	entrypoint = (JS_ROOT / "edgeui.bundle.js").read_text(encoding="utf-8")
	assert f'EDGE_SUITE_UI_VERSION = "{__version__}"' in entrypoint


def test_frappe_hooks_include_local_runtime_assets():
	hooks = HOOKS.read_text(encoding="utf-8")
	assert '"edgeui.bundle.js"' in hooks
	assert '"edgeui.bundle.css"' in hooks
	assert CSS_BUNDLE.exists()
