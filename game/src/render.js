// The world renderer: a Mode-7 ground sampled from the terrain map,
// a painted sky with sun and drifting clouds, glowing target rings,
// a runway beacon, and the aircraft — chase view or a lit cockpit.

import { VIEW, CAMERA, RING, DAY_SKY, DUSK_SKY, RUNWAYS } from './config.js';
import { clamp, lerp } from './random.js';
import { terrainHeight } from './terrain.js';

export function createRenderer(terrainMap, clouds) {
  const viewCanvas = document.createElement('canvas');
  viewCanvas.width = VIEW.viewCanvas;
  viewCanvas.height = VIEW.viewCanvas;
  const viewCtx = viewCanvas.getContext('2d');
  const mapCanvas = terrainMap.canvas;

  const renderer = {
    horizonY: VIEW.height * CAMERA.horizonBase,
    eyeHeight: 3,
  };

  function skyColors(dusk) {
    return dusk ? DUSK_SKY : DAY_SKY;
  }

  function drawSky(ctx, game, horizonY) {
    const { width: W, height: H } = VIEW;
    const sky = skyColors(game.mission.dusk);
    const gradient = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
    gradient.addColorStop(0, sky.top);
    gradient.addColorStop(0.62, sky.mid);
    gradient.addColorStop(1, sky.horizon);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, horizonY + 40);
    // Sun: high and warm by day, low and orange at dusk.
    const sunX = W * 0.76;
    const sunY = game.mission.dusk ? horizonY - 60 : horizonY - 190;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
    glow.addColorStop(0, sky.sun);
    glow.addColorStop(0.25, 'rgba(255, 240, 190, 0.55)');
    glow.addColorStop(1, 'rgba(255, 240, 190, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
    ctx.fillStyle = sky.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, game.mission.dusk ? 34 : 26, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGround(ctx, game, horizonY) {
    const { width: W, height: H } = VIEW;
    const flight = game.flight;
    const sky = skyColors(game.mission.dusk);
    const eyeH = Math.max(2, flight.altitude - terrainHeight(flight.x, flight.y) + CAMERA.chaseHeight);
    renderer.eyeHeight = eyeH;

    // Rotate the terrain map so "ahead" is up, centred on the plane.
    const heading = flight.heading;
    const k = VIEW.viewScale / (2048 / 6000);
    const pxm = flight.x * (2048 / 6000);
    const pym = flight.y * (2048 / 6000);
    const a = k * Math.cos(heading);
    const b = -k * Math.sin(heading);
    const c = k * Math.sin(heading);
    const d = k * Math.cos(heading);
    viewCtx.setTransform(a, b, c, d, VIEW.viewPlaneX - a * pxm - c * pym, VIEW.viewPlaneY - b * pxm - d * pym);
    viewCtx.fillStyle = '#1b5f8a';
    viewCtx.fillRect(-4000, -4000, 12000, 12000);
    viewCtx.drawImage(mapCanvas, 0, 0);

    // One horizontal strip of the map per screen row: the Mode-7 trick.
    const focal = VIEW.focal;
    const halfTan = VIEW.fovHalfTan;
    for (let y = Math.floor(horizonY) + 1; y < H; y += 2) {
      const depth = (eyeH * focal) / (y - horizonY);
      if (depth > VIEW.maxGroundDistance) {
        ctx.fillStyle = sky.haze;
        ctx.fillRect(0, y, W, 2);
        continue;
      }
      const v = VIEW.viewPlaneY - depth * VIEW.viewScale;
      if (v < 0) {
        ctx.fillStyle = sky.haze;
        ctx.fillRect(0, y, W, 2);
        continue;
      }
      const halfW = depth * VIEW.viewScale * halfTan;
      ctx.drawImage(viewCanvas, VIEW.viewPlaneX - halfW, v, halfW * 2, 1, 0, y, W, 2);
      const haze = clamp((depth - 800) / 2000, 0, 0.75);
      if (haze > 0.01) {
        ctx.fillStyle = hexWithAlpha(sky.haze, haze);
        ctx.fillRect(0, y, W, 2);
      }
    }
  }

  function hexWithAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }

  // Project a world point to the screen. Returns null when behind the camera.
  function project(game, x, y, z, horizonY) {
    const flight = game.flight;
    const dx = x - flight.x;
    const dy = y - flight.y;
    const sinH = Math.sin(flight.heading);
    const cosH = Math.cos(flight.heading);
    const fwd = dx * sinH - dy * cosH;
    if (fwd < 6) return null;
    const lat = dx * cosH + dy * sinH;
    const eyeAlt = flight.altitude + CAMERA.chaseHeight;
    const sx = VIEW.width / 2 + (lat / fwd) * VIEW.focal;
    const sy = horizonY - ((z - eyeAlt) / fwd) * VIEW.focal;
    return { sx, sy, scale: VIEW.focal / fwd, fwd };
  }

  function drawClouds(ctx, game, horizonY) {
    const sorted = [...clouds].sort((a, b) => {
      const da = cloudForward(game, a);
      const db = cloudForward(game, b);
      return db - da;
    });
    for (const cloud of sorted) {
      const p = project(game, cloud.x, cloud.y, cloud.z, horizonY);
      if (!p || p.fwd > 3600) continue;
      const size = (cloud.size * p.scale) / 2;
      if (size < 4) continue;
      const alpha = clamp(1.15 - p.fwd / 3200, 0.25, 0.9);
      ctx.fillStyle = game.mission.dusk
        ? `rgba(255, 205, 180, ${alpha})`
        : `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, size, size * 0.42, 0, 0, Math.PI * 2);
      ctx.ellipse(p.sx - size * 0.55, p.sy + size * 0.1, size * 0.6, size * 0.3, 0, 0, Math.PI * 2);
      ctx.ellipse(p.sx + size * 0.55, p.sy + size * 0.08, size * 0.65, size * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function cloudForward(game, cloud) {
    const dx = cloud.x - game.flight.x;
    const dy = cloud.y - game.flight.y;
    return dx * Math.sin(game.flight.heading) - dy * Math.cos(game.flight.heading);
  }

  function drawRings(ctx, game, horizonY, time) {
    const state = game.missionState;
    state.rings.forEach((ring, index) => {
      const p = project(game, ring.x, ring.y, ring.z, horizonY);
      if (!p) return;
      const isNext = index === state.ringsPassed;
      const isPassed = ring.passed;
      if (isPassed) return; // flown rings vanish — the sky ahead is what matters
      const r = RING.radius * p.scale;
      if (r < 2) return;
      const pulse = isNext ? 0.75 + 0.25 * Math.sin(time * 5) : 0.55;
      const colour = isNext ? '255, 214, 64' : '120, 220, 255';
      ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.strokeStyle = `rgba(${colour}, ${0.35 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, r, r * 0.86, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = Math.max(1.5, r * 0.06);
      ctx.strokeStyle = `rgba(${colour}, ${pulse})`;
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, r, r * 0.86, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (isNext) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * pulse})`;
        ctx.font = `bold ${Math.max(11, Math.round(r * 0.28))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(p.fwd)} m`, p.sx, p.sy + r + 18);
      }
    });
  }

  function drawRunwayBeacon(ctx, game, horizonY, time) {
    const mission = game.mission;
    if (!mission.landAt) return;
    const runway = RUNWAYS[mission.landAt.toLowerCase()];
    if (!runway) return;
    const p = project(game, runway.x, runway.y, 70, horizonY);
    if (!p) return;
    const bob = Math.sin(time * 3) * 6;
    const size = clamp(26 * p.scale * 0.4, 8, 34);
    ctx.save();
    ctx.translate(p.sx, p.sy + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(64, 255, 150, 0.9)';
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${runway.id} — ${(p.fwd / 1000).toFixed(1)} km`,
      p.sx,
      p.sy + bob + size + 20,
    );
  }

  function drawRain(ctx, game, time) {
    if (!game.mission.dusk) return;
    const { width: W, height: H } = VIEW;
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const x = ((i * 137.5 + time * 340) % (W + 40)) - 20;
      const y = ((i * 211.3 + time * 900) % (H + 40)) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 6, y + 18);
    }
    ctx.stroke();
  }

  function drawAircraft(ctx, game, time) {
    const flight = game.flight;
    const { width: W, height: H } = VIEW;
    const cx = W / 2;
    const cy = H * 0.8 + flight.pitch * 1.2;
    const strobe = Math.sin(time * 6) > 0.6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((flight.bank * Math.PI) / 180);
    // Soft shadow of the plane on the airframe's own scale — a dark halo.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 150, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main wings: wide, red-tipped, white in the middle.
    ctx.fillStyle = '#f2ede2';
    roundRect(ctx, -165, -12, 330, 30, 12);
    ctx.fill();
    ctx.fillStyle = '#d23b2e';
    roundRect(ctx, -165, -12, 34, 30, 10);
    ctx.fill();
    roundRect(ctx, 131, -12, 34, 30, 10);
    ctx.fill();
    ctx.fillStyle = '#2b6cb8';
    ctx.fillRect(-34, -12, 68, 30);
    // Tailplane and fin, seen from behind and above.
    ctx.fillStyle = '#f2ede2';
    roundRect(ctx, -72, -118, 144, 22, 9);
    ctx.fill();
    ctx.fillStyle = '#d23b2e';
    ctx.beginPath();
    ctx.moveTo(-16, -96);
    ctx.lineTo(0, -152);
    ctx.lineTo(16, -96);
    ctx.closePath();
    ctx.fill();
    // Fuselage: tapering toward the nose, away from the camera.
    const body = ctx.createLinearGradient(0, -120, 0, 60);
    body.addColorStop(0, '#f7f3e8');
    body.addColorStop(0.6, '#efe8d6');
    body.addColorStop(1, '#d8cfb8');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-26, 62);
    ctx.quadraticCurveTo(-34, -40, -16, -118);
    ctx.lineTo(16, -118);
    ctx.quadraticCurveTo(34, -40, 26, 62);
    ctx.quadraticCurveTo(0, 74, -26, 62);
    ctx.closePath();
    ctx.fill();
    // Canopy: the pilot's window, lit from inside.
    ctx.fillStyle = '#1d4e79';
    ctx.beginPath();
    ctx.ellipse(0, -84, 13, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160, 220, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(-3, -90, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cheatline stripe down the fuselage.
    ctx.fillStyle = '#d23b2e';
    ctx.fillRect(-27, -18, 54, 7);
    ctx.fillStyle = '#2b6cb8';
    ctx.fillRect(-27, -11, 54, 3);
    // Registration on the tail, small but legible.
    ctx.fillStyle = '#33302a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PK-NSC', 0, -100);
    // Navigation lights: red left, green right, white strobe on the tail.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-168, 3, strobe ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34d17b';
    ctx.beginPath();
    ctx.arc(168, 3, strobe ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    if (strobe) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -152, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCockpit(ctx, game, time) {
    const flight = game.flight;
    const { width: W, height: H } = VIEW;
    const panelTop = H * 0.62;
    // Windshield frame: dark pillars at the edges.
    ctx.fillStyle = '#14181d';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W * 0.16, 0);
    ctx.lineTo(W * 0.1, panelTop);
    ctx.lineTo(0, panelTop);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(W * 0.84, 0);
    ctx.lineTo(W * 0.9, panelTop);
    ctx.lineTo(W, panelTop);
    ctx.closePath();
    ctx.fill();
    // Engine cowling and the spinning prop blur, dead centre.
    ctx.fillStyle = '#232a31';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 60, H);
    ctx.quadraticCurveTo(W / 2, panelTop - 30, W / 2 + 60, H);
    ctx.closePath();
    ctx.fill();
    const propAngle = time * 28;
    ctx.save();
    ctx.translate(W / 2, panelTop - 46);
    ctx.rotate(propAngle);
    ctx.fillStyle = 'rgba(220, 230, 240, 0.10)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 150, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(220, 230, 240, 0.05)';
    ctx.beginPath();
    ctx.ellipse(W / 2, panelTop - 46, 150, 120, 0, 0, Math.PI * 2);
    ctx.fill();

    // Instrument panel.
    ctx.fillStyle = '#161b21';
    ctx.fillRect(0, panelTop, W, H - panelTop);
    ctx.fillStyle = '#232b33';
    ctx.fillRect(0, panelTop, W, 4);
    drawAttitude(ctx, game, W * 0.5, panelTop + 92, 62);
    drawAirspeedTape(ctx, game, W * 0.5 - 168, panelTop + 30, 124);
    drawAltimeter(ctx, game, W * 0.5 + 168, panelTop + 30, 124);
    drawCompassTape(ctx, game, W * 0.5, panelTop + 8);
    drawFuelGauge(ctx, game, W - 150, panelTop + 26, 128);
    drawThrottleLever(ctx, game, W - 52, panelTop + 26, 128);
    drawWarningLights(ctx, game, W * 0.5 - 260, panelTop + 30, time);
    // Panel labels, lit amber.
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', W * 0.5, panelTop + 172);
    ctx.fillText('AIRSPEED', W * 0.5 - 168, panelTop + 172);
    ctx.fillText('ALTIMETER', W * 0.5 + 168, panelTop + 172);
  }

  function drawAttitude(ctx, game, cx, cy, r) {
    const flight = game.flight;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate((-flight.bank * Math.PI) / 180);
    ctx.translate(0, flight.pitch * 1.6);
    ctx.fillStyle = '#3a7bd5';
    ctx.fillRect(-r - 4, -r - 60, r * 2 + 8, r + 60);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(-r - 4, 0, r * 2 + 8, r + 60);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r - 4, -2, r * 2 + 8, 4);
    ctx.restore();
    ctx.strokeStyle = '#f5f2e8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fixed wings marker.
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - r + 8, cy);
    ctx.lineTo(cx - 14, cy);
    ctx.moveTo(cx + 14, cy);
    ctx.lineTo(cx + r - 8, cy);
    ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAirspeedTape(ctx, game, cx, top, h) {
    const flight = game.flight;
    ctx.fillStyle = '#0c1116';
    ctx.fillRect(cx - 52, top, 104, h);
    ctx.strokeStyle = '#3a4550';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 52, top, 104, h);
    const knots = Math.round(flight.speed * 1.944);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(knots).padStart(3, '0'), cx, top + 34);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '11px sans-serif';
    ctx.fillText('KNOTS', cx, top + 52);
    ctx.fillStyle = '#7ee787';
    ctx.fillRect(cx - 52, top + h - 26, 104 * clamp(flight.speed / 90, 0, 1), 6);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '10px sans-serif';
    ctx.fillText('0 — 175 KT', cx, top + h - 8);
  }

  function drawAltimeter(ctx, game, cx, top, h) {
    const flight = game.flight;
    ctx.fillStyle = '#0c1116';
    ctx.fillRect(cx - 52, top, 104, h);
    ctx.strokeStyle = '#3a4550';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 52, top, 104, h);
    const feet = Math.round(flight.altitude * 3.28084);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(feet).padStart(4, '0'), cx, top + 34);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '11px sans-serif';
    ctx.fillText('FEET', cx, top + 52);
    const vsi = flight.verticalSpeed * 196.85;
    ctx.fillStyle = vsi >= 0 ? '#7ee787' : '#ff9a3d';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${vsi >= 0 ? '+' : ''}${Math.round(vsi)} FPM`, cx, top + h - 30);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '10px sans-serif';
    ctx.fillText('VERT SPEED', cx, top + h - 8);
  }

  function drawCompassTape(ctx, game, cx, top) {
    const flight = game.flight;
    const headingDeg = ((flight.heading * 180) / Math.PI % 360 + 360) % 360;
    ctx.fillStyle = '#0c1116';
    ctx.fillRect(cx - 150, top, 300, 22);
    ctx.strokeStyle = '#3a4550';
    ctx.strokeRect(cx - 150, top, 300, 22);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 150, top, 300, 22);
    ctx.clip();
    const points = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
    for (let d = 0; d < 360; d += 10) {
      let offset = d - headingDeg;
      if (offset > 180) offset -= 360;
      if (offset < -180) offset += 360;
      const x = cx + offset * 2.2;
      if (x < cx - 160 || x > cx + 160) continue;
      const label = points[Math.round(d / 30) % 12];
      const isMajor = d % 30 === 0;
      ctx.fillStyle = isMajor ? '#ffd23e' : '#9fb3c8';
      ctx.font = isMajor ? 'bold 12px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isMajor ? label : String(d).padStart(3, '0'), x, top + 15);
    }
    ctx.restore();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(cx - 6, top);
    ctx.lineTo(cx + 6, top);
    ctx.lineTo(cx, top + 8);
    ctx.closePath();
    ctx.fill();
  }

  function drawFuelGauge(ctx, game, x, top, h) {
    const flight = game.flight;
    ctx.fillStyle = '#0c1116';
    ctx.fillRect(x, top, 46, h);
    ctx.strokeStyle = '#3a4550';
    ctx.strokeRect(x, top, 46, h);
    const frac = clamp(flight.fuel / 100, 0, 1);
    const colour = frac > 0.5 ? '#7ee787' : frac > 0.25 ? '#ffb347' : '#ff5a4d';
    ctx.fillStyle = colour;
    ctx.fillRect(x + 4, top + h - 4 - (h - 8) * frac, 38, (h - 8) * frac);
    ctx.fillStyle = '#e8f0f8';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(flight.fuel)}%`, x + 23, top + h + 16);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '10px sans-serif';
    ctx.fillText('FUEL', x + 23, top + h + 30);
  }

  function drawThrottleLever(ctx, game, x, top, h) {
    const flight = game.flight;
    ctx.fillStyle = '#0c1116';
    ctx.fillRect(x, top, 30, h);
    ctx.strokeStyle = '#3a4550';
    ctx.strokeRect(x, top, 30, h);
    const y = top + h - 8 - (h - 16) * flight.throttle;
    ctx.strokeStyle = '#5a6672';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 15, top + 6);
    ctx.lineTo(x + 15, top + h - 6);
    ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(x + 15, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', x + 15, top + h + 16);
    ctx.fillText(`${Math.round(flight.throttle * 100)}%`, x + 15, top + h + 30);
  }

  function drawWarningLights(ctx, game, x, top, time) {
    const flight = game.flight;
    const lights = [
      { label: 'STALL', on: flight.stalled, colour: '#ff5a4d' },
      { label: 'FUEL', on: flight.fuel < 25, colour: '#ffb347' },
      { label: 'GEAR', on: flight.gearDown, colour: '#34d17b' },
    ];
    lights.forEach((light, i) => {
      const y = top + i * 30;
      const lit = light.on && (light.label !== 'STALL' || Math.sin(time * 10) > -0.2);
      ctx.fillStyle = lit ? light.colour : '#2a323b';
      ctx.beginPath();
      ctx.arc(x + 10, y + 8, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lit ? '#ffffff' : '#5a6672';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(light.label, x + 24, y + 12);
    });
  }

  function render(ctx, game, time) {
    const flight = game.flight;
    const horizonY = VIEW.height * CAMERA.horizonBase + flight.pitch * CAMERA.horizonPitchGain;
    renderer.horizonY = horizonY;
    drawSky(ctx, game, horizonY);
    drawGround(ctx, game, horizonY);
    drawClouds(ctx, game, horizonY);
    drawRings(ctx, game, horizonY, time);
    drawRunwayBeacon(ctx, game, horizonY, time);
    if (game.view === 'chase') drawAircraft(ctx, game, time);
    else drawCockpit(ctx, game, time);
    drawRain(ctx, game, time);
  }

  return { render, project, horizonY: () => renderer.horizonY };
}
