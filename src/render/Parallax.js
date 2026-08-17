/**
 * ============================================================================
 *  Parallax.js — Hậu cảnh bánh răng đồng hồ khổng lồ quay chậm ở phía xa
 * ============================================================================
 *  Đây là thứ khiến người chơi TIN rằng mình đang ở trong một cỗ máy khổng lồ.
 *  Bốn lớp chiều sâu khác nhau: lớp càng xa thì trôi càng chậm khi camera lên
 *  cao, tạo ảo giác không gian ba chiều thật sự.
 *
 *  ⚡ HIỆU NĂNG — điều quan trọng nhất của file này
 *    Một bánh răng gồm vành + trục + 10–18 răng cưa + 3 nan hoa. Nếu để mỗi
 *    chi tiết là một mesh thì 16 bánh răng = 370 mesh = 370 lệnh vẽ mỗi khung
 *    hình, đủ để kéo game xuống 16 fps.
 *    Cách làm ở đây: GỘP toàn bộ chi tiết của một bánh răng thành MỘT khối
 *    hình học duy nhất ngay lúc khởi tạo → mỗi bánh răng chỉ còn 1 lệnh vẽ.
 *
 *  MỤC LỤC
 *    [1] DỰNG MỘT BÁNH RĂNG ĐÃ GỘP (vành + răng + nan hoa → 1 geometry)
 *    [2] KHỞI TẠO CÁC LỚP
 *    [3] update() — quay bánh răng + cuộn lặp vô tận theo camera
 *
 *  CHỈNH Ở ĐÂU?
 *    • Số lớp, bán kính, tốc độ quay, hệ số parallax → core/Config.js phần [7]
 * ============================================================================
 */

import * as THREE from 'three';
import { FX } from '../core/Config.js';
import { coloredSolid, mergeAll, vertexColorMaterial } from './MergeUtils.js';

export class Parallax {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    /** Mỗi phần tử: { mesh, spec, baseY } */
    this.gears = [];
    /** Chiều cao một chu kỳ lặp — vượt quá thì bánh răng được cuộn vòng lại. */
    this.span = FX.GEAR_ROWS * FX.GEAR_ROW_SPACING;

    // Một vật liệu duy nhất cho TẤT CẢ bánh răng; màu nằm trong từng đỉnh.
    this.material = vertexColorMaterial();

    this.build();
  }

  // ==========================================================================
  // [1] DỰNG MỘT BÁNH RĂNG ĐÃ GỘP
  // ----------------------------------------------------------------------------
  //  Từng chi tiết được tạo ra, dịch/xoay về đúng chỗ, sơn màu vào đỉnh, rồi
  //  tất cả được nối lại thành một khối. Sau bước này không còn "chi tiết" nào
  //  tồn tại riêng lẻ nữa — chỉ còn một mảng số gửi thẳng cho GPU.
  // ==========================================================================
  buildGearGeometry(radius, teeth, colorHex) {
    const parts = [];

    // Vành ngoài
    parts.push(new THREE.TorusGeometry(radius, radius * 0.09, 5, 22));

    // Trục giữa
    const hub = new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, 1.5, 8);
    hub.rotateX(Math.PI / 2);
    parts.push(hub);

    // Răng cưa quanh vành
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const t = new THREE.BoxGeometry(radius * 0.16, radius * 0.22, 1.4);
      t.rotateZ(a);
      t.translate(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      parts.push(t);
    }

    // Nan hoa nối trục với vành
    for (let i = 0; i < 3; i++) {
      const s = new THREE.BoxGeometry(radius * 1.85, radius * 0.09, 1.2);
      s.rotateZ((i / 3) * Math.PI);
      parts.push(s);
    }

    return mergeAll(parts.map((g) => coloredSolid(g, colorHex)));
  }

  // ==========================================================================
  // [2] KHỞI TẠO CÁC LỚP
  // ==========================================================================
  build() {
    FX.GEARS.forEach((spec, layer) => {
      // Lớp càng xa càng tối màu → củng cố cảm giác chiều sâu.
      const shade = 0.30 + layer * 0.10;
      const color = new THREE.Color(0x8a6320).multiplyScalar(shade).getHex();

      // Cả một lớp dùng chung MỘT khối hình học (chỉ khác vị trí và góc quay),
      // nên GPU chỉ phải nạp dữ liệu 4 lần cho toàn bộ hậu cảnh.
      const geo = this.buildGearGeometry(spec.radius, spec.teeth, color);

      for (let row = 0; row < FX.GEAR_ROWS; row++) {
        const mesh = new THREE.Mesh(geo, this.material);
        // So le trái/phải và lệch pha theo hàng để không nhìn ra quy luật lặp.
        const side = (row + layer) % 2 === 0 ? -1 : 1;
        mesh.position.set(side * (14 + layer * 5), row * FX.GEAR_ROW_SPACING, spec.z);
        mesh.rotation.z = (row * 1.7 + layer) % (Math.PI * 2);
        mesh.matrixAutoUpdate = true;
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
