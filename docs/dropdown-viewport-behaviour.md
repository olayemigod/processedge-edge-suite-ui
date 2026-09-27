# EdgeDropdown viewport behaviour

EdgeDropdown menus must remain usable when the trigger is close to the bottom of the visible viewport.

The shared dropdown viewport runtime:

- measures available space above and below an open EdgeDropdown;
- opens upward when there is not enough useful space below and more space is available above;
- constrains menu height to the available viewport space;
- recalculates after click, keyboard interaction, resize, and scroll;
- does not poll and does not use MutationObserver;
- does not alter product data, permissions, or field values.

This behaviour is product-neutral and applies to VetEdge, RetailEdge, EduEdge, and other EdgeSuite consumers.
