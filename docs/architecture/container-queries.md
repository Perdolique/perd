# Container queries

Responsive CSS decision rules live here as architecture guidance, not as roadmap work.

## Decision rule

- Use `@container` when a component should adapt to the width it receives from its parent layout.
- Keep `@media` when the behavior depends on the viewport, app shell mode, or environment preferences rather than local component width.

## Current audit

- `app/components/layout/PageContent.vue` uses `container-type: inline-size` because the header layout depends on available content width.
- Keep `app/components/PageHeader.vue` on `@media`: the sidebar toggle and shell spacing are coupled to mobile vs desktop navigation behavior.
- Keep `app/components/PerdSidebar/PerdSidebar.vue` on `@media`: overlay visibility, off-canvas behavior, and desktop collapsed mode are viewport-shell concerns.
- Keep `app/pages/login.vue` mostly on `@media`: fullscreen centering and card presentation depend on the screen. Revisit the button row only if the card becomes reusable outside the login page shell.
- Keep `app/assets/styles/colors.css` on `@media`: `prefers-color-scheme` is an environment query, not a container concern.

## Verification

- Keep at least one real `PageContent` screen with an `actions` slot covered in Playwright.
- Add or keep a focused assertion that the header stacks when the `PageContent` container is narrowed inside a wide viewport, so the test proves container-driven behavior rather than viewport-driven behavior.
- Re-run the existing responsive smoke around login and sidebar shell behavior to catch regressions in rules that intentionally stay on `@media`.