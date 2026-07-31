from pathlib import Path

from edgesuite_ui import __version__

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "document_components.js"
COMPAT = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "runtime_component_compat.js"
CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_documents.css"
CHILD_TABLE_CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_child_table_layout.css"
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
STANDALONE_BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgesuite_ui.bundle.js"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"
VERSION = ROOT / "edgesuite_ui" / "__init__.py"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_document_foundation_exports_full_workspace_components():
	content = read(JS)
	for contract in (
		"EdgeDataTable",
		"EdgeChildTable",
		"EdgeWorkflowBar",
		"EdgeDocumentForm",
		"EdgeSettingsLayout",
		"documentComponents",
		"evaluateDocumentDependency",
		"EdgeLinkField",
		"EdgeStatusBadge",
	):
		assert contract in content


def test_document_form_supports_tabs_sections_dependencies_links_and_child_rows():
	content = read(JS)
	for contract in (
		"schema.tabs",
		"selectedTab",
		"section.fields",
		"depends_on",
		"mandatory_depends_on",
		"read_only_depends_on",
		"child_fields",
		"linkSearcher",
		"childLinkSearcher",
		'"update:modelValue"',
	):
		assert contract in content


def test_workflow_component_is_provider_driven_and_does_not_write_documents():
	content = read(JS)
	for contract in (
		'emits: ["save", "delete", "transition", "back", "more-action"]',
		'this.$emit("transition", transition)',
		'this.$emit("save")',
		'this.$emit("delete")',
	):
		assert contract in content
	for forbidden in (
		"frappe.call",
		"frappe.client.insert",
		"frappe.client.set_value",
		"apply_workflow(",
		"doc.save(",
		"doc.submit(",
		"doc.cancel(",
	):
		assert forbidden not in content


def test_document_components_are_registered_versioned_and_compatibility_wrapped():
	bundle = read(BUNDLE)
	standalone_bundle = read(STANDALONE_BUNDLE)
	hooks = read(HOOKS)
	version = read(VERSION)
	compat = read(COMPAT)
	assert 'from "./edgeui/document_components"' in bundle
	assert 'from "./edgeui/runtime_component_compat"' in bundle
	assert "createCompatibleRuntimeComponents" in bundle
	assert "documentComponents," in bundle
	assert 'export * from "./edgeui/document_components"' in bundle
	assert 'export * from "./edgeui/runtime_component_compat"' in bundle
	assert f'EDGE_SUITE_UI_VERSION = "{__version__}"' in bundle
	assert f'__version__ = "{__version__}"' in version
	assert 'export * from "./edgeui.bundle"' in standalone_bundle
	assert 'export { default } from "./edgeui.bundle"' in standalone_bundle
	assert "/assets/edgesuite_ui/css/edgeui_documents.css" in hooks
	assert "/assets/edgesuite_ui/css/edgeui_child_table_layout.css" in hooks
	for contract in (
		"normalizeEdgeDataTableColumns",
		"fieldname: column.fieldname || column.key",
		"createCompatibleEdgeDataTable",
		"createCompatibleEdgeStatCard",
		"normalizeEdgeStatIcon",
	):
		assert contract in compat


def test_document_styles_cover_desktop_mobile_forms_lists_workflows_and_settings():
	styles = read(CSS)
	for selector in (
		".edge-data-table",
		".edge-document-form",
		".edge-document-section__grid",
		".edge-child-table",
		".edge-workflow-bar",
		".edge-settings-layout",
		"@media (max-width: 47.99rem)",
	):
		assert selector in styles


def test_child_table_layout_wraps_long_headers_and_preserves_link_width():
	styles = read(CHILD_TABLE_CSS)
	for contract in (
		"white-space: normal",
		"overflow-wrap: anywhere",
		".edge-child-table th:first-child",
		"td:has(.edge-link-field)",
		'td:has(> input[type="checkbox"])',
		"min-width: 11rem",
	):
		assert contract in styles
