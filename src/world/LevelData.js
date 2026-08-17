/**
 * ============================================================================
 *  LevelData.js — TOÀN BỘ BẢN ĐỒ THÁP. Một màn chơi duy nhất, Y: 0 → 1050.
 * ============================================================================
 *  Đây là file quyết định game khó hay dễ. Không có màn chơi riêng, không có
 *  checkpoint: mọi thứ trong file này là MỘT toà tháp liền mạch.
 *
 *  MỤC LỤC
 *    [1] BỘ SINH SỐ NGẪU NHIÊN CÓ HẠT GIỐNG — map giống hệt nhau mỗi lần mở
 *    [2] TOÁN TẦM NHẢY — công thức kiểm tra "cú nhảy này có với tới không?"
 *    [3] TowerBuilder — bộ dựng tháp: thang zic-zac, thang bám vách, phễu
 *    [4] VÙNG 1 — RỪNG CƠ KHÍ      (Y 0 → 350)    + Phễu Tử Thần #1 @ Y214
 *    [5] VÙNG 2 — HẦM BĂNG GIÁ     (Y 350 → 650)  + Trạm nghỉ @ Y500
 *    [6] VÙNG 3 — LÕI THÁP ĐỒNG HỒ (Y 650 → 1000) + Siêu Phễu #2 @ Y880
 *    [7] ĐỈNH THÁP                 (Y 1000 → 1050) Cỗ Máy Thời Gian
 *    [8] buildLevelData() — ghép tất cả lại
 *    [9] validateLevel()  — cảnh báo nếu có cú nhảy vượt tầm (chạy ở chế độ dev)
 *
 *  CHỈNH Ở ĐÂU?
 *    • Đổi độ khó tổng thể   → sửa SEED ở [1] hoặc tham số `ladder()` ở [4][5][6]
 *    • Dời phễu tử thần      → sửa lời gọi `funnel()` ở [4] và [6]
 *    • Thêm một bục cụ thể   → gọi `b.box({...})` (mạch chính) hoặc `b.free({...})`
 *
 *  ⚠ Sau MỌI thay đổi ở file này, mở game bằng `npm run dev` và xem console:
 *    validateLevel() sẽ in cảnh báo nếu bạn vừa tạo ra một cú nhảy bất khả thi.
 * ============================================================================
 */

import { WORLD, PLAYER, LEVEL_DESIGN } from '../core/Config.js';
import { PlatformType } from '../physics/Platform.js';

const HW = WORLD.HALF_WIDTH;          // 24 — nửa chiều rộng lòng tháp
const PHW = PLAYER.WIDTH / 2;         // nửa bề ngang nhân vật

// ============================================================================
// [1] BỘ SINH SỐ NGẪU NHIÊN CÓ HẠT GIỐNG (mulberry32)
// ----------------------------------------------------------------------------
//  Dùng số ngẫu nhiên để bục nhảy có nhịp điệu tự nhiên, nhưng CÓ HẠT GIỐNG
//  cố định nên map luôn y hệt nhau — điều bắt buộc với game speedrun.
//  Đổi SEED = có ngay một toà tháp khác hoàn toàn (nhớ chạy lại validateLevel).
// ============================================================================
export const SEED = 20260817;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// [2] TOÁN TẦM NHẢY
// ----------------------------------------------------------------------------
//  Vật lý ném xiên: để bay từ gốc toạ độ tới điểm (dx, dy) cần vận tốc tối
//  thiểu v thoả  v² = g·( dy + √(dx² + dy²) ).
//  Đặt COST = dy + √(dx² + dy²) thì điều kiện với tới là  COST ≤ v²max / g.
//
//  ⚠ HAI THƯỚC ĐO KHÁC NHAU — đừng nhầm lẫn:
//
//    DESIGN_COST — tính từ LEVEL_DESIGN.JUMP_SPEED. Đây là thước dùng để ĐẶT
//      BỤC. Nó phải đứng yên, vì mỗi lần nó đổi là cả toà tháp được sinh lại
//      khác đi hoàn toàn.
//
//    MAX_COST — tính từ PLAYER.MAX_JUMP_SPEED, tức sức nhảy THẬT của người
//      chơi hiện tại. Đây là thước dùng để KIỂM TRA map có đi được không.
//
//    Khoảng chênh giữa hai con số chính là "biên an toàn" của người chơi.
//    Muốn game dễ thở hơn → tăng PLAYER.MAX_JUMP_SPEED (map giữ nguyên).
//    Muốn tháp giãn rộng ra → tăng LEVEL_DESIGN.JUMP_SPEED (map vẽ lại).
// ============================================================================
const G = Math.abs(WORLD.GRAVITY);

/** Tầm với thật sự của người chơi — dùng để kiểm tra map. */
export const MAX_COST = (PLAYER.MAX_JUMP_SPEED ** 2) / G;

/** Tầm với mà bản đồ được vẽ theo — dùng để đặt bục. */
const DESIGN_COST = (LEVEL_DESIGN.JUMP_SPEED ** 2) / G;
/** Ngưỡng "thoải mái" — chừa biên an toàn ~11% cho phần lớn bục. */
const SAFE_COST = DESIGN_COST * 0.89;
/** Ngưỡng "nút thắt" — dành cho các cú nhảy chính xác cố tình làm khó. */
const HARD_COST = DESIGN_COST * 0.96;
/** Bậc thang không bao giờ được thấp hơn mức này so với bậc trước. */
const MIN_STEP_Y = 3.5;

/** Khoảng hoành độ mà nhân vật thực sự đứng vững được trên một bục. */
function standSpan(d) {
  const l = d.x - d.w / 2 + PHW;
  const r = d.x + d.w / 2 - PHW;
  return l <= r ? [l, r] : [d.x, d.x];   // bục hẹp hơn nhân vật → chỉ đứng giữa
}

/** Chi phí cú nhảy giữa hai bục (càng nhỏ càng dễ). Xem công thức ở [2]. */
export function reachCost(from, to) {
  const [fl, fr] = standSpan(from);
  const [tl, tr] = standSpan(to);
  let sx, lx;
  if (tr < fl) { sx = fl; lx = tr; }         // bục đích nằm hẳn bên trái
  else if (tl > fr) { sx = fr; lx = tl; }    // bục đích nằm hẳn bên phải
  else { sx = Math.max(fl, tl); lx = sx; }   // hai bục chồng nhau theo phương ngang
  const dx = Math.abs(lx - sx);
  const dy = (to.y + to.h / 2) - (from.y + from.h / 2);
  return dy + Math.hypot(dx, dy);
}

// ============================================================================
// [3] TowerBuilder — bộ dựng tháp
// ----------------------------------------------------------------------------
//  b.box()     đặt bục và ghi nhớ nó làm "bậc thang hiện tại" của mạch leo
//  b.free()    đặt bục phụ (lò xo, mỏm trang trí) KHÔNG nằm trên mạch leo
//  b.anchor()  dời điểm xuất phát của mạch leo sang một bục đã có
//  b.ladder()  sinh một đoạn thang, tự động kéo mọi bục vào tầm với
//  b.funnel()  dựng một Phễu Tử Thần (2 mặt dốc chụm vào một khe hở)
//
//  HAI KIỂU THANG
//    mode:'zigzag' → đảo trái–phải mỗi bậc. Nhịp leo kinh điển của thể loại.
//    mode:'wall'   → bám MỘT bên vách, so le trong–ngoài. Dùng cho đoạn phải
//                    chừa trống cột giữa tháp làm giếng rơi cho phễu.
// ============================================================================
class TowerBuilder {
  constructor(seed) {
    this.rng = mulberry32(seed);
    this.defs = [];
    this.prev = null;      // bậc thang gần nhất của mạch leo chính
    this.chain = [];       // toàn bộ mạch leo chính, dùng cho validateLevel()
  }

  /** Số thực ngẫu nhiên trong [a, b). */
  r(a, b) { return a + this.rng() * (b - a); }

  /** Bục nằm trên mạch leo chính. */
  box(def) {
    const d = { type: PlatformType.STATIC, h: 2, ...def };
    this.defs.push(d);
    this.prev = d;
    this.chain.push(d);
    return d;
  }

  /** Bục phụ: không tham gia mạch leo, không bị kiểm tra tầm với. */
  free(def) {
    const d = { type: PlatformType.STATIC, h: 2, ...def };
    this.defs.push(d);
    return d;
  }

  /** Dời điểm xuất phát của mạch leo sang một bục đã đặt trước đó. */
  anchor(def) { this.prev = def; this.chain.push(def); return this; }

  /**
   * Sinh một đoạn thang.
   *
   * @param {object} o
   *  @param {number} o.toY             leo tới độ cao này thì dừng
   *  @param {[number,number]} o.step   khoảng cách dọc mỗi bậc [min, max]
   *  @param {[number,number]} o.width  bề rộng bục [min, max]
   *  @param {[number,number]} o.center độ lệch tâm |x| của bục [min, max]
   *  @param {'zigzag'|'wall'} [o.mode] kiểu thang (mặc định 'zigzag')
   *  @param {number} [o.minAbsCenter]  ép mép trong của bục cách tâm tháp ít nhất
   *                                    bấy nhiêu → chừa trống giếng rơi
   *  @param {Array}  [o.types]         bảng trọng số loại bục, vd [['ice',7],['static',3]]
   *  @param {number} [o.budget]        ngưỡng chi phí cho phép (mặc định SAFE_COST)
   *  @param {number} [o.side]          bên bắt đầu: -1 trái, +1 phải
   *  @param {string} [o.tag]
   */
  ladder(o) {
    const budget = o.budget ?? SAFE_COST;
    const mode = o.mode ?? 'zigzag';
    let side = o.side ?? (this.prev && this.prev.x > 0 ? -1 : 1);
    let outer = true;                     // dùng cho mode 'wall': so le trong/ngoài

    // Chốt chặn tuyệt đối: dù tham số có sai thế nào cũng không treo trình duyệt.
    for (let guard = 0; guard < 400 && this.prev.y < o.toY; guard++) {
      const w = this.r(o.width[0], o.width[1]);
      const dy = this.r(o.step[0], o.step[1]);

      let cx;
      if (mode === 'wall') {
        // Bám một bên vách: xen kẽ mép trong (sát giếng) và mép ngoài (sát tường).
        const inner = (o.minAbsCenter ?? 0) + w / 2;
        const outerMax = HW - w / 2 - 0.5;
        cx = side * (outer ? this.r(Math.min(inner + 3, outerMax), outerMax)
          : this.r(inner, Math.min(inner + 2.5, outerMax)));
        outer = !outer;
      } else {
        cx = side * this.r(o.center[0], o.center[1]);
      }

      // Không cho bục lấn vào giếng rơi, cũng không cho thò ra ngoài vách tháp.
      if (o.minAbsCenter) {
        const need = o.minAbsCenter + w / 2;
        if (Math.abs(cx) < need) cx = side * need;
      }
      const maxAbs = HW - w / 2 - 0.5;
      if (Math.abs(cx) > maxAbs) cx = side * maxAbs;

      const type = o.types ? this.pickType(o.types) : PlatformType.STATIC;
      const cand = { type, w, h: 2, x: cx, y: this.prev.y + dy, tag: o.tag };
      if (type === PlatformType.MOVING) {
        // Băng chuyền chạy ngang; biên độ sẽ bị thu lại nếu làm bục ngoài tầm với.
        cand.move = { axis: 'x', range: this.r(4, 8), speed: this.r(0.7, 1.3), phase: this.r(0, 6.28) };
        // Không để băng chuyền trôi vào giếng rơi hoặc đâm vào vách.
        if (o.minAbsCenter) {
          cand.move.range = Math.min(cand.move.range, Math.abs(cand.x) - (o.minAbsCenter + cand.w / 2));
        }
        cand.move.range = Math.min(cand.move.range, maxAbs - Math.abs(cand.x));
        if (cand.move.range < 1.5) delete cand.move;
      }

      this.fitIntoReach(cand, budget, o.minAbsCenter, side);
      this.box(cand);
      if (mode === 'zigzag') side = -side;    // đảo bên → nhịp zic-zac trái–phải
    }
    return this;
  }

  /** Rút một loại bục theo trọng số, ví dụ [['static',6],['ice',3],['moving',1]]. */
  pickType(table) {
    let total = 0;
    for (const [, wgt] of table) total += wgt;
    let roll = this.rng() * total;
    for (const [t, wgt] of table) { roll -= wgt; if (roll <= 0) return t; }
    return table[0][0];
  }

  /**
   * Kéo một bục ứng viên vào TẦM VỚI của bậc thang trước đó.
   * Thứ tự nhượng bộ: kéo ngang về tâm → thu hẹp hành trình băng chuyền →
   * hạ thấp bục. Không bao giờ hạ thấp quá MIN_STEP_Y (nếu không thang sẽ
   * không bao giờ leo tới đích và vòng lặp sẽ chạy mãi).
   */
  fitIntoReach(cand, budget, minAbsCenter, side) {
    if (!this.prev) return;
    // Băng chuyền có thể trôi ra xa → siết ngưỡng thêm đúng bằng biên độ trôi.
    const effBudget = budget - (cand.move ? cand.move.range : 0);
    const floor = (minAbsCenter ?? 0) + cand.w / 2;

    for (let guard = 0; guard < 200; guard++) {
      if (reachCost(this.prev, cand) <= effBudget) return;

      if (Math.abs(cand.x) > floor + 0.5) {
        cand.x -= side * 0.5;                          // kéo bục về phía tâm tháp
      } else if (cand.move && cand.move.range > 2) {
        cand.move.range -= 0.5;                        // thu hẹp hành trình băng chuyền
      } else if (cand.y - this.prev.y > MIN_STEP_Y) {
        cand.y -= 0.4;                                 // hạ bục thấp xuống
      } else {
        return;   // đã nhượng bộ hết mức — validateLevel() sẽ báo nếu vẫn quá tầm
      }
    }
  }

  /**
   * ☠ PHỄU TỬ THẦN — hai mặt dốc chụm vào một khe hở ở giữa.
   *  Rơi trúng phễu = bị dồn vào khe rồi tuột thẳng xuống mấy tầng bên dưới.
   *  Mặt dốc chỉ chặn TỪ TRÊN, nên đường leo lên chính là chui qua khe hở.
   *
   * @param {object} o
   *  @param {number} o.y       độ cao của khe hở (đáy phễu)
   *  @param {number} o.gapHalf nửa bề rộng khe (nhân vật rộng 2.8 đơn vị)
   *  @param {number} o.rise    hai mép ngoài cao hơn khe bao nhiêu → quyết định độ dốc
   *  @param {string} o.tag
   */
  funnel(o) {
    const { y, gapHalf, rise, tag } = o;
    this.defs.push({ type: PlatformType.SLOPE, x1: -HW, y1: y + rise, x2: -gapHalf, y2: y, depth: 7, tag });
    this.defs.push({ type: PlatformType.SLOPE, x1: gapHalf, y1: y, x2: HW, y2: y + rise, depth: 7, tag });
    return this;
  }

  /**
   * ỐNG TỤT — hai vách thẳng đứng ngay dưới khe hở của phễu.
   *
   *  VÌ SAO CẦN?  Người trượt hết mặt dốc lao ra khỏi khe với vận tốc ngang
   *  rất lớn (40+ đơn vị/giây), đủ để bay vọt sang tận bên kia giếng và bám
   *  được vào bậc thang phía đối diện — thế là cái bẫy mất tác dụng.
   *  Hai vách này nhốt nạn nhân lại: va vào vách thì DỘI TƯỜNG, mất dần lực
   *  ngang, và rơi thẳng một mạch xuống đáy giếng.
   *
   *  ⚠ Ống PHẢI rộng hơn khe hở, và PHẢI kết thúc cách bệ hứng một quãng để
   *    người chơi còn bước ra ngoài được (nếu không sẽ bị nhốt trong ống).
   *
   * @param {object} o { yFrom, yTo, halfWidth (mặt trong), thickness, tag }
   */
  throat(o) {
    const t = o.thickness ?? 1.5;
    const h = o.yTo - o.yFrom;
    for (const s of [-1, 1]) {
      this.defs.push({
        type: PlatformType.STATIC,
        x: s * (o.halfWidth + t / 2),
        y: (o.yFrom + o.yTo) / 2,
        w: t, h, tag: o.tag,
      });
    }
    return this;
  }
}

// ============================================================================
// [4] VÙNG 1 — RỪNG CƠ KHÍ (Y 0 → 350)
// ----------------------------------------------------------------------------
//  Nhánh cây kim loại, rễ đan chéo. Nhiệm vụ: dạy người chơi nhịp zic-zac và
//  cảm giác căn lực. Kết thúc bằng cú tát đầu tiên — Phễu Tử Thần #1.
// ============================================================================
function buildForest(b) {
  // --- 4.1 Nền tháp: sàn đá liền mạch, nơi chú robot thức tỉnh ---------------
  b.box({ x: 0, y: -2, w: HW * 2, h: 4, tag: 'ground' });

  // --- 4.2 Bậc thang khởi động: bục rộng, bước ngắn, ai cũng qua được -------
  b.ladder({ toY: 58, step: [7, 9], width: [14, 18], center: [7, 13], tag: 'z1-warmup' });

  // --- 4.3 Thắt lại: bục hẹp dần, bắt đầu phải căn lực 60–80% ---------------
  b.ladder({ toY: 100, step: [7.5, 9.5], width: [10, 14], center: [8, 14], tag: 'z1-mid' });

  // --- 4.4 NÚT THẮT ĐẦU TIÊN: bục bằng đầu ngón chân ------------------------
  //     Rộng 4.5 đơn vị trong khi nhân vật rộng 2.8 → chỉ còn 1.7 đơn vị
  //     dung sai. Sai một ly là rơi một dặm, đúng nghĩa đen.
  const spike = { type: PlatformType.STATIC, w: 4.5, h: 2, x: -12, y: b.prev.y + 9, tag: 'z1-precision' };
  b.fitIntoReach(spike, HARD_COST, 0, -1);
  b.box(spike);

  // --- 4.5 Bệ hứng của Phễu #1 ---------------------------------------------
  //     Vừa là bậc thang bình thường trên đường lên, vừa là nơi nạn nhân của
  //     phễu rơi xuống. Nhìn thấy nó lần thứ hai nghĩa là bạn vừa mất 100 mét.
  b.box({ x: 0, y: 118, w: 18, h: 2.5, tag: 'funnel-1-landing' });

  // --- 4.6 Giếng rơi: bám vách trái leo lên, chừa trống cột x ∈ [-8, 8] -----
  //     ⚠ minAbsCenter PHẢI lớn hơn `gapHalf` của phễu ít nhất một nửa bề ngang
  //       nhân vật (1.4), nếu không người rơi qua khe sẽ mắc vào mép bục và
  //       cái bẫy mất tác dụng. Ở đây gapHalf = 5 → chọn 8 cho dư dả.
  b.ladder({
    toY: 188, step: [8, 10], width: [9, 13], center: [10, 19],
    mode: 'wall', side: -1, minAbsCenter: 8, tag: 'z1-shaft',
  });

  // --- 4.6b Bậc chờ ngay dưới chân phễu ------------------------------------
  const a1 = { type: PlatformType.STATIC, w: 9, h: 2, x: -15, y: 200, tag: 'z1-shaft' };
  b.fitIntoReach(a1, SAFE_COST, 8, -1);
  b.box(a1);

  // --- 4.7 ☠ PHỄU TỬ THẦN #1 @ Y214 ----------------------------------------
  //     Hai vách dốc 32° chụm vào khe rộng 10 đơn vị.
  //     Trượt chân ở tầng trên → bị dồn vào khe → rơi thẳng về bệ hứng Y118.
  //     Mất trắng ~95 đơn vị độ cao (khoảng 11 bậc thang).
  b.funnel({ y: 214, gapHalf: 5, rise: 12, tag: 'funnel-1' });
  b.throat({ yFrom: 148, yTo: 213, halfWidth: 5.75, tag: 'funnel-1' });

  // --- 4.8 ĐƯỜNG SỐNG QUA PHỄU --------------------------------------------
  //  Ba bậc, và cả ba đều KHÔNG được chắn ngang khe hở (nếu chắn thì cái bẫy
  //  mất tác dụng — người rơi sẽ đáp lên chính bậc cứu hộ của mình).
  //    b1 "hang trú" : nằm LỌT DƯỚI bụng mặt dốc — mép trên phải thấp hơn mặt
  //                    dốc ít nhất 3.2 đơn vị (chiều cao nhân vật) để không kẹt.
  //    e1 "mỏm treo" : nằm TRÊN mặt dốc — mép dưới phải cao hơn đầu của một
  //                    người đang trượt trên dốc, nếu không nó sẽ chặn cú trượt.
  //    c1            : bậc thoát cuối, đã ra khỏi hẳn vùng phễu.
  b.box({ x: -12, y: 211, w: 6, h: 2, tag: 'funnel-1-cave' });
  b.box({ x: -8, y: 223, w: 6, h: 2, tag: 'funnel-1-lip' });
  b.box({ x: -6, y: 233, w: 7, h: 2, tag: 'funnel-1-lip' });

  // --- 4.9 Qua phễu: nhịp nhanh dần, băng bắt đầu xuất hiện -----------------
  b.ladder({ toY: 296, step: [7.5, 10], width: [9, 14], center: [8, 15], tag: 'z1-upper' });
  b.ladder({
    toY: 344, step: [8, 10.5], width: [8, 12], center: [8, 16],
    types: [[PlatformType.STATIC, 8], [PlatformType.ICE, 2]], tag: 'z1-transition',
  });
}

// ============================================================================
// [5] VÙNG 2 — HẦM BĂNG GIÁ (Y 350 → 650)
// ----------------------------------------------------------------------------
//  Vách băng trơn lạnh, mỏm băng li ti bám sát mép vực. Ma sát gần như bằng 0
//  nên tiếp đất xong VẪN CÒN TRƯỢT — phải tính trước cả điểm dừng, không chỉ
//  điểm rơi. Giữa vùng có một trạm nghỉ an toàn.
// ============================================================================
function buildIce(b) {
  // --- 5.1 Cửa hầm: bục đá rộng cuối cùng trước khi mọi thứ trơn tuột ------
  b.box({ x: -14, y: 354, w: 15, h: 2, tag: 'z2-gate' });

  // --- 5.2 Dốc băng: bục nhỏ dần, phần lớn là băng -------------------------
  b.ladder({
    toY: 428, step: [7.5, 9.5], width: [8, 12], center: [8, 15],
    types: [[PlatformType.ICE, 7], [PlatformType.STATIC, 3]], tag: 'z2-lower',
  });

  // --- 5.3 Mỏm băng li ti bám sát vách ------------------------------------
  //     center [13, 19] đẩy bục ra sát tường: cú nhảy hơi quá tay là đập vào
  //     vách và bị DỘI TƯỜNG bắn ngược lại. Người chơi giỏi sẽ lợi dụng điều đó.
  b.ladder({
    toY: 486, step: [8, 10], width: [6, 9], center: [13, 19],
    types: [[PlatformType.ICE, 9], [PlatformType.STATIC, 1]],
    budget: HARD_COST, tag: 'z2-spikes',
  });

  // --- 5.4 ⛺ TRẠM NGHỈ AN TOÀN @ Y500 -------------------------------------
  //     Bục đá rộng, KHÔNG trơn. Chỗ duy nhất trong vùng được thở.
  //     Bậc đệm phía dưới đảm bảo trạm nghỉ luôn với tới được dù đoạn "mỏm băng
  //     li ti" phía trên kết thúc ở đâu (vị trí bục do hạt giống ngẫu nhiên quyết định).
  const side = b.prev.x > 0 ? 1 : -1;
  const approach = { type: PlatformType.ICE, w: 8, h: 2, x: side * 11, y: 492, tag: 'z2-approach' };
  b.fitIntoReach(approach, HARD_COST, 0, side);
  b.box(approach);

  b.box({ x: 0, y: 500, w: 24, h: 3, type: PlatformType.STATIC, tag: 'rest-station' });
  b.free({ x: -19, y: 509, w: 9, h: 2, tag: 'rest-shelf' });
  b.free({ x: 19, y: 509, w: 9, h: 2, tag: 'rest-shelf' });

  // --- 5.5 Ống khói băng: bục cực nhỏ so le sát hai vách -------------------
  b.ladder({
    toY: 564, step: [8.5, 10.5], width: [6, 8.5], center: [12, 19],
    types: [[PlatformType.ICE, 8], [PlatformType.STATIC, 2]],
    budget: HARD_COST, tag: 'z2-chimney',
  });

  // --- 5.6 Đoạn cuối vùng băng --------------------------------------------
  b.ladder({
    toY: 620, step: [8, 10], width: [8, 12], center: [8, 16],
    types: [[PlatformType.ICE, 6], [PlatformType.STATIC, 4]], tag: 'z2-upper',
  });

  // --- 5.7 Bệ hứng của Siêu Phễu #2 ---------------------------------------
  //     Rơi từ Y880 xuống đây là mất trắng 250 đơn vị — gần nửa chặng đường.
  //     Cảnh này chính là hình phạt nặng nhất của cả game.
  b.box({ x: 0, y: 630, w: 22, h: 3, type: PlatformType.STATIC, tag: 'funnel-2-landing' });

  // --- 5.8 Đệm lò xo cứu hộ: rơi trúng thì được bật lại lên một đoạn -------
  b.free({ x: -18, y: 637, w: 9, h: 2, type: PlatformType.BOUNCY, tag: 'z2-spring' });
  b.free({ x: 18, y: 637, w: 9, h: 2, type: PlatformType.BOUNCY, tag: 'z2-spring' });
}

// ============================================================================
// [6] VÙNG 3 — LÕI THÁP ĐỒNG HỒ (Y 650 → 1000)
// ----------------------------------------------------------------------------
//  Không gian cơ khí SỐNG: băng chuyền chạy qua lại, lò xo bật cao, bục nứt
//  sập sau 1.5 giây. Toàn bộ đoạn Y630 → Y878 phải chừa trống cột giữa
//  (x ∈ [-5, 5]) để làm giếng rơi cho Siêu Phễu #2.
// ============================================================================
function buildCore(b) {
  // --- 6.1 Cửa vào lõi tháp: bám vách phải ---------------------------------
  b.ladder({
    toY: 716, step: [8, 10], width: [9, 13], center: [10, 19],
    mode: 'wall', side: 1, minAbsCenter: 7,
    types: [[PlatformType.STATIC, 5], [PlatformType.MOVING, 5]], tag: 'z3-conveyor',
  });

  // --- 6.2 Sàn nứt: đứng quá 1.5 giây là sập ------------------------------
  b.ladder({
    toY: 786, step: [8, 10], width: [8, 12], center: [10, 19],
    mode: 'wall', side: 1, minAbsCenter: 7,
    types: [[PlatformType.FALLING, 5], [PlatformType.STATIC, 3], [PlatformType.MOVING, 2]],
    tag: 'z3-crumble',
  });

  // --- 6.3 Trạm lò xo: bật vọt lên, đổi lại mất kiểm soát điểm rơi ---------
  b.free({ x: -19, y: 794, w: 9, h: 2, type: PlatformType.BOUNCY, tag: 'z3-spring' });
  b.free({ x: -19, y: 838, w: 9, h: 2, type: PlatformType.BOUNCY, tag: 'z3-spring' });

  // --- 6.4 Leo lên miệng Siêu Phễu ----------------------------------------
  b.ladder({
    toY: 855, step: [8, 10], width: [8, 12], center: [10, 19],
    mode: 'wall', side: 1, minAbsCenter: 7,
    types: [[PlatformType.STATIC, 5], [PlatformType.MOVING, 3], [PlatformType.FALLING, 2]],
    budget: HARD_COST, tag: 'z3-ascent',
  });

  // Bậc chờ cuối cùng trước Siêu Phễu — bục TĨNH, để người chơi được lấy đà
  // trên một mặt phẳng chắc chắn thay vì trên băng chuyền đang trôi.
  const a2 = { type: PlatformType.STATIC, w: 9, h: 2, x: 14, y: 867, tag: 'z3-ascent' };
  b.fitIntoReach(a2, SAFE_COST, 7, 1);
  b.box(a2);

  // --- 6.5 ☠☠ SIÊU PHỄU TỬ THẦN #2 @ Y880 ---------------------------------
  //     Dốc 39° (gắt hơn phễu #1 nhiều), khe hở chỉ rộng 8 đơn vị.
  //     Ngã ở đây = rơi thẳng 250 đơn vị về lại Hầm Băng Giá.
  //     Đặt ngay sát vạch đích — đúng chỗ tim người chơi đập nhanh nhất.
  b.funnel({ y: 880, gapHalf: 4, rise: 16, tag: 'funnel-2' });
  b.throat({ yFrom: 658, yTo: 879, halfWidth: 4.75, tag: 'funnel-2' });

  // --- 6.6 ĐƯỜNG SỐNG QUA SIÊU PHỄU ---------------------------------------
  //  Cùng công thức ba bậc như Phễu #1 (xem chú thích ở phần [4]), nhưng khe
  //  hẹp hơn và dốc gắt hơn nên dung sai mỏng hơn hẳn.
  b.box({ x: 12, y: 878, w: 6, h: 2, tag: 'funnel-2-cave' });
  b.box({ x: 7, y: 890, w: 5, h: 2, tag: 'funnel-2-lip' });
  b.box({ x: 7, y: 900, w: 7, h: 2, tag: 'funnel-2-lip' });

  // --- 6.7 Chặng cuối: tổng hợp mọi thứ đã học ----------------------------
  b.ladder({
    toY: 944, step: [8, 10], width: [7, 11], center: [8, 16],
    types: [[PlatformType.MOVING, 4], [PlatformType.FALLING, 3], [PlatformType.STATIC, 3]],
    budget: HARD_COST, tag: 'z3-final',
  });
  b.ladder({
    toY: 994, step: [8, 10.5], width: [8, 12], center: [8, 15],
    types: [[PlatformType.STATIC, 6], [PlatformType.MOVING, 4]], tag: 'z3-crown',
  });
}

// ============================================================================
// [7] ĐỈNH THÁP (Y 1000 → 1050) — CỖ MÁY THỜI GIAN
// ----------------------------------------------------------------------------
//  Vùng đất bình yên. Ba bậc thang vàng cuối cùng rồi tới bệ đích.
// ============================================================================
function buildSummit(b) {
  b.box({ x: -12, y: 1006, w: 13, h: 2.5, tag: 'summit' });
  b.box({ x: 6, y: 1017, w: 12, h: 2.5, tag: 'summit' });
  b.box({ x: -5, y: 1028, w: 12, h: 2.5, tag: 'summit' });
  b.box({ x: 8, y: 1038, w: 11, h: 2.5, tag: 'summit' });

  // Bệ đích: mặt trên nằm đúng mốc Y = 1050 (WORLD.GOAL_Y).
  // Rộng rãi — người chơi xứng đáng được thở sau cả nghìn đơn vị leo trèo.
  b.box({ x: 0, y: 1048, w: 26, h: 4, type: PlatformType.GOAL, tag: 'goal' });
}

// ============================================================================
// [8] buildLevelData() — ghép toàn bộ toà tháp
// ============================================================================
function build(seed) {
  const b = new TowerBuilder(seed);
  buildForest(b);
  buildIce(b);
  buildCore(b);
  buildSummit(b);
  return b;
}

/** Danh sách dữ liệu thô của MỌI bục trong tháp. */
export function buildLevelData(seed = SEED) {
  return build(seed).defs;
}

// ============================================================================
// [9] validateLevel() — LƯỚI AN TOÀN CHO NGƯỜI THIẾT KẾ MAP
// ----------------------------------------------------------------------------
//  Duyệt mạch leo chính và cảnh báo mọi bước nhảy vượt quá tầm với.
//  Chạy tự động ở chế độ dev (npm run dev), im lặng ở bản build.
// ============================================================================
export function validateLevel(seed = SEED) {
  const b = build(seed);
  const chain = b.chain;
  const issues = [...checkFunnels(b.defs)];
  let hardest = { cost: 0, from: null, to: null };

  for (let i = 1; i < chain.length; i++) {
    const from = chain[i - 1];
    const to = chain[i];
    if (to.type === PlatformType.BOUNCY) continue;   // lò xo không phải bậc đứng

    let cost = reachCost(from, to);
    if (to.move) cost += to.move.range;              // băng chuyền có thể trôi ra xa

    if (cost > hardest.cost) hardest = { cost, from, to };
    // So với sức nhảy THẬT của người chơi, không phải với thước vẽ map.
    if (cost > MAX_COST) {
      issues.push({
        level: 'error',
        message: `Buoc nhay BAT KHA THI: Y${from.y.toFixed(1)} -> Y${to.y.toFixed(1)} `
          + `(cost ${cost.toFixed(2)} > max ${MAX_COST.toFixed(2)})`,
      });
    } else if (cost > HARD_COST) {
      issues.push({
        level: 'warn',
        message: `Buoc nhay SAT NGUONG: Y${from.y.toFixed(1)} -> Y${to.y.toFixed(1)} `
          + `(cost ${cost.toFixed(2)} / max ${MAX_COST.toFixed(2)})`,
      });
    }
  }

  return { total: chain.length, issues, hardest, maxCost: MAX_COST };
}

// ============================================================================
//  KIỂM TRA HÌNH HỌC PHỄU TỬ THẦN
// ----------------------------------------------------------------------------
//  Hai lỗi rất dễ mắc khi chỉnh map mà mắt thường không thấy:
//    (1) Đặt một bục CHẮN NGANG khe hở → không ai rơi lọt được nữa, cái bẫy
//        đắt giá nhất của game trở thành vô dụng.
//    (2) Đặt một bục THÒ VÀO ĐƯỜNG TRƯỢT trên mặt dốc → người chơi đang trượt
//        bị chặn đứng giữa dốc, đứng chôn chân ở đó mãi mãi.
//  Hàm này mô phỏng hình học để bắt cả hai lỗi trước khi bạn kịp mở game.
// ============================================================================
function checkFunnels(defs) {
  const issues = [];
  const slopes = defs.filter((d) => d.type === PlatformType.SLOPE);
  const boxes = defs.filter((d) => d.type !== PlatformType.SLOPE);
  const H = PLAYER.HEIGHT;

  // --- (1) Khe hở còn lọt người không? -------------------------------------
  const tags = [...new Set(slopes.map((s) => s.tag))];
  for (const tag of tags) {
    const pair = slopes.filter((s) => s.tag === tag);
    if (pair.length < 2) continue;
    // Khe hở nằm giữa hai mép trong của hai mặt dốc.
    const gapL = Math.max(...pair.map((s) => (s.x2 < 0 ? s.x2 : -Infinity)));
    const gapR = Math.min(...pair.map((s) => (s.x1 > 0 ? s.x1 : Infinity)));
    if (!isFinite(gapL) || !isFinite(gapR)) continue;
    const gapY = Math.min(...pair.map((s) => Math.min(s.y1, s.y2)));
    // Chỉ những bục nằm trong "miệng phễu" (từ khe lên tới mép ngoài cao nhất)
    // mới thực sự bịt đường rơi; cao hơn nữa thì người chơi vẫn né được.
    const mouthTop = Math.max(...pair.map((s) => Math.max(s.y1, s.y2))) + 8;

    // Quét từng vị trí đứng có thể có trong khe, xem có lối rơi lọt nào không.
    let widest = 0; let run = 0;
    for (let x = gapL + PHW; x <= gapR - PHW; x += 0.1) {
      const blocked = boxes.some((d) => {
        const bTop = d.y + d.h / 2;
        if (bTop < gapY - 2 || bTop > mouthTop) return false;    // ngoài vùng miệng phễu
        return x + PHW > d.x - d.w / 2 && x - PHW < d.x + d.w / 2;
      });
      run = blocked ? 0 : run + 0.1;
      if (run > widest) widest = run;
    }
    if (widest < 0.5) {
      issues.push({ level: 'error', message: `Phe "${tag}": khe ho bi CHAN HOAN TOAN - cai bay vo dung` });
    } else if (widest < 2) {
      issues.push({ level: 'warn', message: `Phe "${tag}": loi roi chi con rong ${widest.toFixed(1)} don vi` });
    }
  }

  // --- (2) Có bục nào thò vào đường trượt trên mặt dốc không? --------------
  for (const s of slopes) {
    const m = (s.y2 - s.y1) / (s.x2 - s.x1);
    for (const d of boxes) {
      const bl = d.x - d.w / 2; const br = d.x + d.w / 2;
      const bTop = d.y + d.h / 2; const bBot = d.y - d.h / 2;
      // Nới rộng vùng quét thêm nửa bề ngang nhân vật ở hai đầu: cú chặn hay
      // xảy ra nhất là khi người trượt đâm vào MẶT BÊN của bục, tại vị trí
      // nằm ngay ngoài rìa bục chứ không phải bên trong nó.
      const from = Math.max(s.x1, bl - PHW); const to = Math.min(s.x2, br + PHW);
      if (from >= to) continue;

      for (let x = from; x <= to; x += 0.5) {
        const surf = s.y1 + (x - s.x1) * m;
        // Thân người đang trượt chiếm khoảng [surf, surf + H].
        if (bBot < surf + H && bTop > surf + 0.05) {
          issues.push({
            level: 'error',
            message: `Buc tai (x=${d.x.toFixed(1)}, y=${d.y.toFixed(1)}) CHAN DUONG TRUOT `
              + `cua mat doc "${s.tag}" tai x=${x.toFixed(1)}`,
          });
          break;
        }
      }
    }
  }

  return issues;
}
