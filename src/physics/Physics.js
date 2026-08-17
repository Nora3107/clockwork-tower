/**
 * ============================================================================
 *  Physics.js — Tích phân chuyển động + va chạm. TRÁI TIM CẢM GIÁC CỦA GAME.
 * ============================================================================
 *  Nguyên tắc thiết kế:
 *    • Vật lý chạy ở BƯỚC CỐ ĐỊNH (Config.WORLD.FIXED_STEP = 1/120 giây).
 *      Nhờ vậy máy 60fps và máy 144fps cho kết quả nhảy GIỐNG HỆT NHAU —
 *      điều bắt buộc với một game speedrun đòi độ chính xác.
 *    • Va chạm giải theo trục: đi ngang trước → giải, rồi đi dọc → giải.
 *      Đây là cách đơn giản nhất mà vẫn không bị kẹt góc.
 *    • Vì mỗi bước di chuyển tối đa 135 · (1/120) ≈ 1.13 đơn vị, luôn nhỏ hơn
 *      độ dày bục (2 đơn vị) → KHÔNG BAO GIỜ xuyên bục.
 *
 *  MỤC LỤC
 *    [1] createContacts() — túi đựng sự kiện va chạm trả về cho Game
 *    [2] step()           — một bước vật lý hoàn chỉnh
 *    [3] MA SÁT & LỰC     — ma sát mặt bục, trượt dốc, lực cản không khí
 *    [4] VA CHẠM NGANG    — dội tường (Wall Bounce)
 *    [5] VA CHẠM DỌC      — tiếp đất, cộc đầu, lò xo, bục sập
 *    [6] MẶT DỐC          — bám mặt nghiêng và trượt tuột
 *    [7] BIÊN THÁP        — hai vách tường và nền đáy
 *
 *  CHỈNH Ở ĐÂU?
 *    • Độ nảy tường, ma sát, lực nảy lò xo → core/Config.js phần [4]
 *    • Trọng lực, tốc độ rơi tối đa        → core/Config.js phần [1]
 * ============================================================================
 */

import { WORLD, PLAYER, COLLISION } from '../core/Config.js';
import {
  PlatformType, left, right, top, bottom, slopeSurfaceY, triggerFalling,
} from './Platform.js';

const HALF_W = PLAYER.WIDTH / 2;
const HALF_H = PLAYER.HEIGHT / 2;
const EPS = 0.02;          // khe hở nhỏ để "đứng đúng trên mặt bục" không bị tính là chạm cạnh
const G_MAG = Math.abs(WORLD.GRAVITY);

// ============================================================================
// [1] createContacts() — túi đựng sự kiện của một FRAME (gom nhiều bước vật lý)
//     Game đọc túi này để phát âm thanh, bắn hạt, rung màn hình.
// ============================================================================
export function createContacts() {
  return {
    land: null,     // { speed, platform }  — tiếp đất
    wall: null,     // { speed, dir, x, y } — đập vào tường thẳng đứng
    ceiling: null,  // { speed, x, y }      — cộc đầu vào trần
    bounce: null,   // { speed, platform }  — bật khỏi bục lò xo
    crack: null,    // platform             — vừa dẫm lên bục nứt
    goal: false,    // chạm Cỗ Máy Thời Gian
  };
}

/** Chỉ giữ lại cú va mạnh nhất trong frame để âm thanh không bị chồng chéo. */
function keepStrongest(slot, next) {
  return !slot || next.speed > slot.speed ? next : slot;
}

// ============================================================================
// [2] step() — MỘT bước vật lý cố định
// ============================================================================
/**
 * @param {object} player  { x, y, vx, vy, grounded, groundPlatform, onSlope, dashTimer }
 * @param {Array}  platforms danh sách bục đang sống
 * @param {number} dt      luôn bằng WORLD.FIXED_STEP
 * @param {object} c       túi sự kiện từ createContacts()
 */
export function step(player, platforms, dt, c) {
  const prevX = player.x;
  const prevY = player.y;
  const wasGrounded = player.grounded;

  // --------------------------------------------------------------------------
  // [3] MA SÁT & LỰC
  // --------------------------------------------------------------------------
  applyFriction(player, dt);

  // Trượt dốc: nếu đang đứng trên mặt nghiêng, trọng lực kéo tuột xuống chân dốc.
  if (player.grounded && player.onSlope) {
    const m = player.onSlope.slope;
    // Thành phần ngang của gia tốc trọng trường dọc theo mặt dốc: g·m/(1+m²)
    player.vx += (-G_MAG * m) / (1 + m * m) * dt;
  }

  // Trọng lực — bị TẮT khi đang lướt (dash bay thẳng như viên đạn).
  if (player.dashTimer <= 0) {
    player.vy += WORLD.GRAVITY * dt;
    if (player.vy < WORLD.MAX_FALL_SPEED) player.vy = WORLD.MAX_FALL_SPEED;
  }

  // Mỗi bước mới đều coi như đang bay, các hàm giải va chạm dưới sẽ bật lại.
  player.grounded = false;
  player.groundPlatform = null;
  player.onSlope = null;

  // --------------------------------------------------------------------------
  // [4] VA CHẠM NGANG
  // --------------------------------------------------------------------------
  player.x += player.vx * dt;
  resolveHorizontal(player, platforms, prevY, wasGrounded, c);
  resolveTowerWalls(player, wasGrounded, c);

  // --------------------------------------------------------------------------
  // [5] VA CHẠM DỌC
  // --------------------------------------------------------------------------
  player.y += player.vy * dt;
  resolveVertical(player, platforms, prevY, c);

  // --------------------------------------------------------------------------
  // [6] MẶT DỐC
  // --------------------------------------------------------------------------
  resolveSlopes(player, platforms, prevX, prevY, c);

  // --------------------------------------------------------------------------
  // [7] NỀN ĐÁY THÁP — lưới an toàn cuối cùng, không cho rơi ra khỏi thế giới
  // --------------------------------------------------------------------------
  if (player.y - HALF_H < WORLD.FLOOR_Y) {
    const impact = Math.abs(player.vy);
    player.y = WORLD.FLOOR_Y + HALF_H;
    if (player.vy < 0) {
      player.vy = 0;
      player.grounded = true;
      if (impact > 6) c.land = keepStrongest(c.land, { speed: impact, platform: null });
    }
  }

  // Băng chuyền kéo theo: nhân vật đứng trên bục di động thì trôi cùng bục.
  const gp = player.groundPlatform;
  if (gp && gp.move) {
    player.x += gp.vx * dt * COLLISION.MOVING.CARRY_FACTOR;
    player.y += gp.vy * dt * COLLISION.MOVING.CARRY_FACTOR;
  }
}

// ============================================================================
// [3] MA SÁT — quyết định game "dính tay" hay "trơn tuột"
// ============================================================================
function applyFriction(player, dt) {
  if (player.dashTimer > 0) return;   // đang lướt thì không hãm

  let k;
  if (!player.grounded) {
    k = COLLISION.AIR_DRAG;                       // trên không: gần như không cản
  } else if (player.onSlope) {
    k = COLLISION.FRICTION_SLOPE;                 // mặt dốc: gần như không giữ
  } else if (player.groundPlatform?.type === PlatformType.ICE) {
    k = COLLISION.FRICTION_ICE;                   // băng: trượt dài
  } else {
    k = COLLISION.FRICTION_STATIC;                // bục thường: dừng phắt
  }

  // Tắt dần theo hàm mũ → độc lập với FPS.
  player.vx *= Math.exp(-k * dt);
  if (Math.abs(player.vx) < 0.05) player.vx = 0;
}

// ============================================================================
// [4] VA CHẠM NGANG — DỘI TƯỜNG (Wall Bounce)
// ----------------------------------------------------------------------------
//  Đây là kỹ thuật đặc trưng của thể loại: đập vào vách sẽ bị bắn ngược lại
//  với 55% lực ngang, cho phép "nảy tường" leo lên những khe hẹp.
// ============================================================================
function resolveHorizontal(player, platforms, prevY, wasGrounded, c) {
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (!p.active || p.kind === 'slope') continue;   // mặt dốc không chặn hai bên

    const pt = top(p);
    const pb = bottom(p);
    // Có chồng lấn theo chiều dọc không? (dùng Y hiện tại, chưa di chuyển dọc)
    if (player.y - HALF_H >= pt - EPS) continue;
    if (player.y + HALF_H <= pb + EPS) continue;

    const pl = left(p);
    const pr = right(p);
    if (player.x + HALF_W <= pl || player.x - HALF_W >= pr) continue;

    // Đẩy nhân vật ra phía mà nó bay tới.
    const movingRight = player.vx > 0 || (player.vx === 0 && prevY !== null && player.x < p.x);
    if (movingRight) player.x = pl - HALF_W - COLLISION.SKIN;
    else player.x = pr + HALF_W + COLLISION.SKIN;

    bounceOffWall(player, wasGrounded, movingRight ? -1 : 1, c);
  }
}

/** Xử lý phản lực khi va vách — dùng chung cho bục và cho tường biên tháp. */
function bounceOffWall(player, wasGrounded, dir, c) {
  const speed = Math.abs(player.vx);

  if (!wasGrounded && speed >= COLLISION.WALL_BOUNCE_MIN_SPEED) {
    // Đủ nhanh → nảy ngược lại, giữ phần lớn lực dọc để còn bay tiếp.
    player.vx = dir * speed * COLLISION.WALL_BOUNCE;
    player.vy *= COLLISION.WALL_BOUNCE_VY_KEEP;
    c.wall = keepStrongest(c.wall, { speed, dir, x: player.x, y: player.y });
  } else {
    // Chạm nhẹ hoặc đang đứng dưới đất → chỉ dừng lại, không nảy.
    if (speed > 3) c.wall = keepStrongest(c.wall, { speed, dir, x: player.x, y: player.y });
    player.vx = 0;
  }
  player.dashTimer = 0;    // đập tường là kết thúc cú lướt
}

// ============================================================================
// [5] VA CHẠM DỌC — tiếp đất, cộc đầu, lò xo, bục nứt
// ============================================================================
function resolveVertical(player, platforms, prevY, c) {
  const prevBottom = prevY - HALF_H;
  const prevTop = prevY + HALF_H;

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (!p.active || p.kind === 'slope') continue;

    const pl = left(p);
    const pr = right(p);
    if (player.x + HALF_W <= pl + EPS || player.x - HALF_W >= pr - EPS) continue;

    const pt = top(p);
    const pb = bottom(p);

    // --- 5.1 TIẾP ĐẤT: đang đi xuống và chân vừa cắt qua mặt bục ------------
    if (player.vy <= 0 && player.y - HALF_H < pt && prevBottom >= pt - 0.5) {
      const impact = Math.abs(player.vy);
      player.y = pt + HALF_H;

      if (p.type === PlatformType.BOUNCY) {
        // --- Bục lò xo: bật ngược lên, càng rơi mạnh càng bay cao ---------
        const B = COLLISION.BOUNCY;
        const v = Math.min(Math.max(impact * B.FACTOR, B.MIN_SPEED), B.MAX_SPEED);
        player.vy = v;
        player.grounded = false;
        c.bounce = keepStrongest(c.bounce, { speed: v, platform: p });
      } else {
        player.vy = 0;
        player.grounded = true;
        player.groundPlatform = p;
        if (impact > 6) c.land = keepStrongest(c.land, { speed: impact, platform: p });

        // --- Bục nứt: dẫm lên là bắt đầu đếm ngược 1.5 giây --------------
        if (triggerFalling(p)) c.crack = p;

        // --- Đích đến ------------------------------------------------------
        if (p.type === PlatformType.GOAL) c.goal = true;
      }
      continue;
    }

    // --- 5.2 CỘC ĐẦU: đang bay lên và đầu vừa cắt qua đáy bục --------------
    if (player.vy > 0 && player.y + HALF_H > pb && prevTop <= pb + 0.5) {
      const impact = Math.abs(player.vy);
      player.y = pb - HALF_H;
      player.vy = -player.vy * COLLISION.CEILING_BOUNCE;
      player.dashTimer = 0;
      if (impact > 8) c.ceiling = keepStrongest(c.ceiling, { speed: impact, x: player.x, y: player.y });
    }
  }
}

// ============================================================================
// [6] MẶT DỐC — bám mặt nghiêng, nền tảng của "Phễu Tử Thần"
// ----------------------------------------------------------------------------
//  Mặt dốc CHỈ chặn từ phía trên. Nhảy từ dưới lên sẽ xuyên qua, để nhân vật
//  không bị kẹt cứng trong lòng phễu.
// ============================================================================
function resolveSlopes(player, platforms, prevX, prevY, c) {
  if (player.vy > 0) return;    // đang bay lên thì mặc kệ mặt dốc

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (!p.active || p.kind !== 'slope') continue;

    const sy = slopeSurfaceY(p, player.x);
    if (sy === null) continue;                 // ngoài đoạn dốc

    const feet = player.y - HALF_H;
    if (feet > sy) continue;                   // còn ở trên mặt dốc, chưa chạm
    if (feet < sy - p.depth) continue;         // đã lọt hẳn xuống dưới thân dốc

    // Frame trước có ở phía trên mặt dốc không? (cho phép sai số để trượt mượt)
    const prevSy = slopeSurfaceY(p, prevX);
    const prevFeet = prevY - HALF_H;
    if (prevSy !== null && prevFeet < prevSy - 1.2) continue;

    const impact = Math.abs(player.vy);
    player.y = sy + HALF_H;
    player.vy = 0;
    player.grounded = true;
    player.onSlope = p;
    player.groundPlatform = p;
    if (impact > 14) c.land = keepStrongest(c.land, { speed: impact * 0.6, platform: p });
  }
}

// ============================================================================
// [7] BIÊN THÁP — hai vách tường trái/phải
// ============================================================================
function resolveTowerWalls(player, wasGrounded, c) {
  const limit = WORLD.HALF_WIDTH - HALF_W;

  if (player.x < -limit) {
    player.x = -limit;
    bounceOffWall(player, wasGrounded, 1, c);
  } else if (player.x > limit) {
    player.x = limit;
    bounceOffWall(player, wasGrounded, -1, c);
  }
}

// ============================================================================
//  TIỆN ÍCH DÙNG CHUNG — Level validator và AI debug gọi tới
// ============================================================================
/** Tầm bay xa tối đa (đơn vị) của một cú nhảy full lực ở góc 45°. */
export function maxJumpRange() {
  const v = PLAYER.MAX_JUMP_SPEED;
  return (v * v) / G_MAG;               // = v²/g, đạt được ở góc 45°
}

/** Độ cao tối đa (đơn vị) của một cú nhảy full lực thẳng đứng. */
export function maxJumpHeight() {
  const v = PLAYER.MAX_JUMP_SPEED;
  return (v * v) / (2 * G_MAG);
}
