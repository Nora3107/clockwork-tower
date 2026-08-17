/**
 * ============================================================================
 *  Platform.js — Định nghĩa CÁC LOẠI BỤC và hành vi sống của chúng
 * ============================================================================
 *  File này KHÔNG biết gì về three.js. Nó chỉ mô tả hình học + trạng thái.
 *  Việc dựng mesh là của world/Level.js.
 *
 *  MỤC LỤC
 *    [1] BẢNG LOẠI BỤC (PlatformType)
 *    [2] HAI DẠNG HÌNH HỌC: 'box' (hộp chữ nhật) và 'slope' (mặt dốc)
 *    [3] createPlatform() — biến một dòng dữ liệu thô thành đối tượng bục sống
 *    [4] updatePlatform() — nhịp sống mỗi frame: băng chuyền chạy, bục rơi sập
 *    [5] TIỆN ÍCH HÌNH HỌC — lấy AABB, tính độ cao mặt dốc tại một hoành độ
 *
 *  CHỈNH Ở ĐÂU?
 *    • Muốn đổi thời gian bục sập / độ nảy lò xo → core/Config.js phần [4]
 *    • Muốn THÊM một loại bục mới → thêm vào [1], xử lý trong [4] và trong
 *      physics/Physics.js phần [5] (phản ứng khi tiếp đất).
 * ============================================================================
 */

import { COLLISION } from '../core/Config.js';

// ============================================================================
// [1] BẢNG LOẠI BỤC
// ============================================================================
export const PlatformType = {
  /** Bục tiêu chuẩn: bám vững, ma sát ổn định. */
  STATIC: 'static',
  /** Băng: gần như không ma sát, trượt tuột. */
  ICE: 'ice',
  /** Băng chuyền: tự di chuyển qua lại, kéo theo nhân vật đứng trên. */
  MOVING: 'moving',
  /** Lò xo: bật nhân vật lên cao gấp nhiều lần. */
  BOUNCY: 'bouncy',
  /** Bục nứt: rung lắc khi chạm chân rồi sập sau 1.5 giây. */
  FALLING: 'falling',
  /** Mặt dốc: nhân vật trượt xuống theo quán tính (xương sống của Phễu Tử Thần). */
  SLOPE: 'slope',
  /** Đích đến: Cỗ Máy Thời Gian trên đỉnh tháp. */
  GOAL: 'goal',
};

// ============================================================================
// [2] HAI DẠNG HÌNH HỌC
// ----------------------------------------------------------------------------
//  'box'   → mô tả bằng tâm (x, y) + kích thước (w, h). Va chạm 4 phía.
//  'slope' → mô tả bằng ĐOẠN THẲNG MẶT TRÊN (x1,y1) → (x2,y2) + độ dày `depth`.
//            Chỉ va chạm từ phía trên; hai bên cho đi xuyên qua để nhân vật
//            có thể trượt vào lòng phễu mà không bị kẹt góc.
// ============================================================================

// ============================================================================
// [3] createPlatform() — dựng đối tượng bục từ dữ liệu thô của LevelData.js
// ============================================================================
/**
 * @param {object} def dữ liệu thô, ví dụ:
 *    { type:'static', x:-20, y:30, w:14, h:2 }
 *    { type:'moving', x:0, y:700, w:12, h:2, move:{ axis:'x', range:16, speed:1.1 } }
 *    { type:'slope',  x1:-34, y1:240, x2:-4, y2:214, depth:6 }
 * @param {number} index chỉ số trong mảng, dùng làm id ổn định
 */
export function createPlatform(def, index) {
  const type = def.type || PlatformType.STATIC;
  const isSlope = type === PlatformType.SLOPE;

  const p = {
    id: index,
    type,
    kind: isSlope ? 'slope' : 'box',
    /** Nhãn tự do để debug / gắn hiệu ứng riêng (ví dụ 'funnel-1'). */
    tag: def.tag || null,
    /** Vùng sinh thái, Level.js điền vào để chọn màu. */
    zone: null,
  };

  if (isSlope) {
    // --- Mặt dốc: chuẩn hoá sao cho x1 luôn nhỏ hơn x2 ---------------------
    let { x1, y1, x2, y2 } = def;
    if (x1 > x2) { [x1, x2] = [x2, x1]; [y1, y2] = [y2, y1]; }
    p.x1 = x1; p.y1 = y1; p.x2 = x2; p.y2 = y2;
    p.depth = def.depth ?? 6;                    // thân dốc dày bao nhiêu (chỉ để vẽ)
    p.slope = (y2 - y1) / (x2 - x1 || 1e-6);     // hệ số góc: dương = dốc lên bên phải
    // Hộp bao ngoài, phục vụ lọc va chạm nhanh và dựng mesh.
    p.x = (x1 + x2) / 2;
    p.y = (Math.max(y1, y2) + Math.min(y1, y2) - p.depth) / 2;
    p.w = x2 - x1;
    p.h = Math.abs(y2 - y1) + p.depth;
  } else {
    // --- Hộp chữ nhật -------------------------------------------------------
    p.x = def.x; p.y = def.y;
    p.w = def.w; p.h = def.h ?? 2;
  }

  // --- Vị trí gốc, dùng làm neo cho bục di động và bục rơi -------------------
  p.baseX = p.x;
  p.baseY = p.y;

  // --- Băng chuyền ----------------------------------------------------------
  if (def.move) {
    p.move = {
      axis: def.move.axis || 'x',      // 'x' = chạy ngang, 'y' = lên xuống
      range: def.move.range ?? 12,     // biên độ mỗi phía (đơn vị)
      speed: def.move.speed ?? 1.0,    // rad/giây — chu kỳ = 2π/speed
      phase: def.move.phase ?? 0,      // lệch pha, để nhiều bục không chạy trùng nhau
    };
  }
  /** Vận tốc hiện tại của bục — Physics dùng để kéo nhân vật đứng trên. */
  p.vx = 0;
  p.vy = 0;

  // --- Bục rơi --------------------------------------------------------------
  if (type === PlatformType.FALLING) {
    p.state = 'idle';   // 'idle' → 'shaking' → 'falling' → 'gone' → 'idle'
    p.timer = 0;
    p.shakeOffset = 0;
  }

  /** Bục có đang tồn tại để va chạm không (bục rơi lúc 'gone' thì không). */
  p.active = true;

  return p;
}

// ============================================================================
// [4] updatePlatform() — nhịp sống mỗi frame
// ============================================================================
/**
 * @param {object} p    bục
 * @param {number} dt   thời gian frame (giây)
 * @param {number} time thời gian tích luỹ của thế giới (giây) — dùng cho dao động
 */
export function updatePlatform(p, dt, time) {
  // --- 4.1 Băng chuyền: dao động điều hoà quanh vị trí gốc ------------------
  if (p.move) {
    const { axis, range, speed, phase } = p.move;
    const prev = axis === 'x' ? p.x : p.y;
    const next = (axis === 'x' ? p.baseX : p.baseY) + Math.sin(time * speed + phase) * range;

    if (axis === 'x') { p.x = next; p.vx = (next - prev) / (dt || 1e-6); p.vy = 0; }
    else { p.y = next; p.vy = (next - prev) / (dt || 1e-6); p.vx = 0; }
  }

  // --- 4.2 Bục rơi: idle → shaking(1.5s) → falling → gone(4s) → mọc lại -----
  if (p.type === PlatformType.FALLING) {
    const C = COLLISION.FALLING;

    if (p.state === 'shaking') {
      p.timer += dt;
      // Rung mạnh dần để cảnh báo người chơi sắp sập.
      const intensity = p.timer / C.DELAY;
      p.shakeOffset = Math.sin(p.timer * C.SHAKE_FREQ) * C.SHAKE_AMP * intensity;
      if (p.timer >= C.DELAY) { p.state = 'falling'; p.timer = 0; p.vy = 0; }
    } else if (p.state === 'falling') {
      // Miếng bục tự rơi tự do xuống vực.
      p.vy += C.GRAVITY * dt;
      p.y += p.vy * dt;
      p.shakeOffset = 0;
      p.active = false;                       // vừa sập là hết va chạm ngay
      p.timer += dt;
      if (p.timer >= 1.2) { p.state = 'gone'; p.timer = 0; }
    } else if (p.state === 'gone') {
      p.timer += dt;
      if (p.timer >= C.RESPAWN) {             // mọc lại đúng chỗ cũ
        p.state = 'idle'; p.timer = 0; p.y = p.baseY; p.vy = 0; p.active = true;
      }
    } else {
      p.shakeOffset = 0;
    }
  }
}

/** Nhân vật vừa đặt chân lên bục rơi → khởi động đồng hồ đếm ngược sập. */
export function triggerFalling(p) {
  if (p.type === PlatformType.FALLING && p.state === 'idle') {
    p.state = 'shaking';
    p.timer = 0;
    return true;    // trả về true để Game phát tiếng rung cảnh báo
  }
  return false;
}

// ============================================================================
// [5] TIỆN ÍCH HÌNH HỌC
// ============================================================================

/** Cạnh trái của hộp va chạm. */
export const left = (p) => p.x - p.w / 2;
/** Cạnh phải. */
export const right = (p) => p.x + p.w / 2;
/** Mặt trên — nơi nhân vật tiếp đất. */
export const top = (p) => p.y + p.h / 2 + (p.shakeOffset || 0);
/** Mặt dưới. */
export const bottom = (p) => p.y - p.h / 2 + (p.shakeOffset || 0);

/**
 * Độ cao mặt dốc tại hoành độ px.
 * @returns {number|null} null nếu px nằm ngoài đoạn dốc.
 */
export function slopeSurfaceY(p, px) {
  if (px < p.x1 || px > p.x2) return null;
  return p.y1 + (px - p.x1) * p.slope;
}

/** Mặt dốc có phải loại "trơn tuột" không (dốc đứng hơn 30° thì gần như không giữ được). */
export function slopeAngleDeg(p) {
  return Math.atan(p.slope) * (180 / Math.PI);
}
