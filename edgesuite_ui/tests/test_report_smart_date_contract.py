from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SMART_DATE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "report_smart_date.js"
SMART_DATE_CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_report_smart_date.bundle.css"
DROPDOWN_RUNTIME = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "dropdown_viewport_runtime.js"
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"


def test_smart_date_interpreter_supports_business_period_phrases():
	text = SMART_DATE.read_text()
	for phrase in (
		'"today"',
		'"yesterday"',
		'"tomorrow"',
		'"year to date"',
		'"month to date"',
		'"quarter to date"',
		'"week to date"',
	):
		assert phrase in text
	assert "this|last|next" in text
	assert "day|days|week|weeks" in text
	assert "month|months|year|years" in text
	assert "previous" in text
	assert "complete" in text
	assert "q([1-4])" in text
	assert "h([12])" in text
	assert "resolveMonthSpan" in text
	assert "through|until|till|and|-" in text
	assert "addMonthsClamped" in text
	assert "addYearsClamped" in text
	assert "MONTHS" in text


def test_smart_date_supports_requested_retailedge_examples_without_breaking_iso_dates():
	text = SMART_DATE.read_text()
	assert "May to June 2026" in text
	assert "last 2 months" in text
	assert "previous 2 months" in text
	assert "YYYY-MM-DD" in text
	assert 'const isoDate = text.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);' in text
	assert '.replace(/\\s*[–—]\\s*/g, " - ")' in text
	assert '.replace(/\\s*-\\s*/g, " - ")' not in text


def test_smart_date_emits_exact_dates_not_free_text_to_consumers():
	text = SMART_DATE.read_text()
	assert "from_date: result.from_date" in text
	assert "to_date: result.to_date" in text
	assert "expression: result.expression" in text
	assert 'this.$emit("update:modelValue", value)' in text
	assert 'this.$emit("resolved", value)' in text


def test_smart_date_preview_uses_resolved_dates_not_unapplied_selection():
	text = SMART_DATE.read_text()
	assert "renderInterpretationPreview" in text
	assert "displayDate(result.from_date" in text
	assert "displayDate(result.to_date" in text
	assert "edge-smart-date__interpretation" in text
	assert "edge-smart-date__error" in text


def test_ambiguous_numeric_dates_require_explicit_confirmation():
	text = SMART_DATE.read_text()
	assert "requires_confirmation: Boolean(ambiguous)" in text
	assert "confirmedAmbiguousExpression" in text
	assert "confirmAmbiguous" in text
	assert "Confirm ${String(this.dateOrder" in text


def test_smart_date_is_one_closed_selector_with_smart_presets_and_custom_dates_inside():
	text = SMART_DATE.read_text()
	css = SMART_DATE_CSS.read_text()
	for marker in (
		"DEFAULT_PRESETS",
		'"Last 90 Days"',
		"applyPreset",
		"applyCustomRange",
		"customFrom",
		"customTo",
		'type: "date"',
		"edge-smart-date__trigger",
		"edge-smart-date__picker",
		"edge-smart-date__smart-row",
	):
		assert marker in text
	assert "this.customFrom = value.from_date" in text
	assert "this.customTo = value.to_date" in text
	assert 'expression: "custom"' in text
	assert "edge-smart-date__custom-fields" in css
	assert "edge-smart-date__presets" in css
	assert "edge-smart-date__trigger" in css


def test_smart_date_quick_presets_can_be_hidden_by_product_surfaces():
	text = SMART_DATE.read_text()
	assert "if ((this.presets || []).length)" in text
	assert "Quick periods" in text
	assert "presets: { type: Array" in text


def test_smart_date_picker_auto_flips_left_or_up_and_stays_inside_viewport():
	runtime = DROPDOWN_RUNTIME.read_text()
	css = SMART_DATE_CSS.read_text()
	for marker in (
		"positionSmartDate",
		'.querySelectorAll(".edge-smart-date.is-open")',
		"edgeSmartDateDirection",
		"edgeSmartDateAlign",
		'SMART_DATE_MAX_WIDTH_PX = 560',
		'SMART_DATE_MAX_HEIGHT_PX = 672',
		'picker.style.position = "fixed"',
		'align = "end"',
		'openUpward ? "up" : "down"',
		"resetClosedSmartDates",
	):
		assert marker in runtime
	assert "overflow-y: auto" in css
	assert "overscroll-behavior: contain" in css


def test_smart_resolution_prefills_custom_range_and_updates_closed_selector_immediately():
	text = SMART_DATE.read_text()
	assert "selectedValue: {}" in text
	assert "this.selectedValue = { ...value }" in text
	assert "this.customFrom = value.from_date" in text
	assert "this.customTo = value.to_date" in text
	assert "selectedRangeLabel" in text
	assert "selectedPeriodLabel" in text


def test_smart_date_is_registered_as_shared_edgesuite_component():
	bundle = BUNDLE.read_text()
	assert 'from "./edgeui/report_smart_date"' in bundle
	assert "...reportSmartDateComponents" in bundle
	assert 'export * from "./edgeui/report_smart_date"' in bundle


def test_smart_date_styles_are_loaded_through_hashed_bundle():
	hooks = HOOKS.read_text()
	assert '"edgeui_report_smart_date.bundle.css"' in hooks
	assert '"/assets/edgesuite_ui/css/edgeui_report_smart_date.css"' not in hooks
