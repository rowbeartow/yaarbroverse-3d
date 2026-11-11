// The surfaces of the grove: bark, rock, moss, forest floor, mushroom, leaves.
// Each is a physically lit material built from a downloaded texture set or a
// picture drawn in code. Three extras are added on top of the standard ones:
//
//   mist   everything fades into the mist as it gets lower, as well as farther
//   moss   a second texture grows over the first wherever a shape says so
//   wind   grass, ferns and boughs sway
//
// Looks only. Nothing here affects the game rules.

import {
  Color,
  DoubleSide,
  FrontSide,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderChunk,
  Vector2,
  type Texture,
} from 'three';
import type { Assets, SetName } from './assets';
import { boughPicture, capPicture, fernPicture, gillsPicture, leafPicture, ringsPicture } from './pictures';

// ---------- Mist: fog by height as well as distance ----------

let mistInstalled = false;

/**
 * Makes every material fade into the fog colour below `top`, fully by `bottom`.
 * Call once, before anything is drawn.
 */
export const installMist = (top: number, bottom: number): void => {
  if (mistInstalled) return;
  mistInstalled = true;
  ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
	varying float vFogDepth;
	varying float vFogHeight;
#endif`;
  ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	// Height in the world, worked back from the camera's own view of the point.
	vFogHeight = cameraPosition.y + dot( viewMatrix[ 1 ].xyz, mvPosition.xyz );
#endif`;
  ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying float vFogHeight;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`;
  ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	float mistFactor = smoothstep( ${top.toFixed(2)}, ${bottom.toFixed(2)}, vFogHeight );
	fogFactor = 1.0 - ( 1.0 - fogFactor ) * ( 1.0 - mistFactor );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
};

// ---------- Wind ----------

/** The clock every swaying material reads. GroveView moves it forward each frame. */
export const WIND = { time: { value: 0 } };

type Patch = (shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, { value: unknown }> }) => void;

/** A lit material: the full physically based kind, or the simple kind for machines with no graphics card. */
export type Lit = MeshStandardMaterial | MeshLambertMaterial;

const patched = (material: Lit, key: string, patch: Patch): void => {
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    patch(shader);
  };
  const beforeKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${beforeKey()}|${key}`;
};

/**
 * Makes a material sway. Shapes say how much each point moves through their
 * `sway` values (0 at a root, 1 at a tip); `strength` is the reach in metres.
 */
export const sways = <T extends Lit>(material: T, strength: number, speed = 1): T => {
  patched(material, `sway:${strength}:${speed}`, (shader) => {
    shader.uniforms.uWindTime = WIND.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
	{
		#ifdef USE_INSTANCING
			vec3 swayHome = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
		#else
			vec3 swayHome = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
		#endif
		float swayPhase = swayHome.x * 0.37 + swayHome.z * 0.29 + position.y * 0.6;
		float swayTime = uWindTime * ${speed.toFixed(2)};
		float gust = sin( swayTime * 1.7 + swayPhase ) * 0.6 + sin( swayTime * 3.3 + swayPhase * 1.9 ) * 0.4;
		float lift = cos( swayTime * 1.3 + swayPhase * 1.3 );
		transformed.x += gust * sway * ${strength.toFixed(3)};
		transformed.z += lift * sway * ${(strength * 0.6).toFixed(3)};
		transformed.y += gust * lift * sway * ${(strength * 0.25).toFixed(3)};
	}`,
      );
  });
  return material;
};

/**
 * Lights both faces of a thin leaf or bough the same. Left alone, the back of
 * a two-sided shape is lit as if it faced the other way, so boughs seen from
 * below go dark and grey. Foliage is lit as if it all faced the sky instead.
 */
export const softBothSides = <T extends Lit>(material: T): T => {
  patched(material, 'soft-sides', (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n\tnormal *= faceDirection;\n#endif',
    );
  });
  return material;
};

/**
 * Grows moss over a material. Shapes say where through their `moss` values;
 * the edge of the moss follows the grain of the moss picture, so it creeps
 * rather than stopping at a line.
 */
export const mossy = <T extends Lit>(material: T, moss: Texture, tint: Color, scale = 1): T => {
  patched(material, `moss:${scale}`, (shader) => {
    shader.uniforms.uMossMap = { value: moss };
    shader.uniforms.uMossTint = { value: tint };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float moss;\nvarying float vMoss;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvMoss = moss;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uMossMap;\nuniform vec3 uMossTint;\nvarying float vMoss;')
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
	{
		vec3 mossColor = texture2D( uMossMap, vMapUv * ${scale.toFixed(2)} ).rgb;
		float grain = mossColor.g + dot( diffuseColor.rgb, vec3( 0.6 ) );
		float mossAmount = smoothstep( 0.42, 0.62, vMoss * 1.15 + ( grain - 0.55 ) * 0.55 ) * step( 0.02, vMoss );
		diffuseColor.rgb = mix( diffuseColor.rgb, mossColor * uMossTint, mossAmount );
	}`,
      )
      // Moss is soft and matte wherever it grows.
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n\troughnessFactor = mix( roughnessFactor, 0.96, smoothstep( 0.35, 0.7, vMoss ) );',
      );
  });
  return material;
};

// ---------- The set of materials for one grove ----------

const linear = (hex: number): Color => new Color(hex);

export class Materials {
  /** Tree bark, with moss where shapes ask for it. One texture tile is 2 m. */
  readonly bark: Lit;
  /** Grey lichen rock, with moss where shapes ask for it. One tile is 3 m. */
  readonly rock: Lit;
  /** The soft green top of a safe mossy bank. One tile is 3 m. */
  readonly mossTop: Lit;
  /** The bare stone top of a bank that is not safe. */
  readonly stoneTop: Lit;
  /** The forest floor far below and off to the sides. One tile is 6 m. */
  readonly ground: Lit;
  /** Cut wood with growth rings. */
  readonly rings: Lit;
  readonly cap: Lit;
  readonly gills: Lit;
  readonly stem: Lit;
  /** Fir and cedar boughs. */
  readonly foliage: Lit;
  readonly fern: Lit;
  readonly grass: Lit;
  readonly goldLeaf: Lit;

  /**
   * `simple` swaps every material for a plain matte one with the same colours
   * and textures: no fine bumps, no forest reflections, no gloss. It is for
   * machines that draw in software, where the full kind takes over half a
   * second a frame.
   */
  constructor(
    assets: Assets,
    readonly simple = false,
  ) {
    interface Look {
      map?: Texture;
      normalMap?: Texture;
      color?: number;
      roughness?: number;
      bump?: number;
      alphaTest?: number;
      doubleSided?: boolean;
      vertexColors?: boolean;
    }
    const make = (look: Look): Lit => {
      const shared = {
        map: look.map ?? null,
        color: look.color ?? 0xffffff,
        alphaTest: look.alphaTest ?? 0,
        side: look.doubleSided ? DoubleSide : FrontSide,
        vertexColors: look.vertexColors ?? false,
      };
      if (simple) return new MeshLambertMaterial(shared);
      return new MeshStandardMaterial({
        ...shared,
        normalMap: look.normalMap ?? null,
        normalScale: new Vector2(look.bump ?? 1, look.bump ?? 1),
        roughness: look.roughness ?? 0.9,
        metalness: 0,
      });
    };
    const set = (name: SetName, look: Look = {}): Lit =>
      make({ ...look, map: assets.sets[name].color, normalMap: assets.sets[name].normal });

    const mossWood = assets.sets.mossWood.color;
    this.bark = mossy(set('bark', { color: 0xe8d8c8, roughness: 0.92, bump: 1.4 }), mossWood, linear(0xb8e070), 0.7);
    this.rock = mossy(set('rock', { color: 0xd8d6d0, roughness: 0.88, bump: 1.3 }), mossWood, linear(0xa8d868), 0.6);
    this.mossTop = set('moss', { color: 0xa2f06c, roughness: 0.97, bump: 1.2 });
    this.stoneTop = set('rock', { color: 0xf0ece4, roughness: 0.85, bump: 1.1 });
    this.ground = set('ground', { color: 0xc8dcb8, roughness: 0.96 });

    this.rings = make({ map: ringsPicture(), roughness: 0.82 });
    // The caps get a thin glossy coat, like a wet toadstool in a picture book.
    this.cap = simple
      ? make({ map: capPicture() })
      : new MeshPhysicalMaterial({ map: capPicture(), roughness: 0.45, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.3 });
    this.gills = make({ map: gillsPicture(), roughness: 0.9, doubleSided: true });
    this.stem = make({ color: 0xf3e6c8, roughness: 0.85 });

    this.foliage = softBothSides(
      sways(make({ map: boughPicture(), alphaTest: 0.4, doubleSided: true, roughness: 0.82, vertexColors: true }), 0.16, 0.8),
    );
    this.fern = sways(
      make({ map: fernPicture(), alphaTest: 0.45, doubleSided: true, roughness: 0.8, vertexColors: true }),
      0.09,
      1.3,
    );
    this.grass = sways(make({ doubleSided: true, roughness: 0.85, vertexColors: true }), 0.12, 1.6);

    const leaf = make({ map: leafPicture(), alphaTest: 0.5, doubleSided: true, roughness: 0.35 });
    leaf.emissiveMap = leafPicture();
    leaf.emissive.setHex(0xffc640);
    leaf.emissiveIntensity = simple ? 1.2 : 2.4;
    leaf.fog = false;
    if (!simple) (leaf as MeshStandardMaterial).metalness = 0.4;
    this.goldLeaf = leaf;
  }

  /** Every material, for settings that apply to all of them. */
  all(): Lit[] {
    return [
      this.bark,
      this.rock,
      this.mossTop,
      this.stoneTop,
      this.ground,
      this.rings,
      this.cap,
      this.gills,
      this.stem,
      this.foliage,
      this.fern,
      this.grass,
      this.goldLeaf,
    ];
  }

  dispose(): void {
    for (const material of this.all()) material.dispose();
  }
}
