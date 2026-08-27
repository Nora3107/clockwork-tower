/**
 * ============================================================================
 *  Textures.js — Nạp và dùng chung ảnh cho toàn bộ game
 * ============================================================================
 *  ⚡ LUẬT SỐNG CÒN CỦA FILE NÀY
 *    Mỗi VẬT LIỆU là một lệnh vẽ. Ta vừa tốn công kéo số lệnh vẽ từ 190 xuống
 *    18–35 (xem docs/ARCHITECTURE.md phần [6]) — thả ảnh vào bừa bãi là mất
 *    sạch thành quả đó.
 *
 *    Nên: mọi thứ dùng CHUNG một tấm ảnh phải dùng CHUNG một vật liệu.
 *    Bộ nhớ đệm dưới đây đảm bảo gọi `texture()` mười lần với cùng đường dẫn
 *    vẫn chỉ nạp một lần và trả về đúng một đối tượng.
 *
 *  MỤC LỤC
 *    [1] BỘ NHỚ ĐỆM ẢNH
 *    [2] spriteMaterial() — vật liệu cho ảnh có nền trong suốt
 *    [3] planeFor()       — dựng tấm phẳng đúng tỉ lệ khung ảnh
 *
 *  VÌ SAO CÓ HAI KIỂU TRONG SUỐT?
 *    • alphaTest  : cắt thẳng, điểm ảnh hoặc hiện hoặc mất. Không cần sắp xếp
 *                   thứ tự vẽ → không bao giờ bị lỗi "vật thể sau che vật thể
 *                   trước". Dùng cho vật thể có mép sắc: bánh răng, bục nhảy.
 *    • transparent: pha mờ thật, cần sắp xếp thứ tự vẽ và dễ sinh lỗi chồng
 *                   lớp. Chỉ dùng khi BẮT BUỘC phải có vùng mờ dần: quầng
 *                   sáng, khói, vệt lướt.
 * ============================================================================
 */

import * as THREE from 'three';

// ============================================================================
// [1] BỘ NHỚ ĐỆM ẢNH
// ============================================================================
const loader = new THREE.TextureLoader();
const cache = new Map();

/**
 * Nạp một tấm ảnh (hoặc lấy lại từ bộ đệm nếu đã nạp).
 * @param {string} url đường dẫn tính từ thư mục public, ví dụ '/assets/gears/gear-a.png'
 */
export function texture(url) {
  let t = cache.get(url);
  if (t) return t;

  t = loader.load(url);
  // Ảnh do hoạ sĩ/AI vẽ luôn nằm trong không gian màu sRGB. Không khai báo
  // đúng thì three.js coi là màu tuyến tính và ảnh sẽ bị bạc trắng hết.
  t.colorSpace = THREE.SRGBColorSpace;
  // Lọc dị hướng: giữ nét khi tấm phẳng bị nhìn nghiêng (camera của ta chúi 13°).
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;

  cache.set(url, t);
  return t;
}

// ============================================================================
// [2] spriteMaterial() — vật liệu cho ảnh có nền trong suốt
// ============================================================================
const materials = new Map();

/**
 * @param {string} url
 * @param {object} [o]
 *  @param {boolean} [o.lit]    true = chịu ảnh hưởng ánh sáng cảnh (Lambert),
 *                              false = luôn sáng đúng như ảnh gốc (Basic)
 *  @param {number}  [o.color]  màu nhân lên ảnh, dùng để làm tối lớp hậu cảnh
 *  @param {boolean} [o.soft]   true = pha mờ thật (quầng sáng), false = cắt thẳng
 *  @param {number}  [o.opacity]
 */
export function spriteMaterial(url, o = {}) {
  const key = `${url}|${o.lit ? 1 : 0}|${o.color ?? 0xffffff}|${o.soft ? 1 : 0}|${o.opacity ?? 1}`;
  let m = materials.get(key);
  if (m) return m;

  const params = {
    map: texture(url),
    color: o.color ?? 0xffffff,
    side: THREE.DoubleSide,
    depthWrite: !o.soft,        // vùng mờ không được ghi vào bộ đệm chiều sâu
  };

  if (o.soft) {
    params.transparent = true;
    params.opacity = o.opacity ?? 1;
  } else {
    // Cắt thẳng: rẻ hơn, không cần sắp xếp, và đổ bóng đúng hình.
    params.alphaTest = 0.5;
  }

  m = o.lit ? new THREE.MeshLambertMaterial(params) : new THREE.MeshBasicMaterial(params);
  materials.set(key, m);
  return m;
}

// ============================================================================
// [3] planeFor() — dựng tấm phẳng đúng tỉ lệ khung ảnh
// ----------------------------------------------------------------------------
//  Ảnh không vuông, mà PlaneGeometry mặc định thì vuông. Nếu không chỉnh tỉ lệ
//  thì mọi thứ sẽ bị bóp méo. Hàm này nhận CHIỀU CAO mong muốn trong thế giới
//  rồi tự suy ra chiều rộng từ tỉ lệ thật của ảnh.
//
//  Ảnh nạp bất đồng bộ nên lúc gọi có thể chưa biết kích thước — khi đó dùng
//  tỉ lệ tạm rồi sửa lại ngay khi ảnh về.
// ============================================================================
export function planeFor(url, height, onReady) {
  const tex = texture(url);
  const geo = new THREE.PlaneGeometry(height, height);

  const apply = () => {
    const img = tex.image;
    if (!img || !img.width) return;
    const ratio = img.width / img.height;
    geo.scale(ratio, 1, 1);
    if (onReady) onReady(height * ratio, height);
  };

  if (tex.image && tex.image.width) apply();
  else tex.addEventListener('update', function once() {
    tex.removeEventListener('update', once);
    apply();
  });

  return geo;
}

/** Tỉ lệ rộng/cao của một ảnh đã nạp xong (1 nếu chưa biết). */
export function aspectOf(url) {
  const img = texture(url).image;
  return img && img.width ? img.width / img.height : 1;
}
