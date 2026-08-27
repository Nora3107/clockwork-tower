/**
 * ============================================================================
 *  Parallax.js — Hậu cảnh bánh răng đồng hồ khổng lồ quay chậm ở phía xa
 * ============================================================================
 *  Đây là thứ khiến người chơi TIN rằng mình đang ở trong một cỗ máy khổng lồ.
 *  Bốn lớp chiều sâu khác nhau: lớp càng xa thì trôi càng chậm khi camera lên
 *  cao, tạo ảo giác không gian ba chiều thật sự.
 *
 *  ⚡ HIỆU NĂNG — điều quan trọng nhất của file này
 *    Bản đầu tiên nặn từng bánh răng bằng hình học: vành + trục + 10–18 răng
 *    cưa + 3 nan hoa, mỗi chi tiết một mesh → 370 mesh chỉ riêng hậu cảnh,
 *    đủ kéo game xuống 16 fps.
 *    Bản thứ hai gộp mỗi bánh răng thành một khối hình học (16 lệnh vẽ).
 *    Bản hiện tại thay hẳn bằng MỘT TẤM PHẲNG DÁN ẢNH bánh răng vẽ sẵn:
 *    vẫn 16 lệnh vẽ, nhưng chỉ 2 tam giác mỗi cái và đẹp hơn hẳn.
 *
 *    Cả 16 bánh răng dùng chung một tấm ảnh và chung một hình học; chỉ có
 *    4 vật liệu (mỗi lớp chiều sâu một màu nhân để lớp xa chìm dần).
 *
 *  MỤC LỤC
 *    [1] MỘT BÁNH RĂNG = MỘT TẤM PHẲNG DÁN ẢNH
 *    [2] KHỞI TẠO CÁC LỚP
 *    [3] update() — quay bánh răng + cuộn lặp vô tận theo camera
 *
 *  CHỈNH Ở ĐÂU?
 *    • Số lớp, bán kính, tốc độ quay, hệ số parallax → core/Config.js phần [7]
 * ============================================================================
 */

import * as THREE from 'three';
import { FX } from '../core/Config.js';
import { spriteMaterial } from './Textures.js';

/** Ảnh bánh răng dùng chung cho mọi lớp. */
const GEAR_TEXTURE = '/assets/gears/gear-a.png';

export class Parallax {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    /** Mỗi phần tử: { mesh, spec, baseY } */
    this.gears = [];
    /** Chiều cao một chu kỳ lặp — vượt quá thì bánh răng được cuộn vòng lại. */
    this.span = FX.GEAR_ROWS * FX.GEAR_ROW_SPACING;

    /** Hình học dùng chung cho mọi bánh răng, tỉ lệ đặt qua mesh.scale. */
    this._geo = null;

    this.build();
  }

  // ==========================================================================
  // [1] MỘT BÁNH RĂNG = MỘT TẤM PHẲNG DÁN ẢNH
  // ----------------------------------------------------------------------------
  //  Trước đây mỗi bánh răng được nặn bằng hình học: vành + trục + 10–18 răng
  //  cưa + 3 nan hoa. Nay chỉ còn MỘT tấm phẳng vuông dán ảnh bánh răng đã vẽ
  //  sẵn — vừa đẹp hơn hẳn, vừa rẻ hơn (2 tam giác thay vì hàng trăm).
  //
  //  Cả 4 lớp dùng CHUNG một tấm ảnh, chỉ khác nhau ở màu nhân vào để lớp càng
  //  xa càng chìm. Mỗi lớp một vật liệu → đúng 4 vật liệu cho toàn bộ hậu cảnh.
  // ==========================================================================
  buildGearMesh(spec, colorHex) {
    // Ảnh có chừa lề quanh bánh răng nên tấm phẳng phải to hơn bán kính một chút.
    const size = spec.radius * 2.25;
    if (!this._geo) this._geo = new THREE.PlaneGeometry(1, 1);

    const mesh = new THREE.Mesh(
      this._geo,
      spriteMaterial(GEAR_TEXTURE, { lit: false, color: colorHex }),
    );
    mesh.scale.set(size, size, 1);
    return mesh;
  }

  // ==========================================================================
  // [2] KHỞI TẠO CÁC LỚP
  // ==========================================================================
  build() {
    FX.GEARS.forEach((spec, layer) => {
      // Lớp càng xa càng tối màu → củng cố cảm giác chiều sâu.
      const shade = 0.34 + layer * 0.12;
      const color = new THREE.Color(0xffffff).multiplyScalar(shade).getHex();

      for (let row = 0; row < FX.GEAR_ROWS; row++) {
        const mesh = this.buildGearMesh(spec, color);
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
