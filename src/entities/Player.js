/**
 * ============================================================================
 *  Player.js — Chú robot đồng hồ: trạng thái và TOÀN BỘ BỘ KỸ NĂNG
 * ============================================================================
 *  File này KHÔNG vẽ gì cả (việc đó là của PlayerView.js) và KHÔNG tự giải
 *  va chạm (việc đó là của Physics.js). Nó chỉ trả lời một câu hỏi:
 *  "người chơi vừa bấm gì, và điều đó biến thành vận tốc nào?"
 *
 *  MỤC LỤC
 *    [1] TRẠNG THÁI — mọi thứ mô tả chú robot tại một thời điểm
 *    [2] NGẮM BẮN   — chuyển vị trí chuột thành hướng nhảy (có chặn góc)
 *    [3] handleInput() — chạy MỘT lần mỗi frame: gồng lực, nhảy, dash, phanh
 *    [4] preStep()     — chạy mỗi BƯỚC VẬT LÝ: hồi chiêu, đếm giờ lướt
 *    [5] postStep()    — phản ứng sau va chạm: hồi phanh gấp khi chạm đất
 *    [6] GOD MODE      — bay tự do khảo sát địa hình
 *    [7] reset()       — về chân tháp
 *
 *  CHỈNH Ở ĐÂU?
 *    • Lực nhảy, thời gian gồng, góc ngắm tối thiểu → core/Config.js phần [2]
 *    • Dash / Phanh gấp / God mode                  → core/Config.js phần [3]
 * ============================================================================
 */

import { WORLD, PLAYER, SKILLS } from '../core/Config.js';

const DEG = Math.PI / 180;

export class Player {
  // ==========================================================================
  // [1] TRẠNG THÁI
  // ==========================================================================
  constructor() {
    this.reset();
  }

  reset() {
    // --- Vị trí & vận tốc ---------------------------------------------------
    this.x = WORLD.SPAWN.x;
    this.y = WORLD.SPAWN.y;
    this.vx = 0;
    this.vy = 0;

    // --- Tiếp xúc mặt đất (Physics.js ghi vào) ------------------------------
    this.grounded = true;
    this.groundPlatform = null;
    this.onSlope = null;

    // --- Gồng lực nhảy ------------------------------------------------------
    this.charging = false;
    this.chargeTime = 0;    // đồng hồ dao động của thanh lực
    this.power = 0;         // 0 → 1, giá trị hiển thị trên thanh lực

    // --- Kỹ năng ------------------------------------------------------------
    this.dashTimer = 0;         // > 0 nghĩa là đang trong pha lướt (tắt trọng lực)
    this.dashCooldown = 0;      // > 0 nghĩa là chưa dùng lại được phím E
    this.hasAirBrake = true;    // phanh gấp còn dùng được trong cú nhảy này không
    this.godMode = false;

    // --- Hướng ngắm ---------------------------------------------------------
    this.aim = { x: 0.707, y: 0.707 };      // hướng nhảy đã chặn góc
    this.aimRaw = { x: 0.707, y: 0.707 };   // hướng chuột thật, dùng cho dash 360°
    this.facing = 1;                        // 1 nhìn phải, -1 nhìn trái

    // --- Thống kê phục vụ hiệu ứng & HUD ------------------------------------
    this.airTime = 0;
    this.maxHeight = this.y;
    this.hasJumpedOnce = false;   // đồng hồ speedrun bắt đầu từ cú nhảy đầu tiên
    this.justJumped = false;      // cờ một-frame cho âm thanh/hạt
    this.justDashed = false;
    this.justBraked = false;
  }

  // ==========================================================================
  // [2] NGẮM BẮN
  // ----------------------------------------------------------------------------
  //  Hướng nhảy bị chặn để không thể nhảy chúi xuống đất (thành phần dọc luôn
  //  ≥ sin(MIN_AIM_DEG)). Riêng DASH thì tự do 360° — đó là lý do tồn tại của nó.
  // ==========================================================================
  setAim(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    this.aimRaw.x = nx;
    this.aimRaw.y = ny;

    const minY = Math.sin(PLAYER.MIN_AIM_DEG * DEG);
    if (ny < minY) {
      const sign = nx >= 0 ? 1 : -1;
      this.aim.y = minY;
      this.aim.x = sign * Math.sqrt(Math.max(0, 1 - minY * minY));
    } else {
      this.aim.x = nx;
      this.aim.y = ny;
    }
    if (Math.abs(nx) > 0.08) this.facing = nx >= 0 ? 1 : -1;
  }

  /** Góc ngắm tính bằng radian — PlayerView dùng để xoay mũi tên định hướng. */
  get aimAngle() { return Math.atan2(this.aim.y, this.aim.x); }

  // ==========================================================================
  // [3] handleInput() — chạy MỘT lần mỗi frame render
  // ----------------------------------------------------------------------------
  //  Đặt ở đây (chứ không ở bước vật lý) vì các phím bấm-một-lần chỉ đúng
  //  một lần mỗi frame; xử lý trong vòng lặp vật lý sẽ kích hoạt nhiều lần.
  // ==========================================================================
  handleInput(input, dt) {
    this.justJumped = false;
    this.justDashed = false;
    this.justBraked = false;

    // --- 3.1 Bật/tắt God Mode ----------------------------------------------
    if (input.wasPressed('GOD_MODE')) {
      this.godMode = !this.godMode;
      this.vx = 0; this.vy = 0;
      this.charging = false;
      this.power = 0;
    }
    if (this.godMode) { this.updateGodMode(input, dt); return; }

    // --- 3.2 GỒNG LỰC: giữ Space, thanh lực dao động tăng giảm liên tục ----
    if (this.grounded && input.isDown('CHARGE')) {
      if (!this.charging) { this.charging = true; this.chargeTime = 0; }
      this.charging = true;
      this.chargeTime += dt;
      this.vx = 0;                       // đứng yên tại chỗ khi đang lấy đà

      // Dao động tam giác: 0 → 1 → 0 → 1 … mỗi chiều mất CHARGE_TIME giây.
      const cycle = (this.chargeTime % (PLAYER.CHARGE_TIME * 2)) / PLAYER.CHARGE_TIME;
      this.power = cycle <= 1 ? cycle : 2 - cycle;
    }

    // --- 3.3 NHẢY: nhả Space là phóng theo hướng ngắm ----------------------
    if (this.charging && !input.isDown('CHARGE')) {
      this.performJump();
    }

    // --- 3.4 ĐI BỘ: chỉ khi đang đứng và KHÔNG gồng lực -------------------
    if (this.grounded && !this.charging) {
      const ax = input.axisX;
      if (ax !== 0) {
        const target = ax * PLAYER.WALK_SPEED;
        const d = target - this.vx;
        this.vx += Math.sign(d) * Math.min(Math.abs(d), PLAYER.WALK_ACCEL * dt);
        this.facing = ax;
      }
    }

    // --- 3.5 LƯỚT KHÔNG GIAN (E) — phóng vút đi như một viên đạn ----------
    if (input.wasPressed('DASH') && this.dashCooldown <= 0) {
      const D = SKILLS.DASH;
      this.vx = this.aimRaw.x * D.SPEED;   // dash dùng hướng chuột THẬT, 360°
      this.vy = this.aimRaw.y * D.SPEED;
      this.dashTimer = D.DURATION;
      this.dashCooldown = D.COOLDOWN;
      this.grounded = false;
      this.charging = false;
      this.power = 0;
      this.justDashed = true;
      this.hasJumpedOnce = true;
    }

    // --- 3.6 ĐÁP KHẨN CẤP (Q) — triệt tiêu quán tính, rơi thẳng đứng ------
    if (input.wasPressed('AIR_BRAKE') && !this.grounded && this.hasAirBrake) {
      this.vx = 0;
      this.vy = SKILLS.AIR_BRAKE.DROP_SPEED;
      this.dashTimer = 0;
      this.hasAirBrake = false;
      this.justBraked = true;
    }
  }

  /** Thực hiện cú nhảy với lực đang có trên thanh lực. */
  performJump() {
    const v = PLAYER.MIN_JUMP_SPEED + this.power * (PLAYER.MAX_JUMP_SPEED - PLAYER.MIN_JUMP_SPEED);
    this.vx = this.aim.x * v;
    this.vy = this.aim.y * v;
    this.charging = false;
    this.grounded = false;
    this.groundPlatform = null;
    this.hasAirBrake = true;      // mỗi cú nhảy được một lần phanh gấp
    this.justJumped = true;
    this.jumpPower = this.power;  // lưu lại để chọn cao độ tiếng "vút"
    this.power = 0;
    this.hasJumpedOnce = true;    // ⏱ đồng hồ speedrun bắt đầu từ đây
  }

  // ==========================================================================
  // [4] preStep() — chạy mỗi BƯỚC VẬT LÝ CỐ ĐỊNH
  // ==========================================================================
  preStep(dt) {
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        // Hết pha lướt: giữ lại một phần vận tốc rồi trả về cho trọng lực.
        this.dashTimer = 0;
        this.vx *= SKILLS.DASH.EXIT_SPEED_KEEP;
        this.vy *= SKILLS.DASH.EXIT_SPEED_KEEP;
      }
    }

    if (this.grounded) this.airTime = 0;
    else this.airTime += dt;
  }

  // ==========================================================================
  // [5] postStep() — phản ứng sau khi Physics đã giải va chạm
  // ==========================================================================
  postStep() {
    if (this.grounded && SKILLS.AIR_BRAKE.RESET_ON_GROUND) this.hasAirBrake = true;
    if (this.y > this.maxHeight) this.maxHeight = this.y;
  }

  // ==========================================================================
  // [6] GOD MODE — bay tự do, không trọng lực, không va chạm
  // ----------------------------------------------------------------------------
  //  Dành cho việc khảo sát địa hình và thử nghiệm thiết kế map.
  // ==========================================================================
  updateGodMode(input, dt) {
    const G = SKILLS.GOD_MODE;
    const speed = G.FLY_SPEED * (input.isDown('BOOST') ? G.BOOST_MULT : 1);
    this.vx = input.axisX * speed;
    this.vy = input.axisY * speed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Math.max(-WORLD.HALF_WIDTH, Math.min(WORLD.HALF_WIDTH, this.x));
    this.y = Math.max(0, this.y);
    this.grounded = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.hasAirBrake = true;
  }

  // ==========================================================================
  // [7] TIỆN ÍCH
  // ==========================================================================
  /** Tốc độ tổng hợp — dùng cho hiệu ứng dãn người và âm thanh gió. */
  get speed() { return Math.hypot(this.vx, this.vy); }

  /** Phần trăm hồi chiêu dash còn lại (1 = vừa dùng xong, 0 = sẵn sàng). */
  get dashCooldownRatio() {
    return this.dashCooldown / SKILLS.DASH.COOLDOWN;
  }
}
