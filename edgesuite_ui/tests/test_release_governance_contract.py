import json
import re
from pathlib import Path

from edgesuite_ui import __version__

ROOT = Path(__file__).resolve().parents[2]
POLICY = json.loads((ROOT / "release-governance.json").read_text(encoding="utf-8"))
PACKAGE = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
RUNTIME = (ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js").read_text(encoding="utf-8")


def test_release_line_is_one_x_or_newer_and_matches_all_authoritative_surfaces():
	match = re.search(r'EDGE_SUITE_UI_VERSION\s*=\s*"([^"]+)"', RUNTIME)
	assert match
	assert int(__version__.split(".", maxsplit=1)[0]) >= 1
	assert POLICY["release_line"] == f"{__version__.split('.', maxsplit=1)[0]}.x"
	assert POLICY["highest_established_version"] == __version__
	assert PACKAGE["version"] == __version__
	assert match.group(1) == __version__


def test_progressive_development_governance_is_source_controlled():
	assert POLICY["progression_policy"] == "continue-stack-reconcile"
	assert POLICY["authoritative_branch"] == "main"
	assert (ROOT / "scripts" / "check_release_governance.py").is_file()
	assert (ROOT / "docs" / "development-lineage-governance.md").is_file()
	assert (ROOT / ".github" / "pull_request_template.md").is_file()


def test_governance_policy_forbids_version_regression_and_isolated_release_lines():
	script = (ROOT / "scripts" / "check_release_governance.py").read_text(encoding="utf-8")
	documentation = (ROOT / "docs" / "development-lineage-governance.md").read_text(encoding="utf-8")
	assert "Version regression blocked" in script
	assert "previous_version_floor" in script
	assert "Authoritative predecessor" in script
	assert "Divergence check" in script
	assert "One release authority" in documentation
	assert "Do not create a parallel branch from an older baseline" in documentation
