# EdgeSuite UI Professional Shell and Product Menu

## Goal

The professional EdgeSuite UI layer gives every ProcessEdge product a consistent, simple, responsive, and brand-aware interface without moving product business logic into the shared UI app.

The design follows these principles:

- clear hierarchy before decoration;
- enough breathing space without wasting screen area;
- small, purposeful colour accents;
- consistent cards, buttons, filters, and status states;
- SVG icons rather than text characters or emoji;
- responsive behaviour compatible with Frappe and Bootstrap breakpoints;
- product identity through CSS variables rather than copied component implementations.

## Shared shell

`EdgeAppShell` accepts the existing properties and adds optional professional metadata:

- `product`
- `title`
- `subtitle`
- `tenantName`
- `branchName`
- `userName`
- `menuItems`
- `activeRoute`
- `showSidebar`

It continues to emit `navigate` with the selected route.

### Grouped menu structure

Preferred structure:

```javascript
const menuItems = [
  {
    label: "Overview",
    icon: "home",
    items: [
      {
        label: "Home",
        route: "/app/product-home",
        icon: "home",
        description: "Operational command centre",
      },
    ],
  },
  {
    label: "Operations",
    icon: "activity",
    items: [
      {
        label: "Daily Operations",
        route: "/app/product-operations",
        icon: "calendar",
        description: "Run high-frequency work",
        badge: "New",
      },
    ],
  },
];
```

A legacy flat list remains valid:

```javascript
const menuItems = [
  {
    section: "Operations",
    sectionIcon: "activity",
    label: "Daily Operations",
    route: "/app/product-operations",
    icon: "calendar",
  },
];
```

## Product menu

Register the global product menu after `edgeui.bundle.js` is available:

```javascript
window.EdgeSuiteUI.registerProductMenu({
  product: "EduEdge",
  subtitle: "School operations and intelligence",
  profile: {
    name: frappe.boot?.user?.full_name,
    email: frappe.session?.user,
    company: frappe.defaults?.get_default?.("company"),
    branch: frappe.defaults?.get_user_default?.("eduedge_school_branch"),
  },
  sections: [
    {
      label: "School Operations",
      description: "Admissions, students, classes, and attendance",
      icon: "graduation",
      items: [
        {
          label: "Students",
          description: "Student records and profiles",
          icon: "students",
          link_type: "DocType",
          link_to: "Student",
        },
      ],
    },
  ],
});
```

Supported item properties:

- `label`
- `description`
- `icon`
- `badge`
- `keywords`
- `roles`
- `visible`
- `hidden`
- `route`
- `link_type`
- `link_to`

The menu automatically supports search, active route highlighting, role visibility, outside-click dismissal, Escape dismissal, navbar remounting, and Desk route changes.

## SVG icon contract

Use semantic icon names rather than emoji or initials.

Built-in names include:

- `home`
- `grid`
- `graduation`
- `students`
- `user`
- `book`
- `calendar`
- `clipboard`
- `assessment`
- `report`
- `chart`
- `layers`
- `building`
- `shield`
- `settings`
- `wallet`
- `bell`
- `search`

EdgeSuite UI first asks Frappe for an icon with the same name. When Frappe does not provide one, the shared local SVG library supplies a safe fallback. Icons use `currentColor`, so active, hover, warning, and brand states remain consistent.

## Brand colours

Shared default colours are professional blue with restrained green accent.

EduEdge applies:

- primary blue `#1f6feb`;
- deeper action blue `#185fc8`;
- accent green `#22a06b`;
- pale blue and green surfaces for selected and contextual states.

Products may override shared CSS variables at their root without copying the shell.

## Spacing and responsiveness

Important shared tokens:

- `--edge-page-padding`
- `--edge-section-gap`
- `--edge-card-gap`
- `--edge-content-max-width`
- `--edge-sidebar-width`
- `--edge-topbar-height`

The shell uses responsive CSS aligned with common Bootstrap ranges:

- desktop: persistent sidebar and two-column product menu;
- smaller laptop/tablet: narrower sidebar and reduced optional descriptions;
- tablet/mobile: off-canvas sidebar with backdrop;
- mobile: stacked page actions and one-column product menu.

Product pages should continue using Bootstrap/Frappe controls where practical. EdgeSuite UI standardises their spacing, radius, focus ring, and layout rather than replacing every native control.

## Native Frappe sidebar

The professional stylesheet also refines native Frappe Workspace sidebars for named EdgeSuite workspaces, including EduEdge and VetEdge.

It preserves Frappe behaviour while applying:

- consistent item height and padding;
- rounded hover and active states;
- SVG icon tiles using `currentColor`;
- compact section headings;
- visible keyboard focus;
- brand-coloured active indicator.

## Safety and compatibility

- Existing flat menu arrays remain supported.
- Existing product pages do not need business-logic rewrites.
- `window.EdgeUI` remains an alias during migration.
- EdgeSuite UI does not import CoreEdge or any product app.
- Products remain responsible for permission-aware menu definitions and backend validation.
- Product-local fallbacks should be removed only after browser QA confirms the shared renderer is stable.
