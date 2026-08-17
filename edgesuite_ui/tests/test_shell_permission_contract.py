from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_shell_permission_contract_keeps_authorization_product_owned():
	doc = (ROOT / "docs/shell-permission-contract.md").read_text()
	for expected in (
		"effective_capability = platform_capability_available AND product_setting_enabled AND scope_view_access AND action_authorization",
		"exportEnabled",
		"printEnabled",
		"Never trust the client-side shell state",
		"revalidate authorization server-side",
		"branch/company/tenant",
	):
		assert expected in doc


def test_shell_action_runtime_does_not_contain_product_authorization_logic():
	source = (ROOT / "edgesuite_ui/public/js/edgeui/report_shell_actions.js").read_text()
	for forbidden in (
		"frappe.call",
		"ignore_permissions",
		"Veterinary Settings",
		"VetEdge",
		"RetailEdge",
		"EduEdge",
	):
		assert forbidden not in source
