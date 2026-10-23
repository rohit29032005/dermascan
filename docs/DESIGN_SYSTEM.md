# Design System

## Brand direction

Calm, trustworthy clinical technology. The current UI is a high-contrast dark interface with blue as the primary medical/interactive accent, restrained motion, generous rounded surfaces, and clear status colors.

## Color palette

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#0A0A0A` | Main page background |
| Surface | `#111111` | Cards, dialogs, elevated areas |
| Surface subtle | `rgba(255,255,255,0.05)` | Borders and quiet panels |
| Text primary | `#FFFFFF` | Headings and primary controls |
| Text muted | `#9CA3AF` | Supporting copy and labels |
| Primary | `#2563EB` | Main actions, selected state, focus |
| Primary hover | `#1D4ED8` | Interactive hover state |
| Success | `#22C55E` | Confirmed/success state |
| Warning | `#F59E0B` | Caution or pending review |
| Danger | `#EF4444` | Errors and destructive feedback |

Use status colors with an icon and text; do not rely on color alone.

## Typography

- **Font:** Geist Sans where loaded by the application; use the system sans-serif fallback.
- **Display heading:** 36–48px, 700–800 weight, tight tracking.
- **Section heading:** 24–30px, 700 weight.
- **Body:** 16px, 400–500 weight, 1.5–1.7 line height.
- **Supporting text:** 12–14px, muted color.
- **Metadata/labels:** 10–12px, 700–800 weight, uppercase with wider letter spacing.

## Layout and spacing

- Use a centered content width of `max-w-7xl` for dashboards and `max-w-4xl` for focused workflows.
- Standard page gutter: `p-4` on narrow viewports and `px-6` from tablet upward.
- Base spacing unit: 4px. Prefer Tailwind’s 4, 8, 12, 16, 24, 32, and 48px increments.
- Keep clinical content in readable columns; do not place dense explanatory text over decorative backgrounds.

## Components

### Buttons

- Primary: blue fill, white text, 14px minimum text, bold uppercase label only where it matches the existing product voice.
- Secondary: dark/translucent surface with a subtle border.
- Destructive: red only for irreversible user-intended actions, with confirmation where appropriate.
- All buttons need visible focus state, disabled state, and a label or accessible name.

### Cards and forms

- Cards use `rounded-2xl` or `rounded-3xl`, a subtle white translucent border, dark surface, and roomy internal padding.
- Inputs use a dark surface, clear label, 44px+ touch target, blue focus ring/border, and inline validation feedback.
- Use native labels and explicit text for sensitive permissions such as location or image upload.

### Feedback and results

- Pair status tone with an icon and plain-language explanation.
- Present medical disclaimer and recommended next action in the same visual area as the result.
- Explain loading in human terms (for example, “Analyzing your image”) rather than exposing internal service names.

## Theme and accessibility rules

- Dark mode is the current default and should remain visually consistent across routes. Do not add a light mode unless all core screens are designed and tested for it.
- Maintain WCAG AA contrast, keyboard navigation, visible focus, semantic controls, and meaningful image alt text.
- Respect reduced-motion preferences; Framer Motion animation must be decorative and never required to understand or operate a flow.

