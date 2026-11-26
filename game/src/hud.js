// The HUD and the screens around the flying: instruments on top of the
// world, a minimap, clickable cockpit buttons, and the title, briefing
// and debrief screens. Everything here is drawn, so a screenshot always
// shows the game at its most legible.

import { VIEW, GAME_TITLE, GAME_SUBTITLE, RUNWAYS } from './config.js';
import { clamp } from './random.js';
import { formatTime, headingLabel, missionObjectiveText, MISSIONS } from './missions.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 14, 20, 0.62)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function bigNumber(ctx, label, value, unit, x, y, colour) {
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(label, x, y);
  ctx.fillStyle = colour || '#ffffff';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(value, x, y + 32);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(unit, x + ctx.measureText(value).width + 62, y + 32);
}

export function drawHud(ctx, game, input) {
  const { width: W } = VIEW;
  const flight = game.flight;
  const state = game.missionState;
  const headingDeg = Math.round(((flight.heading * 180) / Math.PI % 360 + 360) % 360);
  const knots = Math.round(flight.speed * 1.944);
  const feet = Math.round(flight.altitude * 3.28084);

  // Top bar: altitude, speed, heading — the three numbers the bounty asks for.
  panel(ctx, 14, 12, 250, 64);
  bigNumber(ctx, 'ALTITUDE', String(feet).padStart(4, '0'), 'FT', 26, 28);
  panel(ctx, 274, 12, 230, 64);
  bigNumber(ctx, 'AIRSPEED', String(knots).padStart(3, '0'), 'KT', 286, 28);
  panel(ctx, 514, 12, 250, 64);
  bigNumber(
    ctx,
    'HEADING',
    `${String(headingDeg).padStart(3, '0')}° ${headingLabel(headingDeg)}`,
    '',
    526,
    28,
  );

  // Mission clock, score and lives, top right.
  panel(ctx, W - 264, 12, 250, 64);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('TIME', W - 26, 28);
  ctx.fillStyle = state.timeLeft < 30 ? '#ff5a4d' : '#ffffff';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(formatTime(state.timeLeft), W - 26, 60);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`SCORE ${state.score}`, W - 150, 28);

  // Objective banner under the top bar.
  const objective = missionObjectiveText(state);
  ctx.font = 'bold 16px sans-serif';
  const bannerW = ctx.measureText(objective).width + 36;
  panel(ctx, (W - bannerW) / 2, 86, bannerW, 30);
  ctx.fillStyle = '#ffd23e';
  ctx.textAlign = 'center';
  ctx.fillText(`MISI ${game.mission.number} — ${objective}`, W / 2, 106);

  // Fuel and throttle, left edge.
  panel(ctx, 14, 86, 190, 76);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('FUEL', 26, 102);
  const fuelFrac = clamp(flight.fuel / 100, 0, 1);
  ctx.fillStyle = '#22303a';
  ctx.fillRect(26, 108, 166, 12);
  ctx.fillStyle = fuelFrac > 0.5 ? '#34d17b' : fuelFrac > 0.25 ? '#ffb347' : '#ff5a4d';
  ctx.fillRect(26, 108, 166 * fuelFrac, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('THROTTLE', 26, 138);
  ctx.fillStyle = '#22303a';
  ctx.fillRect(26, 144, 166, 10);
  ctx.fillStyle = '#7ec8ff';
  ctx.fillRect(26, 144, 166 * flight.throttle, 10);

  // Warnings, centre screen, impossible to miss.
  if (flight.stalled && !flight.onGround) {
    ctx.fillStyle = Math.sin(game.time * 10) > 0 ? '#ff5a4d' : '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALL — TURUNKAN HIDUNG', W / 2, 190);
  } else if (flight.fuel < 25 && flight.fuel > 0) {
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BAHAN BAKAR MENIPIS', W / 2, 190);
  } else if (flight.engineOut) {
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MESIN MATI — MELUNCUR KE DARAT', W / 2, 190);
  }

  // Toasts: ring passes, landings, mission events — just under the banner,
  // never in the middle of the windshield.
  game.toasts.forEach((toast, i) => {
    const alpha = clamp(toast.life, 0, 1);
    ctx.fillStyle = `rgba(255, 210, 62, ${alpha})`;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(toast.text, W / 2, 150 + i * 30);
  });

  // Lives, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`✈ ${'●'.repeat(Math.max(0, game.lives))}${'○'.repeat(Math.max(0, 3 - game.lives))}`, 16, VIEW.height - 16);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText('↑↓ pitch   ←→ belok   Shift/Ctrl throttle   G gear   F flap   C kamera   P jeda', 16, VIEW.height - 70);

  drawMinimap(ctx, game);
  drawCockpitButtons(ctx, game, input);
}

function drawMinimap(ctx, game) {
  const size = 168;
  const x = VIEW.width - size - 14;
  const y = VIEW.height - size - 14;
  panel(ctx, x - 6, y - 6, size + 12, size + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.drawImage(game.terrainMap.canvas, 0, 0, 2048, 2048, x, y, size, size);
  // Target runway and next ring.
  const state = game.missionState;
  if (game.mission.landAt) {
    const runway = RUNWAYS[game.mission.landAt.toLowerCase()];
    if (runway) {
      ctx.fillStyle = '#40ff96';
      ctx.beginPath();
      ctx.arc(x + (runway.x / 6000) * size, y + (runway.y / 6000) * size, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const ring = state.rings[state.ringsPassed];
  if (ring) {
    ctx.strokeStyle = '#ffd640';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + (ring.x / 6000) * size, y + (ring.y / 6000) * size, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The plane, pointing where it is heading.
  ctx.translate(x + (game.flight.x / 6000) * size, y + (game.flight.y / 6000) * size);
  ctx.rotate(game.flight.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 7);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PETA', x, y - 10);
}

function drawCockpitButtons(ctx, game, input) {
  const buttons = [
    { label: 'THR −', action: () => { game.flight.throttle = clamp(game.flight.throttle - 0.1, 0, 1); } },
    { label: 'THR +', action: () => { game.flight.throttle = clamp(game.flight.throttle + 0.1, 0, 1); } },
    { label: game.flight.gearDown ? 'GEAR ▼' : 'GEAR ▲', action: () => { game.flight.gearDown = !game.flight.gearDown; } },
    { label: game.flight.flapsDown ? 'FLAP ▼' : 'FLAP ▲', action: () => { game.flight.flapsDown = !game.flight.flapsDown; } },
    { label: game.view === 'chase' ? 'KOKPIT' : 'CHASE', action: () => { game.view = game.view === 'chase' ? 'cockpit' : 'chase'; } },
    { label: game.audio.muted ? 'SUARA ✕' : 'SUARA ♪', action: () => { game.audio.toggleMute(); } },
  ];
  const y = VIEW.height - 52;
  let x = VIEW.width / 2 - (buttons.length * 86) / 2;
  ctx.font = 'bold 13px sans-serif';
  buttons.forEach((button) => {
    panel(ctx, x, y, 78, 34);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(button.label, x + 39, y + 22);
    input.registerButton({ x, y, w: 78, h: 34, onClick: button.action });
    x += 86;
  });
}

function menuButton(ctx, input, label, cx, y, w, action) {
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(cx - w / 2, y, w, 52);
  ctx.fillStyle = '#1a2027';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, y + 33);
  input.registerButton({ x: cx - w / 2, y, w, h: 52, onClick: action });
}

function screenBackdrop(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, 'rgba(10, 25, 45, 0.82)');
  gradient.addColorStop(1, 'rgba(10, 25, 45, 0.68)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

export function drawTitle(ctx, game, input) {
  screenBackdrop(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(GAME_TITLE, VIEW.width / 2, 180);
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px sans-serif';
  ctx.fillText('Kurir Kepulauan — terbang, antar, mendarat', VIEW.width / 2, 222);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '17px sans-serif';
  ctx.fillText('Tiga misi melintasi kepulauan: cincin di Teluk Biru, antar paket ke Pulau Hijau,', VIEW.width / 2, 290);
  ctx.fillText('dan kurir badai senja ke Karang. Bahan bakar terbatas — terbanglah dengan cerdas.', VIEW.width / 2, 316);
  ctx.fillStyle = '#7ec8ff';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('↑ ↓ naik / turun      ← → belok      Shift / Ctrl gas      G roda      F flap      C kamera', VIEW.width / 2, 372);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '15px sans-serif';
  ctx.fillText('Mouse juga bisa: klik tombol kokpit di bawah, atau seret langit untuk mengemudi.', VIEW.width / 2, 400);
  MISSIONS.forEach((mission, i) => {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${mission.number}. ${mission.name} — ${mission.subtitle}`, VIEW.width / 2, 452 + i * 28);
  });
  menuButton(ctx, input, '▶  MULAI TERBANG', VIEW.width / 2, 560, 320, () => game.startBriefing());
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('Enter juga bisa. Skor terbaik tersimpan di browser ini.', VIEW.width / 2, 650);
}

export function drawBriefing(ctx, game, input) {
  screenBackdrop(ctx);
  const mission = game.mission;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`MISI ${mission.number} DARI 3`, VIEW.width / 2, 170);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(mission.name, VIEW.width / 2, 236);
  ctx.fillStyle = '#7ec8ff';
  ctx.font = '22px sans-serif';
  ctx.fillText(mission.subtitle, VIEW.width / 2, 276);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '18px sans-serif';
  wrapText(ctx, mission.briefing, VIEW.width / 2, 330, 760, 28);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`Batas waktu ${formatTime(mission.timeLimit)}   •   Bahan bakar ${mission.fuel}%`, VIEW.width / 2, 470);
  menuButton(ctx, input, '✈  LEPAS LANDAS', VIEW.width / 2, 520, 320, () => game.startFlying());
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px sans-serif';
  ctx.fillText('Tekan Enter untuk lepas landas.', VIEW.width / 2, 610);
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
}

export function drawDebrief(ctx, game, input) {
  screenBackdrop(ctx);
  const state = game.missionState;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#34d17b';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('MISI SELESAI!', VIEW.width / 2, 220);
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px sans-serif';
  ctx.fillText(`${game.mission.name} — ${game.mission.subtitle}`, VIEW.width / 2, 264);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`Skor misi: ${state.missionScore}      Skor total: ${state.score}`, VIEW.width / 2, 330);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '17px sans-serif';
  ctx.fillText(`Cincin: ${state.ringsPassed}/${state.rings.length}`, VIEW.width / 2, 372);
  if (state.landedAt) {
    ctx.fillText(`Mendarat di ${state.landedAt} — sentuhan ${state.bestLandingRate.toFixed(1)} m/s`, VIEW.width / 2, 400);
  } else {
    ctx.fillText(`Sisa waktu: ${formatTime(state.timeLeft)}`, VIEW.width / 2, 400);
  }
  const last = game.mission.number >= MISSIONS.length;
  menuButton(
    ctx,
    input,
    last ? '🏆  LIHAT HASIL AKHIR' : '▶  MISI BERIKUTNYA',
    VIEW.width / 2,
    470,
    340,
    () => game.nextMission(),
  );
  menuButton(ctx, input, 'ULANGI MISI INI', VIEW.width / 2, 540, 340, () => game.retryMission());
}

export function drawCrash(ctx, game, input) {
  screenBackdrop(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4d';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('PESAWAT JATUH', VIEW.width / 2, 230);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText(game.missionState.failReason || 'Pesawat jatuh.', VIEW.width / 2, 280);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`Nyawa tersisa: ${game.lives}`, VIEW.width / 2, 330);
  if (game.lives > 0) {
    menuButton(ctx, input, '↻  COBA LAGI', VIEW.width / 2, 400, 300, () => game.retryMission());
  } else {
    menuButton(ctx, input, '↻  MULAI DARI AWAL', VIEW.width / 2, 400, 300, () => game.restartCampaign());
  }
}

export function drawCampaignComplete(ctx, game, input) {
  screenBackdrop(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('KURIR LEGENDA!', VIEW.width / 2, 200);
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px sans-serif';
  ctx.fillText('Ketiga misi selesai. Semua paket sampai, semua cincin tertembus.', VIEW.width / 2, 248);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 34px monospace';
  ctx.fillText(`SKOR AKHIR: ${game.missionState.score}`, VIEW.width / 2, 320);
  const best = Number(localStorage.getItem('nusa-sky-courier-best') || 0);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Skor terbaik: ${Math.max(best, game.missionState.score)}`, VIEW.width / 2, 356);
  menuButton(ctx, input, '✈  TERBANG LAGI', VIEW.width / 2, 430, 320, () => game.restartCampaign());
}

export function drawPaused(ctx, game, input) {
  screenBackdrop(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('JEDA', VIEW.width / 2, 300);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '18px sans-serif';
  ctx.fillText('Tekan P atau klik tombol di bawah untuk lanjut terbang.', VIEW.width / 2, 344);
  menuButton(ctx, input, '▶  LANJUT', VIEW.width / 2, 400, 280, () => game.togglePause());
}
