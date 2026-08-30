export const LORA_STATUS_PANEL_LAYOUT = Object.freeze({
    SOURCE: Object.freeze({ WIDTH: 247, HEIGHT: 90 }),
    PORTRAIT_VIEWPORT: Object.freeze({ X: 0, Y: 0, WIDTH: 55, HEIGHT: 56 }),
    PORTRAIT_SCALE: 1.22,
    PORTRAIT_VISUAL_CENTER: Object.freeze({ X: 0.55, Y: 0.4 }),
    PORTRAIT_MOOD_VISUAL_CENTER: Object.freeze({ X: 0.55, Y: 0.45 }),
    PORTRAIT_CLIP: Object.freeze([
        Object.freeze({ X: 25, Y: 6 }),
        Object.freeze({ X: 49, Y: 27 }),
        Object.freeze({ X: 25, Y: 50 }),
        Object.freeze({ X: 6, Y: 27 })
    ]),
    PORTRAIT_FRAME_CLIPS: Object.freeze([
        Object.freeze([
            Object.freeze({ X: 0, Y: 27 }),
            Object.freeze({ X: 25, Y: 0 }),
            Object.freeze({ X: 25, Y: 6 }),
            Object.freeze({ X: 6, Y: 27 })
        ]),
        Object.freeze([
            Object.freeze({ X: 25, Y: 0 }),
            Object.freeze({ X: 55, Y: 27 }),
            Object.freeze({ X: 49, Y: 27 }),
            Object.freeze({ X: 25, Y: 6 })
        ]),
        Object.freeze([
            Object.freeze({ X: 55, Y: 27 }),
            Object.freeze({ X: 25, Y: 56 }),
            Object.freeze({ X: 25, Y: 50 }),
            Object.freeze({ X: 49, Y: 27 })
        ]),
        Object.freeze([
            Object.freeze({ X: 25, Y: 56 }),
            Object.freeze({ X: 0, Y: 27 }),
            Object.freeze({ X: 6, Y: 27 }),
            Object.freeze({ X: 25, Y: 50 })
        ])
    ]),
    STATUS_LINES: Object.freeze([
        Object.freeze({ X: 62, Y: 11, WIDTH: 158, HEIGHT: 14 }),
        Object.freeze({ X: 62, Y: 27, WIDTH: 158, HEIGHT: 14 })
    ]),
    STATUS_FONT_SCALE: 0.812,
    STATUS_MIN_FONT_PX: 8,
    HP_VALUE: Object.freeze({ X: 123, Y: 47, WIDTH: 20, HEIGHT: 8 }),
    HP_BAR: Object.freeze({ X: 62, Y: 56, WIDTH: 149, HEIGHT: 4 }),
    INSTABILITY_BAR: Object.freeze({ X: 51, Y: 70, WIDTH: 149, HEIGHT: 4 }),
    INSTABILITY_VALUE: Object.freeze({ X: 123, Y: 73, WIDTH: 20, HEIGHT: 8 })
});

export const ITEM_DESCRIPTION_PANEL_LAYOUT = Object.freeze({
    SOURCE: Object.freeze({ WIDTH: 86, HEIGHT: 128 }),
    TITLE: Object.freeze({ X: 10, Y: 2, WIDTH: 66, HEIGHT: 10 }),
    TOP_ORNAMENT_BOTTOM_Y: 24,
    STATUS: Object.freeze({ X: 10, Y: 25, WIDTH: 66, HEIGHT: 10 }),
    DESCRIPTION: Object.freeze({ X: 14, Y: 29, WIDTH: 58, HEIGHT: 64 }),
    PAGE: Object.freeze({ X: 22, Y: 94, WIDTH: 42, HEIGHT: 8 }),
    MAX_DESCRIPTION_LINES: 5,
    STATUS_DESCRIPTION_GAP_MULTIPLIER: 1.6,
    DESCRIPTION_LINE_HEIGHT_MULTIPLIER: 1.3
});
