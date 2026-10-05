# EdgeSuite UI Modernization V2 — Post-MVP Decision

Status: **Deferred / post-MVP**

Decision date: 2026-10-05

## Decision

ProcessEdge will not install or run Nexus Theme alongside EdgeSuite UI on product sites.

EdgeSuite UI remains the single presentation authority for ProcessEdge product applications. Useful Nexus ideas or MIT-licensed implementation patterns may be selectively adapted later, but they must be implemented inside EdgeSuite contracts rather than introduced as a second global theme, navigation, density, branding, or shortcut runtime.

The broader modernization work is intentionally deferred until the RetailEdge, VetEdge, and EduEdge MVPs are functionally complete and their current shared-UI QA has stabilized.

No runtime, DocType, CSS, JavaScript, navigation, permission, or theme migration work is authorized by this document.

## Why this is deferred

The current product line is still actively validating shared EdgeSuite behavior across RetailEdge, VetEdge, and EduEdge. A broad native-Desk modernization would touch the same surfaces currently being hardened: forms, dialogs, tables, overlays, navigation, mobile behavior, reports, product identity, and shared components.

Introducing a large visual refactor before the MVP boundary would increase regression scope and distract from completing operational workflows.

Until the activation criteria below are met, EdgeSuite changes should be limited to MVP-critical usability, compatibility, accessibility, and defect fixes.

## Presentation authority

ProcessEdge product sites must have one presentation authority: **EdgeSuite UI**.

EdgeSuite owns or coordinates:

- shared visual tokens and component styling;
- ProcessEdge product shell and product menu;
- product switching and navigation behavior;
- Ctrl/Cmd+K behavior exposed by EdgeSuite;
- EdgeSuite density behavior;
- product and tenant identity contracts;
- Frappe Desk visual integration required by ProcessEdge products;
- shared compatibility styling for Frappe controls, dialogs, overlays, and other surfaces consumed by EdgeSuite pages.

Product applications continue to own their pages, workflows, data access, permissions, product-specific presentation, and business logic.

Frappe/ERPNext continues to own native authorization semantics. UI modernization must not create a second permission system.

## Third-party theme policy

Third-party Desk themes or UI frameworks are not supported alongside EdgeSuite when they globally alter responsibilities already owned by EdgeSuite, including:

- navigation or sidebar state;
- keyboard shortcuts such as Ctrl/Cmd+K;
- global density state;
- Frappe design tokens in a way that competes with EdgeSuite token resolution;
- product/tenant branding;
- shell behavior;
- workspace/home routing;
- global theme state.

This applies to Nexus Theme as audited in October 2026.

Nexus Theme should be treated as a reference/source of selected ideas rather than as a ProcessEdge runtime dependency.

## Work allowed before MVP completion

Before the post-MVP modernization programme starts, EdgeSuite work may continue where it is required to complete or stabilize the MVPs, including:

- dark-mode defects and contrast corrections;
- broken Frappe controls, dialogs, dropdowns, overlays, or child-table behavior;
- navigation and product-menu defects;
- Global Create defects;
- mobile/responsive defects;
- table usability and sorting required by product workflows;
- shared printing and device-integration work already required by product applications;
- workflow usability fixes;
- approved product identity and branding fixes;
- shared components required by current RetailEdge, VetEdge, or EduEdge MVP workflows.

These fixes must remain narrow and should not be used as an entry point for the deferred Theme Studio or full native-Desk redesign.

## Deferred initiative: EdgeSuite UI Modernization V2

When activated, the programme should modernize both EdgeSuite product surfaces and the native Frappe/ERPNext surfaces that ProcessEdge users encounter, while preserving one EdgeSuite-owned design system.

Expected scope includes:

### 1. Native Desk modernization

Modernize the Frappe/ERPNext surfaces used by ProcessEdge products, including:

- workspace cards and layouts;
- native Desk sidebar presentation;
- icons and icon presentation;
- list views;
- native forms;
- child tables;
- tabs and page headers;
- buttons and controls;
- dropdowns, popovers, date pickers, and autocomplete surfaces;
- dashboards and reports;
- dialogs and notifications;
- empty states;
- spacing, radius, typography, and visual hierarchy.

The modernization layer must consume EdgeSuite semantic tokens. It must not create an independent theme runtime.

### 2. Accessible theme foundation

Add reusable WCAG contrast utilities, semantic palette generation, light/dark pairing, validation, and governed theme definitions.

Useful Nexus palette-generation and contrast concepts may be adapted under the Nexus MIT license with required attribution where substantial code is reused.

### 3. Theme Studio

Add an EdgeSuite-native Theme Studio with:

- built-in themes;
- tenant/site defaults;
- user-selectable themes where permitted;
- generated themes from a seed brand color;
- accessibility validation;
- semantic-token overrides only;
- live preview against real EdgeSuite/Frappe controls;
- safe import/export if later required.

Arbitrary CSS or JavaScript injection is outside the intended theme contract.

### 4. Shared branding

Add shared ProcessEdge login/site branding and tenant branding without weakening approved product identity contracts.

### 5. Administration tooling

Consider a System-Manager-only permission inspector as a separate administration capability.

The inspector must explain Frappe permissions rather than replace them. Read-only inspection should precede any permission-editing capability. If editing is later introduced, changes should be transactional, auditable, reason-gated, and cache-safe.

### 6. Feedback services

Sound, haptic, and other semantic feedback may be considered later through a product-neutral EdgeSuite feedback API. A generic Sound Studio is not an MVP requirement.

## Capabilities not to import as parallel runtimes

The following Nexus-style responsibilities should not be introduced as separate global systems:

- Theme Manager runtime;
- density runtime;
- sidebar rail/skin runtime;
- command palette ownership;
- native theme-switcher ownership;
- Brand Kit runtime;
- alternate product home/workspace authority;
- automatic Theme User role assignment.

Equivalent capabilities may be implemented later only when they are native to EdgeSuite and respect existing EdgeSuite contracts.

## Activation criteria

EdgeSuite UI Modernization V2 should not begin until all of the following are true:

1. RetailEdge MVP operational workflows are release-ready or explicitly frozen for release.
2. VetEdge MVP operational workflows are release-ready or explicitly frozen for release.
3. EduEdge MVP operational workflows are release-ready or explicitly frozen for release.
4. Current shared EdgeSuite navigation, dark-mode, product identity, forms/dialogs, printing, and mobile QA has no known release-blocking regression.
5. The active EdgeSuite release lineage is clear so the modernization branch does not revive or stack onto obsolete theme/navigation branches.
6. A dedicated modernization QA cycle can be run across RetailEdge, VetEdge, and EduEdge.

## Intended implementation order after activation

The recommended order is:

1. Native Frappe/ERPNext visual modernization baseline.
2. Unified icon, workspace, sidebar, form, list, table, and overlay presentation.
3. EdgeSuite semantic theme/contrast foundation.
4. Accessible palette generator.
5. Theme Definition, settings, and preference governance.
6. EdgeSuite Theme Studio.
7. Tenant/site branding and shared login branding.
8. Permission Inspector as a separate administration stream.
9. Optional semantic sound/haptic feedback.

This order deliberately establishes the stable ProcessEdge visual language before exposing deep theme customization.

## QA expectation

When the programme begins, each slice should pass the existing EdgeSuite validation model and add coverage for the new native-Desk surfaces. At minimum the release candidate should be validated against RetailEdge, EduEdge, and VetEdge on desktop and mobile-responsive breakpoints.

Theme and native-Desk modernization must prove both light and dark behavior for forms, controls, dialogs, overlays, workspaces, sidebars, lists, tables, reports, and product shells.

## Non-negotiable boundaries

The post-MVP programme must preserve these rules:

- no Nexus app dependency;
- no parallel global theme runtime;
- no second Ctrl/Cmd+K owner;
- no second sidebar state authority;
- no second density state authority;
- no arbitrary custom JavaScript through themes;
- no automatic Theme User role;
- no theme feature that changes business authorization;
- no Permission Inspector bypass of Frappe permissions;
- no product-specific business logic inside EdgeSuite;
- no broad visual rollout without downstream product QA.

In short: one EdgeSuite runtime, one navigation authority, one density authority, one branding contract, and one coherent ProcessEdge design system.
