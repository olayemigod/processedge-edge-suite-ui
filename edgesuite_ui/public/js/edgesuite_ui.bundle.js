// Canonical standalone EdgeSuite UI entry point.
//
// The unique bundle name prevents Frappe asset-manifest collisions with the
// legacy CoreEdge `edgeui.bundle.js` while retaining the old entry point for
// downstream pages that have not yet migrated.
export * from "./edgeui.bundle";
export { default } from "./edgeui.bundle";
