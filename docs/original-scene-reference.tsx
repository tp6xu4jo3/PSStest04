import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  Camera,
  Check,
  Clock,
  Eye,
  Layers,
  Maximize2,
  RotateCcw,
  Sparkles,
  User,
  Volume2,
  Wrench,
} from 'lucide-react';
import {
  CameraPreset,
  ComputedSeatStatus,
  LibrarySeat,
  LibrarySpace,
  SceneLayer,
  SeatFilterState,
  SpaceId,
} from '../types/library';
import {
  computeSeatStatus,
  SEAT_STATUS_META,
  seatMatchesFilter,
} from '../utils/seatLogic';

interface Scene25DProps {
  space: LibrarySpace;
  seats: LibrarySeat[];
  selectedSeatId: string | null;
  recommendedSeatIds: string[];
  activeLayer: SceneLayer;
  cameraPreset: CameraPreset;
  filter: SeatFilterState;
  focusTrigger: number;
  onSelectSeat: (seatId: string | null) => void;
  onChangeSpace: (spaceId: SpaceId) => void;
  onChangeLayer: (layer: SceneLayer) => void;
  onChangeCameraPreset: (preset: CameraPreset) => void;
  allSpaces: LibrarySpace[];
  spaceAvailability: Record<SpaceId, { available: number; total: number; anomalies: number }>;
}

interface SeatRig {
  seatId: string;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  padMesh: THREE.Mesh;
  padMat: THREE.MeshStandardMaterial;
  ringMesh: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  personGroup: THREE.Group;
  backpackGroup: THREE.Group;
  booksGroup: THREE.Group;
  anchorLocal: THREE.Vector3;
  worldAnchor: THREE.Vector3;
}

const _projVec = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createWoodTexture(baseHex: string, grainHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle architectural plank lines & grain
  ctx.strokeStyle = grainHex;
  for (let i = 0; i < 16; i++) {
    const y = i * 32;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  for (let i = 0; i < 140; i++) {
    ctx.globalAlpha = 0.05 + (i % 4) * 0.015;
    ctx.lineWidth = 1 + (i % 3);
    const y = (i * 19) % 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + ((i % 5) - 2), 340, y - ((i % 5) - 2), 512, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createTerrazzoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#EFECE5';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle architectural grid joints
  ctx.strokeStyle = 'rgba(130, 124, 114, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const chipColors = ['#C8C2B6', '#A7B4AE', '#D2B59B', '#9CA3AF', '#DFDBD2'];
  // Deterministic chips
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = chipColors[i % chipColors.length];
    ctx.globalAlpha = 0.45 + rand() * 0.35;
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 1.2 + rand() * 3.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + r, y + rand() * r);
    ctx.lineTo(x + rand() * r, y + r * 1.1);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function createMonitorScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 0, 128, 80);
  ctx.fillStyle = '#334155';
  ctx.fillRect(8, 8, 34, 64);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(48, 10, 72, 28);
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(48, 44, 48, 6);
  ctx.fillRect(48, 55, 62, 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 24, 128, 128, 126);
  grad.addColorStop(0, 'rgba(24, 26, 31, 0.22)');
  grad.addColorStop(0.55, 'rgba(24, 26, 31, 0.08)');
  grad.addColorStop(1, 'rgba(24, 26, 31, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function buildPottedPlant(scale = 1): THREE.Group {
  const group = new THREE.Group();
  const potMat = new THREE.MeshStandardMaterial({
    color: 0xe6e1d6,
    roughness: 0.72,
    metalness: 0.04,
  });
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x4b3f35,
    roughness: 0.95,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4f7a61,
    roughness: 0.58,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24 * scale, 0.18 * scale, 0.36 * scale, 16),
    potMat,
  );
  pot.position.y = 0.18 * scale;
  pot.castShadow = true;
  pot.receiveShadow = true;
  group.add(pot);

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * scale, 0.22 * scale, 0.03 * scale, 14),
    soilMat,
  );
  soil.position.y = 0.35 * scale;
  group.add(soil);

  // Multiple angled leaves
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 * scale, 8, 6),
      leafMat,
    );
    leaf.scale.set(0.75, 1.5, 0.25);
    leaf.position.set(
      Math.cos(angle) * 0.14 * scale,
      (0.54 + (i % 3) * 0.12) * scale,
      Math.sin(angle) * 0.14 * scale,
    );
    leaf.rotation.y = -angle;
    leaf.rotation.z = 0.35 + (i % 2) * 0.2;
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

function buildBookshelf(width: number, height: number): THREE.Group {
  const group = new THREE.Group();
  const oakMat = new THREE.MeshStandardMaterial({
    color: 0xc9ab84,
    roughness: 0.65,
    metalness: 0.04,
  });
  const backMat = new THREE.MeshStandardMaterial({
    color: 0xb0926c,
    roughness: 0.78,
  });

  // Back panel
  const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.06), backMat);
  back.position.set(0, height / 2, -0.16);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);

  // Side uprights
  [-width / 2 + 0.04, width / 2 - 0.04].forEach((sx) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, height, 0.34), oakMat);
    side.position.set(sx, height / 2, 0);
    side.castShadow = true;
    group.add(side);
  });

  // Shelves & miniature books
  const bookPalette = [0x3b6e8c, 0xc26d53, 0x5c7f67, 0xd4a656, 0x625f7a, 0x8f6b53];
  const shelfCount = 4;
  for (let s = 0; s <= shelfCount; s++) {
    const y = (s / shelfCount) * (height - 0.08) + 0.04;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(width, 0.045, 0.34), oakMat);
    shelf.position.set(0, y, 0);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    group.add(shelf);

    if (s < shelfCount) {
      let bx = -width / 2 + 0.14;
      let bi = 0;
      while (bx < width / 2 - 0.16) {
        const bw = 0.055 + ((bi + s) % 3) * 0.018;
        const bh = 0.22 + ((bi * 3 + s) % 4) * 0.045;
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, 0.2),
          new THREE.MeshStandardMaterial({
            color: bookPalette[(bi + s * 2) % bookPalette.length],
            roughness: 0.75,
          }),
        );
        book.position.set(bx + bw / 2, y + 0.02 + bh / 2, 0.02);
        book.castShadow = true;
        group.add(book);
        bx += bw + 0.015;
        bi++;
        if (bi % 6 === 0) bx += 0.12; // natural reading gap
      }
    }
  }
  return group;
}

function buildSeatAssembly(
  seat: LibrarySeat,
  screenTex: THREE.CanvasTexture,
  shirtColors: number[],
  index: number,
): SeatRig {
  const group = new THREE.Group();
  group.position.set(seat.position.x, seat.position.y, seat.position.z);
  group.rotation.y = seat.position.rotationY;

  const isPavilion = seat.spaceId === 'pavilion';
  const deskMat = new THREE.MeshStandardMaterial({
    color: isPavilion ? 0xd7ba92 : seat.spaceId === 'atrium' ? 0xf3f1ec : 0xdedad2,
    roughness: 0.52,
    metalness: 0.05,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: isPavilion ? 0x5c4a38 : 0x3b4252,
    roughness: 0.42,
    metalness: 0.55,
  });
  const chairFabricMat = new THREE.MeshStandardMaterial({
    color: isPavilion ? 0x64786e : seat.spaceId === 'atrium' ? 0x4b5c74 : 0x505366,
    roughness: 0.85,
    metalness: 0.02,
  });

  // 1. Ground Status Pad & Highlight Ring (Y slightly offset above floor)
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x059669,
    roughness: 0.75,
    transparent: true,
    opacity: 0.24,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const padMesh = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.022, 1.48), padMat);
  padMesh.position.set(0, 0.012, 0.14);
  padMesh.receiveShadow = true;
  group.add(padMesh);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x1d4ed8,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.76, 0.86, 32), ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.set(0, 0.026, 0.14);
  group.add(ringMesh);

  // 2. Desk (Tabletop + 4 legs + acoustic privacy screen + power outlet strip)
  const deskW = 1.12;
  const deskD = 0.62;
  const deskH = 0.74;

  const tabletop = new THREE.Mesh(new THREE.BoxGeometry(deskW, 0.045, deskD), deskMat);
  tabletop.position.set(0, deskH, -0.18);
  tabletop.castShadow = true;
  tabletop.receiveShadow = true;
  group.add(tabletop);

  const legOffsets: Array<[number, number]> = [
    [-deskW / 2 + 0.06, -0.18 - deskD / 2 + 0.06],
    [deskW / 2 - 0.06, -0.18 - deskD / 2 + 0.06],
    [-deskW / 2 + 0.06, -0.18 + deskD / 2 - 0.06],
    [deskW / 2 - 0.06, -0.18 + deskD / 2 - 0.06],
  ];
  legOffsets.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.018, deskH - 0.02, 8),
      frameMat,
    );
    leg.position.set(lx, (deskH - 0.02) / 2, lz);
    leg.castShadow = true;
    group.add(leg);
  });

  // Acoustic privacy divider at rear of desk (for Pavilion & Loft)
  if (seat.spaceId !== 'atrium' || seat.specs.dualMonitor) {
    const dividerMat = new THREE.MeshStandardMaterial({
      color: isPavilion ? 0xb59c7b : 0x9aa4b2,
      roughness: 0.82,
    });
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(deskW - 0.04, 0.34, 0.03),
      dividerMat,
    );
    divider.position.set(0, deskH + 0.18, -0.18 - deskD / 2 + 0.02);
    divider.castShadow = true;
    group.add(divider);
  }

  // Power Outlet Box on desk edge
  if (seat.specs.powerOutlet) {
    const outletBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.04, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x262930, roughness: 0.4, metalness: 0.6 }),
    );
    outletBox.position.set(-0.38, deskH + 0.04, -0.39);
    group.add(outletBox);
  }

  // 3. Optional Desk Lamp (composite 3 parts: base, stem, shade)
  if (seat.specs.deskLamp) {
    const lampMat = new THREE.MeshStandardMaterial({
      color: isPavilion ? 0xb48a4e : 0x2d333d,
      roughness: 0.3,
      metalness: 0.78,
    });
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 12), lampMat);
    lampBase.position.set(0.38, deskH + 0.03, -0.34);
    group.add(lampBase);

    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), lampMat);
    lampStem.position.set(0.38, deskH + 0.19, -0.34);
    lampStem.rotation.z = 0.15;
    group.add(lampStem);

    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.08, 12),
      lampMat,
    );
    lampShade.position.set(0.33, deskH + 0.34, -0.3);
    lampShade.rotation.z = 0.45;
    lampShade.castShadow = true;
    group.add(lampShade);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xfff3c4,
        emissive: 0xffd275,
        emissiveIntensity: 0.9,
      }),
    );
    bulb.position.set(0.32, deskH + 0.31, -0.29);
    group.add(bulb);
  }

  // 4. Optional Dual Monitor Setup
  if (seat.specs.dualMonitor) {
    const standPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.022, 0.28, 8),
      frameMat,
    );
    standPole.position.set(0, deskH + 0.15, -0.38);
    group.add(standPole);

    const screenMat = new THREE.MeshStandardMaterial({
      map: screenTex,
      roughness: 0.25,
      metalness: 0.15,
      emissive: 0x1e293b,
      emissiveIntensity: 0.25,
    });
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x1f242d,
      roughness: 0.4,
      metalness: 0.6,
    });

    [-0.21, 0.21].forEach((mx, mIdx) => {
      const monitorGroup = new THREE.Group();
      monitorGroup.position.set(mx, deskH + 0.26, -0.35);
      monitorGroup.rotation.y = mIdx === 0 ? 0.16 : -0.16;

      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.23, 0.02), bezelMat);
      bezel.castShadow = true;
      monitorGroup.add(bezel);

      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.2), screenMat);
      panel.position.z = 0.012;
      monitorGroup.add(panel);

      group.add(monitorGroup);
    });
  }

  // 5. Ergonomic Chair (5-star base + cylinder + seat cushion + backrest)
  const chairGroup = new THREE.Group();
  chairGroup.position.set(0, 0, 0.34);

  const starBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 5), frameMat);
  starBase.position.y = 0.04;
  chairGroup.add(starBase);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.38, 8), frameMat);
  stem.position.y = 0.23;
  chairGroup.add(stem);

  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.42), chairFabricMat);
  cushion.position.y = 0.44;
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  chairGroup.add(cushion);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.06), chairFabricMat);
  backrest.position.set(0, 0.69, 0.19);
  backrest.rotation.x = 0.08;
  backrest.castShadow = true;
  chairGroup.add(backrest);

  group.add(chairGroup);

  // 6. Dynamic Occupant (Seated Person — 5-part composite model)
  const personGroup = new THREE.Group();
  personGroup.position.set(0, 0.47, 0.31);
  const shirtColor = shirtColors[index % shirtColors.length];
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.78 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1cbb0, roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x2a2421, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x333c4d, roughness: 0.85 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.19), shirtMat);
  torso.position.set(0, 0.21, -0.02);
  torso.rotation.x = -0.14;
  torso.castShadow = true;
  personGroup.add(torso);

  // Head + Hair cap
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), skinMat);
  head.position.set(0, 0.49, -0.07);
  head.castShadow = true;
  personGroup.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.122, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  hair.position.set(0, 0.5, -0.065);
  hair.rotation.x = -0.25;
  personGroup.add(hair);

  // Arms reaching onto desk
  [-0.18, 0.18].forEach((ax) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.32), shirtMat);
    arm.position.set(ax, 0.25, -0.22);
    arm.rotation.x = 0.25;
    arm.castShadow = true;
    personGroup.add(arm);
  });

  // Knees/Lap
  const lap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.28), pantsMat);
  lap.position.set(0, 0.04, -0.16);
  personGroup.add(lap);

  personGroup.visible = seat.vision.hasPerson;
  group.add(personGroup);

  // 7. Dynamic Backpack (3-part composite beside chair)
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0.38, 0, 0.32);
  backpackGroup.rotation.y = -0.4;
  const packColor = [0x3d5a80, 0x7c5e4b, 0x4a6b5d, 0x5c5373][index % 4];
  const packMat = new THREE.MeshStandardMaterial({ color: packColor, roughness: 0.82 });

  const mainPack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.15), packMat);
  mainPack.position.y = 0.16;
  mainPack.castShadow = true;
  backpackGroup.add(mainPack);

  const pocket = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.16, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x262930, roughness: 0.78 }),
  );
  pocket.position.set(0, 0.11, 0.09);
  backpackGroup.add(pocket);

  backpackGroup.visible = seat.vision.hasBackpack;
  group.add(backpackGroup);

  // 8. Dynamic Books & Open Laptop on desk
  const booksGroup = new THREE.Group();
  booksGroup.position.set(0, deskH + 0.025, -0.14);

  const laptopBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.015, 0.19),
    new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.35, metalness: 0.7 }),
  );
  laptopBase.position.set(-0.06, 0.008, 0.03);
  booksGroup.add(laptopBase);

  const laptopLid = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.18, 0.012),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.7 }),
  );
  laptopLid.position.set(-0.06, 0.095, -0.065);
  laptopLid.rotation.x = -0.22;
  laptopLid.castShadow = true;
  booksGroup.add(laptopLid);

  const book1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.035, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x3b6e8c, roughness: 0.75 }),
  );
  book1.position.set(0.22, 0.018, 0);
  book1.rotation.y = 0.14;
  book1.castShadow = true;
  booksGroup.add(book1);

  const book2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.025, 0.21),
    new THREE.MeshStandardMaterial({ color: 0xd4a656, roughness: 0.75 }),
  );
  book2.position.set(0.22, 0.048, 0);
  book2.rotation.y = -0.08;
  booksGroup.add(book2);

  booksGroup.visible = seat.vision.hasBooks;
  group.add(booksGroup);

  // 9. Invisible Click/Hover Hit Proxy Box for reliable raycasting
  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 1.35, 1.45),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitMesh.position.set(0, 0.68, 0.1);
  hitMesh.userData.seatId = seat.id;
  hitMesh.layers.set(1);
  group.add(hitMesh);

  return {
    seatId: seat.id,
    group,
    hitMesh,
    padMesh,
    padMat,
    ringMesh,
    ringMat,
    personGroup,
    backpackGroup,
    booksGroup,
    anchorLocal: new THREE.Vector3(0, 1.38, 0.05),
    worldAnchor: new THREE.Vector3(),
  };
}

function buildArchitecturalShell(
  space: LibrarySpace,
  woodTex: THREE.CanvasTexture,
  terrazzoTex: THREE.CanvasTexture,
  shadowTex: THREE.CanvasTexture,
): {
  shellGroup: THREE.Group;
  cutawayWalls: THREE.Object3D[];
  envLayerGroup: THREE.Group;
  visionLayerGroup: THREE.Group;
} {
  const shellGroup = new THREE.Group();
  const cutawayWalls: THREE.Object3D[] = [];
  const envLayerGroup = new THREE.Group();
  const visionLayerGroup = new THREE.Group();

  const dims =
    space.id === 'pavilion'
      ? { w: 12.6, d: 9.6 }
      : space.id === 'atrium'
        ? { w: 13.8, d: 10.6 }
        : { w: 15.2, d: 11.4 };

  // Ground contact shadow plane beneath plinth
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.w + 4.8, dims.d + 4.8),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -0.39;
  shellGroup.add(contactShadow);

  // Architectural Museum Plinth
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w + 0.5, 0.36, dims.d + 0.5),
    new THREE.MeshStandardMaterial({ color: 0xe3dfd5, roughness: 0.88, metalness: 0.02 }),
  );
  plinth.position.y = -0.2;
  plinth.receiveShadow = true;
  shellGroup.add(plinth);

  // Main Floor
  const floorMat =
    space.id === 'pavilion'
      ? new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0.04 })
      : space.id === 'atrium'
        ? new THREE.MeshStandardMaterial({ map: terrazzoTex, roughness: 0.45, metalness: 0.06 })
        : new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.78, metalness: 0.04 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(dims.w, 0.04, dims.d), floorMat);
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  shellGroup.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf6f4ee,
    roughness: 0.85,
    metalness: 0.02,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.32,
  });
  const mullionMat = new THREE.MeshStandardMaterial({
    color: space.id === 'pavilion' ? 0x8b6e4e : 0x3b4252,
    roughness: 0.45,
    metalness: 0.4,
  });

  const wallH = space.id === 'loft' ? 3.5 : 2.85;

  // Back wall (-Z)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(dims.w, wallH, 0.18), wallMat);
  backWall.position.set(0, wallH / 2, -dims.d / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  shellGroup.add(backWall);

  // Left wall (-X): Window wall with mullions & sunlit strip
  const leftWallGroup = new THREE.Group();
  const baseKnee = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, dims.d), wallMat);
  baseKnee.position.set(-dims.w / 2, 0.325, 0);
  baseKnee.receiveShadow = true;
  leftWallGroup.add(baseKnee);

  const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, dims.d), wallMat);
  headerBeam.position.set(-dims.w / 2, wallH - 0.175, 0);
  headerBeam.castShadow = true;
  leftWallGroup.add(headerBeam);

  const glassPane = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, wallH - 1.0, dims.d - 0.4),
    glassMat,
  );
  glassPane.position.set(-dims.w / 2, 0.65 + (wallH - 1.0) / 2, 0);
  leftWallGroup.add(glassPane);

  const mullionCount = 5;
  for (let i = 0; i <= mullionCount; i++) {
    const mz = -dims.d / 2 + 0.2 + (i / mullionCount) * (dims.d - 0.4);
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, wallH - 0.9, 0.08),
      mullionMat,
    );
    mullion.position.set(-dims.w / 2, 0.65 + (wallH - 1.0) / 2, mz);
    mullion.castShadow = true;
    leftWallGroup.add(mullion);
  }
  shellGroup.add(leftWallGroup);
  cutawayWalls.push(leftWallGroup);

  // Low front/right cutaway glass/curb walls so user has unobstructed view
  const frontCurb = new THREE.Mesh(new THREE.BoxGeometry(dims.w, 0.36, 0.14), wallMat);
  frontCurb.position.set(0, 0.18, dims.d / 2);
  shellGroup.add(frontCurb);
  cutawayWalls.push(frontCurb);

  const rightCurb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, dims.d), wallMat);
  rightCurb.position.set(dims.w / 2, 0.18, 0);
  shellGroup.add(rightCurb);
  cutawayWalls.push(rightCurb);

  // Space-specific architectural features
  if (space.id === 'pavilion') {
    // Rear bookcases
    const shelf1 = buildBookshelf(3.4, 2.25);
    shelf1.position.set(-2.5, 0, -dims.d / 2 + 0.28);
    shellGroup.add(shelf1);

    const shelf2 = buildBookshelf(3.4, 2.25);
    shelf2.position.set(2.5, 0, -dims.d / 2 + 0.28);
    shellGroup.add(shelf2);

    // Acoustic timber ceiling fins
    for (let i = -4; i <= 4; i++) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.16, dims.d - 0.8),
        new THREE.MeshStandardMaterial({ color: 0xc8a97e, roughness: 0.65 }),
      );
      fin.position.set(i * 1.15, wallH - 0.12, 0);
      shellGroup.add(fin);
      cutawayWalls.push(fin);
    }

    // Potted plants
    const p1 = buildPottedPlant(1.1);
    p1.position.set(-5.3, 0, -4.1);
    shellGroup.add(p1);
    const p2 = buildPottedPlant(1.0);
    p2.position.set(5.3, 0, 3.8);
    shellGroup.add(p2);
  } else if (space.id === 'atrium') {
    // Central shared architectural studio island base plinth/trough
    const centralSpine = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.78, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.45, metalness: 0.3 }),
    );
    centralSpine.position.set(0, 0.39, 0);
    shellGroup.add(centralSpine);

    // Glass partition screens behind rear booths
    [-2.45, 2.45].forEach((bx) => {
      const divider = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 1.35, 0.05),
        glassMat,
      );
      divider.position.set(bx, 0.68, -2.35);
      shellGroup.add(divider);
    });

    // Overhead ring skylight beam
    const skylightFrame = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.07, 10, 48),
      new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.35, metalness: 0.6 }),
    );
    skylightFrame.rotation.x = Math.PI / 2;
    skylightFrame.position.set(0, wallH - 0.05, 0);
    shellGroup.add(skylightFrame);
    cutawayWalls.push(skylightFrame);

    // Courtyard planters
    [
      [-5.6, -3.8],
      [-5.6, 3.8],
      [5.5, -3.8],
      [5.5, 3.8],
    ].forEach(([px, pz]) => {
      const plant = buildPottedPlant(1.2);
      plant.position.set(px, 0, pz);
      shellGroup.add(plant);
    });
  } else if (space.id === 'loft') {
    // Upper Mezzanine Platform (x: 2.9 to 7.3, z: -5.3 to 4.6, y = 1.65)
    const mezzW = 4.4;
    const mezzD = 9.9;
    const mezzDeck = new THREE.Mesh(
      new THREE.BoxGeometry(mezzW, 0.16, mezzD),
      new THREE.MeshStandardMaterial({ color: 0xded9ce, roughness: 0.65, metalness: 0.08 }),
    );
    mezzDeck.position.set(5.1, 1.57, -0.35);
    mezzDeck.castShadow = true;
    mezzDeck.receiveShadow = true;
    shellGroup.add(mezzDeck);

    // Steel columns supporting mezzanine
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x2e3440,
      roughness: 0.38,
      metalness: 0.72,
    });
    [
      [3.1, -4.8],
      [3.1, 0.2],
      [3.1, 4.2],
      [7.0, -4.8],
      [7.0, 4.2],
    ].forEach(([cx, cz]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.55, 12), colMat);
      col.position.set(cx, 0.775, cz);
      col.castShadow = true;
      shellGroup.add(col);
    });

    // Glass railing along mezzanine west edge
    const railGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 7.6), glassMat);
    railGlass.position.set(2.96, 2.08, -1.4);
    shellGroup.add(railGlass);

    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 7.6), colMat);
    railTop.position.set(2.96, 2.52, -1.4);
    shellGroup.add(railTop);

    // Architectural Staircase connecting ground to mezzanine (x: 1.4 to 3.0, z: 3.1 to 4.5)
    const treadMat = new THREE.MeshStandardMaterial({ color: 0xc8aa82, roughness: 0.62 });
    const stepCount = 7;
    for (let s = 0; s < stepCount; s++) {
      const sx = 1.45 + (s / (stepCount - 1)) * 1.45;
      const sy = ((s + 1) / stepCount) * 1.56;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 1.25), treadMat);
      tread.position.set(sx, sy - 0.04, 3.8);
      tread.castShadow = true;
      tread.receiveShadow = true;
      shellGroup.add(tread);
    }

    const p1 = buildPottedPlant(1.15);
    p1.position.set(-6.4, 0, -4.6);
    shellGroup.add(p1);
    const p2 = buildPottedPlant(0.95);
    p2.position.set(6.8, 1.65, -4.8);
    shellGroup.add(p2);
  }

  // Environmental Layer (Sunlit zone & Acoustic contour rings)
  const sunStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, dims.d - 1.2),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  sunStrip.rotation.x = -Math.PI / 2;
  sunStrip.position.set(-dims.w / 2 + 2.0, 0.03, 0);
  envLayerGroup.add(sunStrip);

  const quietRing = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 3.6, 40),
    new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  quietRing.rotation.x = -Math.PI / 2;
  quietRing.position.set(space.id === 'loft' ? 4.8 : 0.8, space.id === 'loft' ? 1.69 : 0.035, 0);
  envLayerGroup.add(quietRing);
  envLayerGroup.visible = false;
  shellGroup.add(envLayerGroup);

  // Camera Vision Layer (3D Ceiling Cameras + Translucent Detection Frustum Cones)
  space.cameras.forEach((camSpec) => {
    const camPos = new THREE.Vector3(...camSpec.position);
    const lookTarget = new THREE.Vector3(...camSpec.lookAt);

    // Miniature Ceiling Camera Housing (always visible in shell)
    const camGroup = new THREE.Group();
    camGroup.position.copy(camPos);
    camGroup.lookAt(lookTarget);

    const camBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.7 }),
    );
    camBody.rotation.x = Math.PI / 2;
    camGroup.add(camBody);

    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7 }),
    );
    lens.position.z = 0.12;
    camGroup.add(lens);
    shellGroup.add(camGroup);

    // Translucent Vision Cone in visionLayerGroup
    const coneDist = camPos.distanceTo(lookTarget) * 1.15;
    const coneRadius = Math.tan(THREE.MathUtils.degToRad(camSpec.fovDeg / 2)) * coneDist * 0.72;
    const coneGeo = new THREE.ConeGeometry(coneRadius, coneDist, 24, 1, true);
    coneGeo.translate(0, -coneDist / 2, 0);
    coneGeo.rotateX(-Math.PI / 2);

    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.copy(camPos);
    coneMesh.lookAt(lookTarget);
    visionLayerGroup.add(coneMesh);
  });
  visionLayerGroup.visible = false;
  shellGroup.add(visionLayerGroup);

  return { shellGroup, cutawayWalls, envLayerGroup, visionLayerGroup };
}

function StatusPinIcon({ status }: { status: ComputedSeatStatus }) {
  switch (status) {
    case 'available':
      return <Check className="w-3 h-3" strokeWidth={2.5} />;
    case 'occupied_checked_in':
      return <User className="w-3 h-3" strokeWidth={2.2} />;
    case 'temp_away':
    case 'reserved_waiting':
      return <Clock className="w-3 h-3" strokeWidth={2.2} />;
    case 'anomaly_unbooked_occupied':
    case 'anomaly_reported':
      return <AlertTriangle className="w-3 h-3" strokeWidth={2.3} />;
    case 'maintenance':
      return <Wrench className="w-3 h-3" strokeWidth={2.2} />;
  }
}

export const Scene25D: React.FC<Scene25DProps> = ({
  space,
  seats,
  selectedSeatId,
  recommendedSeatIds,
  activeLayer,
  cameraPreset,
  filter,
  focusTrigger,
  onSelectSeat,
  onChangeSpace,
  onChangeLayer,
  onChangeCameraPreset,
  allSpaces,
  spaceAvailability,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Refs storing latest reactive values for Three.js render loop
  const seatsRef = useRef(seats);
  seatsRef.current = seats;
  const selectedIdRef = useRef(selectedSeatId);
  selectedIdRef.current = selectedSeatId;
  const recommendedRef = useRef(recommendedSeatIds);
  recommendedRef.current = recommendedSeatIds;
  const onSelectRef = useRef(onSelectSeat);
  onSelectRef.current = onSelectSeat;

  // Imperative bridge to trigger camera presets, space rebuilds, and state updates
  const engineRef = useRef<{
    requestRender: () => void;
    flyToSeat: (seatId: string) => void;
    applyPreset: (preset: CameraPreset) => void;
    rebuildSpace: (space: LibrarySpace, spaceSeats: LibrarySeat[]) => void;
    syncDynamicStates: (spaceSeats: LibrarySeat[], layer: SceneLayer, selected: string | null, recIds: string[]) => void;
  } | null>(null);

  const spaceSeats = useMemo(
    () => seats.filter((s) => s.spaceId === space.id),
    [seats, space.id],
  );

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f2ed);
    scene.fog = new THREE.Fog(0xf4f2ed, 38, 82);

    // Environment reflection via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // Orthographic 2.5D architectural camera
    const frustumSize = 13.5;
    const aspect = Math.max(0.5, mount.clientWidth / Math.max(1, mount.clientHeight));
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      120,
    );
    camera.position.set(18, 15.5, 18);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minZoom = 0.65;
    controls.maxZoom = 2.35;
    controls.minPolarAngle = 0.28;
    controls.maxPolarAngle = Math.PI / 2.25;
    controls.target.set(0, 0.5, 0);
    controls.update();

    // 3-Point Warm Architectural Daylight Rig
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0xd6cfc2, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.55);
    keyLight.position.set(-14, 18, 10);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -12;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 45;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.55);
    rimLight.position.set(14, 10, -14);
    scene.add(rimLight);

    // Procedural Textures
    const woodTex = createWoodTexture('#DFC8A6', '#BFA176');
    const terrazzoTex = createTerrazzoTexture();
    const screenTex = createMonitorScreenTexture();
    const shadowTex = createContactShadowTexture();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    woodTex.anisotropy = maxAniso;
    terrazzoTex.anisotropy = maxAniso;

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    let seatRigs: Record<string, SeatRig> = {};
    let hitMeshes: THREE.Mesh[] = [];
    let cutawayWalls: THREE.Object3D[] = [];
    let envLayerGroup: THREE.Group | null = null;
    let visionLayerGroup: THREE.Group | null = null;

    // Camera transition state
    let transitionActive = false;
    const camTargetPos = new THREE.Vector3().copy(camera.position);
    const orbitTargetGoal = new THREE.Vector3().copy(controls.target);
    let zoomGoal = 1.0;
    let cutawayAmount = 0;
    let cutawayGoal = 0;

    // Render scheduler respecting software WebGL
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;

    const updatePinPositions = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      for (const rig of Object.values(seatRigs)) {
        const el = pinRefs.current[rig.seatId];
        if (!el) continue;
        rig.worldAnchor.copy(rig.anchorLocal);
        rig.group.localToWorld(rig.worldAnchor);
        _projVec.copy(rig.worldAnchor).project(camera);
        const px = ((_projVec.x + 1) / 2) * w;
        const py = ((-_projVec.y + 1) / 2) * h;
        el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%)`;
      }
    };

    let lastFrameTime = performance.now();

    const performFrame = () => {
      if (disposed) return;
      renderDirty = false;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
      lastFrameTime = now;

      let stillAnimating = false;

      if (transitionActive) {
        const lambda = isSoftwareGl ? 18 : 7.5;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, camTargetPos.x, lambda, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, camTargetPos.y, lambda, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, camTargetPos.z, lambda, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, orbitTargetGoal.x, lambda, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, orbitTargetGoal.y, lambda, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, orbitTargetGoal.z, lambda, dt);
        camera.zoom = THREE.MathUtils.damp(camera.zoom, zoomGoal, lambda, dt);
        camera.updateProjectionMatrix();

        const posErr = camera.position.distanceTo(camTargetPos);
        const tgtErr = controls.target.distanceTo(orbitTargetGoal);
        const zoomErr = Math.abs(camera.zoom - zoomGoal);
        if (posErr < 0.03 && tgtErr < 0.02 && zoomErr < 0.005) {
          transitionActive = false;
        } else {
          stillAnimating = true;
        }
      }

      if (Math.abs(cutawayAmount - cutawayGoal) > 0.005) {
        cutawayAmount = THREE.MathUtils.damp(cutawayAmount, cutawayGoal, 8, dt);
        cutawayWalls.forEach((wall) => {
          wall.position.y = -cutawayAmount * 1.45;
          wall.visible = cutawayAmount < 0.92;
        });
        stillAnimating = true;
      }

      const dampingMoving = controls.update();
      renderer.render(scene, camera);
      updatePinPositions();

      if (stillAnimating || dampingMoving) {
        renderDirty = true;
      }
    };

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        performFrame();
        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    controls.addEventListener('start', () => {
      transitionActive = false;
    });
    controls.addEventListener('change', () => {
      requestRender();
    });

    const shirtColors = [0x3b6e8c, 0xb86b52, 0x4f7a61, 0x625f7a, 0x8b7355, 0x466978];

    const rebuildSpace = (nextSpace: LibrarySpace, nextSeats: LibrarySeat[]) => {
      while (worldGroup.children.length > 0) {
        worldGroup.remove(worldGroup.children[0]);
      }
      seatRigs = {};
      hitMeshes = [];

      const built = buildArchitecturalShell(nextSpace, woodTex, terrazzoTex, shadowTex);
      worldGroup.add(built.shellGroup);
      cutawayWalls = built.cutawayWalls;
      envLayerGroup = built.envLayerGroup;
      visionLayerGroup = built.visionLayerGroup;

      nextSeats.forEach((seat, idx) => {
        const rig = buildSeatAssembly(seat, screenTex, shirtColors, idx);
        worldGroup.add(rig.group);
        seatRigs[seat.id] = rig;
        hitMeshes.push(rig.hitMesh);
      });

      worldGroup.updateMatrixWorld(true);
      requestRender();
    };

    const syncDynamicStates = (
      nextSeats: LibrarySeat[],
      layer: SceneLayer,
      selected: string | null,
      recIds: string[],
    ) => {
      if (envLayerGroup) envLayerGroup.visible = layer === 'environment';
      if (visionLayerGroup) visionLayerGroup.visible = layer === 'vision';

      nextSeats.forEach((seat) => {
        const rig = seatRigs[seat.id];
        if (!rig) return;
        const status = computeSeatStatus(seat);
        const meta = SEAT_STATUS_META[status];

        rig.personGroup.visible = seat.vision.hasPerson;
        rig.backpackGroup.visible = seat.vision.hasBackpack;
        rig.booksGroup.visible = seat.vision.hasBooks;

        rig.padMat.color.set(meta.colorHex);
        const isSelected = selected === seat.id;
        const isRec = recIds.includes(seat.id);

        if (isSelected) {
          rig.padMat.opacity = 0.45;
          rig.ringMat.color.set(0x1d4ed8);
          rig.ringMat.opacity = 0.9;
        } else if (isRec) {
          rig.padMat.opacity = 0.4;
          rig.ringMat.color.set(0x059669);
          rig.ringMat.opacity = 0.85;
        } else {
          rig.padMat.opacity = status === 'available' ? 0.22 : 0.3;
          rig.ringMat.opacity = 0;
        }
      });

      requestRender();
    };

    const applyPreset = (preset: CameraPreset) => {
      transitionActive = true;
      orbitTargetGoal.set(0, 0.5, 0);
      if (preset === 'isometric') {
        camTargetPos.set(18, 15.5, 18);
        zoomGoal = 1.02;
        cutawayGoal = 0;
      } else if (preset === 'cutaway') {
        camTargetPos.set(16, 10.5, 19);
        zoomGoal = 1.12;
        cutawayGoal = 1;
      } else {
        camTargetPos.set(0.01, 26, 4.2);
        zoomGoal = 1.05;
        cutawayGoal = 0.6;
      }
      requestRender();
    };

    const flyToSeat = (seatId: string) => {
      const rig = seatRigs[seatId];
      if (!rig) return;
      transitionActive = true;
      orbitTargetGoal.set(
        rig.group.position.x,
        rig.group.position.y + 0.55,
        rig.group.position.z,
      );
      camTargetPos.set(
        rig.group.position.x + 14,
        rig.group.position.y + 12.5,
        rig.group.position.z + 14,
      );
      zoomGoal = 1.38;
      requestRender();
    };

    engineRef.current = {
      requestRender,
      flyToSeat,
      applyPreset,
      rebuildSpace,
      syncDynamicStates,
    };

    // Raycasting for Click & Hover
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Dragging camera, not clicking
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length > 0) {
        const seatId = hits[0].object.userData.seatId as string;
        onSelectRef.current(seatId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length > 0) {
        const seatId = hits[0].object.userData.seatId as string;
        renderer.domElement.style.cursor = 'pointer';
        setHoveredSeatId((prev) => (prev === seatId ? prev : seatId));
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredSeatId((prev) => (prev === null ? null : null));
      }
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const handleResize = () => {
      if (!mount || disposed) return;
      const w = mount.clientWidth;
      const h = Math.max(1, mount.clientHeight);
      const nextAspect = w / h;
      camera.left = (-frustumSize * nextAspect) / 2;
      camera.right = (frustumSize * nextAspect) / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    // Initial mount build
    rebuildSpace(space, seatsRef.current.filter((s) => s.spaceId === space.id));
    syncDynamicStates(
      seatsRef.current.filter((s) => s.spaceId === space.id),
      activeLayer,
      selectedIdRef.current,
      recommendedRef.current,
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      controls.dispose();
      woodTex.dispose();
      terrazzoTex.dispose();
      screenTex.dispose();
      shadowTex.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild space geometry when switching between the 3 architectural halls
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.rebuildSpace(space, spaceSeats);
    engineRef.current.syncDynamicStates(
      spaceSeats,
      activeLayer,
      selectedSeatId,
      recommendedSeatIds,
    );
    engineRef.current.applyPreset(cameraPreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id]);

  // Sync seat visual props & layer overlays whenever states change
  useEffect(() => {
    engineRef.current?.syncDynamicStates(
      spaceSeats,
      activeLayer,
      selectedSeatId,
      recommendedSeatIds,
    );
  }, [spaceSeats, activeLayer, selectedSeatId, recommendedSeatIds]);

  // Apply camera preset
  useEffect(() => {
    engineRef.current?.applyPreset(cameraPreset);
  }, [cameraPreset]);

  // Fly camera to seat when explicitly requested
  useEffect(() => {
    if (selectedSeatId && focusTrigger > 0) {
      engineRef.current?.flyToSeat(selectedSeatId);
    }
  }, [selectedSeatId, focusTrigger]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#F4F2ED] select-none">
      {/* Isolated WebGL Mount Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Graceful Fallback if WebGL disabled */}
      {webglUnavailable && (
        <div className="absolute inset-0 flex items-center justify-center p-8 bg-[#F4F2ED]">
          <div className="max-w-lg w-full bg-white border border-[#E5E1D8] rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#181A1F] mb-2">
              {space.name} — 平面席位總覽
            </h3>
            <p className="text-sm text-[#626770] mb-4">
              目前瀏覽器環境未啟用 WebGL 3D 加速，已切換至高對比平面席位檢視模式。
            </p>
            <div className="grid grid-cols-4 gap-2">
              {spaceSeats.map((seat) => {
                const st = computeSeatStatus(seat);
                const meta = SEAT_STATUS_META[st];
                return (
                  <button
                    key={seat.id}
                    onClick={() => onSelectSeat(seat.id)}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${meta.bgClass} ${meta.borderClass} ${meta.textClass}`}
                  >
                    <div className="font-mono-num text-xs font-semibold">{seat.code}</div>
                    <div className="text-[11px] mt-0.5 truncate">{meta.shortLabel}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Projected 3D-to-2D Interactive Seat Pins */}
      {!webglUnavailable && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {spaceSeats.map((seat) => {
            const status = computeSeatStatus(seat);
            const meta = SEAT_STATUS_META[status];
            const isSelected = selectedSeatId === seat.id;
            const isHovered = hoveredSeatId === seat.id;
            const isRecommended = recommendedSeatIds.includes(seat.id);
            const matches = seatMatchesFilter(seat, filter);

            return (
              <button
                key={seat.id}
                ref={(el) => {
                  pinRefs.current[seat.id] = el;
                }}
                type="button"
                onClick={() => onSelectSeat(seat.id)}
                onMouseEnter={() => setHoveredSeatId(seat.id)}
                onMouseLeave={() => setHoveredSeatId(null)}
                aria-label={`座位 ${seat.code} ${meta.label}`}
                style={{
                  opacity: matches || isSelected || isRecommended ? 1 : 0.34,
                }}
                className={`pointer-events-auto absolute top-0 left-0 flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium transition-shadow duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                  isSelected
                    ? 'bg-[#181A1F] text-white border-[#181A1F] shadow-md z-30 scale-105'
                    : isRecommended
                      ? 'bg-[#059669] text-white border-[#047857] shadow-md z-25'
                      : isHovered
                        ? 'bg-white text-[#181A1F] border-[#181A1F] shadow-md z-20'
                        : 'bg-white/95 text-[#181A1F] border-[#DCD6CA] shadow-sm z-10'
                }`}
              >
                <span
                  className="flex items-center justify-center w-4 h-4 rounded-sm shrink-0"
                  style={{
                    backgroundColor: isSelected || isRecommended ? 'rgba(255,255,255,0.18)' : `${meta.colorHex}18`,
                    color: isSelected || isRecommended ? '#FFFFFF' : meta.colorHex,
                  }}
                >
                  <StatusPinIcon status={status} />
                </span>
                <span className="font-mono-num font-semibold tracking-tight whitespace-nowrap">
                  {seat.code}
                </span>

                {activeLayer === 'environment' && (
                  <span className="font-mono-num text-[10px] opacity-80 whitespace-nowrap">
                    {seat.specs.noiseDb}dB
                  </span>
                )}
                {activeLayer === 'vision' && (
                  <span className="text-[10px] opacity-85 whitespace-nowrap">
                    {seat.vision.hasPerson ? '人' : '—'}
                    {'/'}
                    {seat.vision.hasBackpack || seat.vision.hasBooks ? '物' : '—'}
                  </span>
                )}
                {isRecommended && !isSelected && (
                  <span className="text-[10px] font-semibold whitespace-nowrap">推薦</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Top-Left: Space Switcher & Hall Atmosphere Header */}
      <div className="pointer-events-auto absolute top-4 left-4 right-4 md:right-auto z-20 flex flex-col gap-2 max-w-full md:max-w-[540px]">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white/95 border border-[#E5E1D8] rounded-xl shadow-sm">
          {allSpaces.map((sp) => {
            const active = sp.id === space.id;
            const stats = spaceAvailability[sp.id];
            return (
              <button
                key={sp.id}
                type="button"
                onClick={() => onChangeSpace(sp.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                  active
                    ? 'bg-[#181A1F] text-white'
                    : 'text-[#4B515C] hover:bg-[#F4F2ED] hover:text-[#181A1F]'
                }`}
              >
                <span>{sp.name}</span>
                <span
                  className={`font-mono-num text-[11px] ${
                    active ? 'text-white/80' : 'text-[#626770]'
                  }`}
                >
                  {stats.available}/{stats.total}
                </span>
                {stats.anomalies > 0 && (
                  <span
                    className={`font-mono-num text-[10px] font-semibold ${
                      active ? 'text-rose-300' : 'text-rose-600'
                    }`}
                  >
                    · {stats.anomalies}異常
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quiet architectural metadata strip (Zero-Pill Typography) */}
        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-white/90 border border-[#E5E1D8] rounded-lg text-xs text-[#545963] w-fit">
          <span className="font-medium text-[#181A1F]">{space.englishSubtitle}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">{space.floorAreaLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">{space.ambientDb} dB</span>
          <span aria-hidden="true">·</span>
          <span>{space.lightingProfile}</span>
        </div>
      </div>

      {/* Top-Right (or below space bar on small screens): 3D Layer & Camera Controls */}
      <div className="pointer-events-auto absolute top-[68px] sm:top-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 p-1 bg-white/95 border border-[#E5E1D8] rounded-xl shadow-sm">
          <button
            type="button"
            onClick={() => onChangeLayer('status')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 min-h-[34px] transition-colors ${
              activeLayer === 'status'
                ? 'bg-[#1D4ED8] text-white'
                : 'text-[#4B515C] hover:bg-[#F4F2ED]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>狀態圖層</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeLayer('environment')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 min-h-[34px] transition-colors ${
              activeLayer === 'environment'
                ? 'bg-[#0F766E] text-white'
                : 'text-[#4B515C] hover:bg-[#F4F2ED]'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>採光聲學</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeLayer('vision')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 min-h-[34px] transition-colors ${
              activeLayer === 'vision'
                ? 'bg-[#0284C7] text-white'
                : 'text-[#4B515C] hover:bg-[#F4F2ED]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>攝影機視野</span>
          </button>
        </div>

        {/* Camera Perspective Controls */}
        <div className="flex items-center gap-1 p-1 bg-white/95 border border-[#E5E1D8] rounded-xl shadow-sm">
          <button
            type="button"
            onClick={() => onChangeCameraPreset('isometric')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 min-h-[32px] transition-colors ${
              cameraPreset === 'isometric'
                ? 'bg-[#181A1F] text-white'
                : 'text-[#4B515C] hover:bg-[#F4F2ED]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>等角微縮</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeCameraPreset('cutaway')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 min-h-[32px] transition-colors ${
              cameraPreset === 'cutaway'
                ? 'bg-[#181A1F] text-white'
                : 'text-[#4B515C] hover:bg-[#F4F2ED]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>空間剖面</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeCameraPreset('top')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 min-h-[32px] transition-colors ${
              cameraPreset === 'top'
                ? 'bg-[#181A1F] text-white'
                : 'text-[#4B515C] hover:bg-[#F4F2ED]'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>正交平面</span>
          </button>
        </div>
      </div>

      {/* Subtle Bottom-Left Hint (Layer Context or Orbit hint) */}
      <div className="pointer-events-none hidden lg:flex items-center gap-2 absolute bottom-24 left-4 z-10 px-3 py-1.5 bg-white/85 border border-[#E5E1D8] rounded-lg text-[11px] text-[#545963]">
        {activeLayer === 'vision' ? (
          <>
            <Camera className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>顯示館內 AI 攝影機偵測視野錐（僅偵測人像／背包／書籍，無法辨識個人身分）</span>
          </>
        ) : activeLayer === 'environment' ? (
          <>
            <Sparkles className="w-3.5 h-3.5 text-[#0F766E]" />
            <span>黃區為自然窗景採光帶，藍環為建築極靜聲學區域</span>
          </>
        ) : (
          <span>左鍵拖曳旋轉視角 · 滾輪縮放 · 右鍵平移 · 點擊任一座位檢視數位孿生詳情</span>
        )}
      </div>
    </div>
  );
};
