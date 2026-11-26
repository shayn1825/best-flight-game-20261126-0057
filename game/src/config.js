// Nusa Sky Courier — shared tuning and world constants.
// One place for every number the flight model, missions and renderer agree on,
// so a tweak here retunes the whole game instead of hunting through files.

export const GAME_TITLE = 'NUSA SKY COURIER';
export const GAME_SUBTITLE = 'Kurir Kepulauan — terbang, antar, mendarat';

export const WORLD = {
  size: 6000, // world is 6000 x 6000 metres, origin top-left of the map
  mapPixels: 2048, // top-down terrain map canvas, square
};

export const MAP_SCALE = WORLD.mapPixels / WORLD.size; // map px per metre

export const VIEW = {
  width: 1280,
  height: 800,
  focal: 520, // projection focal length in px (chase camera)
  fovHalfTan: 0.5317, // tan(28 deg) — half the horizontal field of view
  viewCanvas: 1024, // rotated ground map, square, px
  viewScale: 0.25, // view-canvas px per metre of ground
  viewPlaneX: 512, // plane position inside the rotated view canvas
  viewPlaneY: 700,
  maxGroundDistance: 2800, // metres of ground drawn ahead
};

export const PLANE = {
  stallSpeed: 26, // m/s — below this the wing stops flying
  stallSpeedFlaps: 21, // flaps lower the stall speed
  cruiseSpeed: 58, // m/s at full throttle, clean
  maxSpeed: 88, // m/s, overspeed warning above this
  maxThrottle: 1,
  throttleRate: 0.55, // per second
  pitchRate: 55, // deg per second of stick — the stick must answer at once
  maxPitchUp: 24,
  maxPitchDown: -16,
  bankRate: 110, // deg per second
  maxBank: 58, // deg
  climbFactor: 0.92, // how much of forward speed becomes climb
  sinkRateStall: 9, // m/s extra sink while stalled
  fuelBurnBase: 0.14, // fuel units per second at idle
  fuelBurnThrottle: 0.55, // extra fuel units per second at full throttle
  fuelCapacity: 100,
  gearDrag: 4, // m/s top speed lost with gear down
  flapDrag: 9, // m/s top speed lost with flaps down
  damageHardLanding: 45, // damage from a touchdown harder than -4 m/s
  damageBrush: 12, // damage from clipping a treetop / wingtip scrape
};

export const CAMERA = {
  chaseHeight: 3.2, // camera sits this far above the aircraft
  chaseDistance: 0, // chase view is drawn over the shoulder (sprite), not a 3D offset
  horizonBase: 0.42, // horizon sits at 42% of screen height at level flight
  horizonPitchGain: 7, // px the horizon moves per degree of pitch
};

export const RING = {
  radius: 24, // metres — generous, the game is about flying, not threading needles
  passDistance: 30, // metres of 3D distance that counts as flying through
  score: 100,
};

export const SCORE = {
  ring: 100,
  landingPerfect: 500,
  landingGood: 300,
  landingRough: 100,
  timeBonusPerSecond: 5,
  delivery: 400,
};

// Runway definitions live with the terrain, but the missions need the names.
export const RUNWAYS = {
  merpati: { id: 'MPT', name: 'Merpati', x: 1500, y: 4200, headingDeg: 0, length: 700, width: 42 },
  hijau: { id: 'HJU', name: 'Hijau', x: 4500, y: 1200, headingDeg: 90, length: 650, width: 40 },
  karang: { id: 'KRG', name: 'Karang', x: 3050, y: 1750, headingDeg: 315, length: 600, width: 38 },
};

export const DAY_SKY = {
  top: '#2b6cb8',
  mid: '#7fb8e0',
  horizon: '#cfe9f4',
  sun: '#fff3c4',
  haze: '#cfe4ef',
};

export const DUSK_SKY = {
  top: '#2c2350',
  mid: '#b35a6e',
  horizon: '#ffb37a',
  sun: '#ffdf9e',
  haze: '#e8a583',
};
