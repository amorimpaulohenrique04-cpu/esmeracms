# Esméra Design System

This boundary is intentionally created in Stage 1 before visual reconstruction begins.

Stage 2 will place tokens and Esméra-owned UI primitives here. Base UI may be used underneath accessible primitives, but no third-party visual language becomes the source of truth.

Rules:

- Inter remains the only custom operational UI font;
- CSS/SCSS + CSS variables remain the styling foundation;
- no global Tailwind migration;
- Base UI is infrastructure, not appearance;
- reusable controls belong here, feature-specific composition belongs in `src/admin/modules/*`.
