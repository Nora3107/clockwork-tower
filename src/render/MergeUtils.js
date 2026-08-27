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
 *    [4] texturedBox()     — hộp dán ảnh từ atlas, VẪN gộp chung được
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


// ============================================================================
// [4] texturedBox() — hộp dán ảnh lấy từ atlas
// ----------------------------------------------------------------------------
//  ĐÂY LÀ MẤU CHỐT ĐỂ VỪA CÓ ẢNH VỪA GIỮ ĐƯỢC MỘT LỆNH VẼ.
//
//  Vấn đề: một cái bục có mặt cần dán ảnh (mặt trước, mặt trên) và mặt chỉ cần
//  màu trơn (mặt sau, mặt đáy, hai mặt bên). Cách thông thường là hai vật liệu
//  → hai lệnh vẽ → nhân đôi chi phí cho cả toà tháp.
//
//  Cách ở đây: vật liệu có CẢ `map` LẪN `vertexColors`, và three.js nhân hai
//  thứ đó với nhau. Vậy thì:
//    • Mặt có ảnh   → UV trỏ vào ô ảnh trong atlas, màu đỉnh = trắng
//                     → trắng × ảnh = đúng ảnh
//    • Mặt màu trơn → UV trỏ vào ô _white trong atlas, màu đỉnh = màu muốn có
//                     → màu × trắng = đúng màu
//  Một vật liệu lo được cả hai. Xem thêm chú thích đầu scripts/atlas.py.
//
//  Thứ tự mặt của BoxGeometry sau khi bỏ chỉ mục, mỗi mặt 6 đỉnh:
//    0–5 (+X phải) · 6–11 (−X trái) · 12–17 (+Y trên)
//    18–23 (−Y đáy) · 24–29 (+Z trước) · 30–35 (−Z sau)
// ============================================================================
const FACE = { px: 0, nx: 6, py: 12, ny: 18, pz: 24, nz: 30 };

/**
 * @param {number} w,h,d kích thước hộp
 * @param {object} o
 *  @param {object} o.front ô atlas cho mặt trước {u0,v0,u1,v1}
 *  @param {object} o.white ô trắng cho các mặt còn lại
 *  @param {number} o.sideColor màu các mặt bên / sau / đáy
 *  @param {number} o.topColor  màu mặt trên
 *
 *  VÌ SAO MẶT TRÊN KHÔNG DÁN ẢNH?
 *    Đã thử và phải bỏ. Mặt trên của bục có tỉ lệ rộng/sâu khoảng 1.3:1, còn
 *    dải ảnh bề mặt thì 20:1 — nhét vào là ảnh bị kéo dãn thành những vệt dọc
 *    nhoè nhoẹt.
 *    Quan trọng hơn: mặt trên chính là thứ người chơi liếc một cái để biết
 *    "chỗ này đứng được". Một mảng màu sáng sắc nét đọc nhanh hơn nhiều so với
 *    một mảng ảnh chi tiết. Đây là chỗ mà rõ ràng thắng đẹp.
 */
export function texturedBox(w, h, d, o) {
  const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const uv = geo.getAttribute('uv');
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);

  const side = new THREE.Color(o.sideColor);
  const top = new THREE.Color(o.topColor ?? o.sideColor);

  // Gán mỗi mặt một ô atlas và một màu đỉnh
  const plan = [
    [FACE.pz, o.front, 1, 1, 1],                       // mặt trước: ảnh thật
    [FACE.py, o.white, top.r, top.g, top.b],           // mặt trên: màu trơn sắc nét
    [FACE.px, o.white, side.r, side.g, side.b],
    [FACE.nx, o.white, side.r, side.g, side.b],
    [FACE.ny, o.white, side.r, side.g, side.b],
    [FACE.nz, o.white, side.r, side.g, side.b],
  ];

  for (const [start, rect, r, g, b] of plan) {
    for (let i = start; i < start + 6; i++) {
      // UV gốc của BoxGeometry chạy 0→1 trên mỗi mặt; kéo nó vào ô atlas.
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i,
        rect.u0 + u * (rect.u1 - rect.u0),
        rect.v0 + v * (rect.v1 - rect.v0));
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
  }

  uv.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Ghép thêm thuộc tính uv vào hàm gộp — dùng cho khối hình có dán ảnh. */
export function mergeAllTextured(geometries) {
  let total = 0;
  for (const g of geometries) total += g.getAttribute('position').count;

  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const uvs = new Float32Array(total * 2);

  let offset = 0;
  for (const g of geometries) {
    const p = g.getAttribute('position');
    pos.set(p.array, offset * 3);
    nor.set(g.getAttribute('normal').array, offset * 3);
    col.set(g.getAttribute('color').array, offset * 3);
    uvs.set(g.getAttribute('uv').array, offset * 2);
    offset += p.count;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.computeBoundingSphere();
  return out;
}

/**
 * Kéo toàn bộ UV của một khối hình vào trong một ô atlas.
 * Dùng cho khối KHÔNG dán ảnh (mặt dốc, tường, nền): trỏ hết vào ô trắng rồi
 * để màu từng đỉnh quyết định màu thật. Nhờ vậy chúng vẫn gộp chung được với
 * khối có dán ảnh trong cùng một mesh.
 */
export function remapUV(geo, rect) {
  let uv = geo.getAttribute('uv');
  const n = geo.getAttribute('position').count;
  if (!uv) {
    uv = new THREE.BufferAttribute(new Float32Array(n * 2), 2);
    geo.setAttribute('uv', uv);
  }
  const cu = (rect.u0 + rect.u1) / 2;
  const cv = (rect.v0 + rect.v1) / 2;
  for (let i = 0; i < n; i++) uv.setXY(i, cu, cv);
  uv.needsUpdate = true;
  return geo;
}
