from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCUMENT = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_document.js"
ESCPOS = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_escpos.js"
RUNTIME = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "printing_runtime.js"


def test_receipt_document_supports_product_neutral_58_and_80mm_profiles():
    source = DOCUMENT.read_text()

    for expected in (
        '58: Object.freeze({ widthMm: 58, charactersPerLine: 32 })',
        '80: Object.freeze({ widthMm: 80, charactersPerLine: 48 })',
        '"text"',
        '"rule"',
        '"row"',
        '"feed"',
        '"qr"',
        '"barcode"',
        '"image"',
        '"cut"',
        '"drawer"',
        "normalizeReceiptDocument",
    ):
        assert expected in source


def test_escpos_encoder_exposes_expected_device_primitives():
    source = ESCPOS.read_text()

    for expected in (
        "escposInitialize",
        "escposAlign",
        "escposBold",
        "escposTextSize",
        "escposFeed",
        "escposCut",
        "escposDrawer",
        "escposQr",
        "escposCode128",
        "escposRasterImage",
        "encodeEscPosDocument",
    ):
        assert expected in source


def test_shared_print_manager_can_encode_and_print_receipts():
    source = RUNTIME.read_text()

    assert "encodeReceipt" in source
    assert "printReceipt" in source
    assert "encodeEscPosDocument" in source
    assert 'documentType: "receipt"' in source


def test_escpos_layer_remains_free_of_product_business_logic():
    source = (DOCUMENT.read_text() + ESCPOS.read_text()).lower()

    for product_term in (
        "retailedge",
        "vetedge",
        "eduedge",
        "posnext",
        "sales invoice",
        "cashier expense",
        "veterinary",
        "student",
    ):
        assert product_term not in source
