# Changelog

## Unreleased

- Free placement: cities use absolute `px, py` with overlay rendering
- Added DB columns `px, py` and API support for cities
- Removed tile visuals and numbers; kept grid only for math
- Pixel-based non-overlap for cities with drag ghost preview
- Mobile drag UX: long-press to drag, map scroll locks during drag
- Desktop drag UX: ghost follows cursor; drop to save
- Bear traps: long-press on trap tiles to move (2x2/3x3), with ghost preview
- Menu cleanup: removed Tile Size and City Scale; kept Zoom and Bear Trap Size
- Allow multiple cities per tile on server (client prevents visual overlap)
- Added trap legend dynamic update and overlay sizing
- Various bug fixes (touch event coordinates, context menu suppression)

