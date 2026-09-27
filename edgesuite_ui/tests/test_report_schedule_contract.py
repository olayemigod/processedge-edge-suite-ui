from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "edgesuite_ui"
SOURCE = APP / "public/js/edgeui/report_schedule.js"
BUNDLE = APP / "public/js/edgeui.bundle.js"


def test_schedule_dialog_is_shared_product_neutral_and_bounded():
    source = SOURCE.read_text(encoding="utf-8")

    for expected in (
        'name: "EdgeReportScheduleDialog"',
        'REPORT_SCHEDULE_FREQUENCIES = Object.freeze(["Daily", "Weekdays", "Weekly", "Monthly"])',
        'REPORT_SCHEDULE_FORMATS = Object.freeze(["XLSX", "CSV", "PDF", "HTML"])',
        "Math.min(5000",
        'emits: ["close", "schedule"]',
        'title: "Schedule delivery"',
        '"Create schedule"',
    ):
        assert expected in source

    for forbidden in (
        "frappe.call",
        "frappe.db",
        "Auto Email Report",
        "advanced_reports",
        "VetEdge",
        "RetailEdge",
        "EduEdge",
        "scheduler_events",
    ):
        assert forbidden not in source


def test_schedule_dialog_supports_recipients_weekly_day_send_if_data_and_columns():
    source = SOURCE.read_text(encoding="utf-8")

    for expected in (
        'email_to: String(options.email_to || "").trim()',
        'frequency === "Weekly"',
        'day_of_week: dayOfWeek',
        'send_if_data: options.send_if_data !== false',
        'columns: Array.isArray(options.columns)',
        '"Recipients"',
        '"Day of week"',
        '"Send only when the report contains data"',
        '"Columns"',
    ):
        assert expected in source


def test_bundle_exposes_schedule_component_without_product_policy():
    bundle = BUNDLE.read_text(encoding="utf-8")

    assert 'import { reportScheduleComponents } from "./edgeui/report_schedule"' in bundle
    assert "...reportScheduleComponents" in bundle
    assert 'export * from "./edgeui/report_schedule"' in bundle
