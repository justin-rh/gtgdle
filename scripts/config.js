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
    'Sega Superstars Tennis', 'Mario Hoops', 'Mario Sports',
  ],

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
