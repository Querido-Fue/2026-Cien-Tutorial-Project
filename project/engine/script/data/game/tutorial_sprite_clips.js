import { TUTORIAL_LOGICAL_SPRITE_FRAME_SIZE } from './tutorial_sprites/_tutorial_sprite_clip_entry.js';
import { TUTORIAL_LORA_SPRITE_CLIPS } from './tutorial_sprites/_tutorial_lora_sprite_clips.js';
import { TUTORIAL_PLAYER_SPRITE_CLIPS } from './tutorial_sprites/_tutorial_player_sprite_clips.js';
import { TUTORIAL_SLIME_SPRITE_CLIPS } from './tutorial_sprites/_tutorial_slime_sprite_clips.js';

const clipList = Object.freeze([
    ...TUTORIAL_PLAYER_SPRITE_CLIPS,
    ...TUTORIAL_LORA_SPRITE_CLIPS,
    ...TUTORIAL_SLIME_SPRITE_CLIPS
]);

export const TUTORIAL_SPRITE_CLIPS = Object.freeze({
    VERSION: 2,
    LOGICAL_FRAME_SIZE: TUTORIAL_LOGICAL_SPRITE_FRAME_SIZE,
    CLIPS: Object.freeze(Object.fromEntries(clipList.map((clip) => [clip.id, clip])))
});
