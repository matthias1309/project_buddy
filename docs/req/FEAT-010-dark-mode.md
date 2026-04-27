# FEAT-010: Dark Mode Toggle

**As a** project manager  
**I want to** switch between light and dark mode on any page  
**so that** I can use the dashboard comfortably in different lighting conditions.

## Background

The project already ships dark-mode CSS variables (`.dark` class in `globals.css`) and
Tailwind is configured with `darkMode: ["class"]`. Only a toggle mechanism and persistence
layer are missing.

## Acceptance Criteria

- [ ] AC1: A toggle button (sun/moon icon) is visible in the top-right navigation bar on every dashboard page.
- [ ] AC2: Clicking the toggle switches between light and dark mode immediately without a full page reload.
- [ ] AC3: The selected mode persists across page navigations and browser restarts (stored in `localStorage`).
- [ ] AC4: On first visit the system preference (`prefers-color-scheme`) is used as the default.
- [ ] AC5: The toggle is also visible on the login page.
- [ ] AC6: No flash of unstyled content (FOUC) on initial page load.

## Technical Notes

- Use `next-themes` for SSR-safe theme management; it injects the `dark` class on `<html>` without hydration mismatch.
- Wrap the root layout with `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`).
- `ThemeToggle` is a Client Component in `/components/shared/theme-toggle.tsx` using `useTheme` from `next-themes`.
- The toggle button uses shadcn `Button` (variant `ghost`, size `icon`) with Lucide icons `Sun` / `Moon`.
- Mount-guard (`mounted` state) prevents hydration mismatch by rendering a placeholder until client-side.
