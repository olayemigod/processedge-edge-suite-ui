from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "release-governance.json"
PY_VERSION_PATH = ROOT / "edgesuite_ui" / "__init__.py"
PACKAGE_PATH = ROOT / "package.json"
RUNTIME_PATH = ROOT / "edgesuite_ui" / "public" / "js" / "edgeui.bundle.js"
SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


class GovernanceError(RuntimeError):
	pass


def parse_version(value: str) -> tuple[int, int, int]:
	match = SEMVER.fullmatch(value.strip())
	if not match:
		raise GovernanceError(f"Release-governance versions must be stable SemVer x.y.z; got {value!r}.")
	return tuple(int(part) for part in match.groups())


def extract_python_version(text: str) -> str:
	match = re.search(r'^__version__\s*=\s*["\']([^"\']+)["\']', text, re.MULTILINE)
	if not match:
		raise GovernanceError("Could not read edgesuite_ui.__version__.")
	return match.group(1)


def extract_runtime_version(text: str) -> str:
	match = re.search(r'EDGE_SUITE_UI_VERSION\s*=\s*["\']([^"\']+)["\']', text)
	if not match:
		raise GovernanceError("Could not read browser EDGE_SUITE_UI_VERSION.")
	return match.group(1)


def read_current_versions() -> dict[str, str]:
	return {
		"python": extract_python_version(PY_VERSION_PATH.read_text(encoding="utf-8")),
		"npm": json.loads(PACKAGE_PATH.read_text(encoding="utf-8"))["version"],
		"browser": extract_runtime_version(RUNTIME_PATH.read_text(encoding="utf-8")),
	}


def git_show(ref: str, path: str) -> str | None:
	result = subprocess.run(
		["git", "show", f"{ref}:{path}"],
		cwd=ROOT,
		capture_output=True,
		text=True,
		check=False,
	)
	return result.stdout if result.returncode == 0 else None


def previous_version_floor(base_ref: str | None, minimum: str) -> str:
	if not base_ref:
		return minimum

	remote_ref = f"origin/{base_ref}"
	policy_text = git_show(remote_ref, "release-governance.json")
	if policy_text:
		policy = json.loads(policy_text)
		return policy["highest_established_version"]

	python_text = git_show(remote_ref, "edgesuite_ui/__init__.py")
	if not python_text:
		return minimum
	base_version = extract_python_version(python_text)
	return max((minimum, base_version), key=parse_version)


def validate_pr_lineage() -> None:
	if os.environ.get("GITHUB_EVENT_NAME") != "pull_request":
		return

	event_path = os.environ.get("GITHUB_EVENT_PATH")
	if not event_path:
		raise GovernanceError("GITHUB_EVENT_PATH is missing for pull-request governance validation.")
	payload = json.loads(Path(event_path).read_text(encoding="utf-8"))
	body = (payload.get("pull_request") or {}).get("body") or ""

	required = {
		"Integration mode": r"(?mi)^Integration mode:\s*(continue|stack|reconcile)\s*$",
		"Authoritative predecessor": r"(?mi)^Authoritative predecessor:\s*\S.+$",
		"Capability preservation": r"(?mi)^Capability preservation:\s*\S.+$",
		"Divergence check": r"(?mi)^Divergence check:\s*\S.+$",
		"Version impact": r"(?mi)^Version impact:\s*\S.+$",
		"Release authority": r"(?mi)^Release authority:\s*yes\s*$",
	}
	missing = [label for label, pattern in required.items() if not re.search(pattern, body)]
	if missing:
		raise GovernanceError(
			"PR lineage metadata is incomplete. Missing/invalid: " + ", ".join(missing)
		)

	mode_match = re.search(required["Integration mode"], body)
	if mode_match and mode_match.group(1).lower() == "reconcile":
		if not re.search(r"(?mi)^Source lines:\s*\S.+$", body):
			raise GovernanceError("Reconciliation PRs must declare Source lines: ...")


def main() -> int:
	policy = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
	minimum = policy["minimum_supported_version"]
	highest = policy["highest_established_version"]
	current_versions = read_current_versions()

	parse_version(minimum)
	parse_version(highest)
	if parse_version(highest) < parse_version(minimum):
		raise GovernanceError("highest_established_version cannot be below minimum_supported_version.")

	for surface, value in current_versions.items():
		parse_version(value)
		if value != highest:
			raise GovernanceError(
			f"{surface} version {value} does not match release ledger {highest}. "
			"All authoritative version surfaces must move together."
		)

	base_ref = os.environ.get("GITHUB_BASE_REF")
	previous_floor = previous_version_floor(base_ref, minimum)
	if parse_version(highest) < parse_version(previous_floor):
		raise GovernanceError(
			f"Version regression blocked: candidate {highest} is below established {previous_floor}."
		)

	if not str(policy.get("release_line", "")).startswith(f"{parse_version(highest)[0]}."):
		raise GovernanceError("release_line must match the major version in highest_established_version.")

	validate_pr_lineage()
	print(
		"EdgeSuite release governance PASS: "
		f"version={highest}, previous_floor={previous_floor}, mode={policy['progression_policy']}"
	)
	return 0


if __name__ == "__main__":
	try:
		raise SystemExit(main())
	except GovernanceError as exc:
		print(f"Release governance FAIL: {exc}", file=sys.stderr)
		raise SystemExit(1) from exc
