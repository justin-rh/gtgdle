'use strict';
// Build-time rules for scripts/build-data.js. Edit and re-run the build to apply.
// Matching is accent/punctuation/case-insensitive (see normalize() in logic.js).

module.exports = {
  // Excluded if the game name OR any IGDB franchise/collection name STARTS WITH one of these.
  blockedFranchises: [
    'Call of Duty', 'Battlefield', 'FIFA', 'EA Sports FC', 'EA SPORTS FC', 'Madden NFL', 'Madden',
    'NBA 2K', 'NBA Live', 'NHL', 'MLB The Show', 'MLB', 'Pro Evolution Soccer', 'eFootball',
    'WWE 2K', 'WWE SmackDown', 'WWF SmackDown', 'SmackDown', 'F1', 'Formula One', 'NCAA',
    'College Football', 'EA Sports College Football', 'PGA Tour', 'Tiger Woods PGA Tour',
    'Rory McIlroy PGA Tour', 'Medal of Honor', "Tom Clancy's Ghost Recon", 'Ghost Recon',
    "Tom Clancy's Rainbow Six", 'Rainbow Six', 'Sniper Elite', 'Sniper: Ghost Warrior', 'Homefront',
  ],

  // Games with IGDB genre "Sport" are excluded UNLESS the name CONTAINS one of these.
  sportAllowlist: [
    'Rocket League', 'Wii Sports', 'Mario Tennis', 'Mario Golf', 'Mario Strikers', 'Mario Power Tennis',
    'Mario Superstar Baseball', 'Mario Super Sluggers', 'Punch-Out', "Tony Hawk's", 'NBA Jam',
    'Windjammers', 'Mutant League', 'Mario & Sonic', 'Golf Story', 'OlliOlli', 'Skate',
    'Sega Superstars Tennis', 'Mario Hoops', 'Mario Sports', 'Nintendo Switch Sports', 'NBA Street',
    // Arcade racers (IGDB files most racing under Sport). Sims are handled by racingSims below.
    'Forza Horizon', 'Need for Speed', 'Dirt', 'Grid', 'FlatOut', 'Blur', 'Wreckfest', 'Trackmania',
    'Re-Volt', 'Excitebike', 'Trials', 'Sonic & All-Stars Racing', 'Crash Tag Team Racing',
    'Horizon Chase', "Rock n' Roll Racing", 'Wave Race', '1080', 'SSX', 'Steep', 'Descenders',
    'Lonely Mountains',
    // Not sports at all — IGDB genre misfires.
    'Yakuza', 'Jet Set Radio', 'Jet Grind Radio', 'Beat Saber', 'VRChat', 'Rec Room', 'Nidhogg', 'Pong',
    'Punch Club', "Alto's Adventure", 'My Summer Car', 'Knockout City', 'Lethal League', 'Def Jam',
    'Poker Night', 'Wii Play', 'Wii Fit', 'Ring Fit', 'Golf With Your Friends', 'Quidditch World Cup',
    'Inazuma Eleven', 'theHunter',
  ],

  // Racing sims: excluded regardless of genre if the name STARTS WITH one of these.
  racingSims: [
    'Gran Turismo', 'Forza Motorsport', 'Project CARS', 'Assetto Corsa', 'Dirt Rally', 'Colin McRae Rally',
    'iRacing', 'rFactor', 'RaceRoom', 'Automobilista', 'Richard Burns Rally', 'TOCA', 'GT Legends', 'GTR',
    'NASCAR', 'MotoGP', 'WRC', 'Le Mans Ultimate', 'EA Sports WRC',
  ],

  // Developer column yellow: extra umbrellas for second-party / historical ties that IGDB's
  // current-ownership parent chain doesn't capture. Matched on the exact developer name.
  partnerGroups: {
    Nintendo: [
      'Game Freak', 'Intelligent Systems', 'Creatures Inc.', 'Camelot Software Planning', 'Camelot', 'Rare',
      'Genius Sonority', 'Silicon Knights', 'Factor 5', 'Good-Feel', 'Grezzo', 'Sora', 'Project Sora',
      'Vanpool', 'Jupiter Corporation', 'Retro Studios', 'Next Level Games', 'HAL Laboratory', 'Monolith Soft',
    ],
    Microsoft: ['Bungie', 'Bungie West', 'Lionhead Studios', 'Ensemble Studios', 'Rare'],
    Sony: [
      'Insomniac Games', 'Naughty Dog', 'Quantic Dream', 'Ready At Dawn', 'Sucker Punch Productions',
      'Media Molecule', 'Guerrilla Games', 'SCE Santa Monica Studio', 'Santa Monica Studio', 'SCE Japan Studio',
      'SIE Japan Studio', 'Japan Studio', 'Polyphony Digital', 'Housemarque', 'Bluepoint Games', 'Evolution Studios',
    ],
  },

  // Merge different top-level owner names into one umbrella (applied to the end of IGDB parent chains).
  groupAliases: {
    'Xbox Game Studios': 'Microsoft', 'Microsoft Studios': 'Microsoft', 'Microsoft Game Studios': 'Microsoft',
    'Sony Interactive Entertainment': 'Sony', 'Sony Computer Entertainment': 'Sony', 'Sony Group': 'Sony',
    'Sony Corporation': 'Sony', 'Square Enix Holdings': 'Square Enix', 'Square': 'Square Enix', 'Enix': 'Square Enix',
    'Bandai Namco Holdings': 'Bandai Namco', 'Bandai Namco Entertainment': 'Bandai Namco', 'Namco': 'Bandai Namco',
    'Sega Sammy Holdings': 'Sega', 'Embracer Group AB': 'Embracer Group',
    'Tencent Holdings': 'Tencent', 'Tencent Games': 'Tencent', 'Ubisoft Entertainment': 'Ubisoft',
  },

  // Tags on more than this share of games are moved from primary to secondary (too broad to be a green clue).
  broadTagThreshold: 0.25,

  // IGDB ids. forceInclude beats every exclusion rule; forceExclude always drops.
  forceInclude: [],
  forceExclude: [],

  // IGDB platform name → display name. `null` = drop silently. Anything missing is dropped and logged.
  platformMap: {
    'PC (Microsoft Windows)': 'PC', 'Mac': 'PC', 'Linux': 'PC', 'DOS': 'PC',
    'PlayStation': 'PS1', 'PlayStation 2': 'PS2', 'PlayStation 3': 'PS3', 'PlayStation 4': 'PS4',
    'PlayStation 5': 'PS5', 'PlayStation Portable': 'PSP', 'PlayStation Vita': 'PS Vita',
    'Xbox': 'Xbox', 'Xbox 360': 'Xbox 360', 'Xbox One': 'Xbox One', 'Xbox Series X|S': 'Xbox Series',
    'Nintendo Switch': 'Switch', 'Nintendo Switch 2': 'Switch 2', 'Wii': 'Wii', 'Wii U': 'Wii U',
    'Nintendo GameCube': 'GameCube', 'Nintendo 64': 'N64',
    'Super Nintendo Entertainment System': 'SNES', 'Super Famicom': 'SNES',
    'Nintendo Entertainment System': 'NES', 'Family Computer': 'NES', 'Family Computer Disk System': 'NES',
    'Game Boy': 'Game Boy', 'Game Boy Color': 'Game Boy', 'Game Boy Advance': 'GBA',
    'Nintendo DS': 'DS', 'Nintendo DSi': 'DS', 'Nintendo 3DS': '3DS', 'New Nintendo 3DS': '3DS',
    'Sega Mega Drive/Genesis': 'Genesis', 'Sega CD': 'Genesis', 'Sega 32X': 'Genesis',
    'Sega Saturn': 'Saturn', 'Dreamcast': 'Dreamcast', 'Sega Master System/Mark III': 'Master System',
    'Sega Game Gear': 'Game Gear', 'Arcade': 'Arcade', 'Neo Geo AES': 'Neo Geo', 'Neo Geo MVS': 'Neo Geo',
    'Atari 2600': 'Atari', 'TurboGrafx-16/PC Engine': 'TurboGrafx-16',
    'iOS': 'Mobile', 'Android': 'Mobile', 'Windows Phone': 'Mobile',
    'Google Stadia': 'Stadia', 'Web browser': 'Browser',
    'Amiga': 'Amiga', 'Amiga CD32': 'Amiga', 'Commodore CDTV': 'Amiga', 'Atari ST/STE': 'Atari ST',
    'Commodore C64/128/MAX': 'C64', 'Commodore 16': 'C64', 'Commodore Plus/4': 'C64', 'Commodore VIC-20': 'C64',
    'ZX Spectrum': 'ZX Spectrum', 'Amstrad CPC': 'Amstrad CPC', 'MSX': 'MSX', 'MSX2': 'MSX',
    'Apple II': 'Apple II', 'Apple IIGS': 'Apple II', 'PC-9800 Series': 'PC-98', 'PC-8800 Series': 'PC-98',
    'Sharp X68000': 'X68000', 'FM Towns': 'FM Towns', '3DO Interactive Multiplayer': '3DO',
    'Atari Jaguar': 'Jaguar', 'Atari Jaguar CD': 'Jaguar', 'Neo Geo CD': 'Neo Geo',
    'Turbografx-16/PC Engine CD': 'TurboGrafx-16', 'Satellaview': 'SNES', 'Super NES CD-ROM System': 'SNES',
    '64DD': 'N64', 'WonderSwan': 'WonderSwan', 'WonderSwan Color': 'WonderSwan',
    'Legacy Mobile Device': 'Mobile', 'Windows Mobile': 'Mobile', 'BlackBerry OS': 'Mobile', 'N-Gage': 'Mobile',
    'Palm OS': 'Mobile', 'Windows Mixed Reality': 'VR', 'Gear VR': 'VR', 'Daydream': 'VR', 'visionOS': 'VR',
    'Atari 8-bit': 'Atari', 'Atari 5200': 'Atari', 'Atari 7800': 'Atari',
    'OnLive Game System': null, 'Ouya': null, 'Zeebo': null, 'Amazon Fire TV': null, 'Tapwave Zodiac': null,
    'Legacy Computer': null, 'Philips CD-i': null, 'LaserActive': null, 'Handheld Electronic LCD': null,
    'Acorn Archimedes': null, 'BBC Microcomputer System': null, 'Acorn Electron': null, 'Sharp X1': null,
    'Sharp MZ-2200': null, 'FM-7': null, 'ColecoVision': null, 'Intellivision': null,
    'Texas Instruments TI-99': null, 'Panasonic M2': null, 'SG-1000': null, 'NEC PC-6000 Series': null,
    'TRS-80 Color Computer': null, 'TRS-80': null, 'Leapster Explorer/LeadPad Explorer': null, 'AY-3-8606': null,
    'Oculus Quest': 'VR', 'Meta Quest 2': 'VR', 'Meta Quest 3': 'VR', 'Oculus Rift': 'VR', 'Oculus VR': 'VR',
    'PlayStation VR': 'VR', 'PlayStation VR2': 'VR', 'SteamVR': 'VR',
  },

  // Lowercased source tag → canonical tag. Unifies IGDB and Steam vocabularies.
  tagAliases: {
    'role-playing (rpg)': 'RPG', 'platform': 'Platformer', 'real time strategy (rts)': 'RTS',
    'turn-based strategy (tbs)': 'Turn-Based Strategy', "hack and slash/beat 'em up": 'Hack and Slash',
    'point-and-click': 'Point & Click', 'simulator': 'Simulation', 'card & board game': 'Card Game',
    'quiz/trivia': 'Trivia', 'science fiction': 'Sci-fi', 'open world': 'Open World',
    'warfare': 'War', '4x (explore, expand, exploit, and exterminate)': '4X', 'moba': 'MOBA',
    "shoot 'em up": "Shoot 'Em Up", 'fps': 'FPS', 'first person': 'First-Person', 'third person': 'Third Person',
    'roguelike': 'Roguelike', 'roguelite': 'Roguelite', 'metroidvania': 'Metroidvania',
  },

  // Dropped wherever they appear (store features, NSFW, meta noise).
  tagBlocklist: [
    'Sexual Content', 'Nudity', 'NSFW', 'Hentai', 'Erotic',
    'Singleplayer', 'Multiplayer', 'Great Soundtrack', 'Masterpiece', 'Classic', 'Beautiful',
    'Steam Achievements', 'Steam Trading Cards', 'Steam Cloud', 'Steam Workshop', 'Steam Greenlight',
    'Achievements', 'Digital Distribution', 'Controller Support', 'Full Controller Support',
    'Remote Play Together', 'Family Sharing',
  ],
};
