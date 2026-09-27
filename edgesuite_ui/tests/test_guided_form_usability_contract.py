from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FORM_JS = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "form_components.js"
DOCUMENT_JS = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "document_components.js"


def read(path: Path) -> str:
	return path.read_text(encoding="utf-8")


def test_link_menu_can_escape_modal_and_child_table_overflow():
	content = read(FORM_JS)

	for contract in (
		"Teleport",
		"portalMenu",
		"updateMenuPosition",
		'window.addEventListener("scroll", updateMenuPosition, true)',
		'window.addEventListener("resize", updateMenuPosition)',
		'!menu.value?.contains(event.target)',
		'edge-link-field__menu--portal',
		'h(Teleport, { to: "body" }, menuNode)',
	):
		assert contract in content

	# Position listeners must be active only while the menu is open; a page with
	# many child rows must not add idle scroll listeners for every Link control.
	assert "startPositionListeners()" in content
	assert "stopPositionListeners()" in content
	assert "watch(open" in content


def test_child_table_supports_newest_first_display_and_link_creation_without_reordering_data():
	content = read(DOCUMENT_JS)

	for contract in (
		"newRowsFirst",
		"linkCreator",
		"linkCanCreate",
		"linkCreateLabel",
		"const next = [...this.rows, row]",
		"displayedRows()",
		"this.newRowsFirst ? indexed.reverse() : indexed",
		"canCreateLink(column, row)",
		"createLabelFor(column, row)",
	):
		assert contract in content

	# Compatibility: generic forms keep normal ordering unless a product opts in.
	# Even when opted in, only the rendered order reverses; the emitted row array
	# remains append-ordered so product accounting/default logic is not destabilized.
	assert 'newRowsFirst: { type: Boolean, default: false }' in content
	assert "[row, ...this.rows]" not in content
