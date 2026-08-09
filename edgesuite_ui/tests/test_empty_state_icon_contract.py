from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
JS_ROOT = PACKAGE_ROOT / "public" / "js"


def test_empty_state_icon_override_uses_shared_edge_icon():
	override = (JS_ROOT / "edgeui" / "empty_state_components.js").read_text(encoding="utf-8")

	assert 'EdgeEmptyState as BaseEdgeEmptyState' in override
	assert 'import { EdgeIcon } from "./professional_components"' in override
	assert "if (slots.icon)" in override
	assert "else if (props.icon)" in override
	assert "h(EdgeIcon" in override
	assert "name: props.icon" in override
	assert 'icon: ""' in override
	assert 'onAction: () => emit("action")' in override


def test_bundle_registers_icon_aware_override_after_base_components():
	entrypoint = (JS_ROOT / "edgeui.bundle.js").read_text(encoding="utf-8")

	assert 'import { emptyStateComponents } from "./edgeui/empty_state_components"' in entrypoint
	assert "createCompatibleRuntimeComponents" in entrypoint
	assert "baseComponents," in entrypoint
	assert "emptyStateComponents," in entrypoint
	assert entrypoint.index("baseComponents,") < entrypoint.index("emptyStateComponents,")
	assert (
		'export { EdgeEmptyState, emptyStateComponents } from "./edgeui/empty_state_components"'
		in entrypoint
	)
	assert 'export * from "./edgeui/empty_state_components"' not in entrypoint


def test_empty_state_override_keeps_custom_slots_and_action_contract():
	override = (JS_ROOT / "edgeui" / "empty_state_components.js").read_text(encoding="utf-8")

	assert "forwardedSlots.icon = () => slots.icon()" in override
	assert "forwardedSlots.actions = () => slots.actions()" in override
	assert 'emits: ["action"]' in override
	assert "actionLabel: props.actionLabel" in override
