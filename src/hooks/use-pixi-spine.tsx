import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Handler, useGesture } from "@use-gesture/react";
import { ReactDOMAttributes } from "@use-gesture/react/dist/declarations/src/types";
import GIF from "gif.js";
import { ITrackEntry, SpineDebugRenderer, type Spine } from "pixi-spine";
import * as PIXI from "pixi.js";

type SpineWithDebug = Spine & { debug: SpineDebugRenderer | null };

type Dimensions = { width: number; height: number; x: number; y: number };
type Position = { x: number; y: number };
type ExportOptions = { height?: number };
type VideoFormat = "webm" | "mp4";

const GIF_WORKER_URL = "/gif.worker.js";
const MAX_GIF_HEIGHT = 1000;
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const ANIMATION_SMOOTHING = 0.1;
const DEFAULT_SCALE_FACTOR = 0.8;

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
  takeScreenshot: () => Promise<void>;
  exportToVideo: (
    format: VideoFormat,
    options?: ExportOptions,
  ) => Promise<void>;
  exportToGif: (options?: ExportOptions) => Promise<void>;
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

      // Ensure width is even (for video encoding compatibility)
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
  const withExportSetup = useCallback(
    async <T,>(callback: (spine: SpineWithDebug) => Promise<T>): Promise<T> => {
      const spine = spineAnimationRef.current;
      if (!spine) throw new Error("Spine is not available");

      const wasPaused = animationStateRef.current.isPaused;
      const originalScale = spine.scale.clone();
      const originalPosition = spine.position.clone();
      const originalTime = spine.state.tracks[0]?.trackTime ?? 0;

      try {
        setIsExporting(true);
        if (!wasPaused) spine.state.timeScale = 0;
        return await callback(spine);
      } finally {
        spine.scale.copyFrom(originalScale);
        spine.position.copyFrom(originalPosition);
        if (spine.state.tracks[0]) {
          spine.state.tracks[0].trackTime = originalTime;
        }
        if (!wasPaused) spine.state.timeScale = 1;
        setIsExporting(false);
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
  const takeScreenshot = useCallback(() => {
    const spine = spineAnimationRef.current;
    if (!spine) return Promise.resolve();

    return withExportSetup((spine) => {
      return Promise.resolve().then(() => {
        try {
          const bounds = spine.getLocalBounds();
          spine.position.set(-bounds.x, -bounds.y);

          const renderer = new PIXI.Renderer({
            width: bounds.width,
            height: bounds.height,
            backgroundAlpha: 0,
            antialias: true,
            preserveDrawingBuffer: true,
          });

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
  }, [downloadFile, withExportSetup]);

  /**
   * Exports the animation to a video file with support for custom height
   */
  const exportToVideo = useCallback(
    async (format: VideoFormat, options?: ExportOptions) => {
      const spine = spineAnimationRef.current;
      if (!spine || !spine.state.tracks[0]) return;

      return withExportSetup(async (spine) => {
        try {
          if (format === "mp4") {
            console.warn(
              "MP4 format does not support transparency. Transparent areas will be rendered with an opaque background.",
            );
          }

          const trackEntry = spine.state.tracks[0];
          const duration = getAnimationDuration(trackEntry);

          // Get animation bounds that includes all frames
          const maxBounds = calculateMaxAnimationBounds();
          const originalWidth = maxBounds.width;
          const originalHeight = maxBounds.height;

          // Calculate target dimensions while maintaining aspect ratio
          const { width, height } = calculateExportDimensions(
            originalWidth,
            originalHeight,
            options?.height,
          );

          // Calculate scale based on target height
          const scale = height / originalHeight;

          // Add slight padding to ensure animation stays in frame
          const paddingFactor = 0.02;
          const paddedWidth = Math.ceil(width * (1 + paddingFactor));
          const paddedHeight = Math.ceil(height * (1 + paddingFactor));
          const paddingX = Math.floor((paddedWidth - width) / 2);
          const paddingY = Math.floor((paddedHeight - height) / 2);

          // Create a PIXI renderer with padding
          const renderer = new PIXI.Renderer({
            width: paddedWidth,
            height: paddedHeight,
            backgroundAlpha: 0,
            antialias: true,
            preserveDrawingBuffer: true,
          });

          // Create canvas for rendering the final output (without padding)
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Failed to create canvas context");
          }

          // Set up video encoding
          const FPS = 30;
          const stream = canvas.captureStream(FPS);
          const webmAlphaMime = "video/webm;codecs=vp9,alpha";
          const mimeType =
            format === "mp4"
              ? "video/mp4;codecs=h264"
              : MediaRecorder.isTypeSupported(webmAlphaMime)
                ? webmAlphaMime
                : "video/webm;codecs=vp9";

          const recorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported(mimeType)
              ? mimeType
              : "video/webm",

            videoBitsPerSecond: 5000000, // 5Mbps
          });

          const chunks: Blob[] = [];
          recorder.ondataavailable = (e) => chunks.push(e.data);

          const recordingFinished = new Promise<void>((resolve) => {
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: recorder.mimeType });
              const url = URL.createObjectURL(blob);

              downloadFile(
                url,
                `${animationStateRef.current.currentAnimationName}.${format}`,
              );
              URL.revokeObjectURL(url);

              resolve();
            };
          });

          // Start recording
          recorder.start();

          // Total frames to capture the entire animation
          const totalFrames = Math.max(2, Math.ceil(duration * FPS));

          // Render all frames
          for (let i = 0; i < totalFrames; i++) {
            const time = (i / totalFrames) * duration;

            // Update animation time
            spine.state.tracks[0].trackTime = time;
            spine.updateTransform();

            // Scale and position spine for export with padding
            spine.scale.set(scale, scale);
            spine.position.set(
              -maxBounds.x * scale + paddingX,
              -maxBounds.y * scale + paddingY,
            );

            // Clear the renderer and render the frame
            renderer.clear();
            renderer.render(spine);

            // Clear the output canvas
            ctx.clearRect(0, 0, width, height);

            // Draw the rendered spine animation (cropped to remove padding)
            ctx.drawImage(
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

            // Wait for next frame timing
            await new Promise((resolve) => setTimeout(resolve, 1000 / FPS));
          }

          // Stop recording after all frames are rendered
          recorder.stop();
          await recordingFinished;
          renderer.destroy();
        } catch (error) {
          console.error(`Failed to export to ${format}:`, error);
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
   * Exports the animation to a GIF file
   */
  const exportToGif = useCallback(
    async (options?: { height?: number }) => {
      const spine = spineAnimationRef.current;
      if (!spine || !spine.state.tracks[0]) return;

      return withExportSetup(async (spine) => {
        try {
          const trackEntry = spine.state.tracks[0];
          const duration = getAnimationDuration(trackEntry);
          const FPS = 20;
          const totalFrames = Math.ceil(duration * FPS);

          // Get max animation bounds
          const maxBounds = calculateMaxAnimationBounds();
          const originalWidth = maxBounds.width;
          const originalHeight = maxBounds.height;

          // Calculate target dimensions and scale
          const { width, height } = calculateExportDimensions(
            originalWidth,
            originalHeight,
            options?.height,
          );
          const scale = height / originalHeight; // Calculate scale based on target height

          // Add slight padding to allow for better edge processing
          const paddingFactor = 0.02;
          const paddedWidth = Math.ceil(width * (1 + paddingFactor));
          const paddedHeight = Math.ceil(height * (1 + paddingFactor));
          const paddingX = Math.floor((paddedWidth - width) / 2);
          const paddingY = Math.floor((paddedHeight - height) / 2);

          // Create temporary renderer with padding
          const renderer = new PIXI.Renderer({
            width: paddedWidth,
            height: paddedHeight,
            backgroundAlpha: 0,
            antialias: true,
            preserveDrawingBuffer: true,
          });

          const chromaKey = "0x00ff00";

          const gif = new GIF({
            workers: 4,
            quality: 10,
            width,
            height,
            workerScript: GIF_WORKER_URL,
            transparent: chromaKey,
            dither: false,
          });

          // Pre-render all frames
          const frames: ImageData[] = [];
          const frameCanvas = document.createElement("canvas");
          const frameCtx = frameCanvas.getContext("2d", {
            willReadFrequently: true,
          })!;
          frameCanvas.width = width;
          frameCanvas.height = height;

          // Prepare frame capture function with precise chroma key handling
          const captureFrame = (time: number) => {
            spine.state.tracks[0].trackTime = time;
            spine.updateTransform();

            // Scale and position spine for export with padding
            spine.scale.set(scale, scale);
            spine.position.set(
              -maxBounds.x * scale + paddingX,
              -maxBounds.y * scale + paddingY,
            );

            // Clear the renderer and render the frame
            renderer.clear();
            renderer.render(spine);

            // Fill with chroma key green
            frameCtx.fillStyle = chromaKey;
            frameCtx.fillRect(0, 0, width, height);

            // Draw the rendered spine animation (cropped to remove padding)
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

            // Get the image data for processing
            const imageData = frameCtx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // Careful edge processing that preserves black pixels
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              // Adjust only pixels with strong green bleeding at edges
              // This avoids affecting black pixels (like eyelashes)
              if (a > 0 && g > 180 && g > r * 1.5 && g > b * 1.5) {
                // Check if this is a pure green pixel (part of the background)
                const isChromaKey = r < 50 && g > 240 && b < 50;

                if (isChromaKey) {
                  // Make chroma key pixels fully transparent
                  data[i + 3] = 0;
                } else {
                  // For edge pixels with green bleeding
                  // 1. Reduce the green component
                  // 2. Maintain dark pixels by checking luminance
                  const luminance = r * 0.299 + g * 0.587 + b * 0.114;

                  // Preserve very dark pixels (like eyelashes)
                  if (luminance < 40 && r < 30 && b < 30) {
                    // Keep dark pixels but remove green tint
                    data[i + 1] = Math.min(data[i + 1], Math.max(r, b));
                  } else {
                    // Reduce green bleeding on other edge pixels
                    const avgColor = (r + b) / 2;
                    data[i + 1] = Math.min(g, avgColor * 1.2);
                  }
                }
              }
            }

            return imageData;
          };

          // First pass: generate all frames to ensure consistency
          for (let i = 0; i < totalFrames; i++) {
            const time = (i / (totalFrames - 1)) * duration;
            const imageData = captureFrame(time);
            frames.push(imageData);

            // Yield to main thread periodically
            if (i % 10 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }

          // Second pass: add frames to GIF
          for (let i = 0; i < frames.length; i++) {
            gif.addFrame(frames[i], {
              delay: 1000 / FPS,
              // Fix the dispose/disposal error - GIF.js uses 'dispose'
              dispose: 2,
            });

            // Yield to main thread periodically
            if (i % 20 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }

          // Finalize GIF
          await new Promise<void>((resolve) => {
            gif.on("finished", (blob: Blob) => {
              const url = URL.createObjectURL(blob);
              downloadFile(
                url,
                `${animationStateRef.current.currentAnimationName}.gif`,
              );
              URL.revokeObjectURL(url);
              resolve();
            });
            gif.render();
          });

          renderer.destroy();
        } catch (error) {
          console.error("Failed to export GIF:", error);
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
