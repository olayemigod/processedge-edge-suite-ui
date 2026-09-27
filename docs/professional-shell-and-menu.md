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
- `intent` (`create` for generic DocType creation)

The menu automatically supports search, active route highlighting, role visibility, outside-click dismissal, Escape dismissal, navbar remounting, and Desk route changes.

## Native create navigation

Generic ERPNext/Frappe document creation should use the shared EdgeSuite creation contract:

```javascript
window.EdgeSuiteUI.openCreateSurface("Customer");

// Product-owned guarded exception for a restricted operational flow:
window.EdgeSuiteUI.openCreateSurface("Customer", { allowRestricted: true });
```

The runtime delegates to `frappe.new_doc()`, so Frappe remains responsible for the best native creation surface:

- a DocType-specific native create route is honored when one exists;
- Quick Entry-capable DocTypes open native Frappe Quick Entry;
- native Quick Entry retains Frappe's built-in **Edit Full Form** action;
- DocTypes that are not valid for Quick Entry fall through to the full persistent Form;
- create permission is checked through Frappe's client permission helper when available;
- EdgeSuite-only users are denied native creation by default; a product may pass the literal boolean `allowRestricted: true` only after it has established a safe containment policy for any native Form escape;
- existing documents use `openExistingDocument(doctype, name)` and target the persistent native Form; this is also denied in EdgeSuite-only mode unless the product explicitly passes the literal boolean `allowRestricted: true` under a safe containment policy.

Do not maintain a separate EdgeSuite list of Quick Entry DocTypes and do not recreate or force Frappe Quick Entry internals.

When a product supplies its own `navigate(item)` handler, that custom product navigator remains authoritative for role, containment, and product-specific workflow rules. Shared create-intent handling is used only when no custom navigator is supplied.

Product-menu items can explicitly request generic document creation:

```javascript
{
  label: "New Customer",
  link_type: "DocType",
  link_to: "Customer",
  intent: "create",
}
```

Product-owned guided workflows remain separate. Guided Sale, Purchase, Stock Transfer, Expense, Payment, and other purpose-built flows keep their product-specific quick/persistent rules.

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
