// Screenshot staging: puts the real game into the exact moments the
// bounty asks to see — chase view over the islands, the lit cockpit,
// a runway on final approach, and the campaign win screen. The game
// itself flies from there; nothing here draws a fake picture.

import { MISSIONS } from './missions.js';
import { degreesToRadians } from './random.js';

export function applyShotScene(game, scene) {
  const flight = game.flight;
  if (scene === 'cover') {
    // Mission 1, chasing the third ring over the bay, islands and volcano ahead.
    game.beginMission(0);
    game.state = 'flying';
    const ring = game.missionState.rings[2];
    flight.x = ring.x - Math.sin(degreesToRadians(12)) * 200;
    flight.y = ring.y + Math.cos(degreesToRadians(12)) * 200;
    flight.heading = degreesToRadians(12);
    flight.altitude = 205;
    flight.speed = 58;
    flight.pitch = 3;
    flight.bank = -8;
    flight.throttle = 0.78;
    flight.onGround = false;
    flight.gearDown = false;
    game.view = 'chase';
  } else if (scene === 'cockpit') {
    // Same sortie, but from the pilot's seat, instruments lit, ring ahead.
    game.beginMission(0);
    game.state = 'flying';
    const ring = game.missionState.rings[4];
    flight.x = ring.x - Math.sin(degreesToRadians(-14)) * 220;
    flight.y = ring.y + Math.cos(degreesToRadians(-14)) * 220;
    flight.heading = degreesToRadians(-14);
    flight.altitude = 225;
    flight.speed = 56;
    flight.pitch = 2;
    flight.bank = 6;
    flight.throttle = 0.75;
    flight.onGround = false;
    flight.gearDown = false;
    game.view = 'cockpit';
  } else if (scene === 'landing') {
    // Mission 2 on final approach: gear down, flaps down, runway Hijau ahead.
    // Approaching from the east over the ocean, heading west onto the strip:
    // 1,750 m out at 55 m, a gentle 2-degree glide slope to the threshold.
    game.beginMission(1);
    game.state = 'flying';
    flight.x = 4500 + 1750;
    flight.y = 1200;
    flight.heading = degreesToRadians(270);
    flight.altitude = 55;
    flight.speed = 40;
    flight.pitch = -2;
    flight.bank = 0;
    flight.throttle = 0.45;
    flight.onGround = false;
    flight.gearDown = true;
    flight.flapsDown = true;
    flight.fuel = 61;
    game.missionState.ringsPassed = 3;
    game.missionState.rings.forEach((r) => { r.passed = true; });
    game.view = 'chase';
  } else if (scene === 'win') {
    // Campaign complete, scored high, over the islands at golden light.
    game.beginMission(2);
    game.state = 'campaign';
    game.missionState.score = 2480;
    game.missionState.missionScore = 940;
    flight.x = 3000;
    flight.y = 3000;
    flight.heading = degreesToRadians(30);
    flight.altitude = 260;
    flight.speed = 50;
    flight.throttle = 0.6;
    flight.onGround = false;
    flight.gearDown = false;
    game.view = 'chase';
  }
}

export function shotScenes() {
  return ['cover', 'cockpit', 'landing', 'win'];
}

export { MISSIONS };
