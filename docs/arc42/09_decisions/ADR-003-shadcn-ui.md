# ADR-003: Use shadcn/ui Instead of a Custom Design System

**Status:** Accepted  
**Date:** 2024-01-01

## Context

The dashboard requires a consistent set of UI components: buttons, cards, inputs, dialogs, labels. Options considered:

1. **Build a custom component library** from scratch using Tailwind CSS primitives
2. **shadcn/ui** — a collection of copy-paste components built on Radix UI primitives and styled with Tailwind CSS
3. **A fully managed library** (MUI, Chakra UI, Ant Design) with its own styling system

## Decision

Use **shadcn/ui** as the component foundation.

## Rationale

- **No runtime dependency.** shadcn/ui components are copied into the project and owned by the team. There is no `import from "shadcn"` — the components live in `/components/ui/` and can be modified freely.
- **Built on Radix UI primitives.** Accessibility (keyboard navigation, ARIA roles, focus management) is handled by Radix UI, which has a strong track record. The team does not need to re-implement these correctly.
- **Tailwind-native.** Components use Tailwind utility classes, consistent with the rest of the styling approach. No CSS-in-JS, no separate stylesheet to manage.
- **Custom design systems rejected** — too slow for MVP. A custom library has no accessibility guarantees and requires significant maintenance effort.
- **MUI/Chakra rejected** — these libraries bring their own styling system (Emotion, CSS-in-JS) which conflicts with the Tailwind-only constraint and adds bundle weight.

## Consequences

**Positive:**
- Accessible, consistent components available immediately
- No version mismatch risk between the component library and the app's styling
- Components can be customised or extended without monkey-patching a third-party package

**Negative:**
- Updating to newer shadcn/ui versions requires manual comparison and selective copy-paste, not a `npm update`
- The `/components/ui/` directory must not be edited (convention enforced in `CLAUDE.md`) to preserve the ability to re-generate components
