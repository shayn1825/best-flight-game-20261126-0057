// Missions: three sorties with different goals, so flying is never just
// staying in the air. Ring Run rewards clean lines, Island Hop rewards a
// gentle touchdown, Storm Courier makes fuel and weather the decision.

import { RING, SCORE } from './config.js';
import { degreesToRadians } from './random.js';

export const MISSIONS = [
  {
    id: 'ring-run',
    number: 1,
    name: 'RING RUN',
    subtitle: 'Teluk Biru — terbang menembus 8 cincin',
    briefing:
      'Delapan cincin melayang di atas Teluk Biru. Terbang menembusnya berurutan — makin cepat makin besar bonus waktu. Jaga kecepatan di atas 30 m/s supaya tidak stall.',
    start: { x: 1500, y: 4900, headingDeg: 0, altitude: 200, speed: 55, throttle: 0.75, onGround: false },
    timeLimit: 180,
    fuel: 100,
    rings: [
      { x: 1500, y: 4400, z: 200 },
      { x: 1650, y: 3900, z: 220 },
      { x: 1950, y: 3400, z: 180 },
      { x: 2350, y: 2950, z: 240 },
      { x: 2700, y: 2550, z: 160 },
      { x: 2900, y: 2150, z: 220 },
      { x: 3050, y: 1750, z: 180 },
      { x: 3200, y: 1350, z: 200 },
    ],
    landAt: null,
    dusk: false,
    wind: 0,
  },
  {
    id: 'island-hop',
    number: 2,
    name: 'ISLAND HOP',
    subtitle: 'Antar paket Merpati → Hijau',
    briefing:
      'Paket pos harus sampai di Pulau Hijau sebelum bahan bakar habis. Lepas landas dari Merpati, terbang lurus ke timur, lalu mendarat pelan di runway Hijau (HJU). Mendarat lembut = skor besar.',
    start: { x: 1500, y: 4450, headingDeg: 0, altitude: 0, speed: 0, throttle: 0, onGround: true },
    timeLimit: 240,
    fuel: 100,
    rings: [
      { x: 2400, y: 3800, z: 220 },
      { x: 3300, y: 2900, z: 260 },
      { x: 4100, y: 1900, z: 220 },
    ],
    landAt: 'HJU',
    dusk: false,
    wind: 0,
  },
  {
    id: 'storm-courier',
    number: 3,
    name: 'STORM COURIER',
    subtitle: 'Badai senja — cincin + mendarat di Karang',
    briefing:
      'Badai datang dari barat, bahan bakar pas-pasan. Tembus 6 cincin di tengah hujan, lalu mendarat di runway Karang (KRG) sebelum gelap. Angin mendorong pesawatmu — lawan dengan kemudi.',
    start: { x: 2600, y: 2600, headingDeg: 160, altitude: 240, speed: 55, throttle: 0.8, onGround: false },
    timeLimit: 210,
    fuel: 70,
    rings: [
      { x: 2900, y: 2400, z: 220 },
      { x: 3150, y: 2100, z: 180 },
      { x: 2950, y: 1800, z: 240 },
      { x: 2700, y: 1500, z: 170 },
      { x: 2900, y: 1200, z: 220 },
      { x: 3050, y: 1500, z: 190 },
    ],
    landAt: 'KRG',
    dusk: true,
    wind: 1,
  },
];

export function createMissionState() {
  return {
    index: 0,
    ringsPassed: 0,
    rings: [],
    score: 0,
    missionScore: 0,
    timeLeft: MISSIONS[0].timeLimit,
    elapsed: 0,
    complete: false,
    failed: false,
    failReason: '',
    landedAt: null,
    bestLandingRate: 0,
  };
}

export function startMission(state, index) {
  const mission = MISSIONS[index];
  state.index = index;
  state.ringsPassed = 0;
  state.rings = mission.rings.map((ring) => ({ ...ring, passed: false }));
  state.missionScore = 0;
  state.timeLeft = mission.timeLimit;
  state.elapsed = 0;
  state.complete = false;
  state.failed = false;
  state.failReason = '';
  state.landedAt = null;
  return mission;
}

export function nextRing(state) {
  return state.rings[state.ringsPassed] || null;
}

function distance3D(ax, ay, az, bx, by, bz) {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function updateMission(state, flight, dt) {
  const mission = MISSIONS[state.index];
  if (state.complete || state.failed) return;
  state.elapsed += dt;
  state.timeLeft = Math.max(0, mission.timeLimit - state.elapsed);

  // Fly through the next ring in order.
  const ring = nextRing(state);
  if (ring && distance3D(flight.x, flight.y, flight.altitude, ring.x, ring.y, ring.z) < RING.passDistance) {
    ring.passed = true;
    state.ringsPassed += 1;
    const points = RING.score + Math.round(flight.speed);
    state.missionScore += points;
    state.score += points;
  }

  // Landing on the target runway ends a delivery mission.
  if (mission.landAt && flight.landed && flight.landedRunway === mission.landAt) {
    const rate = Math.abs(flight.touchdownRate);
    state.bestLandingRate = rate;
    let landingPoints = SCORE.landingRough;
    if (rate < 1.5) landingPoints = SCORE.landingPerfect;
    else if (rate < 3) landingPoints = SCORE.landingGood;
    state.missionScore += landingPoints + SCORE.delivery;
    state.score += landingPoints + SCORE.delivery;
    state.landedAt = mission.landAt;
    state.complete = true;
    return;
  }

  // A ring mission ends when the last ring is through.
  if (!mission.landAt && state.ringsPassed >= state.rings.length) {
    const timeBonus = Math.round(state.timeLeft * SCORE.timeBonusPerSecond);
    state.missionScore += timeBonus;
    state.score += timeBonus;
    state.complete = true;
    return;
  }

  // Failure: out of time, out of fuel over water, or crashed.
  if (state.timeLeft <= 0) {
    state.failed = true;
    state.failReason = 'Waktu habis — misi gagal.';
  } else if (flight.crashed) {
    state.failed = true;
    state.failReason = 'Pesawat jatuh. Perbaiki dan coba lagi.';
  } else if (flight.engineOut && flight.altitude < 30 && !flight.onGround) {
    state.failed = true;
    state.failReason = 'Bahan bakar habis di atas laut.';
  }
}

export function missionObjectiveText(state) {
  const mission = MISSIONS[state.index];
  if (mission.landAt) {
    const ringsLeft = state.rings.length - state.ringsPassed;
    if (ringsLeft > 0) return `Cincin ${state.ringsPassed}/${state.rings.length} — lalu mendarat di ${mission.landAt}`;
    return `Mendarat di runway ${mission.landAt} — pelan & lurus`;
  }
  return `Cincin ${state.ringsPassed}/${state.rings.length} — terbang berurutan`;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function headingLabel(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

export { degreesToRadians };
