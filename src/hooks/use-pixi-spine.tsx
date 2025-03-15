import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { Handler, useGesture } from "@use-gesture/react";
import { ReactDOMAttributes } from "@use-gesture/react/dist/declarations/src/types";
import GIFEncoder from "gif-encoder-2";
import { ITrackEntry, SpineDebugRenderer, type Spine } from "pixi-spine";
import * as PIXI from "pixi.js";

type SpineWithDebug = Spine & { debug: SpineDebugRenderer | null };
type Dimensions = { width: number; height: number; x: number; y: number };
type Position = { x: number; y: number };
type ExportOptions = {
  height?: number;
  onExportPercentageUpdate?: (percentage: string) => void;
};
type VideoFormat = "webm" | "mp4";

const MAX_GIF_HEIGHT = 1000;
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const ANIMATION_SMOOTHING = 0.1;
const DEFAULT_SCALE_FACTOR = 0.8;
const ffmpeg = new FFmpeg();

export type UseSpine = {
  animationList: string[];
  playAnimation: (index: number) => void;
  setDefaultPositionAndScale: () => void;
  toggleDebugMode: () => void;
  resetAnimation: () => void;
  pauseAnimation: () => void;
  resumeAnimation: () => void;
  spineAnimation: Spine | null;
  position: PIXI.ObservablePoint<unknown> | undefined;
  scale: PIXI.ObservablePoint<unknown> | undefined;
  setCanvaState: React.Dispatch<React.SetStateAction<HTMLCanvasElement | null>>;
  bindGestures: (...args: unknown[]) => ReactDOMAttributes;
  takeScreenshot: (options?: ExportOptions) => Promise<void>;
  exportToVideo: (
    format: VideoFormat,
    options?: ExportOptions,
  ) => Promise<void>;
  exportToGif: (options?: ExportOptions) => void;
  isExporting: boolean;
};

/**
 * Get animation duration from track entry
 * Helper function to safely get duration from track entry
 */
const getAnimationDuration = (trackEntry: unknown): number => {
  const track = trackEntry as ITrackEntry & { animationStart: number };
  return track.animationEnd - track.animationStart;
};

/**
 * Custom hook for managing Spine animations with interactive controls and export capabilities
 *
 * @param spine - A Spine animation instance
 * @returns A set of functions and state for controlling and interacting with the animation
 */
const useSpine = (spine: Spine | null): UseSpine => {
  const [canvaState, setCanvaState] = useState<HTMLCanvasElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const spineAnimationRef = useRef<SpineWithDebug | null>(null);
  const originalDimensions = useRef<Dimensions>({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  });
  const debugModeRef = useRef(false);
  const dragTarget = useRef<PIXI.DisplayObject | null>(null);
  const animationStateRef = useRef({
    isPaused: false,
    currentAnimationName: "",
    currentAnimationIndex: 0,
  });
  const animationFrameId = useRef<number | undefined>(undefined);
  const targetPosition = useRef<Position>({ x: 0, y: 0 });
  const targetScaleRef = useRef<number>(1);

  const [animationList, setAnimationList] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Handles cleanup of resources and event listeners
   */
  const cleanup = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = undefined;
    }

    if (spineAnimationRef.current) {
      spineAnimationRef.current.destroy({ children: true });
      spineAnimationRef.current = null;
    }
  }, []);

  /**
   * Downloads a file with the given data and filename
   */
  const downloadFile = useCallback((data: string, filename: string) => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = data;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  /**
   * Calculates export dimensions maintaining aspect ratio
   */
  const calculateExportDimensions = useCallback(
    (originalWidth: number, originalHeight: number, targetHeight?: number) => {
      if (!targetHeight)
        return { width: originalWidth, height: originalHeight };

      const aspectRatio = originalWidth / originalHeight;
      const height = Math.min(targetHeight, MAX_GIF_HEIGHT);
      let width = Math.round(height * aspectRatio);

      if (originalWidth % 2 === 0 && width % 2 !== 0) {
        width = Math.abs(width - 1) < 2 ? width - 1 : width + 1;
      }

      return { width, height };
    },
    [],
  );

  /**
   * Sets default position and scale based on container size
   */
  const setDefaultPositionAndScale = useCallback(() => {
    const spine = spineAnimationRef.current;
    if (!spine || !canvaState?.parentElement) return;

    const { clientWidth, clientHeight } = canvaState.parentElement;
    const { width: spineWidth, height: spineHeight } =
      originalDimensions.current;

    targetPosition.current = {
      x: clientWidth / 2,
      y: clientHeight / 2,
    };

    targetScaleRef.current = Math.min(
      (clientWidth / spineWidth) * DEFAULT_SCALE_FACTOR,
      (clientHeight / spineHeight) * DEFAULT_SCALE_FACTOR,
    );

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    const animate = () => {
      const currentX = spine.position.x;
      const currentY = spine.position.y;
      const dx = targetPosition.current.x - currentX;
      const dy = targetPosition.current.y - currentY;

      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        spine.position.set(
          currentX + dx * ANIMATION_SMOOTHING,
          currentY + dy * ANIMATION_SMOOTHING,
        );
      } else {
        spine.position.set(targetPosition.current.x, targetPosition.current.y);
      }

      // Animate scale
      const currentScale = spine.scale.x;
      const ds = targetScaleRef.current - currentScale;
      if (Math.abs(ds) > 0.001) {
        spine.scale.set(currentScale + ds * ANIMATION_SMOOTHING);
      } else {
        spine.scale.set(targetScaleRef.current);
      }

      // Continue until both complete
      const positionDone = Math.abs(dx) <= 0.1 && Math.abs(dy) <= 0.1;
      const scaleDone = Math.abs(ds) <= 0.001;

      if (!positionDone || !scaleDone) {
        animationFrameId.current = requestAnimationFrame(animate);
      } else {
        // Final snap to targets
        spine.position.set(targetPosition.current.x, targetPosition.current.y);
        spine.scale.set(targetScaleRef.current);
        animationFrameId.current = undefined;
      }
    };

    animate();
  }, [canvaState?.parentElement]);

  /**
   * Animation controller for play/pause/reset actions
   */
  const animationControl = useCallback(
    (action: "play" | "pause" | "reset") => {
      const spine = spineAnimationRef.current;
      if (!spine) return;

      switch (action) {
        case "pause":
          spine.state.timeScale = 0;
          animationStateRef.current.isPaused = true;
          break;
        case "play":
          spine.state.timeScale = 1;
          animationStateRef.current.isPaused = false;
          break;
        case "reset":
          spine.state.timeScale = 1;
          animationStateRef.current.isPaused = false;
          if (animationList.length > 0) {
            spine.state.setAnimation(0, animationList[0], true);
            animationStateRef.current.currentAnimationName = animationList[0];
            animationStateRef.current.currentAnimationIndex = 0;
          }
          setDefaultPositionAndScale();
          break;
      }
    },
    [animationList, setDefaultPositionAndScale],
  );

  /**
   * Sets up spine for export and ensures proper cleanup afterward
   */
  const withExportSetup: {
    <T>(callback: (spine: SpineWithDebug) => Promise<T>): Promise<T>;
    <T>(callback: (spine: SpineWithDebug) => T): T;
  } = useCallback(
    <T,>(
      callback: (spine: SpineWithDebug) => Promise<T> | T,
    ): Promise<T> | T => {
      const spine = spineAnimationRef.current;
      if (!spine) throw new Error("Spine is not available");

      const wasPaused = animationStateRef.current.isPaused;
      const originalScale = spine.scale.clone();
      const originalPosition = spine.position.clone();
      const originalTime = spine.state.tracks[0]?.trackTime ?? 0;

      const cleanup = () => {
        spine.scale.copyFrom(originalScale);
        spine.position.copyFrom(originalPosition);
        if (spine.state.tracks[0]) {
          spine.state.tracks[0].trackTime = originalTime;
        }
        if (!wasPaused) spine.state.timeScale = 1;
        setIsExporting(false);
      };

      setIsExporting(true);
      if (!wasPaused) spine.state.timeScale = 0;

      let result: Promise<T> | T;
      try {
        result = callback(spine);
      } catch (error) {
        cleanup();
        throw error;
      }

      if (result instanceof Promise) {
        return result.finally(cleanup);
      } else {
        cleanup();
        return result;
      }
    },
    [],
  );

  /**
   * Calculates the bounds that encompass all frames of the animation
   * with optimized frame sampling
   */
  const calculateMaxAnimationBounds = useCallback(() => {
    const spine = spineAnimationRef.current;
    if (!spine || !spine.state.tracks[0]) {
      return originalDimensions.current;
    }

    // Store original state
    const originalTime = spine.state.tracks[0].trackTime;
    const originalScaleX = spine.scale.x;
    const originalScaleY = spine.scale.y;
    const originalPositionX = spine.position.x;
    const originalPositionY = spine.position.y;

    // Reset scale and position to calculate local bounds
    spine.scale.set(1, 1);
    spine.position.set(0, 0);

    const trackEntry = spine.state.tracks[0];
    const duration = getAnimationDuration(trackEntry);

    // Optimize by taking fewer samples for longer animations
    // Use at least 10 frames and at most 30 frames
    const framesToSample = Math.min(Math.max(Math.ceil(duration * 10), 10), 30);

    let minX = Infinity;
    let minY = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    // Check bounds at multiple points in the animation
    for (let i = 0; i <= framesToSample; i++) {
      const time = (i / framesToSample) * duration;
      spine.state.tracks[0].trackTime = time;
      spine.updateTransform();

      const frameBounds = spine.getLocalBounds();

      const currentLeft = frameBounds.x;
      const currentTop = frameBounds.y;
      const currentRight = currentLeft + frameBounds.width;
      const currentBottom = currentTop + frameBounds.height;

      minX = Math.min(minX, currentLeft);
      minY = Math.min(minY, currentTop);
      maxRight = Math.max(maxRight, currentRight);
      maxBottom = Math.max(maxBottom, currentBottom);
    }

    // Calculate max dimensions
    const maxBounds: Dimensions = {
      x: minX,
      y: minY,
      width: maxRight - minX,
      height: maxBottom - minY,
    };

    // Restore original state
    spine.state.tracks[0].trackTime = originalTime;
    spine.scale.set(originalScaleX, originalScaleY);
    spine.position.set(originalPositionX, originalPositionY);
    spine.updateTransform();

    return maxBounds;
  }, []);

  /**
   * Smoothly animates the scale of the spine animation
   */
  const setAnimationScale = useCallback((targetScale: number) => {
    const spine = spineAnimationRef.current;
    if (!spine) return;

    // Clamp target scale between min and max
    targetScaleRef.current = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, targetScale),
    );

    // Don't start a new animation frame if one is already running
    // The existing animation will pick up the new target value
    if (!animationFrameId.current) {
      const animate = () => {
        const spine = spineAnimationRef.current;
        if (!spine) {
          animationFrameId.current = undefined;
          return;
        }

        const current = spine.scale.x;
        const diff = targetScaleRef.current - current;

        if (Math.abs(diff) > 0.001) {
          spine.scale.set(current + diff * ANIMATION_SMOOTHING);
          animationFrameId.current = requestAnimationFrame(animate);
        } else {
          spine.scale.set(targetScaleRef.current);
          animationFrameId.current = undefined;
        }
      };

      animationFrameId.current = requestAnimationFrame(animate);
    }
  }, []);

  /**
   * Initializes the spine animation and sets up event handlers
   */
  const initializeAnimation = useCallback(
    (spine: Spine) => {
      if (!appRef.current) return;

      if (spineAnimationRef.current) {
        appRef.current.stage.removeChild(spineAnimationRef.current);
        spineAnimationRef.current.destroy({ children: true });
      }

      const spineWithDebug = spine as SpineWithDebug;
      spineAnimationRef.current = spineWithDebug;

      // Store original dimensions for reference
      originalDimensions.current = spine.getBounds();

      spineWithDebug.interactive = true;
      spineWithDebug.cursor = "pointer";
      spineWithDebug.on(
        "pointerdown",
        () => (dragTarget.current = spineWithDebug),
      );

      appRef.current.stage.addChild(spineWithDebug);

      // Filter out Dialog animations
      const animations = spineWithDebug.spineData.animations
        .map((a) => a.name)
        .filter((n) => !n.includes("Dialog"));

      setAnimationList(animations);

      if (animations.length > 0) {
        spineWithDebug.state.setAnimation(0, animations[0], true);
        animationStateRef.current.currentAnimationName = animations[0];
        animationStateRef.current.currentAnimationIndex = 0;
      }

      setDefaultPositionAndScale();
    },
    [setDefaultPositionAndScale],
  );

  // Gesture handlers
  const handleWheel = useCallback<Handler<"wheel">>(
    ({ delta: [, dy] }) => {
      const currentScale = spineAnimationRef.current?.scale.x ?? 1;
      const modifier = dy > 0 ? 0.9 : 1.1;

      setAnimationScale(currentScale * modifier);
    },
    [setAnimationScale],
  );

  const handlePinch = useCallback<Handler<"pinch">>(
    ({ origin: [ox, oy], delta: [dScale] }) => {
      const spine = spineAnimationRef.current;
      if (!spine) return;

      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, spine.scale.x * dScale),
      );

      spine.scale.set(newScale);
      spine.position.set(
        ox - (ox - spine.position.x) * (newScale / spine.scale.x),
        oy - (oy - spine.position.y) * (newScale / spine.scale.y),
      );
    },
    [],
  );

  const handleDrag = useCallback<Handler<"drag">>(
    ({ delta: [dx, dy], active }) => {
      if (active && dragTarget.current) {
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = undefined;
        }

        dragTarget.current.position.set(
          dragTarget.current.x + dx,
          dragTarget.current.y + dy,
        );
      }
    },
    [],
  );

  const bindGestures = useGesture({
    onWheel: handleWheel,
    onPinch: handlePinch,
    onDrag: handleDrag,
  });

  /**
   * Toggles debug rendering for the spine animation
   */
  const toggleDebugMode = useCallback(() => {
    const spine = spineAnimationRef.current;
    if (!spine) return;

    debugModeRef.current = !debugModeRef.current;

    if (debugModeRef.current) {
      spine.debug = new SpineDebugRenderer();
    } else {
      //@ts-expect-error "It can't be helped"
      spine.debug = null;
    }
  }, []);

  /**
   * Plays a specific animation from the animation list
   */
  const playAnimation = useCallback(
    (index: number) => {
      const spine = spineAnimationRef.current;
      if (!spine || index < 0 || index >= animationList.length) return;

      spine.state.setAnimation(0, animationList[index], true);
      animationStateRef.current.currentAnimationName = animationList[index];
      animationStateRef.current.currentAnimationIndex = index;
    },
    [animationList],
  );

  /**
   * Takes a screenshot of the current animation frame
   */
  const takeScreenshot = useCallback(
    (options?: { height?: number }) => {
      const spine = spineAnimationRef.current;
      if (!spine) return Promise.resolve();

      return withExportSetup((spine) => {
        return Promise.resolve().then(() => {
          try {
            const maxBounds = calculateMaxAnimationBounds();
            const originalWidth = maxBounds.width;
            const originalHeight = maxBounds.height;
            const { width, height } = calculateExportDimensions(
              originalWidth,
              originalHeight,
              options?.height,
            );
            const scale = height / originalHeight;

            const renderer = new PIXI.Renderer({
              width,
              height,
              backgroundAlpha: 0,
              antialias: true,
              preserveDrawingBuffer: true,
            });

            spine.position.set(-maxBounds.x * scale, -maxBounds.y * scale);
            spine.scale.set(scale);

            renderer.render(spine);
            const canvas = renderer.view;

            if (!(canvas instanceof HTMLCanvasElement)) {
              throw new Error("Renderer's view is not a canvas element");
            }

            const png = canvas.toDataURL("image/png");
            downloadFile(
              png,
              `${animationStateRef.current.currentAnimationName}.png`,
            );
            renderer.destroy();
          } catch (error) {
            console.error("Failed to capture screenshot:", error);
          }
        });
      });
    },
    [
      withExportSetup,
      calculateMaxAnimationBounds,
      calculateExportDimensions,
      downloadFile,
    ],
  );

  /**
   * Exports the animation to a video file with support for custom height
   */
  const exportToVideo = useCallback(
    async (format: VideoFormat, options?: ExportOptions) => {
      const spine = spineAnimationRef.current;
      if (!spine || !spine.state.tracks[0]) return;

      // Declare frames in an outer scope so they can be cleaned up later.
      let frames: ImageData[] = [];

      return withExportSetup(async (spine) => {
        const exportContainer = new PIXI.Container();
        let renderer: PIXI.Renderer | null = null;
        try {
          // Warn about MP4 transparency limitations
          if (format === "mp4") {
            console.warn(
              "MP4 format does not support transparency. Transparent areas will be rendered with an opaque background.",
            );
          }

          // Calculate animation duration and frame count
          const trackEntry = spine.state.tracks[0];
          const duration = getAnimationDuration(trackEntry);
          const FPS = 30;
          const totalFrames = Math.floor(duration * FPS);
          const frameDuration = duration / totalFrames; // precise frame timing

          // Calculate animation bounds and dimensions
          const maxBounds = calculateMaxAnimationBounds();
          const originalWidth = maxBounds.width;
          const originalHeight = maxBounds.height;
          let { width, height } = calculateExportDimensions(
            originalWidth,
            originalHeight,
            options?.height,
          );

          // Ensure exported dimensions are even (required by libx264)
          width = Math.round(width / 2) * 2;
          height = Math.round(height / 2) * 2;

          // Set up scaling and padding based on even dimensions
          const scale = height / originalHeight;
          exportContainer.addChild(spine);

          const paddingFactor = 0.05;
          const paddedWidth = Math.ceil(width * (1 + paddingFactor));
          const paddedHeight = Math.ceil(height * (1 + paddingFactor));
          const paddingX = Math.floor((paddedWidth - width) / 2);
          const paddingY = Math.floor((paddedHeight - height) / 2);

          // Create PIXI renderer for full export (including padding)
          renderer = new PIXI.Renderer({
            width: paddedWidth,
            height: paddedHeight,
            backgroundAlpha: 0,
            antialias: true,
            preserveDrawingBuffer: true,
          });

          // Create temporary canvas for final frame extraction
          const frameCanvas = document.createElement("canvas");
          frameCanvas.width = width;
          frameCanvas.height = height;
          const frameCtx = frameCanvas.getContext("2d");
          if (!frameCtx) {
            throw new Error("Failed to create frame canvas context");
          }

          // Pre-render all frames
          console.log(`Pre-rendering ${totalFrames} frames...`);
          frames = [];

          for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            const currentTime = Math.min(frameIndex * frameDuration, duration);

            // Update spine animation to the specific time
            spine.state.tracks[0].trackTime = currentTime;
            if (appRef.current) {
              appRef.current.ticker.update();
            }

            // Position and scale the spine appropriately
            spine.scale.set(scale, scale);
            spine.position.set(
              -maxBounds.x * scale + paddingX,
              -maxBounds.y * scale + paddingY,
            );

            // Render the current frame
            renderer.clear();
            renderer.render(exportContainer);

            // Copy the rendered area into the frame canvas (cropping out padding)
            frameCtx.clearRect(0, 0, width, height);
            frameCtx.drawImage(
              renderer.view as CanvasImageSource,
              paddingX,
              paddingY,
              width,
              height,
              0,
              0,
              width,
              height,
            );

            // Get the ImageData and verify its size
            const frameData = frameCtx.getImageData(0, 0, width, height);
            if (frameData.data.length !== width * height * 4) {
              throw new Error(`Invalid frame data at index ${frameIndex}`);
            }
            frames.push(frameData);
          }

          console.log(
            `Pre-rendered ${frames.length} frames, starting video creation...`,
          );

          // Load FFmpeg if not already loaded
          const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
          if (!ffmpeg.loaded) {
            await ffmpeg.load({
              coreURL: await toBlobURL(
                `${baseURL}/ffmpeg-core.js`,
                "text/javascript",
              ),
              wasmURL: await toBlobURL(
                `${baseURL}/ffmpeg-core.wasm`,
                "application/wasm",
              ),
            });
          }

          // Write frames to FFmpeg's virtual filesystem using sequential, zero-based filenames
          for (let i = 0; i < frames.length; i++) {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas context failed");

            ctx.putImageData(frames[i], 0, 0);
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, "image/png"),
            );
            if (!blob) throw new Error("Frame blob creation failed");

            const buffer = await blob.arrayBuffer();
            const filename = `frame${i.toString().padStart(4, "0")}.png`;
            await ffmpeg.writeFile(filename, new Uint8Array(buffer));
          }

          // Build the FFmpeg command:
          // - "-start_number 0": tells FFmpeg the first frame is frame0000.png.
          // - "-frames:v": processes exactly the number of pre-rendered frames.
          const outputFile = `output.${format}`;

          const args = [
            "-framerate",
            String(FPS),
            "-start_number",
            "0",
            "-i",
            "frame%04d.png",
            "-frames:v",
            String(frames.length),
            "-r",
            String(FPS),
            "-vsync",
            "0",
            "-c:v",
            format === "mp4" ? "libx264" : "libvpx-vp9",
            ...(format === "webm"
              ? ["-lossless", "1", "-cpu-used", "4", "-tile-columns", "4"]
              : []),
            ...(format === "mp4" ? ["-preset", "medium", "-crf", "18"] : []),
            "-pix_fmt",
            format === "mp4" ? "yuv420p" : "yuva420p",
            "-auto-alt-ref",
            "0",
            "-b:v",
            "5M",
            "-g",
            String(FPS),
            "-an",
            "-progress",
            "pipe:1",
            outputFile,
          ];

          ffmpeg.on("progress", (event) => {
            const progressPercent = Math.min(event.progress * 100, 100);
            if (options?.onExportPercentageUpdate) {
              options.onExportPercentageUpdate(progressPercent.toFixed(1));
            }
          });

          await ffmpeg.exec(args);

          // Read the output file and create a downloadable blob
          const data = await ffmpeg.readFile(outputFile);
          const videoBlob = new Blob([data], {
            type: format === "mp4" ? "video/mp4" : "video/webm",
          });
          const url = URL.createObjectURL(videoBlob);
          downloadFile(
            url,
            `${animationStateRef.current.currentAnimationName}.${format}`,
          );
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error(`Failed to export to ${format}:`, error);
        } finally {
          // Clean up: delete each frame file individually from FFmpeg's virtual filesystem.
          for (let i = 0; i < frames.length; i++) {
            const filename = `frame${i.toString().padStart(4, "0")}.png`;
            try {
              await ffmpeg.deleteFile(filename);
            } catch (deleteError) {
              console.warn(`Failed to delete ${filename}:`, deleteError);
            }
          }
          try {
            await ffmpeg.deleteFile(`output.${format}`);
          } catch (deleteError) {
            console.warn(`Failed to delete output file:`, deleteError);
          }
          // Destroy the PIXI renderer to free up resources.
          if (renderer) {
            renderer.destroy();
          }
          // Return the spine to the main stage and destroy the export container.
          appRef.current?.stage.addChild(spine);
          exportContainer.destroy({ children: false });
        }
      });
    },
    [
      calculateMaxAnimationBounds,
      downloadFile,
      calculateExportDimensions,
      withExportSetup,
    ],
  );

  /**
   * Exports the animation to a GIF file with proper transparency
   */
  const exportToGif = useCallback(
    (options?: ExportOptions): void => {
      const spine = spineAnimationRef.current;
      if (!spine || !spine.state.tracks[0]) return;

      return withExportSetup((spine) => {
        const exportContainer = new PIXI.Container();
        try {
          const trackEntry = spine.state.tracks[0];
          const duration = getAnimationDuration(trackEntry);

          // Define FPS and calculate total frames
          const FPS = 20;
          const totalFrames = Math.ceil(duration * FPS);

          // Get max animation bounds and target dimensions
          const maxBounds = calculateMaxAnimationBounds();
          const originalWidth = maxBounds.width;
          const originalHeight = maxBounds.height;
          const { width, height } = calculateExportDimensions(
            originalWidth,
            originalHeight,
            options?.height,
          );
          const scale = height / originalHeight;

          // Prepare export container
          exportContainer.addChild(spine);

          // Calculate padding to avoid clipping
          const paddingFactor = 0.05;
          const paddedWidth = Math.ceil(width * (1 + paddingFactor));
          const paddedHeight = Math.ceil(height * (1 + paddingFactor));
          const paddingX = Math.floor((paddedWidth - width) / 2);
          const paddingY = Math.floor((paddedHeight - height) / 2);

          // Create a temporary PIXI renderer with a transparent background
          const renderer = new PIXI.Renderer({
            width: paddedWidth,
            height: paddedHeight,
            backgroundAlpha: 0,
            antialias: true,
            preserveDrawingBuffer: true,
          });

          // Create an offscreen canvas for capturing frames
          const frameCanvas = document.createElement("canvas");
          frameCanvas.width = width;
          frameCanvas.height = height;
          const frameCtx = frameCanvas.getContext("2d", {
            willReadFrequently: true,
            alpha: true,
          })!;

          // Set up the GIF encoder (gif-encoder-2 handles transparency natively)
          const encoder = new GIFEncoder(width, height, "neuquant", false);
          encoder.setRepeat(0); // 0 = loop indefinitely
          encoder.setDelay(1000 / FPS);
          encoder.setQuality(1);
          encoder.setTransparent();
          encoder.start();

          // Generate and add frames
          for (let i = 0; i < totalFrames; i++) {
            const time = (i / (totalFrames - 1)) * duration;
            spine.state.tracks[0].trackTime = time;
            spine.updateTransform();

            // Scale and position the spine animation
            spine.scale.set(scale, scale);
            spine.position.set(
              -maxBounds.x * scale + paddingX,
              -maxBounds.y * scale + paddingY,
            );

            // Render current frame into the renderer
            renderer.clear();
            renderer.render(exportContainer);

            // Draw the rendered frame onto the offscreen canvas
            frameCtx.clearRect(0, 0, width, height);
            frameCtx.drawImage(
              renderer.view as HTMLCanvasElement,
              paddingX,
              paddingY,
              width,
              height,
              0,
              0,
              width,
              height,
            );

            // Add the frame to the encoder
            encoder.addFrame(frameCtx);

            const progressPercent = Math.min(
              ((i + 1) / totalFrames) * 100,
              100,
            );
            if (options?.onExportPercentageUpdate) {
              options.onExportPercentageUpdate(progressPercent.toFixed(1));
            }
          }

          encoder.finish();
          const binaryGif = encoder.out.getData();
          const blob = new Blob([binaryGif], { type: "image/gif" });
          const url = URL.createObjectURL(blob);

          // Trigger file download
          downloadFile(
            url,
            `${animationStateRef.current.currentAnimationName}.gif`,
          );
          URL.revokeObjectURL(url);

          renderer.destroy();
        } catch (error) {
          console.error("Error generating GIF:", error);
          throw new Error("Failed to generate GIF");
        } finally {
          // Restore spine to its original container
          appRef.current?.stage.addChild(spine);
          exportContainer.destroy({ children: false });
        }
      });
    },
    [
      calculateExportDimensions,
      calculateMaxAnimationBounds,
      downloadFile,
      withExportSetup,
    ],
  );

  useLayoutEffect(() => {
    if (!canvaState) return;

    const parent = canvaState.parentElement;
    if (!parent) return;

    const app = new PIXI.Application({
      antialias: true,
      resizeTo: parent,
      view: canvaState,
      resolution: window.devicePixelRatio,
      backgroundAlpha: 0,
    });
    appRef.current = app;

    const resizeObserver = new ResizeObserver(() => {
      app.renderer.resize(parent.clientWidth, parent.clientHeight);

      if (spineAnimationRef.current && !dragTarget.current) {
        setDefaultPositionAndScale();
      }
    });
    resizeObserver.observe(parent);

    const handlePointerUp = () => {
      dragTarget.current = null;
    };
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      cleanup();
      resizeObserver.disconnect();
      document.removeEventListener("pointerup", handlePointerUp);
      app.destroy(true);
    };
  }, [canvaState, cleanup, setDefaultPositionAndScale]);

  useEffect(() => {
    if (!spine) return;
    initializeAnimation(spine);

    return cleanup;
  }, [cleanup, initializeAnimation, spine]);

  return {
    animationList,
    playAnimation,
    setDefaultPositionAndScale,
    toggleDebugMode,
    resetAnimation: () => animationControl("reset"),
    pauseAnimation: () => animationControl("pause"),
    resumeAnimation: () => animationControl("play"),
    spineAnimation: spineAnimationRef.current,
    position: spineAnimationRef.current?.position,
    scale: spineAnimationRef.current?.scale,
    bindGestures,
    setCanvaState,
    takeScreenshot,
    exportToGif,
    exportToVideo,
    isExporting,
  };
};

export default useSpine;
