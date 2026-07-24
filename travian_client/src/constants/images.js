// Centralized image path references for all Travian game assets
// Source: gpack/travian_t4/ → public/assets/

export const BG = {
  main: '/assets/bgs/bodybg.jpg',
  login: '/assets/bgs/artwork1.jpg',
  login2: '/assets/bgs/artwork2.jpg',
  messages: '/assets/bgs/bg0.jpg',
  reports: '/assets/bgs/bg0.jpg',
  statistics: '/assets/bgs/dyn-bg1.jpg',
  map: '/assets/bgs/bg0.jpg',
  settings: '/assets/bgs/bg0.jpg',
  plus: '/assets/bgs/bg0.jpg',
  warsim: '/assets/bgs/bg0.jpg',
  alliance: '/assets/bgs/bg0.jpg',
  villageName: '/assets/bgs/bg0.jpg',
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

// Resource icons (from img/un/res/)
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

// Building name → image path mapping (g{N}.png from img/g/)
// Source: gpack/travian_default/img/g/ — authoritative TravianZ building IDs
// NOTE: PNG conversions for PixiJS compatibility (GIFs also available as g{N}.gif)
export const BUILDINGS = {
  woodcutter: '/assets/buildings/g1.png',
  claypit: '/assets/buildings/g2.png',
  ironmine: '/assets/buildings/g3.png',
  cropland: '/assets/buildings/g4.png',
  sawmill: '/assets/buildings/g5.png',
  brickyard: '/assets/buildings/g6.png',
  iron_foundry: '/assets/buildings/g7.png',
  mill: '/assets/buildings/g8.png',
  bakery: '/assets/buildings/g9.png',
  warehouse: '/assets/buildings/g10.png',
  granary: '/assets/buildings/g11.png',
  blacksmith: '/assets/buildings/g12.png',
  armoury: '/assets/buildings/g13.png',
  tournament_square: '/assets/buildings/g14.png',
  main_building: '/assets/buildings/g15.png',
  rally_point: '/assets/buildings/g16.png',
  marketplace: '/assets/buildings/g17.png',
  embassy: '/assets/buildings/g18.png',
  barracks: '/assets/buildings/g19.png',
  stable: '/assets/buildings/g20.png',
  workshop: '/assets/buildings/g21.png',
  academy: '/assets/buildings/g22.png',
  cranny: '/assets/buildings/g23.png',
  town_hall: '/assets/buildings/g24.png',
  residence: '/assets/buildings/g25.png',
  palace: '/assets/buildings/g26.png',
  treasury: '/assets/buildings/g27.png',
  trade_office: '/assets/buildings/g28.png',
  great_barracks: '/assets/buildings/g29.png',
  great_stable: '/assets/buildings/g30.png',
  city_wall: '/assets/buildings/g31.png',
  earth_wall: '/assets/buildings/g32.png',
  palisade: '/assets/buildings/g33.png',
  trapper: '/assets/buildings/g34.png',
  hero_mansion: '/assets/buildings/g35.png',
  merchant: '/assets/buildings/g36.png',
  wonder: '/assets/buildings/g37.png',
  horse_trough: '/assets/buildings/g38.png',
  wall: '/assets/buildings/g39.png',
  hospital: '/assets/buildings/g40.png',
  stonemason: '/assets/buildings/g41.png',
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
export const getUnitImage = (id) => `/assets/troops/unit-${id}.png`;

// Small unit/troop icon (GIF) for village overview tables
export const getUnitSmallImage = (id) => `/assets/troops/unit-${id}.gif`;

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

// Report type images (from gpack/travian_default/img/r/)
export const REPORTS = {
  attack: '/assets/reports/1.gif',
  spy: '/assets/reports/2.gif',
  reinforcement: '/assets/reports/3.gif',
  trade: '/assets/reports/4.gif',
  units: '/assets/reports/5.gif',
  adventure: '/assets/reports/6.gif',
  scout: '/assets/reports/7.gif',
};

// Quest images by type
export const getQuestImage = (type) => `/assets/quests/${type}.jpg`;

// Artifact type images (from gpack/travian_default/img/artefact/)
export const ARTIFACTS = {
  type1: '/assets/ui/artifact-type1.gif',
  type2: '/assets/ui/artifact-type2.gif',
  type4: '/assets/ui/artifact-type4.gif',
  type5: '/assets/ui/artifact-type5.gif',
  type6: '/assets/ui/artifact-type6.gif',
  type8: '/assets/ui/artifact-type8.gif',
  typeww: '/assets/ui/artifact-typeww.gif',
  typeFool: '/assets/ui/artifact-type-fool.gif',
  // Negative types (type-1 through type-10)
  neg1: '/assets/ui/artifact-type-n1.gif',
  neg2: '/assets/ui/artifact-type-n2.gif',
  neg3: '/assets/ui/artifact-type-n3.gif',
  neg4: '/assets/ui/artifact-type-n4.gif',
  neg5: '/assets/ui/artifact-type-n5.gif',
  neg6: '/assets/ui/artifact-type-n6.gif',
  neg7: '/assets/ui/artifact-type-n7.gif',
  neg8: '/assets/ui/artifact-type-n8.gif',
  neg9: '/assets/ui/artifact-type-n9.gif',
  neg10: '/assets/ui/artifact-type-n10.gif',
};

// UI elements (from gpack/travian_default/img/a/ and img/misc/)
export const UI = {
  logo: '/assets/ui/travian-logo.png',
  gold: '/assets/ui/gold-icon.gif',
  goldG: '/assets/ui/gold-icon-g.gif',
  plus: '/assets/ui/plus-icon.gif',
  gp: '/assets/ui/gp.gif',
  npc: '/assets/ui/npc.gif',
  level: '/assets/ui/level.png',
  top10: '/assets/ui/status-top10.gif',
  tick: '/assets/ui/tick.png',
  cancel: '/assets/ui/cancel.gif',
  opened: '/assets/ui/opened.gif',
  closed: '/assets/ui/closed.gif',
  header: '/assets/bgs/header-bg.jpg',
  headerGold: '/assets/ui/header-gold-grad.png',
  headerGrad: '/assets/ui/header-grad.gif',
  headerLine: '/assets/ui/header-line.png',
  footer: '/assets/bgs/footer-bg.gif',
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
  cropfinder: '/assets/map/cropfinder-btn.gif',
  getTileBg: (pattern) => `/assets/map/tilespbgimg${pattern}.gif`,
  getTerrain: (type) => `/assets/map/t${type}.gif`,
  getOasisTile: (type) => `/assets/map/o${type}.gif`,
  getOasisOccupied: (type) => `/assets/map/o${type}o.gif`,
  getBorder: (cls) => `/assets/map/${cls}.gif`,
  getWall: (level) => `/assets/map/wall${level}.gif`,
  getPop: (pop) => {
    if (pop < 100) return '/assets/map/pop99.gif';
    if (pop < 250) return '/assets/map/pop249.gif';
    if (pop < 500) return '/assets/map/pop499.gif';
    return '/assets/map/pop500.gif';
  },
  att1: '/assets/map/matt.gif',
  volcano: '/assets/map/volcano.gif',
};

// Navigation icons (from gpack/travian_default/img/a/)
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

// Special effects (from gpack/travian_default/img/r/ and img/special/)
export const EFFECTS = {
  easter: '/assets/reports/easter.gif',
  newYear: '/assets/reports/newy.gif',
  peace: '/assets/reports/peace.gif',
  christmas: '/assets/reports/xmas.gif',
};

// Status icons (from gpack/travian_default/img/s/)
export const STATUS = {
  off: '/assets/ui/status-off.gif',
  def: '/assets/ui/status-def.gif',
  top10: '/assets/ui/status-top10.gif',
  v1: '/assets/ui/status-v1.gif',
  v2: '/assets/ui/status-v2.gif',
  v3: '/assets/ui/status-v3.gif',
};
