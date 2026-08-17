/**
 * ============================================================================
 *  Level.js — Biến dữ liệu thô trong LevelData.js thành THẾ GIỚI SỐNG
 * ============================================================================
 *  Trách nhiệm:
 *    • Tạo mảng `platforms` cho hệ vật lý dùng
 *    • Dựng mesh three.js cho từng bục (hộp và mặt dốc)
 *    • Dựng vỏ tháp: hai vách tường + tấm nền hậu cảnh phân tầng theo vùng
 *    • Mỗi frame: cập nhật hành vi bục rồi đồng bộ mesh theo
 *
 *  MỤC LỤC
 *    [1] KHỞI TẠO — build dữ liệu, phân vùng, dựng mesh
 *    [2] MÀU SẮC — chọn màu theo vùng sinh thái và loại bục
 *    [3] DỰNG MESH BỤC HỘP
 *    [4] DỰNG MESH MẶT DỐC (hình bình hành đùn dày)
 *    [5] VỎ THÁP — hai vách tường + nền hậu cảnh
 *    [6] CỖ MÁY THỜI GIAN — đích đến trên đỉnh
 *    [7] update() — nhịp sống mỗi frame
 *
 *  CHỈNH Ở ĐÂU?
 *    • Vị trí bục   → world/LevelData.js
 *    • Màu sắc vùng → core/Config.js phần [6] ZONES
 *    • Độ dày 3D    → hằng số DEPTH ngay dưới đây
 * ============================================================================
 */

import * as THREE from 'three';
import { WORLD, ZONES, PLATFORM_COLORS, DEV } from '../core/Config.js';
import { createPlatform, updatePlatform, PlatformType } from '../physics/Platform.js';
import { buildLevelData, validateLevel } from './LevelData.js';

/** Độ dày của bục theo trục Z — thứ tạo ra cảm giác 2.5D có khối. */
const DEPTH = 9;
/** Bục nằm ở z = 0 cùng mặt phẳng với nhân vật. */
const PLANE_Z = 0;

export class Level {
  // ==========================================================================
  // [1] KHỞI TẠO
  // ==========================================================================
  constructor(scene, seed) {
    this.scene = scene;
    /** Mảng bục cho hệ vật lý — Physics.js chỉ đọc mảng này. */
    this.platforms = [];
    /** Nhóm chứa toàn bộ mesh của màn chơi, tiện bật/tắt hoặc dọn dẹp. */
    this.group = new THREE.Group();
    scene.add(this.group);

    this.time = 0;
    this.goalPlatform = null;

    const defs = buildLevelData(seed);
    defs.forEach((def, i) => {
      const p = createPlatform(def, i);
      p.zone = zoneAt(p.kind === 'slope' ? p.y2 : p.y);
      this.platforms.push(p);
      p.mesh = p.kind === 'slope' ? this.buildSlopeMesh(p) : this.buildBoxMesh(p);
      this.group.add(p.mesh);
      if (p.type === PlatformType.GOAL) this.goalPlatform = p;
    });

    this.buildShell();
    this.buildTimeMachine();

    // --- Lưới an toàn cho người thiết kế map (chỉ ở chế độ dev) -------------
    if (DEV) {
      const report = validateLevel(seed);
      const tag = 'background:#1b2a3a;color:#9fe;padding:2px 6px;border-radius:3px';
      console.log(`%c[Level] ${this.platforms.length} buc | mach leo chinh ${report.total} bac`
        + ` | buoc kho nhat ${report.hardest.cost.toFixed(2)}/${report.maxCost.toFixed(2)}`, tag);
      report.issues.forEach((it) => {
        if (it.level === 'error') console.error('[Level]', it.message);
        else console.warn('[Level]', it.message);
      });
      if (!report.issues.length) console.log('%c[Level] Map hop le: moi buoc nhay deu trong tam voi.', tag);
    }
  }

  // ==========================================================================
  // [2] MÀU SẮC — vùng sinh thái quyết định tông, loại bục đè lên trên
  // ==========================================================================
  colorsFor(p) {
    const special = PLATFORM_COLORS[p.type];
    if (special) return special;
    const z = p.zone;
    return { side: z.platform, top: z.platformTop };
  }

  // ==========================================================================
  // [3] DỰNG MESH BỤC HỘP
  // ----------------------------------------------------------------------------
  //  Dùng mảng 6 vật liệu để RIÊNG MẶT TRÊN có màu sáng hơn — nhờ đó người
  //  chơi nhìn một phát là biết đâu là chỗ đặt chân được.
  //  Thứ tự mặt của BoxGeometry: [+X, -X, +Y, -Y, +Z, -Z]
  // ==========================================================================
  buildBoxMesh(p) {
    const c = this.colorsFor(p);
    const side = new THREE.MeshLambertMaterial({ color: c.side });
    const top = new THREE.MeshLambertMaterial({ color: c.top });
    const geo = new THREE.BoxGeometry(p.w, p.h, DEPTH);
    const mesh = new THREE.Mesh(geo, [side, side, top, side, side, side]);
    mesh.position.set(p.x, p.y, PLANE_Z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.platform = p;
    return mesh;
  }

  // ==========================================================================
  // [4] DỰNG MESH MẶT DỐC
  // ----------------------------------------------------------------------------
  //  Mặt dốc là một hình bình hành: mặt trên là đoạn (x1,y1)→(x2,y2), thân
  //  kéo thẳng xuống dưới `depth` đơn vị. Đùn dày theo Z để có khối 3D.
  // ==========================================================================
  buildSlopeMesh(p) {
    const shape = new THREE.Shape();
    shape.moveTo(p.x1, p.y1);
    shape.lineTo(p.x2, p.y2);
    shape.lineTo(p.x2, p.y2 - p.depth);
    shape.lineTo(p.x1, p.y1 - p.depth);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false });
    geo.translate(0, 0, -DEPTH / 2);

    const c = PLATFORM_COLORS.slope;
    const mat = new THREE.MeshLambertMaterial({ color: c.top });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0, PLANE_Z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.platform = p;

    // Sọc cảnh báo chạy dọc mép dốc — báo cho người chơi "chỗ này trượt".
    // Mesh dốc đặt tại gốc toạ độ (hình học đã mang sẵn toạ độ tuyệt đối),
    // nên toạ độ cục bộ của sọc chính là toạ độ thế giới.
    const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.5, DEPTH + 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff5a3c }),
    );
    stripe.position.set((p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2 + 0.1, 0);
    stripe.rotation.z = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
    mesh.add(stripe);

    return mesh;
  }

  // ==========================================================================
  // [5] VỎ THÁP — hai vách tường và nền hậu cảnh phân tầng
  // ==========================================================================
  buildShell() {
    const height = WORLD.GOAL_Y + 120;
    const t = WORLD.WALL_THICKNESS;

    // --- 5.1 Hai vách tường: chính là bức tường để DỘI TƯỜNG ---------------
    for (const sign of [-1, 1]) {
      const geo = new THREE.BoxGeometry(t, height, DEPTH + 10);
      const mat = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
      const wall = new THREE.Mesh(geo, mat);
      wall.position.set(sign * (WORLD.HALF_WIDTH + t / 2), height / 2 - 20, PLANE_Z - 2);
      wall.receiveShadow = true;
      this.group.add(wall);
    }

    // --- 5.2 Nền hậu cảnh: mỗi vùng sinh thái một tấm màu riêng ------------
    //     Đây là thứ khiến người chơi CẢM nhận được mình đang đổi vùng.
    for (const z of ZONES) {
      const h = z.yMax - z.yMin;
      const geo = new THREE.BoxGeometry(WORLD.HALF_WIDTH * 2 + t * 2, h, 2);
      const mat = new THREE.MeshLambertMaterial({ color: z.sky });
      const panel = new THREE.Mesh(geo, mat);
      panel.position.set(0, z.yMin + h / 2, PLANE_Z - DEPTH / 2 - 8);
      panel.receiveShadow = true;
      this.group.add(panel);
    }
  }

  // ==========================================================================
  // [6] CỖ MÁY THỜI GIAN — đích đến, một bánh răng vàng khổng lồ đang chờ
  // ==========================================================================
  buildTimeMachine() {
    const g = new THREE.Group();

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7, 1.1, 10, 32),
      new THREE.MeshLambertMaterial({ color: 0xffd85e, emissive: 0x8a6a12 }),
    );
    ring.castShadow = true;
    g.add(ring);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.2, 0),
      new THREE.MeshLambertMaterial({ color: 0xfff3b0, emissive: 0xffb457 }),
    );
    g.add(core);

    // Ba kim đồng hồ bất động — thời gian của thế giới đang đóng băng.
    for (let i = 0; i < 3; i++) {
      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 0.5, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xffe9a8 }),
      );
      hand.position.x = 2.4;
      const pivot = new THREE.Group();
      pivot.add(hand);
      pivot.rotation.z = (i / 3) * Math.PI * 2;
      g.add(pivot);
    }

    g.position.set(0, WORLD.GOAL_Y + 9, PLANE_Z - 1);
    this.group.add(g);
    this.timeMachine = { group: g, ring, core };

    // Cột sáng đánh dấu đích, nhìn thấy được từ rất xa phía dưới.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 3.5, 90, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd85e, transparent: true, opacity: 0.13, side: THREE.DoubleSide }),
    );
    beam.position.set(0, WORLD.GOAL_Y - 34, PLANE_Z - 3);
    this.group.add(beam);
  }

  // ==========================================================================
  // [7] update() — nhịp sống mỗi frame
  // ----------------------------------------------------------------------------
  //  Gọi ở BƯỚC VẬT LÝ CỐ ĐỊNH (không phải mỗi frame render) để băng chuyền
  //  và nhân vật luôn đồng bộ tuyệt đối với nhau.
  // ==========================================================================
  update(dt) {
    this.time += dt;
    const ps = this.platforms;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p.move && p.type !== PlatformType.FALLING) continue;   // bục tĩnh: bỏ qua
      updatePlatform(p, dt, this.time);
    }
  }

  /** Đồng bộ mesh theo trạng thái vật lý — gọi MỘT lần mỗi frame render. */
  syncMeshes() {
    const ps = this.platforms;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p.mesh || p.kind === 'slope') continue;
      if (!p.move && p.type !== PlatformType.FALLING) continue;
      p.mesh.position.x = p.x;
      p.mesh.position.y = p.y + (p.shakeOffset || 0);
      p.mesh.visible = p.state !== 'gone';
    }
    // Cỗ Máy Thời Gian đang "thở" chờ được khởi động lại.
    if (this.timeMachine) {
      this.timeMachine.ring.rotation.z += 0.004;
      this.timeMachine.core.rotation.y += 0.01;
      this.timeMachine.group.position.y = WORLD.GOAL_Y + 9 + Math.sin(this.time * 1.4) * 0.6;
    }
  }

  /** Đưa toàn bộ bục về trạng thái ban đầu (bấm R làm lại từ đầu). */
  reset() {
    this.time = 0;
    for (const p of this.platforms) {
      p.x = p.baseX;
      p.y = p.baseY;
      p.vx = 0; p.vy = 0;
      p.active = true;
      if (p.type === PlatformType.FALLING) { p.state = 'idle'; p.timer = 0; p.shakeOffset = 0; }
      if (p.mesh && p.kind !== 'slope') {
        p.mesh.position.x = p.x;
        p.mesh.position.y = p.y;
        p.mesh.visible = true;
      }
    }
  }
}

// ============================================================================
//  TIỆN ÍCH — tra vùng sinh thái theo độ cao
// ============================================================================
export function zoneAt(y) {
  for (let i = 0; i < ZONES.length; i++) {
    if (y < ZONES[i].yMax) return ZONES[i];
  }
  return ZONES[ZONES.length - 1];
}

/** Phần trăm tiến độ leo tháp, 0 → 1. Dùng cho thanh tiến độ trên HUD. */
export function climbProgress(y) {
  return Math.max(0, Math.min(1, y / WORLD.GOAL_Y));
}
