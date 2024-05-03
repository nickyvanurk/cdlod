type Callback = (delta: number, time: number) => void;

/**
 * Main loop class (RequestAnimationFrame).
 */
export class Raf {
  private static raf: number;
  private static paused = true;
  private static lastTime = 0.0;

  private static readonly callbacks: Callback[] = [];

  /**
   * Add a callback that is executed every frame.
   * @param callback
   */
  static add(callback: Callback): void {
    const index = this.callbacks.indexOf(callback);
    index === -1 && this.callbacks.push(callback);
  }

  /**
   * Remove a previously added callback.
   * @param callback
   */
  static remove(callback: Callback): void {
    const index = this.callbacks.indexOf(callback);
    index !== -1 && this.callbacks.splice(index, 1);
  }

  /**
   * Cancel the animation frame and dispose the callbacks.
   */
  static dispose(): void {
    cancelAnimationFrame(this.raf);
    this.callbacks.length = 0;
    this.paused = true;
  }

  /**
   * Set pause to true or false, cancels or requests and animation frame respectively.
   */
  static set pause(paused: boolean) {
    if (Raf.paused !== paused) {
      Raf.paused = paused;
      paused ? cancelAnimationFrame(Raf.raf) : (Raf.raf = requestAnimationFrame(Raf.update.bind(this)));
    }
  }

  private static update(time: number): void {
    this.raf = requestAnimationFrame(this.update.bind(this));
    let delta = time - (this.lastTime || 0.0);

    if (delta > 250) {
      delta = 250;
    }

    for (let c = this.callbacks.length; c--; ) {
      this.callbacks[c](delta * 0.001, time);
    }

    this.lastTime = time;
  }
}
