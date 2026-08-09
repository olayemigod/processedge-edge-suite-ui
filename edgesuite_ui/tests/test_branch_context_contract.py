import json
from pathlib import Path

from edgesuite_ui import __version__

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "context_components.js"
CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_context.css"
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"
INIT = ROOT / "edgesuite_ui" / "__init__.py"
PACKAGE = ROOT / "package.json"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_branch_switcher_is_product_neutral_and_provider_controlled():
	content = read(JS)
	for contract in (
		"EdgeBranchContextSwitcher",
		"normalizeBranchContextOption",
		'"update:modelValue"',
		'"switch"',
		"currentCompany",
		"currentCode",
		"canSwitch",
		"busy",
		"options",
		"data-edge-working-branch",
	):
		assert contract in content

	assert "frappe.call" not in content
	assert "CoreEdge" not in content
	assert "VetEdge" not in content
	assert "EduEdge" not in content


def test_branch_switcher_is_registered_and_styled():
	bundle = read(BUNDLE)
	hooks = read(HOOKS)
	styles = read(CSS)
	assert 'from "./edgeui/context_components"' in bundle
	assert "...contextComponents" in bundle
	assert 'export * from "./edgeui/context_components"' in bundle
	assert "/assets/edgesuite_ui/css/edgeui_context.css" in hooks
	for selector in (
		".edge-branch-context",
		".edge-branch-context__identity",
		".edge-branch-context__select",
		".edge-branch-context__helper",
	):
		assert selector in styles


def test_branch_context_runtime_versions_are_aligned():
	package = json.loads(read(PACKAGE))
	assert f'EDGE_SUITE_UI_VERSION = "{__version__}"' in read(BUNDLE)
	assert f'__version__ = "{__version__}"' in read(INIT)
	assert package["version"] == __version__
