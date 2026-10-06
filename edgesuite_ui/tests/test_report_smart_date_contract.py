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
	assert "rollingMonthsYears" in text
	assert "previousCompleted" in text
	assert "quarterSpan" in text
	assert "monthSpan" in text
	assert "first|second" in text
	assert "compact" in text
	assert "MONTHS" in text


def test_smart_date_supports_retailedge_requested_phrase_families_without_breaking_iso():
	text = SMART_DATE.read_text()
	assert "last|past|next" in text
	assert "month|months|year|years" in text
	assert "previous " in text
	assert "RANGE_CONNECTOR" in text
	assert "sinceMonth" in text
	assert "betweenNamed" in text
	assert r"^(\d{4})-(\d{2})-(\d{2})$" in text
	assert "May to June 2026" in text
	assert "last 2 months" in text
	assert "previous 2 months" in text


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


def test_smart_date_is_one_closed_selector_with_optional_presets_and_custom_dates_inside():
	text = SMART_DATE.read_text()
	css = SMART_DATE_CSS.read_text()
	for marker in (
		"DEFAULT_PRESETS",
		'"Last 90 Days"',
		"showPresets",
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
	assert "this.showPresets && (this.presets || []).length" in text
	assert "this.customFrom = value.from_date" in text
	assert "this.customTo = value.to_date" in text
	assert 'expression: "custom"' in text
	assert "edge-smart-date__custom-fields" in css
	assert "edge-smart-date__presets" in css
	assert "edge-smart-date__trigger" in css


def test_smart_date_picker_is_viewport_aware_and_collision_aware():
	runtime = DROPDOWN_RUNTIME.read_text()
	css = SMART_DATE_CSS.read_text()
	for marker in (
		".edge-smart-date.is-open",
		"positionSmartDate",
		"smartDateSiblingRects",
		"intersectionArea",
		"placementScore",
		"edgeSmartDateDirection",
		"edgeSmartDateHorizontal",
		'edgeSmartDateMode = "viewport"',
		"SMART_DATE_MIN_USABLE_HEIGHT_PX",
	):
		assert marker in runtime
	assert 'globalObject.addEventListener?.("resize", schedule)' in runtime
	assert 'globalObject.addEventListener?.("scroll", schedule, true)' in runtime
	assert "overflow-y: auto" in css
	assert "overflow-x: hidden" in css
	assert "max-width: calc(100vw - 1rem)" in css


def test_smart_date_field_cannot_force_filter_grid_overflow():
	css = SMART_DATE_CSS.read_text()
	assert ".edge-smart-date {" in css
	assert "min-width: 0" in css
	assert "width: 100%" in css
	assert "max-width: 100%" in css
	assert ".edge-smart-date__trigger {" in css
	assert "box-sizing: border-box" in css


def test_legacy_right_edge_hint_remains_as_runtime_fallback():
	css = SMART_DATE_CSS.read_text()
	assert ".edge-smart-date.edge-smart-date--align-end .edge-smart-date__picker" in css
	assert "inset-inline-end: 0" in css


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
