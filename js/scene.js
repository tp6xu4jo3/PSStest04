// 原始 AI Studio Scene25D.tsx 中的幾何、材質、架構與人物/背包/書籍程式原樣轉譯。
// 建置不需要 React、TypeScript、npm；執行時使用 Three.js ES modules。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { computeSeatStatus, SEAT_STATUS_META } from './logic.js';

const _projVec = new THREE.Vector3();
function detectSoftwareWebGL() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl)
            return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    }
    catch {
        return true;
    }
}
function createWoodTexture(baseHex, grainHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
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
function createTerrazzoTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
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
function createMonitorScreenTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
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
function createContactShadowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 24, 128, 128, 126);
    grad.addColorStop(0, 'rgba(24, 26, 31, 0.22)');
    grad.addColorStop(0.55, 'rgba(24, 26, 31, 0.08)');
    grad.addColorStop(1, 'rgba(24, 26, 31, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}
function buildPottedPlant(scale = 1) {
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
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.18 * scale, 0.36 * scale, 16), potMat);
    pot.position.y = 0.18 * scale;
    pot.castShadow = true;
    pot.receiveShadow = true;
    group.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.22 * scale, 0.03 * scale, 14), soilMat);
    soil.position.y = 0.35 * scale;
    group.add(soil);
    // Multiple angled leaves
    for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 8, 6), leafMat);
        leaf.scale.set(0.75, 1.5, 0.25);
        leaf.position.set(Math.cos(angle) * 0.14 * scale, (0.54 + (i % 3) * 0.12) * scale, Math.sin(angle) * 0.14 * scale);
        leaf.rotation.y = -angle;
        leaf.rotation.z = 0.35 + (i % 2) * 0.2;
        leaf.castShadow = true;
        group.add(leaf);
    }
    return group;
}
function buildBookshelf(width, height) {
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
                const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.2), new THREE.MeshStandardMaterial({
                    color: bookPalette[(bi + s * 2) % bookPalette.length],
                    roughness: 0.75,
                }));
                book.position.set(bx + bw / 2, y + 0.02 + bh / 2, 0.02);
                book.castShadow = true;
                group.add(book);
                bx += bw + 0.015;
                bi++;
                if (bi % 6 === 0)
                    bx += 0.12; // natural reading gap
            }
        }
    }
    return group;
}
function buildSeatAssembly(seat, screenTex, shirtColors, index) {
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
    const legOffsets = [
        [-deskW / 2 + 0.06, -0.18 - deskD / 2 + 0.06],
        [deskW / 2 - 0.06, -0.18 - deskD / 2 + 0.06],
        [-deskW / 2 + 0.06, -0.18 + deskD / 2 - 0.06],
        [deskW / 2 - 0.06, -0.18 + deskD / 2 - 0.06],
    ];
    legOffsets.forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, deskH - 0.02, 8), frameMat);
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
        const divider = new THREE.Mesh(new THREE.BoxGeometry(deskW - 0.04, 0.34, 0.03), dividerMat);
        divider.position.set(0, deskH + 0.18, -0.18 - deskD / 2 + 0.02);
        divider.castShadow = true;
        group.add(divider);
    }
    // Power Outlet Box on desk edge
    if (seat.specs.powerOutlet) {
        const outletBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.07), new THREE.MeshStandardMaterial({ color: 0x262930, roughness: 0.4, metalness: 0.6 }));
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
        const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.08, 12), lampMat);
        lampShade.position.set(0.33, deskH + 0.34, -0.3);
        lampShade.rotation.z = 0.45;
        lampShade.castShadow = true;
        group.add(lampShade);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshStandardMaterial({
            color: 0xfff3c4,
            emissive: 0xffd275,
            emissiveIntensity: 0.9,
        }));
        bulb.position.set(0.32, deskH + 0.31, -0.29);
        group.add(bulb);
    }
    // 4. Optional Dual Monitor Setup
    if (seat.specs.dualMonitor) {
        const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.28, 8), frameMat);
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
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.122, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
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
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: 0x262930, roughness: 0.78 }));
    pocket.position.set(0, 0.11, 0.09);
    backpackGroup.add(pocket);
    backpackGroup.visible = seat.vision.hasBackpack;
    group.add(backpackGroup);
    // 8. Dynamic Books & Open Laptop on desk
    const booksGroup = new THREE.Group();
    booksGroup.position.set(0, deskH + 0.025, -0.14);
    const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.015, 0.19), new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.35, metalness: 0.7 }));
    laptopBase.position.set(-0.06, 0.008, 0.03);
    booksGroup.add(laptopBase);
    const laptopLid = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.012), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.7 }));
    laptopLid.position.set(-0.06, 0.095, -0.065);
    laptopLid.rotation.x = -0.22;
    laptopLid.castShadow = true;
    booksGroup.add(laptopLid);
    const book1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.24), new THREE.MeshStandardMaterial({ color: 0x3b6e8c, roughness: 0.75 }));
    book1.position.set(0.22, 0.018, 0);
    book1.rotation.y = 0.14;
    book1.castShadow = true;
    booksGroup.add(book1);
    const book2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.21), new THREE.MeshStandardMaterial({ color: 0xd4a656, roughness: 0.75 }));
    book2.position.set(0.22, 0.048, 0);
    book2.rotation.y = -0.08;
    booksGroup.add(book2);
    booksGroup.visible = seat.vision.hasBooks;
    group.add(booksGroup);
    // 9. Invisible Click/Hover Hit Proxy Box for reliable raycasting
    const hitMesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.35, 1.45), new THREE.MeshBasicMaterial({ visible: false }));
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
function buildArchitecturalShell(space, woodTex, terrazzoTex, shadowTex) {
    const shellGroup = new THREE.Group();
    const cutawayWalls = [];
    const envLayerGroup = new THREE.Group();
    const visionLayerGroup = new THREE.Group();
    const dims = space.id === 'pavilion'
        ? { w: 12.6, d: 9.6 }
        : space.id === 'atrium'
            ? { w: 13.8, d: 10.6 }
            : { w: 15.2, d: 11.4 };
    // Ground contact shadow plane beneath plinth
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(dims.w + 4.8, dims.d + 4.8), new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
    }));
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -0.39;
    shellGroup.add(contactShadow);
    // Architectural Museum Plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.5, 0.36, dims.d + 0.5), new THREE.MeshStandardMaterial({ color: 0xe3dfd5, roughness: 0.88, metalness: 0.02 }));
    plinth.position.y = -0.2;
    plinth.receiveShadow = true;
    shellGroup.add(plinth);
    // Main Floor
    const floorMat = space.id === 'pavilion'
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
    const glassPane = new THREE.Mesh(new THREE.BoxGeometry(0.06, wallH - 1.0, dims.d - 0.4), glassMat);
    glassPane.position.set(-dims.w / 2, 0.65 + (wallH - 1.0) / 2, 0);
    leftWallGroup.add(glassPane);
    const mullionCount = 5;
    for (let i = 0; i <= mullionCount; i++) {
        const mz = -dims.d / 2 + 0.2 + (i / mullionCount) * (dims.d - 0.4);
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.14, wallH - 0.9, 0.08), mullionMat);
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
            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, dims.d - 0.8), new THREE.MeshStandardMaterial({ color: 0xc8a97e, roughness: 0.65 }));
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
    }
    else if (space.id === 'atrium') {
        // Central shared architectural studio island base plinth/trough
        const centralSpine = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.78, 0.18), new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.45, metalness: 0.3 }));
        centralSpine.position.set(0, 0.39, 0);
        shellGroup.add(centralSpine);
        // Glass partition screens behind rear booths
        [-2.45, 2.45].forEach((bx) => {
            const divider = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.35, 0.05), glassMat);
            divider.position.set(bx, 0.68, -2.35);
            shellGroup.add(divider);
        });
        // Overhead ring skylight beam
        const skylightFrame = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.07, 10, 48), new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.35, metalness: 0.6 }));
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
    }
    else if (space.id === 'loft') {
        // Upper Mezzanine Platform (x: 2.9 to 7.3, z: -5.3 to 4.6, y = 1.65)
        const mezzW = 4.4;
        const mezzD = 9.9;
        const mezzDeck = new THREE.Mesh(new THREE.BoxGeometry(mezzW, 0.16, mezzD), new THREE.MeshStandardMaterial({ color: 0xded9ce, roughness: 0.65, metalness: 0.08 }));
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
    const sunStrip = new THREE.Mesh(new THREE.PlaneGeometry(3.4, dims.d - 1.2), new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
    }));
    sunStrip.rotation.x = -Math.PI / 2;
    sunStrip.position.set(-dims.w / 2 + 2.0, 0.03, 0);
    envLayerGroup.add(sunStrip);
    const quietRing = new THREE.Mesh(new THREE.RingGeometry(1.8, 3.6, 40), new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
    }));
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
        const camBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.7 }));
        camBody.rotation.x = Math.PI / 2;
        camGroup.add(camBody);
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7 }));
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

export class SceneEngine {
  constructor(mount, pins, onSelect, onHover = () => {}, onError = () => {}) {
    this.mount = mount;
    this.pins = pins;
    this.onSelect = onSelect;
    this.onHover = onHover;
    this.onError = onError;
    this.seatRigs = {};
    this.hitMeshes = [];
    this.cutawayWalls = [];
    this.layer = 'status';
    this.spaceId = null;
    this.disposed = false;
    this.selected = null;
    this.recs = [];
    this.isSoftwareGl = detectSoftwareWebGL();
    try {
      this.renderer = new THREE.WebGLRenderer({antialias:!this.isSoftwareGl, powerPreference:'high-performance'});
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio,2));
      this.renderer.shadowMap.enabled = !this.isSoftwareGl;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setSize(Math.max(mount.clientWidth,1),Math.max(mount.clientHeight,1));
      mount.appendChild(this.renderer.domElement);
    } catch(err) { this.onError(err); this.failed=true; return; }
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f2ed);
    this.scene.fog = new THREE.Fog(0xf4f2ed,38,82);
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envTex = pmrem.fromScene(new RoomEnvironment(),0.04).texture;
      this.scene.environment = this.envTex;
      pmrem.dispose();
    } catch(e) { console.warn('Environment fallback',e); }
    this.frustumSize = 13.5;
    const a = Math.max(.5, mount.clientWidth / Math.max(mount.clientHeight,1));
    this.camera = new THREE.OrthographicCamera(-this.frustumSize*a/2,this.frustumSize*a/2,this.frustumSize/2,-this.frustumSize/2,.1,120);
    this.camera.position.set(18,15.5,18);
    this.controls = new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = .07;
    this.controls.minZoom=.65; this.controls.maxZoom=2.35;
    this.controls.minPolarAngle=.28; this.controls.maxPolarAngle=Math.PI/2.25;
    this.controls.target.set(0,.5,0);
    this.controls.update();
    this.scene.add(new THREE.HemisphereLight(0xf8fafc,0xd6cfc2,.72));
    const key=new THREE.DirectionalLight(0xfff4e0,1.55);
    key.position.set(-14,18,10); key.castShadow=!this.isSoftwareGl;
    key.shadow.mapSize.set(2048,2048);
    Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:2,far:45});
    key.shadow.bias=-.0005;key.shadow.normalBias=.02;
    this.scene.add(key);
    const rim=new THREE.DirectionalLight(0xdbeafe,.55);rim.position.set(14,10,-14);this.scene.add(rim);
    this.woodTex = createWoodTexture('#DFC8A6','#BFA176');
    this.terrazzoTex=createTerrazzoTexture();
    this.screenTex=createMonitorScreenTexture();
    this.shadowTex=createContactShadowTexture();
    const aniso=this.renderer.capabilities.getMaxAnisotropy();
    this.woodTex.anisotropy=aniso;this.terrazzoTex.anisotropy=aniso;
    this.world = new THREE.Group();this.scene.add(this.world);
    this.camTargetPos=this.camera.position.clone();
    this.targetGoal=this.controls.target.clone();
    this.zoomGoal=1;
    this.cutawayAmount=0;this.cutawayGoal=0;
    this.transition=false;
    this.frameId=0;this.lastFrame=performance.now();this.dirty=true;
    this.draw=this.draw.bind(this);
    this.requestRender=()=>{if(this.disposed||this.failed||this.frameId)return;this.frameId=requestAnimationFrame(this.draw)};
    this.controls.addEventListener('start',()=>{this.transition=false});
    this.controls.addEventListener('change',()=>this.requestRender());
    this.raycaster=new THREE.Raycaster();this.raycaster.layers.set(1);
    this.pointer=new THREE.Vector2();
    this.down={x:0,y:0};this.lastHover=0;
    this.canvas=this.renderer.domElement;
    this.onDown=e=>{this.down={x:e.clientX,y:e.clientY}};
    this.onUp=e=>{
      if(Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>6)return;
      const seatId=this.hitTest(e);
      if(seatId)this.onSelect(seatId);
    };
    this.onMove=e=>{
      if(performance.now()-this.lastHover<55)return;
      this.lastHover=performance.now();
      const id=this.hitTest(e);
      this.canvas.style.cursor=id?'pointer':'grab';
      this.onHover(id);
    };
    this.canvas.style.cursor='grab';
    this.canvas.addEventListener('pointerdown',this.onDown);
    this.canvas.addEventListener('pointerup',this.onUp);
    this.canvas.addEventListener('pointermove',this.onMove);
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(mount);
    this.requestRender();
  }
  hitTest(e){
    const r=this.canvas.getBoundingClientRect();
    if(!r.width||!r.height)return null;
    this.pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    return this.raycaster.intersectObjects(this.hitMeshes,false)[0]?.object?.userData?.seatId||null;
  }
  resize(){
    if(this.disposed||this.failed)return;
    const w=Math.max(1,this.mount.clientWidth),h=Math.max(1,this.mount.clientHeight),a=w/h;
    this.camera.left=-this.frustumSize*a/2;this.camera.right=this.frustumSize*a/2;
    this.camera.top=this.frustumSize/2;this.camera.bottom=-this.frustumSize/2;
    this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.requestRender();
  }
  draw(){
    this.frameId=0;if(this.disposed||this.failed)return;
    const now=performance.now(),dt=Math.min(.05,Math.max(.001,(now-this.lastFrame)/1000));this.lastFrame=now;
    let moving=false;
    if(this.transition){
      const lambda=this.isSoftwareGl?18:7.5;
      for(const k of ['x','y','z']){
        this.camera.position[k]=THREE.MathUtils.damp(this.camera.position[k],this.camTargetPos[k],lambda,dt);
        this.controls.target[k]=THREE.MathUtils.damp(this.controls.target[k],this.targetGoal[k],lambda,dt);
      }
      this.camera.zoom=THREE.MathUtils.damp(this.camera.zoom,this.zoomGoal,lambda,dt);
      this.camera.updateProjectionMatrix();
      if(this.camera.position.distanceTo(this.camTargetPos)<.03 && this.controls.target.distanceTo(this.targetGoal)<.02 && Math.abs(this.camera.zoom-this.zoomGoal)<.005)this.transition=false;
      else moving=true;
    }
    if(Math.abs(this.cutawayAmount-this.cutawayGoal)>.005){
      this.cutawayAmount=THREE.MathUtils.damp(this.cutawayAmount,this.cutawayGoal,8,dt);
      for(const wall of this.cutawayWalls){wall.position.y=-this.cutawayAmount*1.45;wall.visible=this.cutawayAmount<.92}
      moving=true;
    }
    const damping=this.controls.update();
    this.renderer.render(this.scene,this.camera);
    this.updatePins();
    if(moving||damping)this.requestRender();
  }
  updatePins(){
    const w=this.mount.clientWidth,h=this.mount.clientHeight;
    for(const rig of Object.values(this.seatRigs)){
      const el=this.pins.querySelector(`[data-pin="${rig.seatId}"]`);
      if(!el)continue;
      rig.worldAnchor.copy(rig.anchorLocal);
      rig.group.localToWorld(rig.worldAnchor);
      _projVec.copy(rig.worldAnchor).project(this.camera);
      const x=((_projVec.x+1)/2)*w,y=((-_projVec.y+1)/2)*h;
      el.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-100%)`;
    }
  }
  rebuild(space,seats){
    if(this.failed)return;
    this.spaceId=space.id;
    // Geometry caches are disposed only when replacing a hall to avoid GPU leaks.
    this.world.traverse(obj=>{if(obj.geometry)obj.geometry.dispose?.();if(obj.material){const ms=Array.isArray(obj.material)?obj.material:[obj.material];ms.forEach(m=>m.dispose?.())}});
    this.world.clear();this.seatRigs={};this.hitMeshes=[];
    const shell=buildArchitecturalShell(space,this.woodTex,this.terrazzoTex,this.shadowTex);
    this.world.add(shell.shellGroup);
    this.cutawayWalls=shell.cutawayWalls;this.envLayerGroup=shell.envLayerGroup;this.visionLayerGroup=shell.visionLayerGroup;
    const shirt=[0x3b6e8c,0xb86b52,0x4f7a61,0x625f7a,0x8b7355,0x466978];
    seats.forEach((seat,i)=>{const rig=buildSeatAssembly(seat,this.screenTex,shirt,i);this.world.add(rig.group);this.seatRigs[seat.id]=rig;this.hitMeshes.push(rig.hitMesh)});
    this.world.updateMatrixWorld(true);this.sync(seats,this.layer,this.selected,this.recs);this.requestRender();
  }
  sync(seats,layer,selected,recs){
    this.layer=layer;this.selected=selected;this.recs=recs;
    if(this.failed)return;
    if(this.envLayerGroup)this.envLayerGroup.visible=layer==='environment';
    if(this.visionLayerGroup)this.visionLayerGroup.visible=layer==='vision';
    seats.forEach(seat=>{
      const rig=this.seatRigs[seat.id];if(!rig)return;
      const status=computeSeatStatus(seat),meta=SEAT_STATUS_META[status];
      rig.personGroup.visible=seat.vision.hasPerson;
      rig.backpackGroup.visible=seat.vision.hasBackpack;
      rig.booksGroup.visible=seat.vision.hasBooks;
      rig.padMat.color.set(meta.colorHex);
      if(selected===seat.id){rig.padMat.opacity=.45;rig.ringMat.color.set(0x1d4ed8);rig.ringMat.opacity=.9}
      else if(recs.includes(seat.id)){rig.padMat.opacity=.4;rig.ringMat.color.set(0x059669);rig.ringMat.opacity=.85}
      else{rig.padMat.opacity=status==='available'?.22:.3;rig.ringMat.opacity=0}
    });this.requestRender();
  }
  preset(preset){
    if(this.failed)return;
    this.transition=true;this.targetGoal.set(0,.5,0);
    if(preset==='isometric'){this.camTargetPos.set(18,15.5,18);this.zoomGoal=1.02;this.cutawayGoal=0}
    else if(preset==='cutaway'){this.camTargetPos.set(16,10.5,19);this.zoomGoal=1.12;this.cutawayGoal=1}
    else{this.camTargetPos.set(.01,26,4.2);this.zoomGoal=1.05;this.cutawayGoal=.6}
    this.requestRender();
  }
  fly(seatId){
    if(this.failed)return;
    const rig=this.seatRigs[seatId];if(!rig)return;
    this.transition=true;
    this.targetGoal.set(rig.group.position.x,rig.group.position.y+.55,rig.group.position.z);
    this.camTargetPos.set(rig.group.position.x+14,rig.group.position.y+12.5,rig.group.position.z+14);
    this.zoomGoal=1.38;this.requestRender();
  }
  dispose(){
    this.disposed=true;
    cancelAnimationFrame(this.frameId);
    if(this.failed)return;
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown',this.onDown);
    this.canvas.removeEventListener('pointerup',this.onUp);
    this.canvas.removeEventListener('pointermove',this.onMove);
    this.controls.dispose();
    [this.woodTex,this.terrazzoTex,this.screenTex,this.shadowTex,this.envTex].forEach(x=>x?.dispose?.());
    this.renderer.dispose();this.canvas.remove();
  }
}
