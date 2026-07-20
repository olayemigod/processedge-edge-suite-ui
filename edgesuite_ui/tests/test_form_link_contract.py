from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "form_components.js"
CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_form_controls.css"
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_link_field_supports_search_selection_and_controlled_creation():
	content = read(JS)

	for contract in (
		"EdgeLinkField",
		"normalizeLinkOption",
		"searcher",
		"creator",
		"canCreate",
		'emit("update:modelValue"',
		'emit("select"',
		'emit("create-success"',
		'event.key === "ArrowDown"',
		'event.key === "ArrowUp"',
		'event.key === "Enter"',
		'event.key === "Escape"',
		"requestToken",
		"props.context",
	):
		assert contract in content


def test_link_field_does_not_create_records_without_product_provider():
	content = read(JS)

	assert "if (!props.creator)" in content
	assert 'emit("create", term)' in content
	assert "frappe.call" not in content
	assert "insert(" not in content
	assert "save(" not in content


def test_link_field_is_exported_and_styled_globally():
	bundle = read(BUNDLE)
	hooks = read(HOOKS)
	styles = read(CSS)

	assert 'from "./edgeui/form_components"' in bundle
	assert "...formComponents" in bundle
	assert 'export * from "./edgeui/form_components"' in bundle
	assert "/assets/edgesuite_ui/css/edgeui_form_controls.css" in hooks
	for selector in (
		".edge-link-field",
		".edge-link-field__menu",
		".edge-link-field__option",
		".edge-link-field__create",
		".edge-link-field__helper.is-error",
	):
		assert selector in styles


def test_link_field_keeps_parent_context_reactive():
	content = read(JS)

	assert "watch(" in content
	assert "() => props.context" in content
	assert "results.value = []" in content
	assert "activeIndex.value = -1" in content
