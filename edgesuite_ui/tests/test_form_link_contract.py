from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "form_components.js"
MODAL_JS = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "modal_components.js"
CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_form_controls.css"
MODAL_CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_modal.css"
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_link_field_supports_search_selection_creation_and_fuzzy_ranking():
	content = read(JS)

	for contract in (
		"EdgeLinkField",
		"normalizeLinkOption",
		"fuzzyOptionScore",
		"fuzzyFilterOptions",
		"fuzzySubsequenceScore",
		"searcher",
		"creator",
		"canCreate",
		'emit("update:modelValue"',
		'emit("select"',
		'emit("create-success"',
		'"ArrowDown"',
		'"ArrowUp"',
		'"Home"',
		'"End"',
		'event.key === "Escape"',
		"requestToken",
		"props.context",
	):
		assert contract in content

	assert 'event.key !== "Enter"' in content
	assert "selectOption(selected)" in content
	assert "createOption()" in content


def test_static_options_use_regular_non_searchable_dropdown():
	content = read(JS)

	assert 'name: "EdgeDropdown"' in content
	assert '"aria-haspopup": "listbox"' in content
	assert 'type: "search"' not in content.split("export const EdgeDropdown", 1)[1].split(
		"export const EdgeLinkField", 1
	)[0]
	assert "EdgeDropdown," in content.split("export const formComponents", 1)[1]


def test_link_field_does_not_create_records_without_product_provider():
	content = read(JS)

	assert "if (!props.creator)" in content
	assert 'emit("create", term)' in content
	assert "frappe.call" not in content
	assert "insert(" not in content
	assert "save(" not in content


def test_dropdowns_are_exported_and_styled_globally():
	bundle = read(BUNDLE)
	hooks = read(HOOKS)
	styles = read(CSS)

	assert 'from "./edgeui/form_components"' in bundle
	assert "...formComponents" in bundle
	assert 'export * from "./edgeui/form_components"' in bundle
	assert "/assets/edgesuite_ui/css/edgeui_form_controls.css" in hooks
	for selector in (
		".edge-dropdown",
		".edge-dropdown__menu",
		".edge-dropdown__option",
		".edge-link-field",
		".edge-link-field__menu",
		".edge-link-field__option",
		".edge-link-field__create",
		".edge-link-field__helper.is-error",
	):
		assert selector in styles


def test_both_flyouts_match_control_width_exactly():
	styles = read(CSS)
	shared_menu = styles.split(".edge-dropdown__menu,", 1)[1].split(".edge-dropdown__option,", 1)[0]

	assert "width: 100%;" in shared_menu
	assert "min-width: 100%;" in shared_menu
	assert "max-width: 100%;" in shared_menu
	assert "box-sizing: border-box;" in shared_menu
	assert "right: auto;" in shared_menu
	assert "overflow-x: hidden;" in shared_menu


def test_form_dialog_uses_shared_dropdown_and_link_controls():
	content = read(MODAL_JS)
	render_field = content.split("renderField(field, index)", 1)[1].split("  render()", 1)[0]

	assert 'import { EdgeDropdown, EdgeLinkField } from "./form_components"' in content
	assert "h(EdgeDropdown" in render_field
	assert "h(EdgeLinkField" in render_field
	assert '"datalist"' not in render_field
	assert 'control = h(\n          "select"' not in render_field
	assert "linkSearcher" in content
	assert "onQueryChange" in render_field


def test_dialog_flyouts_are_forced_to_the_trigger_width():
	styles = read(MODAL_CSS)
	dialog_width_contract = styles.split("/* Dialog fields use the shared custom dropdowns", 1)[1]

	for selector in (
		".edge-modal .edge-dropdown__trigger",
		".edge-modal .edge-link-field__input",
		".edge-modal .edge-dropdown__menu",
		".edge-modal .edge-link-field__menu",
	):
		assert selector in dialog_width_contract
	assert "inline-size: 100% !important;" in dialog_width_contract
	assert "min-inline-size: 100% !important;" in dialog_width_contract
	assert "max-inline-size: 100% !important;" in dialog_width_contract
	assert "box-sizing: border-box !important;" in dialog_width_contract


def test_link_field_keeps_parent_context_reactive():
	content = read(JS)

	assert "watch(" in content
	assert "() => props.context" in content
	assert "results.value = []" in content
	assert "activeIndex.value = -1" in content


def test_replacing_selected_text_emits_clear_for_dependent_fields():
	content = read(JS)
	on_input = content.split("function onInput(event)", 1)[1].split("function onFocus()", 1)[0]

	assert 'emit("update:modelValue", "")' in on_input
	assert 'emit("clear")' in on_input
