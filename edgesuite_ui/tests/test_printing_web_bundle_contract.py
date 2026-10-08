from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui_print.bundle.js"


def test_web_print_bundle_exposes_shared_print_adapter_without_product_logic():
    source = BUNDLE.read_text()

    for expected in (
        "createEdgePrintAdapter",
        "installEdgeSuitePrintRuntime",
        "EdgeSuitePrint",
        "printReceipt",
    ):
        assert expected in source

    for forbidden in (
        "retailedge",
        "vetedge",
        "eduedge",
        "pos_next",
        "navigator.serial",
    ):
        assert forbidden not in source
