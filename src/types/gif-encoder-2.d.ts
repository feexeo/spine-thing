declare module "gif-encoder-2" {
  /**
   * A browser-compatible GIF encoder that supports transparency.
   */
  export default class GIFEncoder {
    /**
     * Creates an instance of GIFEncoder.
     * @param width The width of images in pixels.
     * @param height The height of images in pixels.
     * @param algorithm The algorithm to use. Accepts "neuquant" or "octree". Defaults to "neuquant".
     * @param useOptimizer Enables/disables the optimizer. Defaults to false.
     * @param totalFrames Total number of images. Defaults to 0.
     */
    constructor(
      width: number,
      height: number,
      algorithm?: "neuquant" | "octree",
      useOptimizer?: boolean,
      totalFrames?: number,
    );

    /**
     * Starts the encoder.
     */
    start(): void;

    /**
     * Adds a frame to the GIF using the provided CanvasRenderingContext2D.
     * @param ctx The canvas 2D rendering context for the frame.
     */
    addFrame(ctx: CanvasRenderingContext2D): void;

    /**
     * Sets the delay for each frame in milliseconds.
     * @param delay Number of milliseconds.
     */
    setDelay(delay: number): void;

    /**
     * Sets the frames per second.
     * @param fps The number of frames per second.
     */
    setFramesPerSecond(fps: number): void;

    /**
     * Sets the encoding quality.
     * @param quality A number from 1 (best quality, slowest) to 30.
     */
    setQuality(quality: number): void;

    /**
     * Sets the optimizer threshold percentage.
     * @param threshold A number between 0 and 100. If the current frame matches the previous frame, the color table is reused.
     */
    setThreshold(threshold: number): void;

    /**
     * Sets the number of loops the GIF will perform.
     * @param repeat 0 means infinite loop; any other number is the literal number of loops.
     */
    setRepeat(repeat: number): void;

    /**
     * Finishes the encoding process. Must be called after all frames are added.
     */
    finish(): void;

    /**
     * Enables transparency.Specify color if needed.
     */
    setTransparent(chromakey?: string): void;

    /**
     * The output data containing the encoded GIF.
     */
    readonly out: {
      /**
       * Returns the encoded GIF data as a Uint8Array.
       */
      getData(): Uint8Array;
    };
  }
}
