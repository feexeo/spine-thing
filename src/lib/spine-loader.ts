import * as spine34 from "@pixi-spine/runtime-3.4";
import * as spine37 from "@pixi-spine/runtime-3.7";
import * as spine38 from "@pixi-spine/runtime-3.8";
import * as spine41 from "@pixi-spine/runtime-4.1";
import {
  BinaryInput,
  ISkeletonData,
  ISkeletonParser,
  TextureAtlas,
} from "pixi-spine";

export enum SPINE_VERSION {
  UNKNOWN = 0,
  VER34 = 34,
  VER37 = 37,
  VER38 = 38,
  VER40 = 40,
  VER41 = 41,
}

const versionMap: Record<string, SPINE_VERSION> = {
  "3.3": SPINE_VERSION.VER34,
  "3.4": SPINE_VERSION.VER34,
  "3.7": SPINE_VERSION.VER37,
  "3.8": SPINE_VERSION.VER38,
  "4.0": SPINE_VERSION.VER40,
  "4.1": SPINE_VERSION.VER41,
};

export function detectSpineVersion(version: string): SPINE_VERSION {
  const ver3 = version.slice(0, 3);

  if (versionMap[ver3]) {
    return versionMap[ver3];
  }

  const verNum = Math.floor(Number(ver3) * 10 + 1e-3);

  if (verNum < 37) {
    return SPINE_VERSION.VER37;
  }

  return SPINE_VERSION.UNKNOWN;
}

// Define interfaces for our expected parser types.
interface SkeletonBinaryParser {
  scale: number;
  readSkeletonData(data: Uint8Array): ISkeletonData;
}

interface SkeletonJsonParser {
  scale: number;
  readSkeletonData(data: Record<string, unknown>): ISkeletonData;
}

class UniBinaryParser implements ISkeletonParser {
  scale = 1;

  readSkeletonData(
    atlas: TextureAtlas,
    dataToParse: Uint8Array,
  ): ISkeletonData {
    const version = this.readVersionOldFormat(dataToParse);
    const ver = detectSpineVersion(version);

    const parser = this.getSpineParserByVersion(ver, atlas);
    if (!parser) {
      throw new Error(
        `Unsupported version of spine model ${version}, please update pixi-spine`,
      );
    }

    parser.scale = this.scale;
    return parser.readSkeletonData(dataToParse);
  }

  readVersionOldFormat(dataToParse: Uint8Array): string {
    const input = new BinaryInput(dataToParse);
    let version = "";
    try {
      input.readString();
      version = input.readString() ?? "";
    } catch (e) {
      console.warn(e);
    }
    return version;
  }

  private getSpineParserByVersion(
    ver: SPINE_VERSION,
    atlas: TextureAtlas,
  ): SkeletonBinaryParser | null {
    switch (ver) {
      case SPINE_VERSION.VER34:
        return new spine34.SkeletonBinary(
          new spine34.AtlasAttachmentLoader(atlas),
        ) as SkeletonBinaryParser;
      case SPINE_VERSION.VER38:
        return new spine38.SkeletonBinary(
          new spine38.AtlasAttachmentLoader(atlas),
        ) as SkeletonBinaryParser;
      case SPINE_VERSION.VER40:
      case SPINE_VERSION.VER41:
        return new spine41.SkeletonBinary(
          new spine41.AtlasAttachmentLoader(atlas),
        ) as SkeletonBinaryParser;
      default:
        return null;
    }
  }
}

class UniJsonParser implements ISkeletonParser {
  scale = 1;

  readSkeletonData(
    atlas: TextureAtlas,
    dataToParse: Record<string, unknown>,
  ): ISkeletonData {
    // Narrow the type of dataToParse to one that has a skeleton.spine property.
    const skeletonData = dataToParse as { skeleton: { spine: string } };
    const version = skeletonData.skeleton.spine;
    const ver = detectSpineVersion(version);
    let parser: SkeletonJsonParser | null = null;

    if (ver === SPINE_VERSION.VER37) {
      parser = new spine37.SkeletonJson(
        new spine37.AtlasAttachmentLoader(atlas),
      ) as SkeletonJsonParser;
    } else if (ver === SPINE_VERSION.VER38) {
      parser = new spine38.SkeletonJson(
        new spine38.AtlasAttachmentLoader(atlas),
      ) as SkeletonJsonParser;
    } else if (ver === SPINE_VERSION.VER40 || ver === SPINE_VERSION.VER41) {
      parser = new spine41.SkeletonJson(
        new spine41.AtlasAttachmentLoader(atlas),
      ) as SkeletonJsonParser;
    }

    if (!parser) {
      const error = `Unsupported version of spine model ${version}, please update pixi-spine`;
      console.error(error);
      throw new Error(error);
    }

    parser.scale = this.scale;
    return parser.readSkeletonData(dataToParse);
  }
}

export type ISpineResource<SKD extends ISkeletonData> = {
  spineData: SKD;
  spineAtlas: TextureAtlas;
};

/**
 * @public
 */
export class SpineLoader {
  createBinaryParser(): ISkeletonParser {
    return new UniBinaryParser();
  }

  createJsonParser(): ISkeletonParser {
    return new UniJsonParser();
  }

  parseData(
    parser: ISkeletonParser,
    atlas: TextureAtlas,
    dataToParse: Uint8Array<ArrayBuffer>,
  ): ISpineResource<ISkeletonData> {
    const parserCast = parser as UniBinaryParser | UniJsonParser;
    const dataToParseCast = dataToParse as Record<string, unknown> & Uint8Array;

    const spineData = parserCast.readSkeletonData(atlas, dataToParseCast);
    return {
      spineData,
      spineAtlas: atlas,
    };
  }
}
