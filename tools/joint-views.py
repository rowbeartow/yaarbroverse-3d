# Draws a model from the side, from above and from the front on a grid marked
# in metres, for finding where its joints are when writing a guide file (see
# tools/caputo.rig.json), and for checking a guide by drawing its joints over
# the model. It needs no graphics card: the pictures are made point by point.
#
#   blender -b -P tools/joint-views.py -- <model.glb> <out.png> [guide.json]
#
#   model.glb    the model as it came from Meshy
#   out.png      the picture: side view, top view, front view, one under another
#   guide.json   optional. Its "turned_left_degrees" is undone first, as the rig
#                scripts do, and its joints are drawn in red.
#
# The numbers on the grid are the guide's own: across (to the character's
# left), up (from the ground) and forward (toward its nose), in metres.
# Needs Blender 4 with numpy and Pillow (`apt-get install -y python3-numpy python3-pil`).

import json
import math
import sys

import bpy
import numpy as np
from mathutils import Matrix
from PIL import Image, ImageDraw

SCALE = 520  # dots for a metre
POINTS = 900000


def main():
    arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(arguments) < 2:
        raise SystemExit('Usage: blender -b -P tools/joint-views.py -- <model.glb> <out.png> [guide.json]')
    source, out = arguments[:2]
    guide = {}
    if len(arguments) > 2:
        with open(arguments[2], encoding='utf8') as file:
            guide = json.load(file)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and len(o.data.materials) > 0]
    fix = Matrix.Rotation(-math.radians(guide.get('turned_left_degrees', 0)), 4, 'Z')

    places, colours = [], []
    rng = np.random.default_rng(1)
    for mesh in meshes:
        data = mesh.data
        data.calc_loop_triangles()
        world = np.array(fix @ mesh.matrix_world)
        corners = np.array([v.co[:] for v in data.vertices]) @ world[:3, :3].T + world[:3, 3]
        triangles = np.array([t.vertices[:] for t in data.loop_triangles])
        loops = np.array([t.loops[:] for t in data.loop_triangles])
        uv = np.array([d.uv[:] for d in data.uv_layers.active.data]) if data.uv_layers.active else None
        image = next((n.image for m in data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
        a, b, c = (corners[triangles[:, i]] for i in range(3))
        area = np.linalg.norm(np.cross(b - a, c - a), axis=1)
        pick = rng.choice(len(triangles), POINTS, p=area / area.sum())
        u, v = rng.random(POINTS), rng.random(POINTS)
        over = u + v > 1
        u[over], v[over] = 1 - u[over], 1 - v[over]
        w = 1 - u - v
        places.append(a[pick] * w[:, None] + b[pick] * u[:, None] + c[pick] * v[:, None])
        if uv is not None and image is not None:
            width, height = image.size
            pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, -1)[:, :, :3]
            at = uv[loops[pick, 0]] * w[:, None] + uv[loops[pick, 1]] * u[:, None] + uv[loops[pick, 2]] * v[:, None]
            x = np.clip((at[:, 0] % 1) * width, 0, width - 1).astype(int)
            y = np.clip((at[:, 1] % 1) * height, 0, height - 1).astype(int)
            colours.append((np.clip(pixels[y, x], 0, 1) ** (1 / 2.2) * 255).astype(np.uint8))
        else:
            colours.append(np.full((POINTS, 3), 150, np.uint8))
    places = np.concatenate(places)
    colours = np.concatenate(colours)
    places[:, 2] -= places[:, 2].min()
    # The guide's own directions.
    across, up, forward = places[:, 0], places[:, 2], -places[:, 1]

    joints = []
    def gather(value):
        if isinstance(value, list) and value and isinstance(value[0], (int, float)):
            joints.append(value)
        elif isinstance(value, list):
            lines.append(value)
            for each in value:
                gather(each)
        elif isinstance(value, dict):
            for each in value.values():
                gather(each)
    lines = []
    gather(guide.get('joints', {}))

    def view(h, v, depth, title, pick_h, pick_v):
        h0, h1 = math.floor(h.min() * 10) / 10 - 0.1, math.ceil(h.max() * 10) / 10 + 0.1
        v0, v1 = math.floor(v.min() * 10) / 10 - 0.1, math.ceil(v.max() * 10) / 10 + 0.1
        wide, tall = round((h1 - h0) * SCALE), round((v1 - v0) * SCALE)
        picture = np.full((tall, wide, 3), 255, np.uint8)
        order = np.argsort(depth)
        px = np.clip(((h[order] - h0) * SCALE).astype(int), 0, wide - 1)
        py = np.clip(((v1 - v[order]) * SCALE).astype(int), 0, tall - 1)
        picture[py, px] = colours[order]
        image = Image.fromarray(picture)
        draw = ImageDraw.Draw(image)
        for mark in np.arange(round(h0, 1), h1 + 1e-6, 0.1):
            x = round((mark - h0) * SCALE)
            draw.line([(x, 0), (x, tall)], fill=(255, 0, 0) if abs(mark) < 1e-6 else (90, 150, 255), width=1)
            draw.text((x + 2, 2), f'{mark:.1f}', fill=(0, 0, 160))
        for mark in np.arange(round(v0, 1), v1 + 1e-6, 0.1):
            y = round((v1 - mark) * SCALE)
            draw.line([(0, y), (wide, y)], fill=(255, 0, 0) if abs(mark) < 1e-6 else (90, 150, 255), width=1)
            draw.text((2, y + 2), f'{mark:.1f}', fill=(0, 0, 160))
        at = lambda joint: ((pick_h(joint) - h0) * SCALE, (v1 - pick_v(joint)) * SCALE)
        for chain in lines:
            if chain and isinstance(chain[0], list) and isinstance(chain[0][0], (int, float)):
                draw.line([at(joint) for joint in chain], fill=(255, 0, 0), width=2)
        for joint in joints:
            x, y = at(joint)
            draw.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(255, 0, 0), fill=(255, 255, 0))
        draw.text((8, tall - 16), title, fill=(160, 0, 0))
        return image

    views = [
        view(forward, up, -across, 'From its right side. Across the page: forward. Up the page: up.', lambda j: j[2], lambda j: j[1]),
        view(across, forward, up, 'From above. Across the page: across (its left is +). Up the page: forward.', lambda j: j[0], lambda j: j[2]),
        view(across, up, -forward, 'From behind. Across the page: across (its left is +). Up the page: up.', lambda j: j[0], lambda j: j[1]),
    ]
    sheet = Image.new('RGB', (max(v.width for v in views), sum(v.height for v in views)), 'white')
    y = 0
    for each in views:
        sheet.paste(each, (0, y))
        y += each.height
    sheet.save(out)
    print(f'[views] saved {out}', flush=True)


main()
