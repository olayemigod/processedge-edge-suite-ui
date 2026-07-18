import json
import tomllib
from pathlib import Path

from edgesuite_ui import __version__

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
JS_ROOT = PACKAGE_ROOT / "public" / "js"
CSS_ROOT = PACKAGE_ROOT / "public" / "css"
HOOKS = PACKAGE_ROOT / "hooks.py"
REPOSITORY_ROOT = PACKAGE_ROOT.parent


def _javascript_source() -> str:
	return "\n".join(path.read_text(encoding="utf-8") for path in sorted(JS_ROOT.rglob("*.js")))


def test_frappe_app_discovery_markers_are_present():
	for marker in ("hooks.py", "modules.txt", "patches.txt"):
		assert (PACKAGE_ROOT / marker).is_file()


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
		"EdgeFilterBar",
		"EdgeStatCard",
		"EdgeStatusBadge",
		"EdgeEmptyState",
		"EdgeLoadingState",
		"EdgeErrorState",
		"EdgeNotificationBell",
		"EdgeNotificationDrawer",
	):
		assert required_symbol in source


def test_runtime_owns_and_exposes_the_vue_bridge():
	bridge = (JS_ROOT / "edgeui" / "vue-bridge.js").read_text(encoding="utf-8")
	runtime = (JS_ROOT / "edgeui" / "runtime.js").read_text(encoding="utf-8")
	entrypoint = (JS_ROOT / "edgeui.bundle.js").read_text(encoding="utf-8")

	assert 'from "../../../../node_modules/vue/dist/vue.runtime.esm-bundler.js"' in bridge
	assert "target.Vue = target.Vue || Vue" in bridge
	assert 'import Vue from "./vue-bridge"' in runtime
	assert 'import { exposeVueBridge } from "./edgeui/vue-bridge"' in entrypoint
	assert "exposeVueBridge(globalThis)" in entrypoint
	assert "coreedge" not in bridge.lower()


def test_runtime_does_not_import_platform_or_product_apps():
	source = _javascript_source().lower()

	for forbidden_import in ("coreedge/", "vetedge/", "retailedge/", "edgepay/"):
		assert forbidden_import not in source


def test_runtime_version_matches_python_package_version():
	entrypoint = (JS_ROOT / "edgeui.bundle.js").read_text(encoding="utf-8")
	assert f'EDGE_SUITE_UI_VERSION = "{__version__}"' in entrypoint


def test_frappe_hooks_include_local_runtime_assets():
	hooks = HOOKS.read_text(encoding="utf-8")
	for asset in ("edgeui.bundle.js", "edgeui.bundle.css", "edgeui_compat.bundle.css"):
		assert f'"{asset}"' in hooks

	assert (JS_ROOT / "edgeui.bundle.js").is_file()
	assert (CSS_ROOT / "edgeui.bundle.css").is_file()
	assert (CSS_ROOT / "edgeui_compat.bundle.css").is_file()


def test_bundle_entrypoint_uses_frappe_bundle_naming_and_local_modules():
	entrypoint = (JS_ROOT / "edgeui.bundle.js").read_text(encoding="utf-8")

	assert (JS_ROOT / "edgeui" / "components.js").is_file()
	assert (JS_ROOT / "edgeui" / "runtime.js").is_file()
	assert '"./edgeui/components"' in entrypoint
	assert '"./edgeui/runtime"' in entrypoint


def test_migrated_product_compatibility_surface_is_present():
	source = _javascript_source()
	for prop_or_event in (
		"menuItems",
		"activeRoute",
		"tenantName",
		"branchName",
		"userName",
		'emit("navigate"',
		'emit("mark-all-read"',
		'emit("update:filter"',
	):
		assert prop_or_event in source


def test_python_and_package_metadata_are_valid():
	pyproject = tomllib.loads((REPOSITORY_ROOT / "pyproject.toml").read_text(encoding="utf-8"))
	package = json.loads((REPOSITORY_ROOT / "package.json").read_text(encoding="utf-8"))

	assert pyproject["project"]["name"] == "edgesuite_ui"
	assert pyproject["project"]["requires-python"] == ">=3.14"
	assert package["name"] == "@processedge/edgesuite-ui"
	assert package["version"] == __version__
	assert package["private"] is True


def test_generated_frontend_paths_are_ignored():
	gitignore = (REPOSITORY_ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
	assert "/edgesuite_ui/public/dist/" in gitignore
	assert "/edgesuite_ui/public/node_modules" in gitignore


def test_runtime_namespace_is_canonical_with_temporary_alias():
	runtime = (JS_ROOT / "edgeui" / "runtime.js").read_text(encoding="utf-8")
	assert "target.EdgeSuiteUI = runtime" in runtime
	assert "target.EdgeUI = runtime" in runtime
	assert runtime.index("target.EdgeSuiteUI = runtime") < runtime.index("target.EdgeUI = runtime")
	assert "createEdgeApp(rootComponent" in runtime
	assert "components: componentRegistry" in runtime


def test_repository_has_no_private_product_imports():
	source_paths = [*PACKAGE_ROOT.rglob("*"), *(REPOSITORY_ROOT / "scripts").rglob("*")]
	for path in source_paths:
		if not path.is_file() or ".git" in path.parts:
			continue
		if path.suffix.lower() not in {".py", ".js"}:
			continue

		source = path.read_text(encoding="utf-8").lower()
		for product in ("coreedge", "vetedge", "retailedge", "edgepay"):
			assert f"from {product}" not in source
			assert f"import {product}" not in source
			assert f"/{product}/" not in source
