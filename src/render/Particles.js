/**
 * ============================================================================
 *  Particles.js — Hệ hạt: bụi tiếp đất, tia lửa va tường, vệt lướt, pháo hoa
 * ============================================================================
 *  Toàn bộ hạt nằm trong MỘT đối tượng THREE.Points duy nhất với shader riêng
 *  → chỉ tốn 1 draw call cho cả nghìn hạt. Bộ nhớ cấp phát sẵn một lần
 *  (object pool), không sinh rác cho bộ dọn rác của trình duyệt.
 *
 *  MỤC LỤC
 *    [1] BỘ ĐỆM & SHADER
 *    [2] spawn() — lấy một hạt từ bể chứa
 *    [3] CÁC LOẠI HIỆU ỨNG — bụi, tia lửa, vệt lướt, khói bục nứt, pháo hoa
 *    [4] update() — tích phân + phai màu + đẩy dữ liệu lên GPU
 *
 *  CHỈNH Ở ĐÂU?
 *    • Số hạt tối đa, mật độ hạt theo tốc độ va chạm → core/Config.js phần [7] FX
 * ============================================================================
 */

import * as THREE from 'three';
import { FX, SKILLS } from '../core/Config.js';

const MAX = FX.MAX_PARTICLES;

// ============================================================================
// [1] BỘ ĐỆM & SHADER
// ============================================================================
const VERT = /* glsl */`
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  uniform float uScale;          // số pixel màn hình trên một đơn vị thế giới
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, aSize * uScale);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    // Cắt hạt vuông thành hình tròn mềm viền.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float soft = smoothstep(0.25, 0.02, r2);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`;

export class Particles {
  constructor(scene) {
    // --- Dữ liệu mô phỏng (mảng phẳng, cấp phát một lần) --------------------
    this.px = new Float32Array(MAX);
    this.py = new Float32Array(MAX);
    this.pz = new Float32Array(MAX);
    this.vx = new Float32Array(MAX);
    this.vy = new Float32Array(MAX);
    this.vz = new Float32Array(MAX);
    this.life = new Float32Array(MAX);      // thời gian sống còn lại (giây)
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);      // trọng lực riêng của từng hạt
    this.drag = new Float32Array(MAX);
    this.baseSize = new Float32Array(MAX);
    this.count = 0;                          // số hạt đang sống (nén về đầu mảng)

    // --- Dữ liệu gửi lên GPU ------------------------------------------------
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.sizes = new Float32Array(MAX);
    this.alphas = new Float32Array(MAX);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    geo.setDrawRange(0, 0);
    this.geometry = geo;

    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 12 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;    // hạt bay khắp nơi, đừng cắt nhầm
    scene.add(this.points);
  }

  /** Stage gọi khi đổi kích thước cửa sổ để hạt luôn to đúng tỉ lệ. */
  setScale(pixelsPerUnit) {
    this.material.uniforms.uScale.value = pixelsPerUnit;
  }

  // ==========================================================================
  // [2] spawn() — lấy một hạt từ bể chứa
  // ==========================================================================
  spawn(o) {
    if (this.count >= MAX) return;          // hết chỗ: bỏ qua, không cấp phát thêm
    const i = this.count++;
    this.px[i] = o.x; this.py[i] = o.y; this.pz[i] = o.z ?? 0;
    this.vx[i] = o.vx; this.vy[i] = o.vy; this.vz[i] = o.vz ?? 0;
    this.life[i] = o.life; this.maxLife[i] = o.life;
    this.grav[i] = o.grav ?? -40;
    this.drag[i] = o.drag ?? 1.2;
    this.baseSize[i] = o.size;

    const c = o.color;
    this.colors[i * 3] = c[0];
    this.colors[i * 3 + 1] = c[1];
    this.colors[i * 3 + 2] = c[2];
  }

  // ==========================================================================
  // [3] CÁC LOẠI HIỆU ỨNG
  // ==========================================================================

  /** Bụi bung ra khi tiếp đất — số hạt và độ văng tỉ lệ với tốc độ rơi. */
  landDust(x, y, speed) {
    const n = Math.min(FX.LAND_DUST_MAX, Math.round(speed * FX.LAND_DUST_PER_SPEED));
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.spawn({
        x: x + (Math.random() - 0.5) * 2.4,
        y: y - 1.4,
        z: (Math.random() - 0.5) * 3,
        vx: dir * (3 + Math.random() * speed * 0.22),
        vy: 3 + Math.random() * 7,
        life: 0.35 + Math.random() * 0.4,
        size: 0.22 + Math.random() * 0.3,
        grav: -32,
        drag: 2.4,
        color: [0.72, 0.63, 0.48],
      });
    }
  }

  /** Tia lửa điện khi đập mạnh vào tường hoặc cộc đầu vào trần. */
  sparks(x, y, speed, dirX = 1) {
    const n = Math.min(FX.SPARK_MAX, Math.round(speed * FX.SPARK_PER_SPEED));
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 2.2;
      this.spawn({
        x, y: y + (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 2,
        vx: dirX * (6 + Math.random() * 26) * Math.cos(a),
        vy: Math.sin(a) * 22 + 6,
        life: 0.2 + Math.random() * 0.35,
        size: 0.16 + Math.random() * 0.18,
        grav: -70,
        drag: 1.0,
        color: [1.0, 0.72, 0.28],
      });
    }
  }

  /** Vệt sáng xanh lá xé gió phía sau cú Lướt Không Gian. */
  dashTrail(x, y, dt) {
    const n = Math.max(1, Math.round(SKILLS.DASH.TRAIL_RATE * dt));
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 2,
        y: y + (Math.random() - 0.5) * 2.6,
        z: (Math.random() - 0.5) * 2,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 0.22 + Math.random() * 0.2,
        size: 0.45 + Math.random() * 0.35,
        grav: 0,
        drag: 3.5,
        color: [0.35, 1.0, 0.55],
      });
    }
  }

  /** Vụn rơi lả tả từ bục nứt đang rung. */
  crackDust(x, y) {
    for (let i = 0; i < 4; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 8,
        y: y - 1,
        z: (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 3,
        vy: -2 - Math.random() * 4,
        life: 0.5 + Math.random() * 0.4,
        size: 0.18 + Math.random() * 0.2,
        grav: -30,
        drag: 0.8,
        color: [0.6, 0.42, 0.22],
      });
    }
  }

  /** Pháo hoa ăn mừng trên màn hình vinh danh. */
  firework(x, y) {
    const hue = Math.random();
    const c = new THREE.Color().setHSL(hue, 0.9, 0.62);
    const n = 46;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const sp = 16 + Math.random() * 20;
      this.spawn({
        x, y,
        z: (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        vz: (Math.random() - 0.5) * 8,
        life: 0.9 + Math.random() * 0.8,
        size: 0.34 + Math.random() * 0.3,
        grav: -18,
        drag: 1.1,
        color: [c.r, c.g, c.b],
      });
    }
  }

  // ==========================================================================
  // [4] update() — tích phân, phai màu, nén mảng, đẩy lên GPU
  // ----------------------------------------------------------------------------
  //  Thủ thuật "nén về đầu mảng": khi một hạt chết, lấy hạt cuối cùng lấp vào
  //  chỗ trống rồi giảm count. Nhờ vậy vùng hạt sống luôn liền mạch ở đầu mảng
  //  và GPU chỉ phải vẽ đúng số hạt đang sống.
  // ==========================================================================
  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.count;
        if (i !== last) this.copyParticle(last, i);
        continue;                              // ô i giờ là hạt khác, xử lý lại
      }

      const damp = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= damp;
      this.vz[i] *= damp;
      this.vy[i] = this.vy[i] * damp + this.grav[i] * dt;

      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;

      const t = this.life[i] / this.maxLife[i];     // 1 → 0
      this.positions[i * 3] = this.px[i];
      this.positions[i * 3 + 1] = this.py[i];
      this.positions[i * 3 + 2] = this.pz[i];
      this.sizes[i] = this.baseSize[i] * (0.35 + 0.65 * t);
      this.alphas[i] = t * t;                       // phai nhanh ở cuối đời

      i++;
    }

    this.geometry.setDrawRange(0, this.count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }

  /** Sao chép toàn bộ thuộc tính của hạt từ ô `from` sang ô `to`. */
  copyParticle(from, to) {
    this.px[to] = this.px[from]; this.py[to] = this.py[from]; this.pz[to] = this.pz[from];
    this.vx[to] = this.vx[from]; this.vy[to] = this.vy[from]; this.vz[to] = this.vz[from];
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from];
    this.baseSize[to] = this.baseSize[from];
    this.colors[to * 3] = this.colors[from * 3];
    this.colors[to * 3 + 1] = this.colors[from * 3 + 1];
    this.colors[to * 3 + 2] = this.colors[from * 3 + 2];
  }

  /** Xoá sạch hạt (dùng khi bấm R làm lại). */
  clear() {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }
}
