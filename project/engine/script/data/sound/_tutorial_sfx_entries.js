import { createTutorialAudioEntry } from './_tutorial_audio_entry.js';

export const TUTORIAL_SFX_IDS = Object.freeze({
    PLAYER_FOOTSTEP: 'sfx.player.footstep',
    PLAYER_MELEE: 'sfx.player.melee',
    PLAYER_RANGED: 'sfx.player.ranged',
    PLAYER_HEAL: 'sfx.player.heal',
    PLAYER_HURT: 'sfx.player.hurt',
    PLAYER_DEATH: 'sfx.player.death',
    LORA_MELEE: 'sfx.lora.melee',
    LORA_AREA: 'sfx.lora.area',
    LORA_HURT: 'sfx.lora.hurt',
    LORA_DEATH: 'sfx.lora.death',
    LORA_HEAVY_BREATHING: 'loop.lora.heavy-breathing',
    SLIME_HURT: 'sfx.slime.hurt',
    ITEM_EQUIP: 'sfx.item.equip',
    ITEM_APPLY: 'sfx.item.apply',
    TELEPORT: 'sfx.world.teleport',
    FLOOR_BREAK: 'sfx.world.floor-break',
    DIAGNOSTIC_SAMPLE: 'legacy.diagnostic.sample'
});

const effect = (id, sourceName, runtimeName, options = {}) => createTutorialAudioEntry({
    id,
    sourceName,
    runtimePath: `../asset/tutorial/audio/sfx/${runtimeName}.mp3`,
    bus: 'sfx',
    loop: false,
    defaultVolume: 1,
    polyphony: 2,
    cooldownSeconds: 0.06,
    required: true,
    ...options
});

export const TUTORIAL_SFX_ENTRIES = Object.freeze([
    effect(TUTORIAL_SFX_IDS.PLAYER_FOOTSTEP, 'audio/special effects/player_footstep.mp3', 'player-footstep', {
        polyphony: 2, cooldownSeconds: 0.08, defaultVolume: 0.7
    }),
    effect(TUTORIAL_SFX_IDS.PLAYER_MELEE, 'audio/special effects/player_meleeattack.mp3', 'player-melee'),
    effect(TUTORIAL_SFX_IDS.PLAYER_RANGED, 'audio/special effects/player_arrowattack.mp3', 'player-ranged'),
    effect(TUTORIAL_SFX_IDS.PLAYER_HEAL, 'audio/special effects/player_heal.mp3', 'player-heal', {
        polyphony: 1, cooldownSeconds: 0.12
    }),
    effect(TUTORIAL_SFX_IDS.PLAYER_HURT, 'audio/special effects/player_hurt.mp3', 'player-hurt'),
    effect(TUTORIAL_SFX_IDS.PLAYER_DEATH, 'audio/special effects/player_death.mp3', 'player-death', {
        polyphony: 1, cooldownSeconds: 0.2
    }),
    effect(TUTORIAL_SFX_IDS.LORA_MELEE, 'audio/special effects/lora_meleeattack.mp3', 'lora-melee'),
    effect(TUTORIAL_SFX_IDS.LORA_AREA, 'audio/special effects/lora_soundwaveattack.mp3', 'lora-area'),
    effect(TUTORIAL_SFX_IDS.LORA_HURT, 'audio/special effects/lora_hurt.mp3', 'lora-hurt'),
    effect(TUTORIAL_SFX_IDS.LORA_DEATH, 'audio/special effects/lora_death.mp3', 'lora-death', {
        polyphony: 1, cooldownSeconds: 0.2
    }),
    effect(
        TUTORIAL_SFX_IDS.LORA_HEAVY_BREATHING,
        'audio/special effects/lora_heavybreathing(불안정, 붕괴 상태).mp3',
        'lora-heavy-breathing',
        { loop: true, polyphony: 1, cooldownSeconds: 0, defaultVolume: 0.62 }
    ),
    effect(TUTORIAL_SFX_IDS.SLIME_HURT, 'audio/special effects/slime_hurt.mp3', 'slime-hurt'),
    effect(TUTORIAL_SFX_IDS.ITEM_EQUIP, 'audio/special effects/itemequip.mp3', 'item-equip', {
        polyphony: 1, cooldownSeconds: 0.1
    }),
    effect(TUTORIAL_SFX_IDS.ITEM_APPLY, 'audio/special effects/itemapply.mp3', 'item-apply', {
        polyphony: 1, cooldownSeconds: 0.1
    }),
    effect(TUTORIAL_SFX_IDS.TELEPORT, 'audio/special effects/teleport.mp3', 'teleport', {
        polyphony: 1, cooldownSeconds: 0.18
    }),
    effect(TUTORIAL_SFX_IDS.FLOOR_BREAK, 'audio/special effects/floorbreak.mp3', 'floor-break', {
        polyphony: 1, cooldownSeconds: 0.25
    }),
    createTutorialAudioEntry({
        id: TUTORIAL_SFX_IDS.DIAGNOSTIC_SAMPLE,
        sourceName: 'old/audio/기다려줘.mp3',
        runtimePath: '../asset/tutorial/audio/legacy/diagnostic-sample.mp3',
        bus: 'sfx', loop: false, defaultVolume: 0.8, polyphony: 1,
        cooldownSeconds: 0, required: false
    })
]);
