/**
 * ============================================================================
 *  Parallax.js — Hậu cảnh bánh răng đồng hồ khổng lồ quay chậm ở phía xa
 * ============================================================================
 *  Đây là thứ khiến người chơi TIN rằng mình đang ở trong một cỗ máy khổng lồ.
 *  Bốn lớp chiều sâu khác nhau: lớp càng xa thì trôi càng chậm khi camera lên
 *  cao, tạo ảo giác không gian ba chiều thật sự.
 *
 *  MỤC LỤC
 *    [1] DỰNG MỘT BÁNH RĂNG (vành + răng + nan hoa)
 *    [2] KHỞI TẠO CÁC LỚP — mỗi lớp một chiều sâu, tốc độ quay, hệ số parallax
 *    [3] update() — quay bánh răng + cuộn lặp vô tận theo camera
 *
 *  CHỈNH Ở ĐÂU?
 *    • Số lớp, bán kính, tốc độ quay, hệ số parallax → core/Config.js phần [7] FX.GEARS
 * ============================================================================
 */

import * as THREE from 'three';
import { FX } from '../core/Config.js';

export class Parallax {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    /** Mỗi phần tử: { mesh, spec, baseY } */
    this.gears = [];
    /** Chiều cao một chu kỳ lặp — vượt quá thì bánh răng được cuộn vòng lại. */
    this.span = FX.GEAR_ROWS * FX.GEAR_ROW_SPACING;

    this.build();
  }

  // ==========================================================================
  // [1] DỰNG MỘT BÁNH RĂNG
  // ==========================================================================
  buildGear(radius, teeth, color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color });

    // Vành ngoài
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.09, 6, 28), mat);
    g.add(rim);

    // Trục giữa
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, 1.5, 10), mat);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);

    // Răng cưa quanh vành
    const toothGeo = new THREE.BoxGeometry(radius * 0.16, radius * 0.22, 1.4);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const t = new THREE.Mesh(toothGeo, mat);
      t.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      t.rotation.z = a;
      g.add(t);
    }

    // Nan hoa nối trục với vành
    const spokeGeo = new THREE.BoxGeometry(radius * 1.85, radius * 0.09, 1.2);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(spokeGeo, mat);
      s.rotation.z = (i / 3) * Math.PI;
      g.add(s);
    }
    return g;
  }

  // ==========================================================================
  // [2] KHỞI TẠO CÁC LỚP
  // ==========================================================================
  build() {
    FX.GEARS.forEach((spec, layer) => {
      for (let row = 0; row < FX.GEAR_ROWS; row++) {
        // Lớp càng xa càng tối màu → củng cố cảm giác chiều sâu.
        const shade = 0.30 + layer * 0.10;
        const color = new THREE.Color(0x8a6320).multiplyScalar(shade);

        const mesh = this.buildGear(spec.radius, spec.teeth, color);
        // So le trái/phải và lệch pha theo hàng để không nhìn ra quy luật lặp.
        const side = (row + layer) % 2 === 0 ? -1 : 1;
        mesh.position.set(side * (14 + layer * 5), row * FX.GEAR_ROW_SPACING, spec.z);
        mesh.rotation.z = (row * 1.7 + layer) % (Math.PI * 2);
        this.group.add(mesh);
        this.gears.push({ mesh, spec, baseY: mesh.position.y });
      }
    });
  }

  // ==========================================================================
  // [3] update() — quay + cuộn lặp vô tận
  // ----------------------------------------------------------------------------
  //  Công thức parallax: bánh răng được kéo lên theo camera một phần
  //  (1 - parallax). Hệ số parallax càng nhỏ thì bánh răng càng "dính" vào
  //  camera → trông càng ở xa. Sau đó vị trí được cuộn vòng trong dải `span`
  //  quanh camera nên chỉ cần vài chục bánh răng là phủ kín cả toà tháp cao 1050.
  // ==========================================================================
  update(dt, camY) {
    const span = this.span;
    for (let i = 0; i < this.gears.length; i++) {
      const { mesh, spec, baseY } = this.gears[i];
      mesh.rotation.z += spec.speed * dt;

      const drifted = baseY + camY * (1 - spec.parallax);
      // Đưa về khoảng [camY - span/2, camY + span/2] bằng phép chia dư.
      const rel = drifted - camY;
      const wrapped = ((rel + span / 2) % span + span) % span - span / 2;
      mesh.position.y = camY + wrapped;
    }
  }
}
