'use strict';

var loaderBase = require('@pixi-spine/loader-base');
var runtime3_4 = require('@pixi-spine/runtime-3.4');

class SpineParser extends loaderBase.SpineLoaderAbstract {
  createBinaryParser() {
    return new runtime3_4.SkeletonBinary(null);
  }
  createJsonParser() {
    return new runtime3_4.SkeletonJson(null);
  }
  parseData(parser, atlas, dataToParse) {
    const parserCast = parser;
    parserCast.attachmentLoader = new runtime3_4.AtlasAttachmentLoader(atlas);
    return {
      spineData: parserCast.readSkeletonData(dataToParse),
      spineAtlas: atlas
    };
  }
}
new SpineParser().installLoader();
//# sourceMappingURL=index.js.map
