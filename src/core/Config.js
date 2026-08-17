/**
 * ============================================================================
 *  Config.js — TOÀN BỘ SỐ LIỆU CÂN BẰNG CỦA GAME NẰM Ở ĐÂY
 * ============================================================================
 *  Đây là file bạn sẽ mở nhiều nhất khi muốn "game dễ hơn / khó hơn / đã tay hơn".
 *  Không có con số gameplay nào được phép hard-code ở nơi khác.
 *
 *  MỤC LỤC
 *    [1] WORLD      — kích thước tháp, mốc độ cao, điểm hồi sinh
 *    [2] PLAYER     — kích thước, trọng lực, lực nhảy, gồng lực
 *    [3] SKILLS     — Dash (E), Air Brake (Q), God Mode (G)
 *    [4] COLLISION  — ma sát, dội tường, va trần, bục nảy, bục rơi
 *    [5] CAMERA     — góc nhìn 2.5D, bám nhân vật, rung màn hình
 *    [6] ZONES      — 3 vùng sinh thái + bảng màu từng vùng
 *    [7] FX         — hạt, parallax, âm lượng
 *    [8] KEYS       — bảng ánh xạ phím
 *
 *  ĐƠN VỊ
 *    • Khoảng cách: "đơn vị thế giới" (nhân vật cao 3.2 đơn vị)
 *    • Vận tốc: đơn vị/giây · Gia tốc: đơn vị/giây²  · Thời gian: giây
 * ============================================================================
 */

// ============================================================================
// [1] WORLD — Kích thước và các mốc độ cao của toà tháp
// ============================================================================
export const WORLD = {
  /** Nửa chiều rộng lòng tháp. Nhân vật chạy trong khoảng x ∈ [-34, 34]. */
  HALF_WIDTH: 34,

  /** Độ dày tường biên hai bên (chỉ để vẽ, va chạm dùng HALF_WIDTH). */
  WALL_THICKNESS: 6,

  /** Chân tháp — nơi nhân vật hồi sinh khi bấm R. */
  SPAWN: { x: -22, y: 6 },

  /** Độ cao của Cỗ Máy Thời Gian. Chạm tới đây là thắng. */
  GOAL_Y: 1050,

  /** Đáy tuyệt đối: rơi xuống dưới mốc này sẽ bị chặn lại bởi nền tháp. */
  FLOOR_Y: 0,

  /** Trọng lực (đã mang dấu âm, tức kéo xuống). */
  GRAVITY: -120,

  /** Tốc độ rơi tối đa — chặn lại để không xuyên qua bục khi rơi từ rất cao. */
  MAX_FALL_SPEED: -135,

  /** Bước tích phân vật lý cố định. Cho vật lý ổn định 100% bất kể FPS máy. */
  FIXED_STEP: 1 / 120,
};

// ============================================================================
// [2] PLAYER — Nhân vật và cơ chế nhảy cốt lõi
// ============================================================================
export const PLAYER = {
  WIDTH: 2.8,   // bề ngang hộp va chạm
  HEIGHT: 3.2,  // chiều cao hộp va chạm

  /** Tốc độ đi bộ trên mặt đất (A/D hoặc ←/→) — chỉ để căn chỉnh chỗ đứng. */
  WALK_SPEED: 13,

  /** Gia tốc đi bộ — càng cao càng "dính" tay. */
  WALK_ACCEL: 90,

  // --- Gồng lực nhảy (giữ Space) -------------------------------------------
  /** Lực nhảy khi nhả phím ngay lập tức (power = 0). */
  MIN_JUMP_SPEED: 18,

  /**
   * Lực nhảy khi thanh lực đầy (power = 1).
   * Nhảy thẳng đứng full lực đạt độ cao = 55² / (2·120) ≈ 12.6 đơn vị (~4 lần chiều cao robot).
   */
  MAX_JUMP_SPEED: 55,

  /** Thời gian để thanh lực chạy từ 0 lên 1. Sau đó tự dao động ngược về 0 rồi lặp lại. */
  CHARGE_TIME: 0.85,

  /**
   * Góc ngắm bị chặn để không nhảy chúi xuống đất.
   * Thành phần dọc của hướng nhảy luôn ≥ sin(MIN_AIM_DEG).
   */
  MIN_AIM_DEG: 12,

  /** Nhân vật KHÔNG có điều khiển trên không (đúng tinh thần Jump King). */
  AIR_CONTROL: 0,

  // --- Squash & Stretch (co giãn thân) -------------------------------------
  /** Bị bẹp xuống bao nhiêu khi gồng đầy lực (1 = không bẹp). */
  SQUASH_AT_FULL_CHARGE: 0.62,
  /** Dãn dài tối đa khi bay với tốc độ cao. */
  STRETCH_MAX: 1.35,
  /** Tốc độ nội suy co giãn về trạng thái mục tiêu (càng cao càng giật). */
  SQUASH_LERP: 14,
};

// ============================================================================
// [3] SKILLS — Bộ kỹ năng bổ trợ
// ============================================================================
export const SKILLS = {
  /** LƯỚT KHÔNG GIAN — phím E */
  DASH: {
    SPEED: 66,          // vận tốc tức thời khi lướt
    DURATION: 0.16,     // trong khoảng này trọng lực bị tắt → bay thẳng như viên đạn
    COOLDOWN: 3.0,      // hồi chiêu (giây) — theo đúng thiết kế
    EXIT_SPEED_KEEP: 0.7, // giữ lại bao nhiêu % vận tốc khi hết thời gian lướt
    TRAIL_RATE: 90,     // số hạt vệt sáng xanh sinh ra mỗi giây
  },

  /** ĐÁP KHẨN CẤP / PHANH GẤP — phím Q */
  AIR_BRAKE: {
    /** Vận tốc dọc ngay sau khi phanh (âm nhẹ để bắt đầu rơi thẳng, không lơ lửng). */
    DROP_SPEED: -6,
    /** Chỉ dùng được 1 lần mỗi cú nhảy; true = tự hồi khi chạm đất. */
    RESET_ON_GROUND: true,
  },

  /** CHẾ ĐỘ SÁNG TẠO — phím G */
  GOD_MODE: {
    FLY_SPEED: 90,      // tốc độ bay tự do
    BOOST_MULT: 2.6,    // giữ Shift để bay nhanh hơn
  },
};

// ============================================================================
// [4] COLLISION — Ma sát mặt bục, dội tường, va trần, hành vi bục đặc biệt
// ============================================================================
export const COLLISION = {
  /**
   * Hệ số tắt dần vận tốc ngang trên mặt đất, theo dạng vx *= e^(-k·dt).
   * Càng lớn càng "dừng phắt".
   */
  FRICTION_STATIC: 12,
  FRICTION_ICE: 1.1,     // băng: gần như trượt tự do
  FRICTION_SLOPE: 0.7,   // mặt dốc: gần như không hãm → trượt tuột

  /** Tắt dần vận tốc ngang khi đang ở trên không (rất nhẹ, chỉ để không bay mãi). */
  AIR_DRAG: 0.15,

  // --- Dội tường (Wall Bounce) ---------------------------------------------
  /** Phần lực ngang được trả ngược lại khi đập vào tường thẳng đứng. */
  WALL_BOUNCE: 0.55,
  /** Phần lực dọc giữ lại sau khi dội. */
  WALL_BOUNCE_VY_KEEP: 0.92,
  /** Dưới tốc độ này thì coi như chạm nhẹ, dính tường và rơi thẳng (không dội). */
  WALL_BOUNCE_MIN_SPEED: 11,

  // --- Va trần --------------------------------------------------------------
  /** Cộc đầu: giữ lại bao nhiêu vận tốc dọc (đổi dấu thành đi xuống). */
  CEILING_BOUNCE: 0.15,

  // --- Bục nảy (Bouncy) -----------------------------------------------------
  BOUNCY: {
    FACTOR: 1.18,    // nhân với tốc độ rơi vào
    MIN_SPEED: 46,   // nảy tối thiểu kể cả khi rơi vào rất nhẹ
    MAX_SPEED: 105,  // trần nảy, tránh bắn lên vô lý
  },

  // --- Bục rơi (Falling) ----------------------------------------------------
  FALLING: {
    DELAY: 1.5,       // đứng lên bao lâu thì sập (giây) — theo đúng thiết kế
    SHAKE_AMP: 0.32,  // biên độ rung cảnh báo
    SHAKE_FREQ: 34,   // tần số rung
    GRAVITY: -55,     // tốc độ rơi của chính miếng bục sau khi sập
    RESPAWN: 4.0,     // bao lâu thì mọc lại
  },

  // --- Băng chuyền (Moving) -------------------------------------------------
  MOVING: {
    /** Nhân vật đứng trên có bị kéo theo 100% không (1 = dính hoàn toàn). */
    CARRY_FACTOR: 1.0,
  },

  /** Sai số chống kẹt khi giải va chạm. */
  SKIN: 0.001,
};

// ============================================================================
// [5] CAMERA — Góc nhìn 2.5D
// ============================================================================
export const CAMERA = {
  /** Bề ngang thế giới luôn nhìn thấy được (đơn vị). Quyết định độ "zoom". */
  VIEW_WIDTH: 78,
  /** Chiều cao khung nhìn tối thiểu, tránh màn hình siêu rộng làm tháp bé tí. */
  MIN_VIEW_HEIGHT: 40,

  /** Camera đặt lùi ra sau và chúi xuống một chút → tạo cảm giác 2.5D. */
  DISTANCE: 120,
  TILT_DEG: -13,

  /** Độ trễ bám theo nhân vật (càng nhỏ càng mượt/chậm). */
  FOLLOW_LERP_Y: 6.5,
  FOLLOW_LERP_X: 4.0,

  /** Camera nhìn cao hơn nhân vật một chút để thấy đường leo phía trên. */
  LOOK_AHEAD_Y: 5,

  /** Rung màn hình khi va đập mạnh. */
  SHAKE_DECAY: 7,
  SHAKE_MAX: 1.6,
};

// ============================================================================
// [6] ZONES — 3 vùng sinh thái phân tầng theo độ cao + bảng màu
// ============================================================================
export const ZONES = [
  {
    id: 'forest',
    name: 'RỪNG CƠ KHÍ',
    yMin: 0,
    yMax: 350,
    fog: '#101c14',
    sky: '#16281c',
    platform: '#4e7a3a',   // thân bục
    platformTop: '#8fce5f',// mặt trên bục (nơi tiếp đất)
    accent: '#c9f27a',
    ambient: 0.36,
  },
  {
    id: 'ice',
    name: 'HẦM BĂNG GIÁ',
    yMin: 350,
    yMax: 650,
    fog: '#0d1a2b',
    sky: '#132a44',
    platform: '#3f7096',
    platformTop: '#9fdcf5',
    accent: '#bff2ff',
    ambient: 0.44,
  },
  {
    id: 'core',
    name: 'LÕI THÁP ĐỒNG HỒ',
    yMin: 650,
    yMax: 1000,
    fog: '#2a1508',
    sky: '#3a1e0c',
    platform: '#8a5a2a',
    platformTop: '#e8a45c',
    accent: '#ffb457',
    ambient: 0.4,
  },
  {
    id: 'summit',
    name: 'ĐỈNH THÁP',
    yMin: 1000,
    yMax: 1200,
    fog: '#3b2f10',
    sky: '#54430f',
    platform: '#b8892f',
    platformTop: '#ffd85e',
    accent: '#fff3b0',
    ambient: 0.7,
  },
];

/** Màu riêng cho từng loại bục đặc biệt (đè lên màu vùng). */
export const PLATFORM_COLORS = {
  ice: { side: '#4f86ad', top: '#d6f4ff' },
  moving: { side: '#6b6f7a', top: '#b9c4d1' },
  bouncy: { side: '#7a2f5a', top: '#ff5fa2' },
  falling: { side: '#6d4526', top: '#c98a4b' },
  slope: { side: '#3d3f45', top: '#6f757f' },
  goal: { side: '#8a6a12', top: '#ffe066' },
};

// ============================================================================
// [7] FX — Hiệu ứng hình ảnh và âm thanh
// ============================================================================
export const FX = {
  /** Bụi bung ra khi tiếp đất — số hạt tỉ lệ với tốc độ rơi. */
  LAND_DUST_PER_SPEED: 0.28,
  LAND_DUST_MAX: 26,

  /** Tia lửa điện khi va đập mạnh vào tường / trần. */
  SPARK_PER_SPEED: 0.35,
  SPARK_MAX: 22,

  /** Tổng số hạt tối đa tồn tại cùng lúc (giới hạn hiệu năng). */
  MAX_PARTICLES: 700,

  /** Hậu cảnh bánh răng: [chiều sâu z, bán kính, tốc độ quay rad/s, hệ số parallax] */
  GEARS: [
    { z: -120, radius: 46, speed: 0.10, parallax: 0.10, teeth: 18 },
    { z: -90, radius: 30, speed: -0.17, parallax: 0.18, teeth: 14 },
    { z: -64, radius: 20, speed: 0.26, parallax: 0.28, teeth: 12 },
    { z: -45, radius: 12, speed: -0.40, parallax: 0.40, teeth: 10 },
  ],
  /** Bao nhiêu tầng bánh răng lặp lại theo chiều cao. */
  GEAR_ROWS: 5,
  GEAR_ROW_SPACING: 70,

  AUDIO: {
    MASTER: 0.5,
    CHARGE: 0.16,
    JUMP: 0.32,
    LAND: 0.4,
    WALL: 0.38,
    CEILING: 0.3,
    DASH: 0.3,
    BRAKE: 0.32,
    BOUNCE: 0.4,
    WIN: 0.45,
  },
};

// ============================================================================
// [8] KEYS — Bảng ánh xạ phím (đổi phím ở đây, không đổi trong Input.js)
// ============================================================================
export const KEYS = {
  CHARGE: ['Space'],
  DASH: ['KeyE'],
  AIR_BRAKE: ['KeyQ'],
  GOD_MODE: ['KeyG'],
  RESET: ['KeyR'],
  MUTE: ['KeyM'],
  LEFT: ['KeyA', 'ArrowLeft'],
  RIGHT: ['KeyD', 'ArrowRight'],
  UP: ['KeyW', 'ArrowUp'],
  DOWN: ['KeyS', 'ArrowDown'],
  BOOST: ['ShiftLeft', 'ShiftRight'],
};

/** Chế độ dev: bật cảnh báo kiểm tra map, log vật lý. Vite thay biến này lúc build. */
export const DEV = import.meta.env?.DEV ?? false;
