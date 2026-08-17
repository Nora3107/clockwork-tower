/**
 * ============================================================================
 *  MergeUtils.js — Gộp nhiều khối hình học rời thành MỘT, để giảm lệnh vẽ
 * ============================================================================
 *  VÌ SAO CẦN FILE NÀY?
 *    Card đồ hoạ vẽ 5000 tam giác trong một lệnh nhanh hơn nhiều so với vẽ
 *    500 tam giác trong 100 lệnh. Nút thắt của game này không phải số tam giác
 *    (cả tháp chỉ vài nghìn) mà là SỐ LỆNH VẼ — mỗi mesh là một lệnh, và mỗi
 *    lệnh bắt CPU nói chuyện với GPU một lần.
 *
 *    Trước khi gộp: 529 mesh → ~190 lệnh vẽ mỗi khung hình → ~16 fps.
 *    Sau khi gộp:   ~45 mesh → ~25 lệnh vẽ.
 *
 *  MẸO ĐỂ GỘP ĐƯỢC MÀ VẪN NHIỀU MÀU
 *    Bình thường mỗi màu cần một vật liệu riêng, mà mỗi vật liệu lại là một
 *    lệnh vẽ. Cách lách: nhét màu vào TỪNG ĐỈNH của hình (thuộc tính `color`)
 *    rồi dùng chung một vật liệu duy nhất có `vertexColors: true`.
 *
 *  MỤC LỤC
 *    [1] withVertexColor() — sơn màu vào từng đỉnh của một khối hình
 *    [2] coloredBox()      — hộp có mặt trên sáng hơn các mặt bên
 *    [3] mergeAll()        — nối tất cả thành một khối duy nhất
 *
 *  Cố ý KHÔNG dùng BufferGeometryUtils của three: bản tự viết này chỉ xử lý
 *  đúng 3 thuộc tính mình cần (vị trí, pháp tuyến, màu) nên ngắn, dễ đọc và
 *  không phụ thuộc vào đường dẫn `examples/jsm` có thể đổi theo phiên bản.
 * ============================================================================
 */

import * as THREE from 'three';

// ============================================================================
// [1] withVertexColor() — sơn màu vào từng đỉnh
// ----------------------------------------------------------------------------
//  @param pick(normalY) -> THREE.Color : hàm chọn màu dựa vào hướng của mặt.
//    Nhờ tham số này mà mặt trên (normalY ≈ 1) có thể sáng hơn mặt bên.
// ============================================================================
export function withVertexColor(geometry, pick) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const c = pick(nor ? nor.getY(i) : 0);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// ============================================================================
// [2] coloredBox() — hộp bục nhảy: mặt trên một màu, bốn mặt bên một màu
// ----------------------------------------------------------------------------
//  Đây chính là thứ giúp người chơi liếc một cái là biết chỗ nào đặt chân được.
// ============================================================================
const _top = new THREE.Color();
const _side = new THREE.Color();

export function coloredBox(w, h, d, topHex, sideHex) {
  _top.set(topHex);
  _side.set(sideHex);
  return withVertexColor(
    new THREE.BoxGeometry(w, h, d),
    (normalY) => (normalY > 0.5 ? _top : _side),
  );
}

/** Khối hình bất kỳ, một màu duy nhất cho mọi mặt. */
export function coloredSolid(geometry, hex) {
  _side.set(hex);
  return withVertexColor(geometry, () => _side);
}

// ============================================================================
// [3] mergeAll() — nối một mảng khối hình thành một khối duy nhất
// ----------------------------------------------------------------------------
//  Điều kiện: mọi khối phải đã được sơn màu ở [1] hoặc [2] (tức là có đủ
//  position + normal + color và không dùng chỉ mục).
//  Các khối gốc được giải phóng luôn sau khi nối, tránh rò rỉ bộ nhớ GPU.
// ============================================================================
export function mergeAll(geometries) {
  let total = 0;
  for (const g of geometries) total += g.getAttribute('position').count;

  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);

  let offset = 0;
  for (const g of geometries) {
    const p = g.getAttribute('position');
    pos.set(p.array, offset * 3);
    nor.set(g.getAttribute('normal').array, offset * 3);
    col.set(g.getAttribute('color').array, offset * 3);
    offset += p.count;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Vật liệu dùng chung cho mọi khối đã gộp — đọc màu từ từng đỉnh. */
export function vertexColorMaterial(opts = {}) {
  return new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
}
