'use strict';

var loaderBase = require('@pixi-spine/loader-base');
var runtime4_1 = require('@pixi-spine/runtime-4.1');

class SpineParser extends loaderBase.SpineLoaderAbstract {
  createBinaryParser() {
    return new runtime4_1.SkeletonBinary(null);
  }
  createJsonParser() {
    return new runtime4_1.SkeletonJson(null);
  }
  parseData(parser, atlas, dataToParse) {
    const parserCast = parser;
    parserCast.attachmentLoader = new runtime4_1.AtlasAttachmentLoader(atlas);
    return {
      spineData: parserCast.readSkeletonData(dataToParse),
      spineAtlas: atlas
    };
  }
}
new SpineParser().installLoader();
//# sourceMappingURL=index.js.map
