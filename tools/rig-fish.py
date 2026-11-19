# Gives a fish a simple skeleton and its animation clips, in Blender, with no
# window. One script and one guide rig every fish of Cocolalla Lake (bass,
# perch, trout and pike), because every one was made the same way: seen from
# the side, straight from nose to tail, fins spread, mouth closed.
#
#   blender -b -P tools/rig-fish.py -- <source.glb> <rigged.glb> <guide.json> <name>
#
#   source.glb   the fish as it came from Meshy (the picked files are on the
#                hero-models release: bass-a, perch-a, trout-b, pike-a)
#   rigged.glb   where to save the rigged, animated fish. Run
#                `node tools/compress-hero.mjs <rigged.glb> <name> 512 fish`
#                on it next, and commit only what that makes.
#   guide.json   tools/fish.rig.json: how many triangles each fish keeps, and
#                where along its length each one bends
#   name         bass, perch, trout or pike
#
# Needs Blender 4 with its glTF add-on and numpy, as tools/rig-quadruped.py
# does. It borrows that script's steps for opening, tidying, skinning and
# saving a model, so the two files must stay side by side.
#
# What it does:
#   1. Opens the model, stands its lowest point on the ground, merges the
#      doubled points along the seams of its picture, and thins the mesh.
#   2. Finds which end is the head: the thicker end, seen from above. A fish's
#      tail end is a thin fin.
#   3. Builds the skeleton along the fish's middle line: a body, a head in
#      front of it, and a tail in four parts behind it. The joints are placed
#      by share of the fish's length, from the guide, so one guide fits a deep
#      bass and a long pike.
#   4. Skins the model with Blender's automatic weights. The fins have no
#      bones of their own: each follows the part of the body it grows from.
#   5. Writes the clips: idle (holding its place in the water), swim, thrash
#      (fighting the line) and flop (landed, lying on its side). Every clip
#      happens on the spot: the game moves the fish.
#   6. Saves the result as a GLB with one animation per clip.

import importlib.util
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

# The shared steps live in the four-legged rig script.
_spec = importlib.util.spec_from_file_location('rig_quadruped', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rig-quadruped.py'))
quad = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(quad)

FPS = quad.FPS
say = quad.say
pitch, yaw, roll, wave, smoothstep = quad.pitch, quad.yaw, quad.roll, quad.wave, quad.smoothstep


# ---------- 2: which end is the head ----------

def measure(mesh):
    """The fish's points in the guide's terms: across, up and forward, in metres, as the mesh lies now."""
    points = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
    # Blender's (x, y, z) is the guide's (across, -forward, up).
    return points[:, 0], points[:, 2], -points[:, 1]


def face_forward(mesh):
    """Turns the fish half way round if its tail is where its head should be. The head end is the thicker one, seen from above."""
    across, _, forward = measure(mesh)
    low, high = forward.min(), forward.max()
    length = high - low
    front = np.abs(across[forward > high - 0.18 * length]).mean()
    back = np.abs(across[forward < low + 0.18 * length]).mean()
    say(f"thickness at the ends: {front:.3f} m in front, {back:.3f} m behind")
    if front >= back:
        return False
    mesh.rotation_euler.z += math.pi
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    say('the fish was tail first: turned half way round')
    return True


# ---------- 3: the skeleton ----------

def fish_plan(guide):
    """Every bone: name, head, tail, parent, and whether it bends the skin. `guide['line']` is the middle line worked out in main."""
    line = guide['line']
    at = lambda share: Vector(line(share))
    bends = guide['bends']
    middle = at(bends['body'][0])
    plan = [('root', Vector((0, middle.y, 0)), Vector((0, middle.y - 0.25, 0)), None, False)]
    # The body runs back from the gills; the head is in front of it, the tail behind.
    plan.append(('body', at(bends['body'][0]), at(bends['body'][1]), 'root', True))
    plan.append(('head', at(bends['body'][0]), at(0.0), 'body', True))
    tail = [bends['body'][1]] + bends['tail'] + [1.0]
    for i in range(len(tail) - 1):
        plan.append((f'tail{i + 1}', at(tail[i]), at(tail[i + 1]), 'body' if i == 0 else f'tail{i}', True))
    return plan


def middle_line(mesh):
    """A function from a share of the fish's length (0 at the nose, 1 at the tail's end) to the middle of the fish there, in Blender's space."""
    across, up, forward = measure(mesh)
    nose, end = forward.max(), forward.min()
    length = nose - end

    def at(share):
        where = nose - share * length
        near = np.abs(forward - where) < 0.04 * length
        height = (up[near].min() + up[near].max()) / 2 if near.any() else (up.min() + up.max()) / 2
        return (0.0, -where, float(height))

    return at, length


# ---------- 5: clips ----------

class Fish:
    """A fish's clips, written against the bones this script builds."""

    def __init__(self, armature):
        self.armature = armature
        self.poser = quad.Poser(armature, {}, movable={'body'})
        self.tail = sorted(bone.name for bone in armature.data.bones if bone.name.startswith('tail'))

    def pose(self, bend, head=0.0, turn=0.0, lean=0.0, nose=0.0, rise=0.0, sway=0.0):
        """
        `bend(i)` is how far tail part i swings to the fish's left, in degrees,
        on top of the part before it. `head` swings the head, `turn`, `lean`
        and `nose` turn the whole fish, `rise` and `sway` move it, in metres.
        """
        p = self.poser
        p.place('root')
        p.place('body', turn=yaw(turn) @ roll(lean) @ pitch(nose), move=Vector((sway, 0, rise)))
        p.place('head', turn=yaw(head))
        for i, bone in enumerate(self.tail):
            p.place(bone, turn=yaw(bend(i)))

    # ----- Each clip is a function from a share of the clip (0 to 1) to a pose. -----

    def idle(self, phase):
        # Holding its place: a slow wave down the tail, the head barely moving.
        self.pose(lambda i: (3.0 + 3.0 * i) * wave(phase - 0.11 * i), head=-2.0 * wave(phase, 0.1), turn=1.5 * wave(phase, 0.05), rise=0.01 * wave(phase * 2))

    def swim(self, phase):
        # Swimming: the wave runs down the body and grows toward the tail fin, and the head swings the other way.
        self.pose(lambda i: (7.0 + 6.0 * i) * wave(phase - 0.14 * i), head=-6.0 * wave(phase, 0.08), turn=4.0 * wave(phase, 0.05), sway=0.012 * wave(phase, 0.3))

    def thrash(self, phase):
        # Fighting the line: three hard beats, the whole fish rolling and its head shaking.
        beats = 3
        self.pose(
            lambda i: (16.0 + 9.0 * i) * wave(phase * beats - 0.12 * i),
            head=-16.0 * wave(phase * beats, 0.06),
            turn=10.0 * wave(phase * beats, 0.05),
            lean=26.0 * wave(phase, 0.2) + 10.0 * wave(phase * beats, 0.3),
            nose=8.0 * wave(phase * 2, 0.1),
            rise=0.03 * wave(phase * beats, 0.4),
        )

    def flop(self, phase):
        # Landed: on its side on the boards, tail slapping twice, then a rest.
        slap = wave(phase * 4) * (1 - smoothstep((phase - 0.5) / 0.15))
        gasp = wave(phase * 2, 0.2)
        self.pose(lambda i: (10.0 + 11.0 * i) * slap + 3.0 * gasp, head=-7.0 * slap, lean=90.0, rise=0.02 * max(0.0, slap))

    def clips(self):
        return [('idle', self.idle, 2.0), ('swim', self.swim, 0.8), ('thrash', self.thrash, 0.9), ('flop', self.flop, 1.6)]

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
        for bone in armature.pose.bones:
            bone.location = (0, 0, 0)
            bone.rotation_quaternion = (1, 0, 0, 0)


def main():
    arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(arguments) != 4:
        raise SystemExit('Usage: blender -b -P tools/rig-fish.py -- <source.glb> <rigged.glb> <guide.json> <name>')
    source, out, guide_path, name = arguments
    with open(guide_path, encoding='utf8') as file:
        guide = json.load(file)
    if name not in guide['fish']:
        raise SystemExit(f"The guide has no fish called {name}. It has: {', '.join(guide['fish'])}")
    fish = {**guide['fish'][name]}

    mesh, armature = quad.open_model(source)
    if armature is not None:
        raise SystemExit('This file already has a skeleton. This script is for a model with none.')
    say(f"opened {source}: {len(mesh.data.vertices)} points")
    quad.straighten(mesh, None, 0)
    face_forward(mesh)
    quad.merge_seams(mesh)
    quad.thin(mesh, fish['triangles'])
    line, length = middle_line(mesh)
    say(f"{name}: {length:.2f} m from nose to tail as it came")
    plan_guide = {'line': line, 'bends': {'body': fish.get('body', guide['bends']['body']), 'tail': fish.get('tail', guide['bends']['tail'])}}
    # The shared skeleton builder asks for a plan; give it the fish's.
    quad.skeleton_plan = fish_plan
    armature, added = quad.build_skeleton(plan_guide, None)
    say(f"skeleton: {len(armature.data.bones)} bones")
    quad.skin(mesh, armature, added, False)
    Fish(armature).write()
    quad.save(out)
    say(f"saved {out}")


if __name__ == '__main__':
    main()
