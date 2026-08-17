/**
 * ============================================================================
 *  PlayerView.js — Thân xác 3D của chú robot đồng hồ
 * ============================================================================
 *  Tách hẳn khỏi Player.js: file này CHỈ đọc trạng thái và vẽ, không bao giờ
 *  sửa trạng thái gameplay. Muốn đổi hình dáng robot thì sửa duy nhất ở đây.
 *
 *  MỤC LỤC
 *    [1] KHỞI TẠO NHÓM MESH
 *    [2] DỰNG THÂN ROBOT — khung đồng, bánh răng lưng, chân, ăng-ten
 *    [3] MẮT KÍNH PHÁT SÁNG — con ngươi liếc theo chuột
 *    [4] MŨI TÊN ĐỊNH HƯỚNG — dài ngắn theo lực đang gồng
 *    [5] sync() — mỗi frame: vị trí, SQUASH & STRETCH, mắt, mũi tên
 *
 *  CHỈNH Ở ĐÂU?
 *    • Độ bẹp khi gồng lực / độ dãn khi bay → core/Config.js phần [2]
 *    • Màu sắc, hình dáng                   → ngay trong phần [2] và [3]
 * ============================================================================
 */

import * as THREE from 'three';
import { PLAYER } from '../core/Config.js';

/** Màu chủ đạo của chú robot. */
const BRASS = 0xd9a441;
const BRASS_DARK = 0x8a6320;
const STEEL = 0x9aa3ad;
const EYE_GLOW = 0x7cf0ff;

export class PlayerView {
  // ==========================================================================
  // [1] KHỞI TẠO
  // ==========================================================================
  constructor(scene) {
    /** Nút gốc: chỉ mang vị trí trong thế giới. */
    this.root = new THREE.Group();
    /** Nút thân: mang phép co giãn và nghiêng theo hướng bay. */
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);

    this.buildBody();
    this.buildEye();
    this.buildArrow(scene);

    // Giá trị co giãn hiện tại, được nội suy mềm về giá trị mục tiêu mỗi frame.
    this.scaleX = 1;
    this.scaleY = 1;
    this.tilt = 0;
    this.wheelSpin = 0;
  }

  // ==========================================================================
  // [2] DỰNG THÂN ROBOT
  // ==========================================================================
  buildBody() {
    const W = PLAYER.WIDTH;
    const H = PLAYER.HEIGHT;

    // --- Khung thân bằng đồng ------------------------------------------------
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(W, H * 0.72, 2.0),
      new THREE.MeshLambertMaterial({ color: BRASS }),
    );
    chassis.position.y = -H * 0.06;
    chassis.castShadow = true;
    this.body.add(chassis);

    // --- Mũ chụp đầu ---------------------------------------------------------
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(W * 0.42, W * 0.46, H * 0.22, 12),
      new THREE.MeshLambertMaterial({ color: BRASS_DARK }),
    );
    cap.position.y = H * 0.36;
    cap.castShadow = true;
    this.body.add(cap);

    // --- Bánh răng sau lưng: quay theo quãng đường đã đi ---------------------
    this.wheel = new THREE.Mesh(
      new THREE.TorusGeometry(W * 0.34, 0.16, 6, 12),
      new THREE.MeshLambertMaterial({ color: STEEL }),
    );
    this.wheel.position.set(0, -H * 0.05, -1.15);
    this.body.add(this.wheel);

    // --- Hai chân nhỏ --------------------------------------------------------
    for (const s of [-1, 1]) {
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.28, H * 0.16, 1.4),
        new THREE.MeshLambertMaterial({ color: BRASS_DARK }),
      );
      foot.position.set(s * W * 0.28, -H * 0.44, 0.2);
      foot.castShadow = true;
      this.body.add(foot);
    }

    // --- Ăng-ten + bóng đèn báo hiệu ----------------------------------------
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, H * 0.34, 6),
      new THREE.MeshLambertMaterial({ color: STEEL }),
    );
    rod.position.y = H * 0.6;
    this.body.add(rod);

    this.bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 8, 8),
      new THREE.MeshBasicMaterial({ color: EYE_GLOW }),
    );
    this.bulb.position.y = H * 0.78;
    this.body.add(this.bulb);
  }

  // ==========================================================================
  // [3] MẮT KÍNH PHÁT SÁNG — "Eye Tracking"
  // ----------------------------------------------------------------------------
  //  Mắt gồm 2 lớp: tròng kính lớn (cố định) và con ngươi nhỏ (trượt theo
  //  hướng chuột). Chi tiết bé xíu này là thứ khiến chú robot có "hồn".
  // ==========================================================================
  buildEye() {
    const W = PLAYER.WIDTH;

    this.lens = new THREE.Mesh(
      new THREE.CircleGeometry(W * 0.3, 16),
      new THREE.MeshBasicMaterial({ color: 0x102028 }),
    );
    this.lens.position.set(0, PLAYER.HEIGHT * 0.06, 1.02);
    this.body.add(this.lens);

    this.pupil = new THREE.Mesh(
      new THREE.CircleGeometry(W * 0.15, 12),
      new THREE.MeshBasicMaterial({ color: EYE_GLOW }),
    );
    this.pupil.position.set(0, 0, 0.02);
    this.lens.add(this.pupil);

    // Vành kính bằng đồng bao quanh mắt.
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(W * 0.31, 0.1, 6, 18),
      new THREE.MeshLambertMaterial({ color: BRASS_DARK }),
    );
    rim.position.copy(this.lens.position);
    this.body.add(rim);
  }

  // ==========================================================================
  // [4] MŨI TÊN ĐỊNH HƯỚNG
  // ----------------------------------------------------------------------------
  //  Không dùng nhóm con của robot, vì mũi tên KHÔNG được co giãn theo thân.
  // ==========================================================================
  buildArrow(scene) {
    this.arrow = new THREE.Group();

    this.arrowShaft = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.34, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.85 }),
    );
    this.arrowShaft.position.x = 0.5;
    this.arrow.add(this.arrowShaft);

    this.arrowHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1.5, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd85e }),
    );
    this.arrowHead.rotation.z = -Math.PI / 2;   // quay mũi nhọn về phía +X
    this.arrow.add(this.arrowHead);

    scene.add(this.arrow);
  }

  // ==========================================================================
  // [5] sync() — cập nhật toàn bộ phần nhìn theo trạng thái nhân vật
  // ==========================================================================
  /**
   * @param {Player} p  nhân vật
   * @param {number} dt thời gian frame (giây)
   */
  sync(p, dt) {
    // --- 5.1 Vị trí ---------------------------------------------------------
    this.root.position.set(p.x, p.y, 0);

    // --- 5.2 SQUASH & STRETCH ----------------------------------------------
    let targetX = 1;
    let targetY = 1;
    let targetTilt = 0;

    if (p.charging) {
      // Gồng lực → bẹp người xuống, càng đầy lực càng bẹp.
      targetY = 1 - (1 - PLAYER.SQUASH_AT_FULL_CHARGE) * p.power;
      targetX = 1 / targetY;                       // giữ nguyên "thể tích"
    } else if (!p.grounded) {
      // Bay trên không → dãn dài DỌC THEO HƯỚNG BAY.
      const t = Math.min(1, p.speed / 70);
      targetY = 1 + (PLAYER.STRETCH_MAX - 1) * t;
      targetX = 1 / targetY;
      if (p.speed > 16) targetTilt = Math.atan2(p.vy, p.vx) - Math.PI / 2;
    }

    const k = 1 - Math.exp(-PLAYER.SQUASH_LERP * dt);   // nội suy độc lập FPS
    this.scaleX += (targetX - this.scaleX) * k;
    this.scaleY += (targetY - this.scaleY) * k;
    this.tilt = lerpAngle(this.tilt, targetTilt, k);

    this.body.scale.set(this.scaleX, this.scaleY, 1);
    this.body.rotation.z = this.tilt;

    // --- 5.3 Mắt liếc theo chuột -------------------------------------------
    const reach = PLAYER.WIDTH * 0.13;
    this.pupil.position.x = p.aimRaw.x * reach;
    this.pupil.position.y = p.aimRaw.y * reach;

    // Bóng đèn ăng-ten: xanh = dash sẵn sàng, đỏ = đang hồi chiêu.
    this.bulb.material.color.setHex(p.dashCooldown > 0 ? 0xff6a4a : EYE_GLOW);

    // --- 5.4 Bánh răng lưng quay theo quãng đường đi ------------------------
    this.wheelSpin -= p.vx * dt * 0.5;
    this.wheel.rotation.z = this.wheelSpin;

    // --- 5.5 Mũi tên định hướng --------------------------------------------
    const show = !p.godMode;
    this.arrow.visible = show;
    if (show) {
      const len = 3.2 + p.power * 6.5;
      this.arrow.position.set(p.x, p.y, 1.5);
      this.arrow.rotation.z = p.aimAngle;
      this.arrowShaft.scale.x = len;
      this.arrowShaft.position.x = len / 2 + 2.2;
      this.arrowHead.position.x = len + 2.6;
      // Đang gồng lực thì mũi tên rực lên, bình thường thì mờ đi.
      this.arrowShaft.material.opacity = p.charging ? 0.95 : 0.45;
      this.arrowHead.material.opacity = p.charging ? 1 : 0.6;
      this.arrowHead.material.transparent = true;
    }

    // --- 5.6 God Mode: thân robot trong suốt để thấy địa hình phía sau ------
    this.body.visible = true;
    this.root.scale.setScalar(p.godMode ? 0.8 : 1);
  }
}

// ============================================================================
//  TIỆN ÍCH — nội suy góc theo đường ngắn nhất (tránh xoay lộn một vòng)
// ============================================================================
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
