import { ISkeletonData, Spine, TextureAtlas } from "pixi-spine";
import { ALPHA_MODES, BaseTexture } from "pixi.js";
import { create } from "zustand";

import { SpineLoader } from "@/lib/spine-loader";

export type SpineUrls = {
  atlasUrl: string | null;
  imageUrl: string | null;
  jsonUrl: string | null;
};
export type SpineFiles = {
  atlasFile: File | null;
  imageFile: File | null;
  jsonFile: File | null;
};

type SpineState = {
  spine: Spine | null;
  isLoading: boolean;
  error: string | null;
  premultipliedAlpha: boolean;
  urls: SpineUrls;
  files: SpineFiles;

  setSpine: (spine: Spine | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setPremultipliedAlpha: (value: boolean) => void;
  setUrls: (urls: Partial<SpineUrls>) => void;
  setFiles: (files: Partial<SpineFiles>) => void;
  resetStore: () => void;
  loadSpineAnimation: () => Promise<void>;
};

export const useSpineStore = create<SpineState>((set, get) => ({
  spine: null,
  isLoading: false,
  error: null,
  premultipliedAlpha: false,
  urls: {
    atlasUrl: null,
    imageUrl: null,
    jsonUrl: null,
  },
  files: {
    atlasFile: null,
    imageFile: null,
    jsonFile: null,
  },
  setSpine: (spine) => set({ spine }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setPremultipliedAlpha: (value) => {
    set({
      premultipliedAlpha: value,
    });
    const { loadSpineAnimation } = get();
    void loadSpineAnimation();
  },
  setUrls: (urls) =>
    set((state) => ({
      urls: { ...state.urls, ...urls },
    })),
  setFiles: (Files) =>
    set((state) => ({
      files: { ...state.files, ...Files },
    })),
  resetStore: () =>
    set({
      spine: null,
      isLoading: false,
      error: null,
      urls: {
        atlasUrl: null,
        imageUrl: null,
        jsonUrl: null,
      },
    }),

  loadSpineAnimation: async () => {
    const { urls, premultipliedAlpha, files } = get();
    const { atlasUrl, imageUrl, jsonUrl } = urls;
    const { atlasFile, jsonFile } = files;

    if (!atlasUrl || !imageUrl || !jsonUrl || !atlasFile || !jsonFile) {
      return;
    }
    let skeletonData: ISkeletonData;
    set({ isLoading: false, error: null });

    try {
      const spineLoader = new SpineLoader();
      const atlasText = await atlasFile.text();
      const dataToParse = new Uint8Array(await jsonFile.arrayBuffer());
      const texturedAtlas = new TextureAtlas(
        atlasText,
        (_, callback: (tex: BaseTexture) => BaseTexture) => {
          BaseTexture.removeFromCache(imageUrl);

          callback(
            BaseTexture.from(imageUrl, {
              alphaMode: premultipliedAlpha
                ? ALPHA_MODES.PREMULTIPLIED_ALPHA
                : ALPHA_MODES.NO_PREMULTIPLIED_ALPHA,
            }),
          );
        },
      );
      if (jsonUrl.endsWith(".skel")) {
        const spineResource = spineLoader.parseData(
          spineLoader.createBinaryParser(),
          texturedAtlas,
          dataToParse,
        );

        skeletonData = spineResource.spineData;
      } else {
        const spineResource = spineLoader.parseData(
          spineLoader.createJsonParser(),
          texturedAtlas,
          dataToParse,
        );
        skeletonData = spineResource.spineData;
      }

      const spine = new Spine(skeletonData);

      set({ spine, isLoading: false });
    } catch (error) {
      console.error("Error loading Spine data:", error);
      set({
        error:
          "Failed to load Spine animation. Please check file compatibility (Spine 3.7-4.1).",
        isLoading: false,
      });
    }
  },
}));
