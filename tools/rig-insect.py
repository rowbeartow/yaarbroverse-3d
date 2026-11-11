# Gives the giant mosquito a small skeleton and its animation clips, in
# Blender, with no window. Meshy's rigging only handles humanoids (see
# docs/decisions.md), and tools/rig-quadruped.py is for four-legged walkers.
#
#   blender -b -P tools/rig-insect.py -- <source.glb> <rigged.glb> <guide.json>
#
#   source.glb   the model as it came from Meshy
#   rigged.glb   where to save the rigged, animated model. It is as big as the
#                source: run tools/compress-hero.mjs on it next, and commit
#                only what that makes.
#   guide.json   where this insect's joints are (see tools/mosquito.rig.json)
#
# Needs Blender 4 with its glTF add-on and numpy, as tools/rig-quadruped.py
# does. It borrows that script's steps for opening, tidying, skinning and
# saving a model, so the two files must stay side by side.
#
# What it does:
#   1. Opens the model, stands its lowest point on the ground and merges the
#      doubled points along the seams of its picture, then thins the mesh to
#      about the guide's "triangles".
#   2. Builds the skeleton from the guide: a body, a head with a beak and two
#      antennae, an abdomen in three parts, two wings, and the legs, each a
#      short chain of bones.
#   3. Skins the model with Blender's automatic weights. The wings are
#      separate pieces of the model, so each is tied whole to its wing bone
#      and stays stiff.
#   4. Makes the wings pale and see-through. Meshy paints wings as solid
#      colour (dark green underneath, on this model). The wings get their own
#      material, and their part of the colour picture is repainted in one
#      pale colour, keeping the veins.
#   5. Writes the clips, one for each thing the mosquito does in the game
#      (its behaviour is Caputo Mountain's): hover, warning, dive, winded,
#      defeated. The wings beat fast, and the legs hang loose and swing late.
#      Every clip happens on the spot: the game moves the mosquito, and
#      points it along its dive.
#   6. Saves the result as a GLB with one animation per clip.

import importlib.util
import json
import math
import os
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Quaternion, Vector

# The shared steps live in the four-legged rig script.
_spec = importlib.util.spec_from_file_location('rig_quadruped', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rig-quadruped.py'))
quad = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(quad)

FPS = quad.FPS
say = quad.say
to_blender = quad.to_blender
pitch, yaw, roll, wave, smoothstep, keyed, bump = quad.pitch, quad.yaw, quad.roll, quad.wave, quad.smoothstep, quad.keyed, quad.bump


# ---------- 2: the skeleton ----------

def insect_plan(guide):
    """Every bone: name, head, tail, parent, and whether it bends the skin."""
    joints = guide['joints']
    point = lambda value: to_blender(value)
    body = [point(p) for p in joints['body']]
    plan = [('root', Vector((body[0].x, body[0].y, 0)), Vector((body[0].x, body[0].y - 0.25, 0)), None, False)]
    plan.append(('body', body[0], body[1], 'root', True))
    for name, parent in (('head', 'body'), ('beak', 'head')):
        low, high = [point(p) for p in joints[name]]
        plan.append((name, low, high, parent, True))
    abdomen = [point(p) for p in joints['abdomen']]
    for i in range(len(abdomen) - 1):
        plan.append((f'abdomen{i + 1}', abdomen[i], abdomen[i + 1], 'body' if i == 0 else f'abdomen{i}', True))
    for name, parent in (('antenna', 'head'), ('wing', 'body')):
        for side, letter in (('left', 'l'), ('right', 'r')):
            low, high = [point(p) for p in joints[f'{name}_{side}']]
            plan.append((f'{name}_{letter}', low, high, parent, True))
    for leg, chain in joints['legs'].items():
        points = [point(p) for p in chain]
        for i in range(len(points) - 1):
            plan.append((f'leg_{leg}_{i + 1}', points[i], points[i + 1], 'body' if i == 0 else f'leg_{leg}_{i}', True))
    return plan


# ---------- 3 and 4: the wings ----------

def wing_points(mesh, guide):
    """The points of each wing: the separate pieces of the model that lie out to one side of the body."""
    beyond = guide['wings']['beyond_across']
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bm.verts.ensure_lookup_table()
    seen = set()
    wings = {'l': set(), 'r': set()}
    for vert in bm.verts:
        if vert.index in seen:
            continue
        stack, piece = [vert], []
        seen.add(vert.index)
        while stack:
            at = stack.pop()
            piece.append(at)
            for edge in at.link_edges:
                other = edge.other_vert(at)
                if other.index not in seen:
                    seen.add(other.index)
                    stack.append(other)
        nearest = min(abs(v.co.x) for v in piece)
        middle = sum(v.co.x for v in piece) / len(piece)
        if nearest > beyond * 0.5 and abs(middle) > beyond and len(piece) > 50:
            wings['l' if middle > 0 else 'r'].update(v.index for v in piece)
    bm.free()
    if not wings['l'] or not wings['r']:
        raise SystemExit('Could not find two wings as separate pieces of the model. Check "wings" in the guide.')
    say(f"wings: {len(wings['l'])} points on the left, {len(wings['r'])} on the right")
    return wings


def stiffen_wings(mesh, wings):
    """Ties each wing whole to its own bone."""
    for letter, points in wings.items():
        for group in mesh.vertex_groups:
            group.remove(list(points))
        mesh.vertex_groups[f'wing_{letter}'].add(list(points), 1.0, 'REPLACE')


def clear_wings(mesh, wings, guide):
    """Gives the wings their own see-through material and repaints them pale, keeping the veins."""
    data = mesh.data
    both = wings['l'] | wings['r']
    first = data.materials[0]
    glass = first.copy()
    glass.name = 'wings'
    data.materials.append(glass)
    glass.blend_method = 'BLEND'
    glass.use_backface_culling = False
    shader = next(node for node in glass.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Alpha'].default_value = guide['wings']['see_through']
    shader.inputs['Roughness'].default_value = 0.35
    faces = [face for face in data.polygons if all(v in both for v in face.vertices)]
    for face in faces:
        face.material_index = 1

    image = next(node.image for node in first.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image)
    width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    # Which dots of the picture the wings are painted from.
    mask = np.zeros((height, width), dtype=bool)
    uv = data.uv_layers.active.data
    for face in faces:
        corners = np.array([uv[i].uv[:] for i in face.loop_indices]) * (width, height)
        for i in range(1, len(corners) - 1):
            a, b, c = corners[0], corners[i], corners[i + 1]
            x0, x1 = int(max(0, math.floor(min(a[0], b[0], c[0])) - 1)), int(min(width - 1, math.ceil(max(a[0], b[0], c[0])) + 1))
            y0, y1 = int(max(0, math.floor(min(a[1], b[1], c[1])) - 1)), int(min(height - 1, math.ceil(max(a[1], b[1], c[1])) + 1))
            ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1]
            px, py = xs + 0.5, ys + 0.5
            area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
            if abs(area) < 1e-9:
                continue
            w1 = ((px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1])) / area
            w2 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / area
            # A little over the edge, so no old colour shows along a seam.
            inside = (w1 >= -0.08) & (w2 >= -0.08) & (w1 + w2 <= 1.08)
            mask[y0:y1 + 1, x0:x1 + 1] |= inside
    # The veins are whatever is darker or lighter than the wing around it.
    light = pixels[:, :, :3].mean(axis=2)
    reach = 10
    padded = np.pad(light, reach, mode='edge')
    sums = padded.cumsum(axis=0).cumsum(axis=1)
    sums = np.pad(sums, ((1, 0), (1, 0)))
    size = 2 * reach + 1
    around = (sums[size:, size:] - sums[:-size, size:] - sums[size:, :-size] + sums[:-size, :-size]) / (size * size)
    detail = np.clip((light - around) / np.maximum(around, 0.08), -0.6, 0.3)
    colour = np.array(guide['wings']['colour'], dtype=np.float32)
    repainted = np.clip(colour[None, None, :] * (1 + 1.3 * detail[:, :, None]), 0, 1)
    pixels[:, :, :3][mask] = repainted[mask]
    image.pixels = pixels.ravel()
    # The saver takes a picture from its file, so the repainted one goes in a file.
    path = os.path.join(tempfile.mkdtemp(), 'colour.png')
    image.filepath_raw = path
    image.file_format = 'PNG'
    image.save()
    say(f"wings: {len(faces)} faces made see-through, {int(mask.sum())} dots of the picture repainted")


# ---------- 5: clips ----------

class Mosquito:
    """The mosquito's clips, written against the bones this script builds."""

    def __init__(self, armature, guide):
        self.armature = armature
        self.poser = quad.Poser(armature, {}, movable={'body'})
        names = [bone.name for bone in armature.data.bones]
        self.abdomen = sorted(name for name in names if name.startswith('abdomen'))
        self.legs = {}
        for name in sorted(names):
            if name.startswith('leg_'):
                self.legs.setdefault(name.rsplit('_', 1)[0], []).append(name)
        # Each leg swings a little later than the last, so they never move as one.
        self.late = {leg: 0.13 * i for i, leg in enumerate(sorted(self.legs))}

    def body(self, rise=0.0, nose=0.0, lean=0.0, turn=0.0, sway=0.0):
        """Moves the whole insect: metres up and to its left, and degrees nose up, left side down and turned left."""
        p = self.poser
        p.place('root')
        p.place('body', turn=roll(lean) @ yaw(turn) @ pitch(nose), move=Vector((sway, 0, rise)))

    def head(self, nod=0.0, turn=0.0, antennae=0.0, spread=0.0):
        p = self.poser
        p.place('head', turn=yaw(turn) @ pitch(nod))
        p.place('beak')
        p.place('antenna_l', turn=pitch(antennae) @ yaw(spread))
        p.place('antenna_r', turn=pitch(antennae) @ yaw(-spread))

    def tail(self, curl):
        """Curls the abdomen: `curl(i)` is how far part i tips up, in degrees (below zero it droops)."""
        for i, bone in enumerate(self.abdomen):
            self.poser.place(bone, turn=pitch(-curl(i)))

    def wings(self, raised, swept=0.0, twist=0.0):
        """Each wing lifted by `raised` degrees, swept back by `swept`, and twisted nose-down by `twist`."""
        p = self.poser
        p.place('wing_l', turn=yaw(swept) @ roll(-raised) @ pitch(-twist))
        p.place('wing_r', turn=yaw(-swept) @ roll(raised) @ pitch(-twist))

    def dangle(self, swing, tuck=0.0, trail=0.0, spread=0.0):
        """
        The legs. `swing(time)` is how far a leg swings back, in degrees, at
        `time`: each leg reads it a little later than the last, and each bone
        of a leg later again and wider, so they move like things that hang.
        `tuck` draws every leg up under the body, `trail` streams them out
        behind, and `spread` holds the side legs out from the body.
        """
        p = self.poser
        for leg, bones in self.legs.items():
            side = 1 if leg.endswith('_l') else -1 if leg.endswith('_r') else 0
            for i, bone in enumerate(bones):
                then = self.late[leg] + 0.09 * i
                back = swing(then) * (0.6 + 0.5 * i)
                if i == 0:
                    turn = roll(-side * spread) @ pitch(-back - trail + tuck * 0.5)
                else:
                    turn = pitch(-back * 0.6 - trail * 0.35 - tuck)
                p.place(bone, turn=turn)

    # ----- The clips. Each is a function from a share of the clip (0 to 1) to a pose. -----

    @staticmethod
    def beat(phase, beats, lift=24.0, width=38.0):
        """The wings' lift at `phase` of a clip that holds `beats` whole wingbeats."""
        return lift + width * wave(phase * beats)

    def hover(self, phase):
        # Hanging in the air: the wings a blur, the body bobbing, the abdomen
        # and the legs swinging under it.
        bob = wave(phase, 0.0)
        self.body(rise=0.035 * bob, nose=2.5 * wave(phase, 0.2), lean=2.0 * wave(phase * 2, 0.1), sway=0.012 * wave(phase, 0.6))
        self.head(nod=-2.0 * wave(phase, 0.35), antennae=5.0 * wave(phase * 2, 0.3), spread=3.0 * wave(phase, 0.1))
        self.tail(lambda i: -3.0 * (i + 1) * wave(phase, 0.3 + 0.08 * i))
        self.wings(self.beat(phase, 12), twist=10.0 * wave(phase * 12, 0.25))
        self.dangle(lambda then: 9.0 * wave(phase - then, 0.35))

    def warning(self, phase):
        # The warning before a dive: it draws its legs up, cocks its abdomen,
        # lowers its beak, and holds there with its wings racing.
        ready = smoothstep(phase / 0.45)
        tremble = smoothstep((phase - 0.45) / 0.1) * wave(phase * 10)
        self.body(rise=0.05 * ready + 0.006 * tremble, nose=-12.0 * ready, lean=1.5 * tremble)
        self.head(nod=-10.0 * ready, antennae=-22.0 * ready, spread=-6.0 * ready)
        self.tail(lambda i: 9.0 * ready * (1 + 0.5 * i))
        self.wings(self.beat(phase, 16, lift=30.0 + 10.0 * ready, width=30.0), twist=8.0 * wave(phase * 16, 0.25))
        self.dangle(lambda then: 6.0 * wave(phase * 2 - then, 0.35) * (1 - ready), tuck=38.0 * ready, spread=10.0 * ready)

    def dive(self, phase):
        # The dive: beak first, wings swept back and fluttering, legs and
        # abdomen streaming out behind.
        flutter = wave(phase * 8)
        self.body(nose=-4.0 + 1.0 * flutter, lean=2.0 * wave(phase * 2))
        self.head(nod=-6.0, antennae=-38.0, spread=-8.0)
        self.tail(lambda i: 6.0 + 2.0 * wave(phase * 2, 0.1 * i))
        self.wings(34.0 + 9.0 * flutter, swept=48.0, twist=6.0 * flutter)
        self.dangle(lambda then: 4.0 * wave(phase * 4 - then), trail=58.0, tuck=6.0)

    def winded(self, phase):
        # Spent after a dive: slow heavy wingbeats, sinking between them, head
        # and legs drooping.
        beats = 4
        sink = wave(phase * beats, 0.3)
        self.body(rise=-0.04 + 0.04 * sink, nose=-9.0 + 2.0 * sink, lean=3.0 * wave(phase, 0.2))
        self.head(nod=-16.0, antennae=24.0, spread=10.0)
        self.tail(lambda i: -7.0 * (i + 1) + 2.0 * sink)
        self.wings(self.beat(phase, beats, lift=6.0, width=46.0), twist=14.0 * wave(phase * beats, 0.25))
        self.dangle(lambda then: 12.0 * wave(phase * 2 - then, 0.4), tuck=-8.0)

    def defeated(self, phase):
        # Beaten: the wings stop, it curls up and rolls over. The game drops it.
        gone = smoothstep(phase / 0.35)
        over = keyed([(0.0, 0.0), (0.15, -14.0), (0.75, 172.0), (1.0, 180.0)], phase)
        self.body(rise=0.06 * math.sin(math.pi * min(1.0, phase / 0.4)), nose=16.0 * gone, lean=over)
        self.head(nod=-24.0 * gone, antennae=40.0 * gone, spread=14.0 * gone)
        self.tail(lambda i: -16.0 * gone * (1 + 0.4 * i))
        flap = (1 - gone) * 34.0 * wave(phase * 14)
        self.wings(20.0 + 46.0 * gone + flap, swept=38.0 * gone)
        self.dangle(lambda then: 10.0 * (1 - gone) * wave(phase * 3 - then), tuck=44.0 * gone, spread=-6.0 * gone)

    def clips(self):
        return [
            ('hover', self.hover, 1.0),
            ('warning', self.warning, 0.8),
            ('dive', self.dive, 0.5),
            ('winded', self.winded, 2.0),
            ('defeated', self.defeated, 0.8),
        ]

    def write(self):
        """Writes every clip into Blender, each on its own track so it is saved as its own animation."""
        armature = self.armature
        armature.animation_data_create()
        for name, pose, seconds in self.clips():
            action = bpy.data.actions.new(name)
            armature.animation_data.action = action
            frames = max(1, round(seconds * FPS))
            for frame in range(frames + 1):
                self.poser.begin()
                pose(frame / frames)
                self.poser.key(frame)
            for curve in action.fcurves:
                for point in curve.keyframe_points:
                    point.interpolation = 'LINEAR'
            armature.animation_data.action = None
            track = armature.animation_data.nla_tracks.new()
            track.name = name
            track.strips.new(name, 0, action)
            say(f"clip {name}: {frames / FPS:.2f} s")
        say('hover: 12 wingbeats a second. warning: 20 a second. winded: 2 a second')
        for bone in armature.pose.bones:
            bone.location = (0, 0, 0)
            bone.rotation_quaternion = (1, 0, 0, 0)


def main():
    arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(arguments) != 3:
        raise SystemExit('Usage: blender -b -P tools/rig-insect.py -- <source.glb> <rigged.glb> <guide.json>')
    source, out, guide_path = arguments
    with open(guide_path, encoding='utf8') as file:
        guide = json.load(file)

    mesh, armature = quad.open_model(source)
    if armature is not None:
        raise SystemExit('This file already has a skeleton. This script is for a model with none.')
    say(f"opened {source}: {len(mesh.data.vertices)} points")
    quad.straighten(mesh, None, guide.get('turned_left_degrees', 0))
    quad.merge_seams(mesh)
    quad.thin(mesh, guide.get('triangles'))
    wings = wing_points(mesh, guide)
    # The shared skeleton builder asks for a plan; give it the insect's.
    quad.skeleton_plan = insect_plan
    armature, added = quad.build_skeleton(guide, None)
    say(f"skeleton: {len(armature.data.bones)} bones")
    quad.skin(mesh, armature, added, False)
    stiffen_wings(mesh, wings)
    clear_wings(mesh, wings, guide)
    Mosquito(armature, guide).write()
    quad.save(out)
    say(f"saved {out}")


if __name__ == '__main__':
    main()
