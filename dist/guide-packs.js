// Guide files are fetched from pinned public source revisions, not hosted here.
const SOURCE = 'https://raw.githubusercontent.com/mkccl/restedxp-reencrypt/d5d4816ca0f33279da3d51f0e271e9d90ff3b669/public/';
const FOREVER_SOURCE = 'https://raw.githubusercontent.com/RestedXP/RXPGuides/b2cb0c5396ea9920098f2f439cf3d33155b17631/';
const FOREVER_FILES = Object.freeze([
  'Guides/Forever/RestedXP-Skyborne.lua',
  'Guides/forever/Alliance-1-10_NightElf.lua',
  'Guides/forever/Alliance-1-13_Human.lua',
  'Guides/forever/Alliance-1-14_DwarfGnome.lua',
  'Guides/forever/Alliance-11-20.lua',
  'Guides/forever/Horde-01-12_Durotar.lua',
  'Guides/forever/Horde-01-14_Undead.lua',
  'Guides/forever/Horde-1-12_Mulgore.lua',
  'Guides/forever/Horde-12-22_Barrens.lua',
  'Guides/forever/Alliance-Mage-1-12.lua',
  'Guides/forever/Alliance-Mage-12-21.lua',
  'Guides/forever/Horde-Mage-12-21.lua',
  'Guides/forever/Alliance-ADV-AoE-Mage-1-22.lua'
]);
export const GUIDE_PACKS = Object.freeze([
  {
    id:'forever', name:'WoW Forever', label:'WoW Forever', levels:'Starting routes · 1–22',
    note:'Horde and Alliance starting routes, including Skyborne. Level coverage varies by route, up to level 22. Use the RestedXP addon for WoW Forever.',
    format:'lua', version:40000, urls:FOREVER_FILES.map(path=>FOREVER_SOURCE+path),
    sourceName:'RestedXP/RXPGuides', sourceUrl:'https://github.com/RestedXP/RXPGuides/tree/b2cb0c5396ea9920098f2f439cf3d33155b17631/Guides',
    attribution:{creator:'RestedXP',license:'CC BY-NC-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-nc-sa/4.0/'}
  },
  {id:'midnight', name:'Midnight', label:'Retail · Midnight', levels:'Levels 80–90', url:SOURCE+'guide_player_1234.txt', sourceTag:'player#1234'},
  {id:'tbc', name:'The Burning Crusade', label:'TBC Classic', levels:'Levels 1–70', url:SOURCE+'guide_tbc_player_1234.txt', sourceTag:'player#1234'},
  {id:'wotlk', name:'Wrath of the Lich King', label:'WotLK Classic', levels:'Levels 1–80', url:SOURCE+'guide_wotlk_player_1234.txt', sourceTag:'player#1234'}
]);
