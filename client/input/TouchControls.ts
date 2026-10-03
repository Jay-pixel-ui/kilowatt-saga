/**
 * Touch controls for phones/tablets (pointer: coarse):
 *  - left thumb: virtual joystick → move / steer swing
 *  - right side drag: camera look
 *  - GRAPPLE button: hold to swing, release to let go (same semantics as LMB)
 *  - JUMP button
 * All elements are created here so index.html stays desktop-clean.
 */
export class TouchControls {
  /** Camera-relative movement intent, -1..1 (same contract as keyboard). */
  forward = 0;
  strafe = 0;
  reel = 0; // future: pinch to reel

  private dx = 0;
  private dy = 0;
  private jump = false;
  private fired = false;
  private released = false;

  private joyId: number | null = null;
  private lookId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private lastLook = { x: 0, y: 0 };
  private nub: HTMLDivElement;

  constructor() {
    const mk = (styles: Partial<CSSStyleDeclaration>): HTMLDivElement => {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position: "fixed",
        userSelect: "none",
        touchAction: "none",
        zIndex: "40",
        ...styles
      } as CSSStyleDeclaration);
      document.body.appendChild(el);
      return el;
    };

    // Joystick base + nub (left-bottom).
    const base = mk({
      left: "26px",
      bottom: "26px",
      width: "124px",
      height: "124px",
      borderRadius: "50%",
      background: "#00000022",
      border: "2px solid #00000033"
    });
    this.nub = mk({
      left: "70px",
      bottom: "70px",
      width: "52px",
      height: "52px",
      borderRadius: "50%",
      background: "#ffffff88",
      border: "2px solid #00000044",
      pointerEvents: "none"
    });

    // Buttons (right-bottom).
    const btn = (label: string, right: string, bottom: string, size: string): HTMLDivElement => {
      const b = mk({
        right,
        bottom,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#ffffff66",
        border: "2px solid #00000044",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "13px",
        fontWeight: "700",
        color: "#1d2733",
        letterSpacing: "0.05em"
      });
      b.textContent = label;
      return b;
    };
    const grappleBtn = btn("GRAPPLE", "24px", "92px", "92px");
    const jumpBtn = btn("JUMP", "132px", "34px", "68px");

    grappleBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.fired = true;
    });
    grappleBtn.addEventListener("pointerup", () => (this.released = true));
    grappleBtn.addEventListener("pointercancel", () => (this.released = true));
    jumpBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.jump = true;
    });

    base.addEventListener("pointerdown", (e) => {
      this.joyId = e.pointerId;
      const r = base.getBoundingClientRect();
      this.joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.moveJoy(e.clientX, e.clientY);
    });

    window.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.joyId) this.moveJoy(e.clientX, e.clientY);
      else if (e.pointerId === this.lookId) {
        this.dx += e.clientX - this.lastLook.x;
        this.dy += e.clientY - this.lastLook.y;
        this.lastLook = { x: e.clientX, y: e.clientY };
      }
    });
    window.addEventListener("pointerup", (e) => this.endPointer(e.pointerId));
    window.addEventListener("pointercancel", (e) => this.endPointer(e.pointerId));

    // Look: any touch on the right 55% of the screen that isn't a button.
    window.addEventListener("pointerdown", (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "CANVAS" && e.clientX > window.innerWidth * 0.45) {
        this.lookId = e.pointerId;
        this.lastLook = { x: e.clientX, y: e.clientY };
      }
    });
  }

  private moveJoy(cx: number, cy: number): void {
    const dx = cx - this.joyCenter.x;
    const dy = cy - this.joyCenter.y;
    const len = Math.hypot(dx, dy);
    const max = 46;
    const k = len > max ? max / len : 1;
    this.strafe = (dx * k) / max;
    this.forward = (-dy * k) / max;
    this.nub.style.left = `${this.joyCenter.x + dx * k - 26}px`;
    this.nub.style.top = `${this.joyCenter.y + dy * k - 26}px`;
    this.nub.style.bottom = "auto";
  }

  private endPointer(id: number): void {
    if (id === this.joyId) {
      this.joyId = null;
      this.forward = 0;
      this.strafe = 0;
      this.nub.style.left = "70px";
      this.nub.style.top = "auto";
      this.nub.style.bottom = "70px";
    }
    if (id === this.lookId) this.lookId = null;
  }

  /** Read + clear one-shot values. Same shape as Input.consumeFrame(). */
  consumeFrame(): { jump: boolean; fired: boolean; released: boolean; dx: number; dy: number } {
    const out = {
      jump: this.jump,
      fired: this.fired,
      released: this.released,
      dx: this.dx * 2.2, // touch look needs more gain than mouse
      dy: this.dy * 2.2
    };
    this.jump = false;
    this.fired = false;
    this.released = false;
    this.dx = 0;
    this.dy = 0;
    return out;
  }
}
