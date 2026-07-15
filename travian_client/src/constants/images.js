// Centralized image path references for all Travian game assets
// Source: gpack/travian_t4/ → public/assets/

export const BG = {
  main: '/assets/bgs/bodybg.jpg',
  login: '/assets/bgs/artwork1.jpg',
  login2: '/assets/bgs/artwork2.jpg',
  messages: '/assets/bgs/bg-messages.png',
  reports: '/assets/bgs/bg-reports.png',
  statistics: '/assets/bgs/bg-statistics.png',
  map: '/assets/bgs/bg-map.png',
  settings: '/assets/bgs/bg-settings.png',
  plus: '/assets/bgs/bg-plus.png',
  warsim: '/assets/bgs/bg-warsim.png',
  alliance: '/assets/bgs/bg-alliance.png',
  villageName: '/assets/bgs/bg-village-name.png',
  dyn: '/assets/bgs/dyn-bg1.jpg',
  bigsize: '/assets/bgs/bigsize-bg.jpg',
  header: '/assets/bgs/header-bg.jpg',
  footer: '/assets/bgs/footer-bg.gif',
  dorf1: '/assets/bgs/bg0.jpg',
  dorf2: '/assets/bgs/bg1.jpg',
  background: '/assets/bgs/background.png',
  day: '/assets/bgs/day.gif',
  night: '/assets/bgs/night.gif',
};

export const RESOURCES = {
  wood: '/assets/ui/res-1.gif',
  clay: '/assets/ui/res-2.gif',
  iron: '/assets/ui/res-3.gif',
  crop: '/assets/ui/res-4.gif',
  gold: '/assets/ui/res-5.gif',
  silver: '/assets/ui/res-6.gif',
  cp: '/assets/ui/res-7.gif',
};

export const RESOURCES_LARGE = {
  wood: '/assets/ui/wood-border.png',
  clay: '/assets/ui/clay-border.png',
  iron: '/assets/ui/iron-border.png',
  crop: '/assets/ui/crop-border.png',
};

export const TRIBES = {
  ROMAN: { splash: '/assets/tribes/roman-splash.gif', large: '/assets/tribes/roman-large.jpg', banner: '/assets/troops/roman-banner.gif' },
  TEUTON: { splash: '/assets/tribes/teuton-splash.gif', large: '/assets/tribes/teuton-large.jpg', banner: '/assets/troops/teuton-banner.gif' },
  GAUL: { splash: '/assets/tribes/gaul-splash.gif', large: '/assets/tribes/gaul-large.jpg', banner: '/assets/troops/gaul-banner.gif' },
  NATURE: { splash: '/assets/tribes/nature-splash.png', large: '/assets/tribes/nature-large.jpg', banner: '/assets/troops/nature-banner.gif' },
  NATAR: { splash: '/assets/tribes/nature2-splash.png', large: '/assets/tribes/natar-large.jpg', banner: '/assets/troops/natar-banner.gif' },
};

// Building name → image path mapping (g{N}.gif from img/g/)
export const BUILDINGS = {
  main_building: '/assets/buildings/g1.gif',
  warehouse: '/assets/buildings/g10.gif',
  granary: '/assets/buildings/g11.gif',
  barracks: '/assets/buildings/g13.gif',
  stable: '/assets/buildings/g14.gif',
  workshop: '/assets/buildings/g15.gif',
  academy: '/assets/buildings/g16.gif',
  smithy: '/assets/buildings/g17.gif',
  rally_point: '/assets/buildings/g16.gif',
  marketplace: '/assets/buildings/g17.gif',
  embassy: '/assets/buildings/g18.gif',
  residence: '/assets/buildings/g19.gif',
  palace: '/assets/buildings/g25.gif',
  treasury: '/assets/buildings/g21.gif',
  town_hall: '/assets/buildings/g22.gif',
  wall: '/assets/buildings/g12.gif',
  woodcutter: '/assets/buildings/g1.gif',
  claypit: '/assets/buildings/g2.gif',
  ironmine: '/assets/buildings/g3.gif',
  cropland: '/assets/buildings/g4.gif',
  mill: '/assets/buildings/g9.gif',
  bakery: '/assets/buildings/g8.gif',
  smithy: '/assets/buildings/g13.gif',
  tournament_square: '/assets/buildings/g20.gif',
  hero_mansion: '/assets/buildings/g39.gif',
  wonder: '/assets/buildings/g40.gif',
};

// Building backgrounds for village views
export const BUILDING_BACKGROUNDS = {
  dorf1: '/assets/bgs/bg0.jpg',
  dorf2: '/assets/bgs/bg1.jpg',
  dorf3: '/assets/bgs/bg11.jpg',
  dorf4: '/assets/bgs/bg12.jpg',
  dorf5: '/assets/bgs/bg13.jpg',
};

// Resource field images (f1-f12, f99)
export const FIELDS = {
  wood: '/assets/fields/f1.jpg',
  clay: '/assets/fields/f2.jpg',
  iron: '/assets/fields/f3.jpg',
  crop: '/assets/fields/f4.jpg',
  empty: '/assets/fields/f99.jpg',
};

// Unit/troop image by ID
export const getUnitImage = (id) => `/assets/troops/unit-${id}.gif`;

// Hero images
export const HERO = {
  portrait: '/assets/hero/hero-portrait.png',
  shadow: '/assets/hero/shadow.png',
  shadow0: '/assets/hero/shadow0.png',
  builderWW: '/assets/hero/builder-ww.png',
  winnerWW: '/assets/hero/winner-ww.png',
  g40_11: '/assets/hero/g40-11.png',
  taskmaster: '/assets/hero/taskmaster.png',
  taskmaster2: '/assets/hero/taskmaster2.png',
  team: '/assets/hero/team.png',
};

// Report type images
export const REPORTS = {
  attack: '/assets/reports/attack.jpg',
  spy: '/assets/reports/spy.jpg',
  reinforcement: '/assets/reports/reinforcement.jpg',
  trade: '/assets/reports/trade.jpg',
  units: '/assets/reports/units.jpg',
  adventure: '/assets/reports/adventure.jpg',
};

// Quest images by type
export const getQuestImage = (type) => `/assets/quests/${type}.jpg`;

// Artifact type images
export const ARTIFACTS = {
  type1: '/assets/ui/artifact-type1.gif',
  type2: '/assets/ui/artifact-type2.gif',
  type3: '/assets/ui/artifact-type3.gif',
  type4: '/assets/ui/artifact-type4.gif',
  type5: '/assets/ui/artifact-type5.gif',
  type6: '/assets/ui/artifact-type6.gif',
  type7: '/assets/ui/artifact-type7.gif',
  type8: '/assets/ui/artifact-type8.gif',
  type9: '/assets/ui/artifact-type9.gif',
  typeww: '/assets/ui/artifact-typeww.gif',
};

// UI elements
export const UI = {
  logo: '/assets/ui/travian-logo.png',
  gold: '/assets/ui/gold.gif',
  goldG: '/assets/ui/gold_g.gif',
  plus: '/assets/ui/plus.png',
  gp: '/assets/ui/gp.png',
  npc: '/assets/ui/npc.png',
  level: '/assets/ui/level.png',
  top10: '/assets/ui/top10.png',
  tick: '/assets/ui/tick.png',
  cancel: '/assets/ui/cancel.gif',
  opened: '/assets/ui/opened.png',
  closed: '/assets/ui/closed.png',
  header: '/assets/ui/header.png',
  headerGold: '/assets/ui/header-gold-grad.png',
  headerGrad: '/assets/ui/header-grad.gif',
  headerLine: '/assets/ui/header-line.png',
  footer: '/assets/ui/footer.png',
  menu: '/assets/ui/menu.png',
  online: '/assets/ui/online.gif',
  attackSymbol: '/assets/ui/attack-symbol.gif',
  del: '/assets/ui/del.gif',
  delG: '/assets/ui/del-g.gif',
  close: '/assets/ui/close.gif',
  clock: '/assets/ui/clock.gif',
  refresh: '/assets/ui/refresh.png',
  vip: '/assets/ui/vip.gif',
  artefacts: '/assets/ui/artefacts.gif',
  cropfinder: '/assets/ui/cropfinder.gif',
  win: '/assets/ui/win.png',
  navi1: '/assets/ui/navi-1.png',
  navi2: '/assets/ui/navi-2.png',
  navi3: '/assets/ui/navi-3.png',
  navi4: '/assets/ui/navi-4.png',
  navi5: '/assets/ui/navi-5.png',
  buildingBorder: '/assets/ui/building-border.png',
  woodBorder: '/assets/ui/wood-border.png',
  clayBorder: '/assets/ui/clay-border.png',
  ironBorder: '/assets/ui/iron-border.png',
  cropBorder: '/assets/ui/crop-border.png',
  gaulWall: '/assets/ui/gaulwall-border.png',
  romanWall: '/assets/ui/romanwall-border.png',
  teutonWall: '/assets/ui/teutonwall-border.png',
  rallyPoint: '/assets/ui/rallypoint-border.png',
  bbButtons: '/assets/ui/bb-buttons.png',
};

// Map tile images
export const MAP = {
  getDirection: (code) => `/assets/map/d${String(code).padStart(2, '0')}.gif`,
  getOasis: (id) => `/assets/map/oasis-${id}.gif`,
  getWater: (id) => `/assets/map/water-${id}.jpg`,
  getTribe: (id) => `/assets/map/tribe-${id}.gif`,
  marker: '/assets/map/marker.gif',
  dir: '/assets/map/dir.gif',
  mapBg: '/assets/map/map-bg.jpg',
};

// Navigation icons (from img/a/)
export const NAV_ICONS = {
  buildings: '/assets/ui/buildings-icon.gif',
  troops: '/assets/ui/troops-icon.gif',
  reports: '/assets/ui/report-icons.gif',
  friends: '/assets/ui/friends-icon.gif',
  gold: '/assets/ui/gold-icon.gif',
  plus: '/assets/ui/plus-icon.gif',
  help: '/assets/ui/help-icon.gif',
  car: '/assets/ui/car-icon.gif',
  attack: '/assets/ui/attack-symbol.gif',
  navi: '/assets/ui/navi.gif',
};

// Special effects
export const EFFECTS = {
  easter: '/assets/ui/easter.gif',
  newYear: '/assets/ui/newy.gif',
  peace: '/assets/ui/peace.gif',
  christmas: '/assets/ui/xmas.gif',
};

// Status icons
export const STATUS = {
  off: '/assets/ui/status-off.gif',
  def: '/assets/ui/status-def.gif',
  top10: '/assets/ui/status-top10.gif',
  v1: '/assets/ui/status-v1.gif',
  v2: '/assets/ui/status-v2.gif',
  v3: '/assets/ui/status-v3.gif',
};
