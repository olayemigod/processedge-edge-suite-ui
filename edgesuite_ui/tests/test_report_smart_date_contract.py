from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SMART_DATE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "report_smart_date.js"
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
	):
		assert phrase in text
	assert "this|last|next" in text
	assert "day|days|week|weeks" in text
	assert "q([1-4])" in text
	assert "MONTHS" in text


def test_smart_date_emits_exact_dates_not_free_text_to_consumers():
	text = SMART_DATE.read_text()
	assert 'from_date: result.from_date' in text
	assert 'to_date: result.to_date' in text
	assert 'expression: result.expression' in text
	assert 'this.$emit("update:modelValue", value)' in text
	assert 'this.$emit("resolved", value)' in text


def test_smart_date_always_surfaces_interpretation():
	text = SMART_DATE.read_text()
	assert "Interpreted as:" in text
	assert "edge-smart-date__interpretation" in text
	assert "edge-smart-date__error" in text


def test_ambiguous_numeric_dates_require_explicit_confirmation():
	text = SMART_DATE.read_text()
	assert "requires_confirmation: Boolean(ambiguous)" in text
	assert "confirmedAmbiguousExpression" in text
	assert "confirmAmbiguous" in text
	assert "Confirm ${String(this.dateOrder" in text


def test_smart_date_is_registered_as_shared_edgesuite_component():
	bundle = BUNDLE.read_text()
	assert 'from "./edgeui/report_smart_date"' in bundle
	assert "...reportSmartDateComponents" in bundle
	assert 'export * from "./edgeui/report_smart_date"' in bundle


def test_smart_date_styles_are_loaded_globally():
	hooks = HOOKS.read_text()
	assert '"/assets/edgesuite_ui/css/edgeui_report_smart_date.css"' in hooks
