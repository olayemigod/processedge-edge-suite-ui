const SVG_ICONS = Object.freeze({
  activity: '<path d="M4 13h4l2-7 4 12 2-5h4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>',
  assessment: '<path d="M7 3.75h10a2 2 0 0 1 2 2v14.5H5V5.75a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 8h8M8 12h8M8 16h5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  bell: '<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0v3.2l1.3 2.3H5.2l1.3-2.3V9.5Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/><path d="M10 18a2.2 2.2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  book: '<path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h5v16H7a2.5 2.5 0 0 0-2.5 2V5.5Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/><path d="M19.5 5.5A2.5 2.5 0 0 0 17 3h-5v16h5a2.5 2.5 0 0 1 2.5 2V5.5Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/>',
  building: '<path d="M5 21V5l7-3 7 3v16M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1M3 21h18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7.5 3v5M16.5 3v5M3.5 10h17" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8"/>',
  check: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m8 12 2.6 2.6L16.5 9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>',
  "chevron-down": '<path d="m6.5 9.5 5.5 5 5.5-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  close: '<path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.9"/>',
  graduation: '<path d="m3 9 9-5 9 5-9 5-9-5Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/><path d="M7 12v4c3 2.7 7 2.7 10 0v-4M21 9v6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"/>',
  grid: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="14" width="6.5" height="6.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  home: '<path d="m3 11 9-8 9 8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"/><path d="M5.5 9.5V21h13V9.5M9.5 21v-7h5v7" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.9"/>',
  report: '<path d="M6 3.5h9l3 3V20.5H6v-17Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/><path d="M15 3.5v4h4M9 11h6M9 15h6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.5 15.5 5 5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8"/>',
  settings: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 14.8 6l-.3-2.6h-4L10.2 6a8 8 0 0 0-1.7 1.1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1.1l.3 2.6h4l.3-2.6a8 8 0 0 0 1.7-1.1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35"/>',
  shield: '<path d="M12 3 20 6v5c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10V6l8-3Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/><path d="m8.5 12 2.2 2.2 4.8-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"/>',
  stethoscope: '<path d="M6 3v5a4 4 0 0 0 8 0V3M4 3h4M12 3h4M10 12v2.5a5.5 5.5 0 0 0 11 0V13" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"/><circle cx="19" cy="10.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  students: '<circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 5.5a3 3 0 0 1 0 5.8M16.5 14a5 5 0 0 1 4 4.9V20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  user: '<circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 21v-2a7 7 0 0 1 14 0v2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>',
  wallet: '<path d="M4 6.5h13a2 2 0 0 1 2 2V19H5a2 2 0 0 1-2-2V6.5Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/><path d="M4 6.5 16 3v3.5M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/>',
});

const ALIASES = Object.freeze({
  "academic-operations": "book",
  admissions: "clipboard",
  applicants: "user",
  assessments: "assessment",
  "branch-governance": "shield",
  branches: "building",
  classes: "calendar",
  dashboard: "grid",
  education: "graduation",
  expand: "chevron-down",
  "program-offerings": "layers",
  "report-cards": "report",
  school: "graduation",
  setup: "settings",
  users: "students",
  veterinary: "stethoscope",
  vet: "stethoscope",
});

export function normalizeEdgeIconName(name) {
  const value = String(name || "list").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return ALIASES[value] || value || "list";
}

export function edgeIconMarkup(name, { size = "sm", target = globalThis } = {}) {
  const iconName = normalizeEdgeIconName(name);
  try {
    const frappeIcon = target?.frappe?.utils?.icon?.(iconName, size);
    if (typeof frappeIcon === "string" && frappeIcon.trim()) return frappeIcon;
  } catch (_error) {
    // Continue to the independent local SVG set.
  }
  const body = SVG_ICONS[iconName] || SVG_ICONS.list;
  return `<svg class="edge-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function productInitials(value) {
  return String(value || "EdgeSuite")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "ES";
}
