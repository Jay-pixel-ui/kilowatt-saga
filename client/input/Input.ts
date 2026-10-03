/**
 * Keyboard + pointer-lock mouse input.
 *
 * Control scheme (swing prototype):
 *   WASD        move / steer swing
 *   SPACE       jump
 *   HOLD LMB    fire grapple (attach) … release LMB to let go
 *   Q / E       reel in / out while swinging
 *   mouse       look (click canvas once to lock pointer)
 */
export class Input {
  forward = 0; // -1..1
  strafe = 0; // -1..1
  jumpPressed = false; // consumed per-read
  grappleHeld = false;
  grappleJustPressed = false; // consumed per-read
  grappleJustReleased = false; // consumed per-read
  reel = 0; // -1 in, +1 out
  lookDX = 0; // consumed per-frame
  lookDY = 0;
  pointerLocked = false;

  private keys = new Set<string>();

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("click", () => {
      if (!this.pointerLocked) canvas.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
  }

  /** Read + clear one-shot flags. Call once per frame. */
  consumeFrame(): { jump: boolean; fired: boolean; released: boolean; dx: number; dy: number } {
    const out = {
      jump: this.jumpPressed,
      fired: this.grappleJustPressed,
      released: this.grappleJustReleased,
      dx: this.lookDX,
      dy: this.lookDY
    };
    this.jumpPressed = false;
    this.grappleJustPressed = false;
    this.grappleJustReleased = false;
    this.lookDX = 0;
    this.lookDY = 0;
    return out;
  }

  private refreshAxes(): void {
    const k = this.keys;
    this.forward = (k.has("KeyW") ? 1 : 0) + (k.has("KeyS") ? -1 : 0);
    this.strafe = (k.has("KeyD") ? 1 : 0) + (k.has("KeyA") ? -1 : 0);
    this.reel = (k.has("KeyQ") ? -1 : 0) + (k.has("KeyE") ? 1 : 0);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === "Space") this.jumpPressed = true;
    this.refreshAxes();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.refreshAxes();
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0 && this.pointerLocked) {
      this.grappleHeld = true;
      this.grappleJustPressed = true;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0 && this.grappleHeld) {
      this.grappleHeld = false;
      this.grappleJustReleased = true;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.lookDX += e.movementX;
    this.lookDY += e.movementY;
  };
}
