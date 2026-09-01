const { GIFEncoder, quantize, applyPalette } = require('gifenc');

// ياخذ مصفوفة إطارات (كل وحد فيها بيانات بكسل RGBA) ويرجع بافر GIF جاهز للإرسال
async function framesToGif(frames, delayMs = 100) {
  const gif = GIFEncoder();

  for (const frame of frames) {
    const palette = quantize(frame.data, 256);
    const index = applyPalette(frame.data, palette);
    gif.writeFrame(index, frame.width, frame.height, { palette, delay: delayMs });
  }

  gif.finish();
  return Buffer.from(gif.bytes());
}

module.exports = { framesToGif };
