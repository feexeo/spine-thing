import { ISkeletonData, Spine, TextureAtlas } from "pixi-spine";
import { ALPHA_MODES, Assets, BaseTexture } from "pixi.js";
import { create } from "zustand";

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
  premultipliedAlpha: true,
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
    const { atlasFile } = files;

    if (!atlasUrl || !imageUrl || !jsonUrl || !atlasFile) {
      return;
    }
    const atlasText = await atlasFile.text();

    set({ isLoading: false, error: null });

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

    const manifest = {
      bundles: [
        {
          name: "spineAnimation",
          assets: [
            {
              name: "spineAnimation",
              srcs: jsonUrl,
              data: {
                spineAtlas: texturedAtlas,
              },
            },
          ],
        },
      ],
    };
    try {
      Assets.reset();
      await Assets.init({ manifest });

      const assetBundle = (await Assets.loadBundle("spineAnimation")) as {
        spineAnimation: { spineData: ISkeletonData };
      };
      const spineData = assetBundle.spineAnimation.spineData;
      const spine = new Spine(spineData);

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
