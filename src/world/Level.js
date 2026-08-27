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
 *  ⚡ CHIẾN LƯỢC HIỆU NĂNG — đọc trước khi thêm bục mới
 *    Bục trong tháp chia làm hai loại hoàn toàn khác nhau về cách vẽ:
 *
 *    (a) BỤC TĨNH (static, ice, slope, goal, tường, nền) — không bao giờ nhúc
 *        nhích. Toàn bộ được GỘP thành vài khối hình học lớn theo TẦNG cao
 *        150 đơn vị. Một tầng = một lệnh vẽ, và tầng nào ra khỏi khung hình
 *        thì three.js tự loại luôn khỏi vòng vẽ.
 *        → ~105 bục tĩnh rút xuống còn ~8 lệnh vẽ.
 *
 *    (b) BỤC ĐỘNG (moving, falling) — phải giữ mesh riêng vì chúng tự di
 *        chuyển và biến mất. Chỉ có khoảng 26 cái nên không đáng ngại.
 *
 *    Vì sao chia theo tầng chứ không gộp hết vào một khối? Vì một khối duy
 *    nhất cao 1170 đơn vị thì không bao giờ bị loại khỏi khung hình, khiến
 *    GPU phải xử lý cả toà tháp ở mọi khung hình kể cả khi chỉ thấy 40 đơn vị.
 *
 *  MỤC LỤC
 *    [1] KHỞI TẠO — build dữ liệu, phân vùng, phân loại tĩnh/động
 *    [2] MÀU SẮC — chọn màu theo vùng sinh thái và loại bục
 *    [3] HÌNH HỌC BỤC TĨNH — gom vào giỏ theo tầng
 *    [4] HÌNH HỌC MẶT DỐC
 *    [5] VỎ THÁP — hai vách tường + nền hậu cảnh (cũng cắt theo tầng)
 *    [6] CHỐT HẠ — nối mọi thứ trong mỗi tầng thành một mesh duy nhất
 *    [7] BỤC ĐỘNG — mesh riêng cho băng chuyền và bục nứt
 *    [8] CỖ MÁY THỜI GIAN — đích đến trên đỉnh
 *    [9] update() / syncMeshes() / reset()
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
import { coloredBox, coloredSolid, mergeAll, vertexColorMaterial } from '../render/MergeUtils.js';
import { spriteMaterial, planeFor } from '../render/Textures.js';

/** Ảnh Cỗ Máy Thời Gian trên đỉnh tháp. */
const GOAL_TEXTURE = '/assets/goal-timemachine.png';

/** Độ dày của bục theo trục Z — thứ tạo ra cảm giác 2.5D có khối. */
const DEPTH = 9;
/** Bục nằm ở z = 0 cùng mặt phẳng với nhân vật. */
const PLANE_Z = 0;
/** Chiều cao mỗi tầng gộp hình học. Nhỏ quá → nhiều lệnh vẽ; to quá → mất tác dụng loại khung hình. */
const CHUNK_H = 150;

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

    /** Giỏ hình học tĩnh, phân theo tầng: Map<chỉ số tầng, mảng geometry>. */
    this._chunks = new Map();
    /** Sọc cảnh báo trên mặt dốc — vật liệu phát sáng nên gộp riêng. */
    this._stripes = [];
    /** Danh sách bục có mesh riêng, syncMeshes() chỉ duyệt mảng này. */
    this.dynamic = [];

    const defs = buildLevelData(seed);
    defs.forEach((def, i) => {
      const p = createPlatform(def, i);
      p.zone = zoneAt(p.kind === 'slope' ? p.y2 : p.y);
      this.platforms.push(p);
      if (p.type === PlatformType.GOAL) this.goalPlatform = p;

      const isDynamic = !!p.move || p.type === PlatformType.FALLING;
      if (isDynamic) {
        p.mesh = this.buildDynamicMesh(p);           // [7]
        this.group.add(p.mesh);
        this.dynamic.push(p);
      } else if (p.kind === 'slope') {
        this.addSlopeGeometry(p);                     // [4]
      } else {
        this.addStaticBox(p);                         // [3]
      }
    });

    this.buildShell();          // [5]
    this.flushChunks();         // [6]
    this.buildTimeMachine();    // [8]

    // --- Lưới an toàn cho người thiết kế map (chỉ ở chế độ dev) -------------
    if (DEV) {
      const report = validateLevel(seed);
      const tag = 'background:#1b2a3a;color:#9fe;padding:2px 6px;border-radius:3px';
      console.log(`%c[Level] ${this.platforms.length} buc (${this.dynamic.length} dong)`
        + ` | mach leo chinh ${report.total} bac`
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
  // [3] HÌNH HỌC BỤC TĨNH — gom vào giỏ theo tầng
  // ----------------------------------------------------------------------------
  //  Mặt trên được sơn sáng hơn bốn mặt bên, y như cũ — chỉ khác là màu giờ
  //  nằm trong từng đỉnh chứ không nằm ở vật liệu, nên gộp chung được.
  // ==========================================================================
  addStaticBox(p) {
    const c = this.colorsFor(p);
    const geo = coloredBox(p.w, p.h, DEPTH, c.top, c.side);
    geo.translate(p.x, p.y, PLANE_Z);
    this.pushChunk(p.y, geo);
    p.mesh = null;      // không có mesh riêng: đã nằm trong khối gộp của tầng
  }

  /** Bỏ một khối hình vào đúng giỏ tầng theo độ cao. */
  pushChunk(y, geo) {
    const idx = Math.floor(y / CHUNK_H);
    if (!this._chunks.has(idx)) this._chunks.set(idx, []);
    this._chunks.get(idx).push(geo);
  }

  // ==========================================================================
  // [4] HÌNH HỌC MẶT DỐC
  // ----------------------------------------------------------------------------
  //  Mặt dốc là một hình bình hành: mặt trên là đoạn (x1,y1)→(x2,y2), thân
  //  kéo thẳng xuống dưới `depth` đơn vị. Đùn dày theo Z để có khối 3D.
  // ==========================================================================
  addSlopeGeometry(p) {
    const shape = new THREE.Shape();
    shape.moveTo(p.x1, p.y1);
    shape.lineTo(p.x2, p.y2);
    shape.lineTo(p.x2, p.y2 - p.depth);
    shape.lineTo(p.x1, p.y1 - p.depth);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false });
    geo.translate(0, 0, PLANE_Z - DEPTH / 2);
    this.pushChunk(p.y2, coloredSolid(geo, PLATFORM_COLORS.slope.top));
    p.mesh = null;

    // Sọc cảnh báo chạy dọc mép dốc — báo cho người chơi "chỗ này trượt".
    const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
    const angle = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
    const stripe = new THREE.BoxGeometry(len, 0.5, DEPTH + 0.3);
    stripe.rotateZ(angle);
    stripe.translate((p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2 + 0.1, PLANE_Z);
    this._stripes.push(coloredSolid(stripe, 0xff5a3c));
  }

  // ==========================================================================
  // [5] VỎ THÁP — hai vách tường và nền hậu cảnh phân tầng
  // ----------------------------------------------------------------------------
  //  Tường cao 1170 đơn vị nếu để nguyên một khối sẽ không bao giờ bị loại
  //  khỏi khung hình, nên nó cũng được cắt thành từng đoạn theo tầng.
  // ==========================================================================
  buildShell() {
    const height = WORLD.GOAL_Y + 120;
    const t = WORLD.WALL_THICKNESS;

    // --- 5.1 Hai vách tường: chính là bức tường để DỘI TƯỜNG ---------------
    for (const sign of [-1, 1]) {
      sliceByChunk(-20, height - 20, (y0, y1) => {
        const h = y1 - y0;
        const geo = coloredBox(t, h, DEPTH + 10, 0x333944, 0x2a2f38);
        geo.translate(sign * (WORLD.HALF_WIDTH + t / 2), y0 + h / 2, PLANE_Z - 2);
        this.pushChunk(y0 + h / 2, geo);
      });
    }

    // --- 5.2 Nền hậu cảnh: mỗi vùng sinh thái một tấm màu riêng ------------
    //     Đây là thứ khiến người chơi CẢM nhận được mình đang đổi vùng.
    for (const z of ZONES) {
      sliceByChunk(z.yMin, z.yMax, (y0, y1) => {
        const h = y1 - y0;
        const geo = coloredBox(WORLD.HALF_WIDTH * 2 + t * 2, h, 2, z.sky, z.sky);
        geo.translate(0, y0 + h / 2, PLANE_Z - DEPTH / 2 - 8);
        this.pushChunk(y0 + h / 2, geo);
      });
    }
  }

  // ==========================================================================
  // [6] CHỐT HẠ — nối mọi thứ trong mỗi tầng thành một mesh duy nhất
  // ==========================================================================
  flushChunks() {
    this.chunkMeshes = [];
    const material = vertexColorMaterial();

    for (const [idx, geos] of this._chunks) {
      const mesh = new THREE.Mesh(mergeAll(geos), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `chunk-${idx}`;
      this.group.add(mesh);
      this.chunkMeshes.push(mesh);
    }
    this._chunks.clear();

    // Sọc cảnh báo: vật liệu phát sáng, không nhận ánh sáng → gộp thành một mesh riêng.
    if (this._stripes.length) {
      const stripeMesh = new THREE.Mesh(
        mergeAll(this._stripes),
        new THREE.MeshBasicMaterial({ vertexColors: true }),
      );
      this.group.add(stripeMesh);
      this._stripes = [];
    }
  }

  // ==========================================================================
  // [7] BỤC ĐỘNG — băng chuyền và bục nứt, mỗi cái một mesh riêng
  // ==========================================================================
  buildDynamicMesh(p) {
    const c = this.colorsFor(p);
    // ⚠ BẪY HIỆU NĂNG: cách "tự nhiên" để làm mặt trên khác màu là truyền một
    //   MẢNG 6 vật liệu cho BoxGeometry. Nhưng three.js vẽ MỖI NHÓM VẬT LIỆU
    //   bằng một lệnh riêng → mỗi cái bục hoá thành 6 lệnh vẽ, nhân đôi thành
    //   12 khi tính cả lượt dựng bóng đổ. Chỉ 8 bục trong khung hình đã ngốn
    //   gần 100 lệnh vẽ.
    //   Cách đúng: nhét màu vào từng đỉnh, dùng CHUNG một vật liệu → 1 lệnh vẽ.
    if (!this._dynMaterial) this._dynMaterial = vertexColorMaterial();
    const mesh = new THREE.Mesh(coloredBox(p.w, p.h, DEPTH, c.top, c.side), this._dynMaterial);
    mesh.position.set(p.x, p.y, PLANE_Z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.platform = p;
    return mesh;
  }

  // ==========================================================================
  // [8] CỖ MÁY THỜI GIAN — đích đến, một bánh răng vàng khổng lồ đang chờ
  // ==========================================================================
  buildTimeMachine() {
    const g = new THREE.Group();

    // Trước đây bộ phận này được nặn bằng hình học: vòng xuyến + lõi 20 mặt +
    // ba cây kim. Nay là MỘT tấm phẳng dán ảnh đã vẽ sẵn — một lệnh vẽ, và
    // chi tiết thì gấp nhiều lần thứ dựng được bằng hình khối cơ bản.
    const H = 26;
    this.machine = new THREE.Mesh(
      planeFor(GOAL_TEXTURE, H),
      spriteMaterial(GOAL_TEXTURE, { lit: false, soft: true }),
    );
    g.add(this.machine);

    g.position.set(0, WORLD.GOAL_Y + 11, PLANE_Z - 1);
    this.group.add(g);
    this.timeMachine = g;

    // Cột sáng đánh dấu đích, nhìn thấy được từ rất xa phía dưới.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 3.5, 90, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd85e, transparent: true, opacity: 0.13, side: THREE.DoubleSide }),
    );
    beam.position.set(0, WORLD.GOAL_Y - 34, PLANE_Z - 3);
    this.group.add(beam);
  }

  // ==========================================================================
  // [9] update() — nhịp sống mỗi frame
  // ----------------------------------------------------------------------------
  //  Gọi ở BƯỚC VẬT LÝ CỐ ĐỊNH (không phải mỗi frame render) để băng chuyền
  //  và nhân vật luôn đồng bộ tuyệt đối với nhau.
  // ==========================================================================
  update(dt) {
    this.time += dt;
    for (let i = 0; i < this.dynamic.length; i++) {
      updatePlatform(this.dynamic[i], dt, this.time);
    }
  }

  /** Đồng bộ mesh theo trạng thái vật lý — gọi MỘT lần mỗi frame render. */
  syncMeshes() {
    for (let i = 0; i < this.dynamic.length; i++) {
      const p = this.dynamic[i];
      p.mesh.position.x = p.x;
      p.mesh.position.y = p.y + (p.shakeOffset || 0);
      p.mesh.visible = p.state !== 'gone';
    }
    // Cỗ Máy Thời Gian đang "thở" chờ được khởi động lại: trôi lên xuống nhẹ
    // và phập phồng độ sáng, đủ để nó trông còn sống chứ không phải hình dán.
    if (this.timeMachine) {
      this.timeMachine.position.y = WORLD.GOAL_Y + 11 + Math.sin(this.time * 1.4) * 0.7;
      const pulse = 0.88 + Math.sin(this.time * 2.1) * 0.12;
      this.machine.material.opacity = pulse;
      this.machine.rotation.z = Math.sin(this.time * 0.35) * 0.04;
    }
  }

  /** Đưa toàn bộ bục về trạng thái ban đầu (bấm R làm lại từ đầu). */
  reset() {
    this.time = 0;
    for (const p of this.dynamic) {
      p.x = p.baseX;
      p.y = p.baseY;
      p.vx = 0; p.vy = 0;
      p.active = true;
      if (p.type === PlatformType.FALLING) { p.state = 'idle'; p.timer = 0; p.shakeOffset = 0; }
      p.mesh.position.set(p.x, p.y, PLANE_Z);
      p.mesh.visible = true;
    }
  }
}

// ============================================================================
//  TIỆN ÍCH
// ============================================================================

/** Cắt một khoảng độ cao thành từng đoạn không vắt qua ranh giới tầng. */
function sliceByChunk(yMin, yMax, fn) {
  let y = yMin;
  while (y < yMax) {
    const next = Math.min(yMax, (Math.floor(y / CHUNK_H) + 1) * CHUNK_H);
    fn(y, next);
    y = next;
  }
}

/** Tra vùng sinh thái theo độ cao. */
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
