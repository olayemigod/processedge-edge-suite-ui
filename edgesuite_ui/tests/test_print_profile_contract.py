import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROFILE_JSON = (
    ROOT
    / "edgesuite_ui"
    / "edgesuite_ui"
    / "doctype"
    / "edge_print_profile"
    / "edge_print_profile.json"
)
PROFILE_CONTROLLER = PROFILE_JSON.with_suffix(".py")
PROFILE_CLIENT = PROFILE_JSON.with_suffix(".js")
API = ROOT / "edgesuite_ui" / "api" / "printing.py"


def test_edge_print_profile_is_shared_policy_not_device_permission_storage():
    profile = json.loads(PROFILE_JSON.read_text())

    assert profile["name"] == "Edge Print Profile"
    assert profile["module"] == "EdgeSuite UI"
    assert profile["autoname"] == "field:profile_name"

    fields = {field["fieldname"]: field for field in profile["fields"]}
    for fieldname in (
        "profile_name",
        "enabled",
        "purpose",
        "product_key",
        "scope_type",
        "scope_value",
        "priority",
        "transport",
        "protocol",
        "paper_width",
        "characters_per_line",
        "baud_rate",
        "text_encoding",
        "auto_cut",
        "cut_mode",
        "cash_drawer",
        "drawer_pin",
        "feed_lines",
        "copies",
        "print_logo",
        "print_qr",
    ):
        assert fieldname in fields

    assert fields["purpose"]["options"] == "Receipt"
    assert fields["product_key"]["fieldtype"] == "Autocomplete"
    assert fields["transport"]["options"] == "Serial"
    assert fields["protocol"]["options"] == "ESC/POS"
    assert fields["scope_value"]["fieldtype"] == "Dynamic Link"
    assert fields["scope_value"]["options"] == "scope_doctype"
    assert fields["print_logo"]["default"] == "0"
    assert fields["print_logo"]["hidden"] == 1

    serialized = PROFILE_JSON.read_text().lower()
    for forbidden in ("mac address", "bluetooth address", "serialport", "device permission"):
        assert forbidden not in serialized


def test_print_profile_management_is_restricted_to_system_manager():
    profile = json.loads(PROFILE_JSON.read_text())
    permissions = profile["permissions"]

    assert len(permissions) == 1
    assert permissions[0]["role"] == "System Manager"
    assert permissions[0]["read"] == 1
    assert permissions[0]["write"] == 1
    assert permissions[0]["create"] == 1


def test_profile_resolution_is_authenticated_product_and_scope_aware():
    source = API.read_text()

    for expected in (
        "_require_authenticated_user",
        "_require_product_available",
        "get_available_products",
        "_profile_matches",
        "_profile_rank",
        "_profile_effective_rank",
        "_validate_product_scope",
        "PRINT_CONTEXT_VALIDATOR_HOOK",
        '"Global": 100',
        '"Company": 200',
        '"Branch": 300',
        '"User": 400',
        "get_active_print_profiles",
        "resolve_print_profile",
    ):
        assert expected in source

    assert "Guest" in source
    assert "frappe.PermissionError" in source
    assert "ignore_permissions=True" not in source
    assert "same effective priority" in source


def test_profile_controller_validates_physical_print_settings():
    source = PROFILE_CONTROLLER.read_text()

    for expected in (
        'SUPPORTED_PURPOSE = "Receipt"',
        'SUPPORTED_TRANSPORT = "Serial"',
        'SUPPORTED_PROTOCOL = "ESC/POS"',
        "_normalize_product_key",
        "_validate_effective_rank_is_unique",
        "Paper Width must be 58 or 80 mm.",
        "Characters per Line must be between 16 and 80.",
        "Baud Rate must be between 300 and 1000000.",
        "Feed Lines must be between 0 and 20.",
        "Copies must be between 1 and 10.",
    ):
        assert expected in source



def test_print_profile_form_uses_smart_context_and_width_defaults():
    source = PROFILE_CLIENT.read_text()

    for expected in (
        "loadProductOptions",
        "get_product_context",
        "scope_doctype",
        "clearInvalid: true",
        "width === 58",
        'set_value("characters_per_line", 32)',
        "width === 80",
        'set_value("characters_per_line", 48)',
    ):
        assert expected in source
