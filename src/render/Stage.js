/**
 * ============================================================================
 *  Stage.js — Sân khấu 2.5D: renderer, camera nghiêng, nắng chiều đổ bóng
 * ============================================================================
 *  "2.5D" ở đây nghĩa là: gameplay hoàn toàn 2D (mọi thứ ở mặt phẳng z = 0),
 *  nhưng camera trực giao được ĐẨY LÙI và CHÚI XUỐNG 13°, cộng với bóng đổ
 *  thật từ một nguồn sáng hoàng hôn. Kết quả: hình khối có chiều sâu, người
 *  chơi vẫn đọc được khoảng cách chính xác như game 2D.
 *
 *  MỤC LỤC
 *    [1] KHỞI TẠO — renderer, scene, sương mù
 *    [2] CAMERA TRỰC GIAO NGHIÊNG — công thức đặt máy
 *    [3] ÁNH SÁNG — nắng chiều + bóng đổ bám theo người chơi
 *    [4] follow()  — camera bám nhân vật có giảm chấn
 *    [5] shake()   — rung màn hình khi va đập
 *    [6] setZoneMood() — đổi tông màu nền/sương theo vùng sinh thái
 *    [7] worldFromMouse() — đổi toạ độ chuột thành toạ độ thế giới (để ngắm)
 *    [8] resize() / render()
 *    [9] HỆ TỰ ĐIỀU CHỈNH CHẤT LƯỢNG — đo FPS và hạ dần khi máy đuối
 *
 *  CHỈNH Ở ĐÂU?
 *    • Độ zoom, góc nghiêng, độ trễ bám → core/Config.js phần [5] CAMERA
 *    • Ngưỡng FPS, các mức chất lượng   → core/Config.js phần [7b] PERF
 *    • Màu nắng, cường độ bóng          → hằng số ngay trong phần [3]
 * ============================================================================
 */

import * as THREE from 'three';
import { CAMERA, WORLD, ZONES, PERF } from '../core/Config.js';

const DEG = Math.PI / 180;
/** Vùng bóng đổ chỉ bao quanh người chơi — nếu phủ cả tháp thì bóng sẽ vỡ hạt. */
const SHADOW_SPAN = 46;

export class Stage {
  // ==========================================================================
  // [1] KHỞI TẠO
  // ==========================================================================
  constructor(container) {
    // Khử răng cưa rất tốn ở màn hình mật độ điểm ảnh cao, mà ở đó nó cũng gần
    // như không cần thiết → chỉ bật khi màn hình có mật độ thường.
    const wantAA = window.devicePixelRatio <= 1.25;
    this.renderer = new THREE.WebGLRenderer({ antialias: wantAA, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // PCFSoftShadowMap đã bị three.js khai tử từ r18x; PCFShadowMap là bản
    // được khuyến nghị thay thế, nhẹ hơn và không sinh cảnh báo.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(ZONES[0].sky);
    // Sương mù ăn theo KHOẢNG CÁCH TỚI CAMERA → hậu cảnh sâu sẽ mờ dần đi.
    // Mốc gần đặt SÁT mặt phẳng chơi (z=0, cách camera đúng CAMERA.DISTANCE)
    // để bục nhảy gần như không bị sương làm bạc màu — người chơi phải đọc
    // được mép bục thật rõ. Chỉ hậu cảnh sâu phía sau mới chìm dần vào sương.
    this.scene.fog = new THREE.Fog(ZONES[0].fog, CAMERA.DISTANCE * 0.92, CAMERA.DISTANCE * 2.1);

    this.buildCamera();
    this.buildLights();

    // --- Trạng thái camera ---------------------------------------------------
    this.camX = 0;
    this.camY = WORLD.SPAWN.y;
    this.shake = 0;

    // --- Dụng cụ chiếu tia cho việc ngắm bằng chuột --------------------------
    this.raycaster = new THREE.Raycaster();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);   // mặt phẳng z = 0
    this._hit = new THREE.Vector3();
    this._ndc = new THREE.Vector2();

    // --- Hệ tự điều chỉnh chất lượng (xem phần [9]) --------------------------
    this.quality = PERF.LEVELS.length - 1;   // khởi động ở mức cao nhất
    this.fps = 60;
    this.renderMs = 0;
    this._frames = 0;
    this._sampleTime = 0;
    this._badStreak = 0;
    this.applyQuality();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ==========================================================================
  // [2] CAMERA TRỰC GIAO NGHIÊNG
  // ----------------------------------------------------------------------------
  //  Đặt máy lùi ra sau D đơn vị và nâng lên h = D·tan(t), rồi chúi xuống t độ.
  //  Nhờ h đúng bằng D·tan(t), tia nhìn trung tâm cắt mặt phẳng z = 0 ĐÚNG tại
  //  độ cao camY — nghĩa là nhân vật luôn nằm chính giữa khung hình.
  // ==========================================================================
  buildCamera() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
    this.tilt = Math.abs(CAMERA.TILT_DEG) * DEG;
    this.camLift = CAMERA.DISTANCE * Math.tan(this.tilt);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.x = -this.tilt;
  }

  // ==========================================================================
  // [3] ÁNH SÁNG — nắng chiều ấm đổ bóng dài
  // ==========================================================================
  buildLights() {
    this.ambient = new THREE.AmbientLight(0xffffff, ZONES[0].ambient);
    this.scene.add(this.ambient);

    // Nắng hoàng hôn: hắt chéo từ trái xuống → bóng đổ dài về bên phải bục.
    // Màu cam nhạt chứ không cam gắt: cam quá đậm sẽ "giết" hết tông xanh của
    // Hầm Băng Giá, làm ba vùng sinh thái trông na ná nhau.
    this.sun = new THREE.DirectionalLight(0xffc78f, 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -SHADOW_SPAN;
    this.sun.shadow.camera.right = SHADOW_SPAN;
    this.sun.shadow.camera.top = SHADOW_SPAN;
    this.sun.shadow.camera.bottom = -SHADOW_SPAN;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.bias = -0.0012;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Đèn hắt lạnh từ phía sau để tách khối nhân vật khỏi nền tối.
    this.rim = new THREE.DirectionalLight(0x6fa8ff, 0.35);
    this.rim.position.set(40, -20, -30);
    this.scene.add(this.rim);
  }

  // ==========================================================================
  // [4] follow() — camera bám nhân vật có giảm chấn
  // ----------------------------------------------------------------------------
  //  Trục Y bám nhanh hơn trục X: leo tháp là chuyện của chiều cao, khung hình
  //  phải theo kịp cú nhảy, còn dịch ngang thì nên từ tốn cho đỡ chóng mặt.
  // ==========================================================================
  follow(player, dt) {
    const targetY = player.y + CAMERA.LOOK_AHEAD_Y;
    const targetX = player.x * 0.35;                    // chỉ lệch nhẹ, giữ tháp trong khung

    this.camY += (targetY - this.camY) * (1 - Math.exp(-CAMERA.FOLLOW_LERP_Y * dt));
    this.camX += (targetX - this.camX) * (1 - Math.exp(-CAMERA.FOLLOW_LERP_X * dt));

    // --- Rung màn hình tắt dần ---------------------------------------------
    let sx = 0; let sy = 0;
    if (this.shake > 0.01) {
      this.shake *= Math.exp(-CAMERA.SHAKE_DECAY * dt);
      sx = (Math.random() * 2 - 1) * this.shake;
      sy = (Math.random() * 2 - 1) * this.shake;
    } else {
      this.shake = 0;
    }

    this.camera.position.set(this.camX + sx, this.camY + this.camLift + sy, CAMERA.DISTANCE);

    // --- Bóng đổ đi theo người chơi ----------------------------------------
    this.sun.position.set(player.x - 42, player.y + 52, 60);
    this.sun.target.position.set(player.x, player.y, 0);
    this.sun.target.updateMatrixWorld();
  }

  // ==========================================================================
  // [5] shake() — gọi khi va đập mạnh
  // ==========================================================================
  addShake(amount) {
    this.shake = Math.min(CAMERA.SHAKE_MAX, this.shake + amount);
  }

  // ==========================================================================
  // [6] setZoneMood() — pha màu nền/sương/ánh sáng theo độ cao
  // ----------------------------------------------------------------------------
  //  Không cắt phựt giữa hai vùng mà pha dần trong 40 đơn vị cuối, để người
  //  chơi CẢM thấy mình đang trôi từ rừng vào hầm băng chứ không bị giật cảnh.
  // ==========================================================================
  setZoneMood(y) {
    const BLEND = 40;
    let a = ZONES[0];
    let b = ZONES[0];
    let t = 0;

    for (let i = 0; i < ZONES.length; i++) {
      if (y < ZONES[i].yMax || i === ZONES.length - 1) {
        a = ZONES[i];
        b = ZONES[Math.min(i + 1, ZONES.length - 1)];
        const distToEdge = ZONES[i].yMax - y;
        t = distToEdge < BLEND ? 1 - distToEdge / BLEND : 0;
        break;
      }
    }

    this.scene.background.set(a.sky).lerp(new THREE.Color(b.sky), t);
    this.scene.fog.color.set(a.fog).lerp(new THREE.Color(b.fog), t);
    this.ambient.intensity = a.ambient + (b.ambient - a.ambient) * t;
    this.currentZone = t > 0.5 ? b : a;
  }

  // ==========================================================================
  // [7] worldFromMouse() — đổi toạ độ chuột thành điểm trên mặt phẳng z = 0
  // ==========================================================================
  worldFromMouse(ndcX, ndcY) {
    this._ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this._ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.aimPlane, this._hit);
    return hit || this._hit.set(0, this.camY, 0);
  }

  // ==========================================================================
  // [8] resize() / render()
  // ==========================================================================
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;

    // Luôn nhìn thấy đủ bề ngang lòng tháp; màn hình càng rộng thì thấy càng
    // ít chiều cao, nhưng không bao giờ ít hơn MIN_VIEW_HEIGHT.
    const viewH = Math.max(CAMERA.VIEW_WIDTH / aspect, CAMERA.MIN_VIEW_HEIGHT);
    const viewW = viewH * aspect;

    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h);
    /** Số pixel màn hình trên một đơn vị thế giới — Particles dùng để tính cỡ hạt. */
    this.pixelsPerUnit = h / viewH;
    this.viewHeight = viewH;
    this.viewWidth = viewW;
  }

  render() {
    const t0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    // Chỉ đo thời gian NỘP LỆNH của CPU. GPU chạy bất đồng bộ nên con số này
    // không phải thời gian vẽ thật, nhưng nó trả lời đúng câu hỏi cần hỏi:
    // "CPU có đang bị kẹt ở khâu render không?"
    // Làm mượt cùng hệ số với jsMs trong Game.js để hai con số so sánh được
    // với nhau (nếu không, một khung hình cá biệt sẽ cho ra cảnh vô lý kiểu
    // "nộp lệnh vẽ" lớn hơn cả tổng thời gian JS).
    this.renderMs += (performance.now() - t0 - this.renderMs) * 0.1;
  }

  /** Số liệu cho bảng đo hiệu năng (phím F). */
  get stats() {
    const info = this.renderer.info.render;
    const c = this.renderer.domElement;
    return {
      calls: info.calls,
      triangles: info.triangles,
      renderMs: this.renderMs || 0,
      canvas: `${c.width}×${c.height}`,
      pixels: (c.width * c.height / 1e6).toFixed(2),
      ratio: this.renderer.getPixelRatio().toFixed(2),
      quality: this.qualityName,
    };
  }

  // ==========================================================================
  // [9] HỆ TỰ ĐIỀU CHỈNH CHẤT LƯỢNG
  // ----------------------------------------------------------------------------
  //  Đây là game đòi độ chính xác từng khung hình: giật hình nghĩa là người
  //  chơi chết oan. Nên thay vì bắt họ mò vào cài đặt, sân khấu tự đo FPS và
  //  hạ chất lượng khi thấy máy đuối — hạ dần từng nấc, và chỉ hạ khi tệ liên
  //  tục nhiều lần đo, để một cú khựng nhất thời không làm mất bóng đổ oan.
  //
  //  Thứ tự hy sinh: độ phân giải trước → bóng đổ sau. Vì bóng đổ chính là
  //  thứ giúp người chơi đoán được mình đang ở trên hay dưới một cái bục.
  // ==========================================================================

  /** Gọi mỗi frame. Trả về true nếu vừa có thay đổi mức chất lượng. */
  measurePerformance(dt) {
    this._frames++;
    this._sampleTime += dt;
    if (this._sampleTime < PERF.SAMPLE_WINDOW) return false;

    this.fps = this._frames / this._sampleTime;
    this._frames = 0;
    this._sampleTime = 0;

    if (this.fps < PERF.DOWNGRADE_FPS) {
      this._badStreak++;
      if (this._badStreak >= PERF.DOWNGRADE_STREAK && this.quality > 0) {
        this._badStreak = 0;
        this.quality--;
        this.applyQuality();
        return true;
      }
    } else {
      this._badStreak = 0;
    }
    return false;
  }

  /** Đổi mức bằng tay (phím P): Thấp → Vừa → Cao → Thấp… */
  cycleQuality() {
    this.quality = (this.quality + 1) % PERF.LEVELS.length;
    this._badStreak = 0;
    this.applyQuality();
    return this.qualityName;
  }

  get qualityName() { return PERF.LEVELS[this.quality].name; }

  applyQuality() {
    const q = PERF.LEVELS[this.quality];

    // --- Tính tỉ lệ điểm ảnh cuối cùng --------------------------------------
    //  Ba tầng chặn: trần chung → hệ số của mức chất lượng → trần tuyệt đối
    //  theo tổng số điểm ảnh (bảo vệ người dùng màn 4K / cửa sổ siêu rộng).
    let ratio = Math.min(window.devicePixelRatio, q.pixelRatio, PERF.MAX_PIXEL_RATIO) * q.scale;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const pixels = w * h * ratio * ratio;
    if (pixels > PERF.MAX_CANVAS_PIXELS) {
      ratio *= Math.sqrt(PERF.MAX_CANVAS_PIXELS / pixels);
    }
    this.renderer.setPixelRatio(ratio);

    this.renderer.shadowMap.enabled = q.shadows;
    this.sun.castShadow = q.shadows;

    if (this.sun.shadow.mapSize.width !== q.shadowMap) {
      this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      // Bản đồ bóng cũ phải được huỷ thì kích thước mới mới có hiệu lực.
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
    // Đổi bật/tắt bóng đổ buộc three.js biên dịch lại shader của mọi vật liệu.
    this.scene.traverse((o) => { if (o.isMesh) applyMaterialUpdate(o); });

    if (this.pixelsPerUnit) this.resize();
  }
}

/** Đánh dấu vật liệu cần biên dịch lại (dùng khi bật/tắt bóng đổ). */
function applyMaterialUpdate(mesh) {
  const m = mesh.material;
  if (Array.isArray(m)) m.forEach((x) => { x.needsUpdate = true; });
  else if (m) m.needsUpdate = true;
}
