// Small pictures drawn in code when the game starts: the cut rings on a stump,
// a mushroom cap, a fir bough, a fern frond, the golden leaf, glows and mist.
// They are ours (nothing to download or credit) and take a moment to draw.

import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { noise, rough, seeded } from './noise';

/**
 * The colour of the mist and the far distance: the same as the sky at the
 * horizon. It is set darker than it looks on screen, because the filmic curve
 * that maps light to the screen brightens and pales it.
 */
export const MIST_COLOR = 0x7fb3a6;
const MIST_CSS = '#7fb3a6';

const canvasOf = (width: number, height = width): { canvas: HTMLCanvasElement; pen: CanvasRenderingContext2D } => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // "willReadFrequently" keeps the drawing on the processor. These pictures are
  // thousands of small strokes, which a browser without a graphics card would
  // otherwise push through its software 3D pipeline, taking seconds.
  const pen = canvas.getContext('2d', { willReadFrequently: true });
  if (!pen) throw new Error('This browser cannot draw pictures');
  return { canvas, pen };
};

const asTexture = (canvas: HTMLCanvasElement, repeat = false): CanvasTexture => {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  }
  return texture;
};

const cache = new Map<string, CanvasTexture>();
const once = (name: string, draw: () => CanvasTexture): CanvasTexture => {
  let texture = cache.get(name);
  if (!texture) {
    texture = draw();
    cache.set(name, texture);
  }
  return texture;
};

/** The cut top of a stump or the end of a log: pale wood, growth rings, a bark rim. */
export const ringsPicture = (): CanvasTexture =>
  once('rings', () => {
    const size = 512;
    const { canvas, pen } = canvasOf(size);
    const random = seeded(71);
    const middle = size / 2;
    pen.fillStyle = '#4e3520';
    pen.fillRect(0, 0, size, size);
    // The heart of the tree sits a little off centre, as it does in real wood.
    const heartX = middle + 14;
    const heartY = middle - 9;
    const wood = pen.createRadialGradient(heartX, heartY, 6, middle, middle, middle * 0.93);
    wood.addColorStop(0, '#b98a52');
    wood.addColorStop(0.25, '#d9b27a');
    wood.addColorStop(0.8, '#e4c48f');
    wood.addColorStop(1, '#c79d63');
    pen.fillStyle = wood;
    pen.beginPath();
    pen.arc(middle, middle, middle * 0.93, 0, Math.PI * 2);
    pen.fill();
    // Growth rings: uneven, a little wobbly, closer together toward the bark.
    let radius = 7;
    while (radius < middle * 0.9) {
      const share = radius / (middle * 0.9);
      pen.strokeStyle = `rgba(120, 78, 38, ${0.16 + random() * 0.3})`;
      pen.lineWidth = 0.8 + random() * 2.2;
      pen.beginPath();
      const wobble = random() * 6;
      for (let step = 0; step <= 72; step += 1) {
        const turn = (step / 72) * Math.PI * 2;
        const r = radius * (1 + 0.025 * Math.sin(turn * 3 + wobble) + 0.012 * Math.sin(turn * 7 + wobble * 2));
        const x = heartX + (middle - heartX) * share + Math.cos(turn) * r;
        const y = heartY + (middle - heartY) * share + Math.sin(turn) * r;
        if (step === 0) pen.moveTo(x, y);
        else pen.lineTo(x, y);
      }
      pen.stroke();
      radius += 5 + random() * 11 * (1 - share * 0.5);
    }
    // A few drying cracks running out from the heart.
    for (let i = 0; i < 5; i += 1) {
      const turn = random() * Math.PI * 2;
      const reach = middle * (0.35 + random() * 0.5);
      pen.strokeStyle = 'rgba(70, 44, 22, 0.55)';
      pen.lineWidth = 1 + random() * 1.6;
      pen.beginPath();
      pen.moveTo(heartX + Math.cos(turn) * 10, heartY + Math.sin(turn) * 10);
      pen.quadraticCurveTo(
        heartX + Math.cos(turn + 0.08) * reach * 0.6,
        heartY + Math.sin(turn + 0.08) * reach * 0.6,
        heartX + Math.cos(turn) * reach,
        heartY + Math.sin(turn) * reach,
      );
      pen.stroke();
    }
    // The bark rim, rough on its inner edge.
    pen.strokeStyle = '#5b3d24';
    pen.lineWidth = middle * 0.1;
    pen.beginPath();
    pen.arc(middle, middle, middle * 0.95, 0, Math.PI * 2);
    pen.stroke();
    for (let i = 0; i < 90; i += 1) {
      const turn = random() * Math.PI * 2;
      pen.fillStyle = random() < 0.5 ? '#6e4a2c' : '#3f2a18';
      pen.beginPath();
      pen.arc(
        middle + Math.cos(turn) * middle * (0.9 + random() * 0.08),
        middle + Math.sin(turn) * middle * (0.9 + random() * 0.08),
        2 + random() * 5,
        0,
        Math.PI * 2,
      );
      pen.fill();
    }
    return asTexture(canvas);
  });

/** A mushroom cap seen from above: warm red with cream spots. */
export const capPicture = (): CanvasTexture =>
  once('cap', () => {
    const size = 512;
    const { canvas, pen } = canvasOf(size);
    const random = seeded(29);
    const middle = size / 2;
    const red = pen.createRadialGradient(middle, middle, 0, middle, middle, middle);
    red.addColorStop(0, '#ee7a3a');
    red.addColorStop(0.45, '#e2582a');
    red.addColorStop(0.85, '#c8401f');
    red.addColorStop(1, '#a8321a');
    pen.fillStyle = red;
    pen.fillRect(0, 0, size, size);
    const spot = (x: number, y: number, radius: number): void => {
      const cream = pen.createRadialGradient(x, y, radius * 0.2, x, y, radius);
      cream.addColorStop(0, '#fff6dc');
      cream.addColorStop(0.75, '#f6e8c8');
      cream.addColorStop(1, 'rgba(246, 232, 200, 0)');
      pen.fillStyle = cream;
      pen.beginPath();
      pen.ellipse(x, y, radius, radius * (0.8 + random() * 0.25), random() * 3, 0, Math.PI * 2);
      pen.fill();
    };
    spot(middle + 6, middle - 4, 44);
    for (let ring = 1; ring <= 3; ring += 1) {
      const count = 4 + ring * 3;
      for (let i = 0; i < count; i += 1) {
        const turn = (i / count) * Math.PI * 2 + random() * 0.5 + ring;
        const out = middle * (0.24 * ring + random() * 0.08);
        spot(middle + Math.cos(turn) * out, middle + Math.sin(turn) * out, 14 + random() * 20 - ring * 2);
      }
    }
    return asTexture(canvas);
  });

/** The underside of a mushroom cap: cream, with fine gills running out from the stem. */
export const gillsPicture = (): CanvasTexture =>
  once('gills', () => {
    const size = 256;
    const { canvas, pen } = canvasOf(size);
    const middle = size / 2;
    pen.fillStyle = '#f3e3bf';
    pen.fillRect(0, 0, size, size);
    for (let i = 0; i < 150; i += 1) {
      const turn = (i / 150) * Math.PI * 2;
      pen.strokeStyle = i % 2 ? 'rgba(160, 120, 80, 0.5)' : 'rgba(255, 250, 235, 0.6)';
      pen.lineWidth = 1.4;
      pen.beginPath();
      pen.moveTo(middle + Math.cos(turn) * 14, middle + Math.sin(turn) * 14);
      pen.lineTo(middle + Math.cos(turn) * middle, middle + Math.sin(turn) * middle);
      pen.stroke();
    }
    return asTexture(canvas);
  });

/**
 * One fir bough seen from above, on a clear background: a twig with side twigs
 * and needles, dark underneath and light at the tips. The stem end is at the
 * bottom of the picture.
 */
export const boughPicture = (): CanvasTexture =>
  once('bough', () => {
    const size = 512;
    const { canvas, pen } = canvasOf(size);
    const random = seeded(1107);
    pen.lineCap = 'round';
    const needleGreens = ['#1d4a34', '#27603f', '#32743f', '#4c9244', '#7fb24a'];

    /** A twig from (x, y) heading `turn` (0 is up the picture), with needles down both sides. */
    const twig = (x: number, y: number, turn: number, length: number, depth: number): void => {
      const steps = Math.max(4, Math.round(length / 9));
      let px = x;
      let py = y;
      let heading = turn;
      for (let i = 0; i < steps; i += 1) {
        const along = i / steps;
        heading += (random() - 0.5) * 0.12;
        const nx = px + Math.sin(heading) * (length / steps);
        const ny = py - Math.cos(heading) * (length / steps);
        // A dark, solid underlay so the bough is not see-through.
        pen.strokeStyle = '#173d2c';
        pen.lineWidth = (depth === 0 ? 30 : depth === 1 ? 24 : 18) * (1 - along * 0.5);
        pen.beginPath();
        pen.moveTo(px, py);
        pen.lineTo(nx, ny);
        pen.stroke();
        // Side twigs, shorter toward the tip.
        if (depth < 2 && i > 0 && i % (depth === 0 ? 1 : 2) === 0) {
          const reach = length * (depth === 0 ? 0.58 : 0.5) * (1 - along * 0.8) ** 0.8 * (0.8 + random() * 0.35);
          for (const side of [-1, 1]) {
            if (reach > 12) twig(nx, ny, heading + side * (0.85 + random() * 0.3), reach, depth + 1);
          }
        }
        px = nx;
        py = ny;
      }
      // Needles: short strokes angled forward, lighter toward the tip.
      px = x;
      py = y;
      heading = turn;
      const count = Math.round(length / 3.2);
      for (let i = 0; i < count; i += 1) {
        const along = i / count;
        const at = along * length;
        const cx = x + Math.sin(turn) * at;
        const cy = y - Math.cos(turn) * at;
        for (const side of [-1, 1]) {
          const lean = turn + side * (0.9 + random() * 0.35);
          const long = (depth === 0 ? 13 : 10) * (1 - along * 0.35) * (0.8 + random() * 0.4);
          const tone = Math.min(needleGreens.length - 1, Math.floor(along * 3 + random() * 2.2 + (depth > 0 ? 0.6 : 0)));
          pen.strokeStyle = needleGreens[tone];
          pen.lineWidth = 2.4;
          pen.beginPath();
          pen.moveTo(cx, cy);
          pen.lineTo(cx + Math.sin(lean) * long, cy - Math.cos(lean) * long);
          pen.stroke();
        }
      }
      // The woody stem down the middle of the main twig.
      if (depth === 0) {
        pen.strokeStyle = '#5a3d24';
        pen.lineWidth = 5;
        pen.beginPath();
        pen.moveTo(x, y);
        pen.lineTo(x + Math.sin(turn) * length * 0.7, y - Math.cos(turn) * length * 0.7);
        pen.stroke();
      }
    };
    twig(size / 2, size - 6, 0, size * 0.93, 0);
    return asTexture(canvas);
  });

/** One fern frond on a clear background, stem end at the bottom. */
export const fernPicture = (): CanvasTexture =>
  once('fern', () => {
    const width = 256;
    const height = 512;
    const { canvas, pen } = canvasOf(width, height);
    const random = seeded(52);
    const middle = width / 2;
    const pairs = 26;
    for (let i = 0; i < pairs; i += 1) {
      const along = i / (pairs - 1);
      const y = height - 14 - along * (height - 30);
      // Longest about a third of the way up, coming to a point at the tip.
      const reach = width * 0.47 * Math.sin(Math.PI * (0.16 + along * 0.84)) ** 0.8 * (1 - along * 0.35);
      for (const side of [-1, 1]) {
        const tilt = 0.32 + along * 0.3;
        const tipX = middle + side * reach * Math.cos(tilt);
        const tipY = y - reach * Math.sin(tilt);
        const thick = Math.max(4, (height / pairs) * 0.62);
        const green = pen.createLinearGradient(middle, y, tipX, tipY);
        green.addColorStop(0, '#2f6a2a');
        green.addColorStop(0.6, '#5d9a34');
        green.addColorStop(1, '#a6cf52');
        pen.fillStyle = green;
        pen.beginPath();
        pen.moveTo(middle, y + thick * 0.5);
        pen.quadraticCurveTo((middle + tipX) / 2, y + thick * 0.75 - reach * 0.22, tipX, tipY);
        pen.quadraticCurveTo((middle + tipX) / 2, y - thick * 0.9 - reach * 0.18, middle, y - thick * 0.5);
        pen.closePath();
        pen.fill();
        // A darker rib, so each leaflet reads at a distance.
        pen.strokeStyle = 'rgba(30, 70, 30, 0.55)';
        pen.lineWidth = 1.2;
        pen.beginPath();
        pen.moveTo(middle, y);
        pen.lineTo(tipX, tipY);
        pen.stroke();
      }
      void random;
    }
    pen.strokeStyle = '#3c6a26';
    pen.lineWidth = 5;
    pen.lineCap = 'round';
    pen.beginPath();
    pen.moveTo(middle, height - 4);
    pen.lineTo(middle, 18);
    pen.stroke();
    return asTexture(canvas);
  });

/** The golden leaf: a pointed leaf with veins, on a clear background. */
export const leafPicture = (): CanvasTexture =>
  once('leaf', () => {
    const size = 256;
    const { canvas, pen } = canvasOf(size);
    const middle = size / 2;
    const outline = (): void => {
      pen.beginPath();
      pen.moveTo(middle, 8);
      pen.bezierCurveTo(middle + 70, 50, middle + 104, 128, middle + 58, 196);
      pen.quadraticCurveTo(middle + 30, 232, middle, 236);
      pen.quadraticCurveTo(middle - 30, 232, middle - 58, 196);
      pen.bezierCurveTo(middle - 104, 128, middle - 70, 50, middle, 8);
      pen.closePath();
    };
    const gold = pen.createLinearGradient(0, 0, size, size);
    gold.addColorStop(0, '#fff2a8');
    gold.addColorStop(0.45, '#ffd34d');
    gold.addColorStop(1, '#e79a12');
    pen.fillStyle = gold;
    outline();
    pen.fill();
    pen.strokeStyle = '#b97a08';
    pen.lineWidth = 4;
    pen.lineCap = 'round';
    pen.beginPath();
    pen.moveTo(middle, 250);
    pen.lineTo(middle, 22);
    pen.stroke();
    pen.lineWidth = 2.2;
    for (let i = 0; i < 6; i += 1) {
      const y = 212 - i * 30;
      const reach = 62 - Math.abs(i - 2) * 9;
      for (const side of [-1, 1]) {
        pen.beginPath();
        pen.moveTo(middle, y);
        pen.quadraticCurveTo(middle + side * reach * 0.6, y - 16, middle + side * reach, y - 40);
        pen.stroke();
      }
    }
    return asTexture(canvas);
  });

/** A soft round glow that fades to nothing at its edge. */
export const glowPicture = (name: string, inner: string, outer: string): CanvasTexture =>
  once(`glow:${name}`, () => {
    const size = 128;
    const { canvas, pen } = canvasOf(size);
    const fade = pen.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    fade.addColorStop(0, inner);
    fade.addColorStop(1, outer);
    pen.fillStyle = fade;
    pen.fillRect(0, 0, size, size);
    return asTexture(canvas);
  });

/** A shaft of light: bright down the middle, fading at the sides and both ends. */
export const rayPicture = (): CanvasTexture =>
  once('ray', () => {
    const { canvas, pen } = canvasOf(64, 256);
    const picture = pen.createImageData(64, 256);
    for (let y = 0; y < 256; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        const across = Math.sin((x / 63) * Math.PI) ** 2;
        const along = Math.sin((y / 255) * Math.PI) ** 0.7;
        const i = (y * 64 + x) * 4;
        picture.data[i] = 255;
        picture.data[i + 1] = 240;
        picture.data[i + 2] = 190;
        picture.data[i + 3] = Math.round(255 * across * along);
      }
    }
    pen.putImageData(picture, 0, 0);
    return asTexture(canvas);
  });

/**
 * The shade of leaves overhead: clear where sunlight gets through, solid where
 * it does not. Never seen itself; it only shapes the sun's shadows on the route.
 */
export const canopyPicture = (): CanvasTexture =>
  once('canopy', () => {
    const size = 256;
    const { canvas, pen } = canvasOf(size);
    const picture = pen.createImageData(size, size);
    const period = 7;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = (x / size) * period;
        const v = (y / size) * period;
        const fx = x / size;
        const fy = y / size;
        // Four shifted copies blended, so the picture repeats without a seam.
        const value =
          rough(u, v, 9.4, 2) * (1 - fx) * (1 - fy) +
          rough(u - period, v, 9.4, 2) * fx * (1 - fy) +
          rough(u, v - period, 9.4, 2) * (1 - fx) * fy +
          rough(u - period, v - period, 9.4, 2) * fx * fy;
        const i = (y * size + x) * 4;
        picture.data[i] = 0;
        picture.data[i + 1] = 0;
        picture.data[i + 2] = 0;
        // About a third of the ground ends up in leaf shade.
        picture.data[i + 3] = value > 0.14 ? 255 : 0;
      }
    }
    pen.putImageData(picture, 0, 0);
    return asTexture(canvas, true);
  });

/** Drifting mist: soft white patches that tile without a seam. */
export const mistPicture = (): CanvasTexture =>
  once('mist', () => {
    const size = 256;
    const { canvas, pen } = canvasOf(size);
    const picture = pen.createImageData(size, size);
    const period = 4;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        // Blend four shifted copies so the left edge matches the right, and top matches bottom.
        const u = (x / size) * period;
        const v = (y / size) * period;
        const fx = x / size;
        const fy = y / size;
        const value =
          rough(u, v, 3.1) * (1 - fx) * (1 - fy) +
          rough(u - period, v, 3.1) * fx * (1 - fy) +
          rough(u, v - period, 3.1) * (1 - fx) * fy +
          rough(u - period, v - period, 3.1) * fx * fy;
        const amount = Math.min(1, Math.max(0, value * 1.6 + 0.45));
        const i = (y * size + x) * 4;
        picture.data[i] = 255;
        picture.data[i + 1] = 255;
        picture.data[i + 2] = 255;
        picture.data[i + 3] = Math.round(255 * amount * amount);
      }
    }
    pen.putImageData(picture, 0, 0);
    return asTexture(canvas, true);
  });

/**
 * The sky, as one picture wrapped round the world: mist colour at the horizon
 * and below, pale gold higher up, with a warm glow where the sun is.
 * `sunAcross` is 0 to 1 round the picture and `sunUp` 0 (horizon) to 1 (overhead).
 */
export const skyPicture = (sunAcross: number, sunUp: number): CanvasTexture =>
  once('sky', () => {
    const width = 512;
    const height = 256;
    const { canvas, pen } = canvasOf(width, height);
    // Top of the picture is straight up; the middle row is the horizon.
    const air = pen.createLinearGradient(0, 0, 0, height);
    air.addColorStop(0, '#f2e4a8');
    air.addColorStop(0.2, '#d6e2b8');
    air.addColorStop(0.38, '#a8ceb8');
    air.addColorStop(0.5, MIST_CSS);
    air.addColorStop(1, MIST_CSS);
    pen.fillStyle = air;
    pen.fillRect(0, 0, width, height);
    const sunX = sunAcross * width;
    const sunY = (0.5 - sunUp * 0.5) * height;
    for (const shift of [-width, 0, width]) {
      const glow = pen.createRadialGradient(sunX + shift, sunY, 0, sunX + shift, sunY, height * 0.8);
      glow.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
      glow.addColorStop(0.25, 'rgba(255, 232, 170, 0.55)');
      glow.addColorStop(1, 'rgba(255, 232, 170, 0)');
      pen.fillStyle = glow;
      pen.fillRect(0, 0, width, height * 0.62);
    }
    // Soften the line where glow meets the mist.
    const veil = pen.createLinearGradient(0, height * 0.42, 0, height * 0.56);
    veil.addColorStop(0, `${MIST_CSS}00`);
    veil.addColorStop(1, MIST_CSS);
    pen.fillStyle = veil;
    pen.fillRect(0, height * 0.42, width, height * 0.58);
    void noise;
    const texture = asTexture(canvas);
    texture.wrapS = RepeatWrapping;
    return texture;
  });

