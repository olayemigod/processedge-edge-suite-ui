# EdgeSuite UI Empty-State Icon Contract

## Problem

`EdgeEmptyState` historically accepted an `icon` string but rendered the string as text. A consumer using:

```vue
<EdgeEmptyState icon="search" />
```

therefore displayed the word `search` instead of the shared SVG search icon.

## Corrected behaviour

EdgeSuite UI 0.5.5 treats the `icon` prop as an EdgeSuite icon name.

The component now renders the icon through the shared `EdgeIcon` component and icon registry.

```vue
<EdgeEmptyState
  title="No matching records"
  description="Adjust the filters and try again."
  icon="search"
/>
```

## Backward compatibility

The existing contract remains stable:

- `title`, `description`, `actionLabel`, and `icon` props remain supported;
- the `action` event remains supported;
- a custom `#icon` slot still takes priority over the icon-name prop;
- a custom `#actions` slot remains supported;
- the component remains available as `EdgeEmptyState` in the global runtime registry;
- the named module export `EdgeEmptyState` resolves to the same icon-aware component.

## Runtime registration

The base component remains available internally for compatibility. The runtime registry installs the icon-aware override after the base component map so all product consumers receive the corrected behaviour without local patches.

## Product impact

This corrects empty states across RetailEdge, VetEdge, EduEdge, and future EdgeSuite products when they use a shared icon name such as:

- `search`
- `report`
- `clipboard`
- `building`
- `wallet`

Products should not render their own SVG or duplicate the shared component to work around this behaviour.

## Validation

The contract tests verify:

1. icon names render through `EdgeIcon`;
2. custom icon slots take priority;
3. custom action slots and the `action` event remain supported;
4. the override is registered after the base components;
5. the canonical named export points to the icon-aware component;
6. the frontend bundle can include the new module.
