// The archipelago: one seeded top-down map canvas plus the height function
// the flight model trusts. The map is the game's recognisable terrain —
// ocean, beaches, jungle islands, a volcano and three marked runways —
// painted once at load and then sampled by the Mode-7 ground renderer.

import { WORLD, MAP_SCALE, RUNWAYS } from './config.js';
import { mulberry32, pickInRange, smoothstep, clamp } from './random.js';

const ISLANDS = [
  // Home island: big, green, runway Merpati running north-south.
  { name: 'Merpati', x: 1500, y: 4200, radius: 950, peak: 95, volcano: false },
  // Volcano island: steep cone, the tallest thing in the world.
  { name: 'Vulkan', x: 4200, y: 3800, radius: 820, peak: 195, volcano: true },
  // Ring bay island: low hills, runway Karang on its south shore.
  { name: 'Karang', x: 3050, y: 1750, radius: 720, peak: 70, volcano: false },
  // Destination island: runway Hijau running east-west.
  { name: 'Hijau', x: 4500, y: 1200, radius: 880, peak: 110, volcano: false },
  // Little islets for the eye to catch while flying.
  { name: 'Kecil Barat', x: 800, y: 1500, radius: 260, peak: 28, volcano: false },
  { name: 'Kecil Timur', x: 5400, y: 2900, radius: 300, peak: 34, volcano: false },
  { name: 'Kecil Selatan', x: 2600, y: 5400, radius: 240, peak: 22, volcano: false },
];

function islandHeight(island, x, y) {
  const dx = x - island.x;
  const dy = y - island.y;
  const d = Math.sqrt(dx * dx + dy * dy) / island.radius;
  if (d >= 1) return 0;
  if (island.volcano) {
    // A cone with a crater scooped out of the top.
    const cone = Math.max(0, 1 - d);
    const crater = smoothstep(0.1, 0.26, d);
    return island.peak * cone * crater;
  }
  // Rolling hills: a soft dome with a wobble so the silhouette is not a circle.
  const wobble = 1 + 0.16 * Math.sin(Math.atan2(dy, dx) * 3 + island.x * 0.01);
  const dome = Math.max(0, 1 - d * d);
  return island.peak * dome * wobble;
}

export function terrainHeight(x, y) {
  let h = 0;
  for (const island of ISLANDS) {
    h = Math.max(h, islandHeight(island, x, y));
  }
  // Airfield plateau: a wide flat apron around each runway, so the
  // approach corridor is clear of hills and landings read cleanly.
  for (const runway of Object.values(RUNWAYS)) {
    const heading = (runway.headingDeg * Math.PI) / 180;
    const fx = Math.sin(heading);
    const fy = -Math.cos(heading);
    const rx = x - runway.x;
    const ry = y - runway.y;
    const along = rx * fx + ry * fy;
    const across = Math.abs(rx * -fy + ry * fx);
    if (Math.abs(along) < 1500 && across < 340) {
      const edge = Math.min((1500 - Math.abs(along)) / 150, (340 - across) / 80);
      const blend = smoothstep(0, 1, clamp(edge, 0, 1));
      h = h * (1 - blend) + 2 * blend;
    }
  }
  // Runways are flattened to sea-level grade so landings read cleanly.
  for (const runway of Object.values(RUNWAYS)) {
    const heading = (runway.headingDeg * Math.PI) / 180;
    const fx = Math.sin(heading);
    const fy = -Math.cos(heading);
    const rx = x - runway.x;
    const ry = y - runway.y;
    const along = rx * fx + ry * fy;
    const across = Math.abs(rx * -fy + ry * fx);
    if (Math.abs(along) < runway.length / 2 + 30 && across < runway.width / 2 + 30) {
      const blend = smoothstep(0, 1, Math.min(1, (runway.width / 2 + 30 - across) / 30));
      h = h * (1 - blend);
    }
  }
  return h;
}

function paintRunway(ctx, runway) {
  const heading = (runway.headingDeg * Math.PI) / 180;
  ctx.save();
  ctx.translate(runway.x * MAP_SCALE, runway.y * MAP_SCALE);
  ctx.rotate(heading);
  const len = runway.length * MAP_SCALE;
  const wid = runway.width * MAP_SCALE;
  // Asphalt strip with a lighter shoulder.
  ctx.fillStyle = '#5d6066';
  ctx.fillRect(-wid / 2 - 4, -len / 2, wid + 8, len);
  ctx.fillStyle = '#3f4247';
  ctx.fillRect(-wid / 2, -len / 2, wid, len);
  // Centreline dashes.
  ctx.fillStyle = '#f5f2e8';
  const dash = 26;
  for (let d = -len / 2 + 30; d < len / 2 - 20; d += dash * 2) {
    ctx.fillRect(-2, d, 4, dash);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    ctx.fillStyle = '#f5f2e8';
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(i * 6 - 1.5, end * (len / 2 - 22), 3, 14);
    }
  }
  // Runway number, painted big enough to read from the air.
  ctx.fillStyle = '#f5f2e8';
  ctx.font = `bold ${Math.round(wid * 0.62)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const num = String(Math.round(runway.headingDeg / 10) % 36).padStart(2, '0');
  ctx.fillText(num, 0, len / 2 - 70);
  ctx.restore();
}

export function buildTerrainMap() {
  const size = WORLD.mapPixels;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = mulberry32(20261126);

  // Deep ocean with a slow depth gradient.
  const ocean = ctx.createLinearGradient(0, 0, size, size);
  ocean.addColorStop(0, '#1b5f8a');
  ocean.addColorStop(0.5, '#2277a8');
  ocean.addColorStop(1, '#185a82');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, size, size);

  // Shallow water shimmer: thousands of tiny pale flecks.
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 5200; i++) {
    const x = random() * size;
    const y = random() * size;
    ctx.fillRect(x, y, 2 + random() * 5, 1);
  }

  // Islands, painted far to near so beaches ring the grass.
  for (const island of ISLANDS) {
    const cx = island.x * MAP_SCALE;
    const cy = island.y * MAP_SCALE;
    const r = island.radius * MAP_SCALE;
    // Sand ring.
    ctx.fillStyle = '#e8d9a0';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Grass dome.
    const grass = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 0.96);
    grass.addColorStop(0, island.volcano ? '#7a6a55' : '#4d8a3f');
    grass.addColorStop(0.7, island.volcano ? '#6b5a48' : '#3f7a34');
    grass.addColorStop(1, '#2f6b2c');
    ctx.fillStyle = grass;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.94, 0, Math.PI * 2);
    ctx.fill();
    // Jungle patches: darker green blobs.
    ctx.fillStyle = 'rgba(24, 84, 32, 0.55)';
    for (let i = 0; i < 26; i++) {
      const a = random() * Math.PI * 2;
      const d = random() * r * 0.72;
      const br = r * (0.08 + random() * 0.14);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, br, 0, Math.PI * 2);
      ctx.fill();
    }
    if (island.volcano) {
      // Crater: dark ring with a glowing heart.
      ctx.fillStyle = '#3a2c22';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff7a2f';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      // Lava trickle down the south-east slope.
      ctx.strokeStyle = 'rgba(255, 122, 47, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.05, cy + r * 0.1);
      ctx.quadraticCurveTo(cx + r * 0.3, cy + r * 0.35, cx + r * 0.42, cy + r * 0.62);
      ctx.stroke();
    }
    // Island name, painted along the shore so the map reads from the air.
    ctx.fillStyle = 'rgba(255, 250, 230, 0.9)';
    ctx.font = `bold ${Math.round(r * 0.16)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(island.name.toUpperCase(), cx, cy + r * 0.72);
  }

  // Runways on top of the grass.
  for (const runway of Object.values(RUNWAYS)) paintRunway(ctx, runway);

  // A few tiny boats: white specks with a wake, for scale.
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) {
    const x = 300 + random() * (size - 600);
    const y = 300 + random() * (size - 600);
    ctx.fillRect(x, y, 5, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x - 14, y + 1, 12, 1);
    ctx.fillStyle = '#ffffff';
  }

  return { canvas, islands: ISLANDS };
}

// Clouds drift slowly above the islands; fixed positions, seeded once.
export function buildClouds() {
  const random = mulberry32(77);
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    clouds.push({
      x: 300 + random() * 5400,
      y: 300 + random() * 5400,
      z: 320 + random() * 220,
      size: 90 + random() * 160,
      drift: pickInRange(random, 1.5, 4),
    });
  }
  return clouds;
}

export function runwayAt(x, y) {
  for (const runway of Object.values(RUNWAYS)) {
    const heading = (runway.headingDeg * Math.PI) / 180;
    const fx = Math.sin(heading);
    const fy = -Math.cos(heading);
    const rx = x - runway.x;
    const ry = y - runway.y;
    const along = rx * fx + ry * fy;
    const across = Math.abs(rx * -fy + ry * fx);
    if (Math.abs(along) < runway.length / 2 && across < runway.width / 2) {
      return { runway, along, across };
    }
  }
  return null;
}

// What the plane is about to touch: open water, a runway strip, or land.
// Water is anywhere outside every island's shore.
export function surfaceAt(x, y) {
  if (runwayAt(x, y)) return 'runway';
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dy = y - island.y;
    if (Math.sqrt(dx * dx + dy * dy) < island.radius) return 'land';
  }
  return 'water';
}

export { ISLANDS };
