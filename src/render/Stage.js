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
 *
 *  CHỈNH Ở ĐÂU?
 *    • Độ zoom, góc nghiêng, độ trễ bám → core/Config.js phần [5] CAMERA
 *    • Màu nắng, cường độ bóng          → hằng số ngay trong phần [3]
 * ============================================================================
 */

import * as THREE from 'three';
import { CAMERA, WORLD, ZONES } from '../core/Config.js';

const DEG = Math.PI / 180;
/** Vùng bóng đổ chỉ bao quanh người chơi — nếu phủ cả tháp thì bóng sẽ vỡ hạt. */
const SHADOW_SPAN = 46;

export class Stage {
  // ==========================================================================
  // [1] KHỞI TẠO
  // ==========================================================================
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap đã bị three.js khai tử từ r18x; PCFShadowMap là bản
    // được khuyến nghị thay thế, nhẹ hơn và không sinh cảnh báo.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(ZONES[0].sky);
    // Sương mù ăn theo KHOẢNG CÁCH TỚI CAMERA → hậu cảnh sâu sẽ mờ dần đi.
    this.scene.fog = new THREE.Fog(ZONES[0].fog, CAMERA.DISTANCE * 0.55, CAMERA.DISTANCE * 2.1);

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
    this.sun = new THREE.DirectionalLight(0xffa366, 1.55);
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
    this.renderer.render(this.scene, this.camera);
  }
}
