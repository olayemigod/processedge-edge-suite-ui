from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui" / "report_shell_actions.js"


def test_report_shell_tracks_partial_columns_before_async_schema_expands():
    source = SOURCE.read_text(encoding="utf-8")

    for expected in (
        "availableColumnKeys: []",
        "const previousAvailable = Array.isArray(this.availableColumnKeys)",
        "const newlyAvailable = available.filter",
        "const columnsExpanded = newlyAvailable.length > 0 && previousAvailable.length > 0",
        "columnsExpanded",
        "currentValid.includes(key) || newlyAvailable.includes(key)",
        "this.availableColumnKeys = [...available]",
    ):
        assert expected in source


def test_explicit_visible_column_state_remains_authoritative_during_schema_expansion():
    source = SOURCE.read_text(encoding="utf-8")

    assert "const explicitVisibleColumns" in source
    assert "Array.isArray(this.viewState?.visible_columns)" in source
    assert "requested = explicitVisibleColumns" in source
    assert "? this.viewState?.visible_columns" in source
