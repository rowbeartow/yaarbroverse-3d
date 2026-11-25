# Gives Walblum the muskrat a skeleton and his animation clips, in Blender,
# with no window. Meshy's own rigging could not be reached from the session
# that made this (no key in its environment), so he is rigged here, the way
# Caputo and the enemies are.
#
#   blender -b -P tools/rig-walblum.py -- <walblum-b.glb> <rigged.glb> tools/walblum.rig.json
#
#   walblum-b.glb   the kids' pick, from the hero-models release. Never make
#                   him again. Download it to a scratch folder, not the repo.
#   rigged.glb      where to save him rigged. Run
#                   `node tools/compress-hero.mjs <rigged.glb> walblum 512 heroes`
#                   on it next, and commit only what that makes.
#
# Needs Blender 4 with its glTF add-on and numpy. It borrows the four-legged
# rig script's steps for opening, tidying, skinning and saving a model, so the
# two files must stay side by side.
#
# What it does:
#   1. Opens the model, stands it on the ground and merges the doubled points
#      along the seams of its picture.
#   2. Lays his whiskers out level: they hang down in the model as it came.
#   3. Thins the mesh: he is small on the screen.
#   4. Builds an upright skeleton from the guide's joints: hips, chest, head,
#      two arms of three bones, two legs of two, and a tail of three. The
#      right side mirrors the left.
#   5. Skins the model with Blender's automatic weights.
#   6. Writes the clips: idle; kick (a flying karate kick, one leg straight
#      out in front) and tumble (heels over head, the way back) for Yaarbro's
#      second move; scared, paddle and cheer for his rescue. Every clip
#      happens on the spot: the game moves him.
#   7. Saves the result as a GLB with one animation per clip.

import importlib.util
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Quaternion, Vector

_spec = importlib.util.spec_from_file_location('rig_quadruped', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rig-quadruped.py'))
quad = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(quad)

FPS = quad.FPS
say = quad.say
pitch, yaw, roll, wave, smoothstep, keyed, to_blender = quad.pitch, quad.yaw, quad.roll, quad.wave, quad.smoothstep, quad.keyed, quad.to_blender


# ---------- 2: the whiskers ----------

def level_whiskers(mesh, spec):
    """Lifts each whisker as if it turned up about its root, so it runs level and no longer hangs."""
    low, high = spec['between']
    slope = math.tan(math.radians(spec['lift_degrees']))
    moved = 0
    for vertex in mesh.data.vertices:
        across, forward, up = vertex.co.x, -vertex.co.y, vertex.co.z
        out = abs(across) - spec['from']
        if out <= 0 or forward < spec['forward_of'] or not low < up < high:
            continue
        vertex.co.z += slope * out
        moved += 1
    mesh.data.update()
    say(f"whiskers laid out level: {moved} points lifted")


# ---------- 4: the skeleton ----------

def mirrored(points):
    return [[-across, up, forward] for across, up, forward in points]


def walblum_plan(guide):
    """Every bone: name, head, tail, parent, and whether it bends the skin."""
    joints = guide['joints']
    spine = [to_blender(p) for p in joints['spine']]
    plan = [('root', Vector((0, spine[0].y, 0)), Vector((0, spine[0].y - 0.25, 0)), None, False)]
    plan.append(('hips', spine[0], spine[1], 'root', True))
    plan.append(('chest', spine[1], spine[2], 'hips', True))
    plan.append(('head', spine[2], spine[3], 'chest', True))
    for letter, points in (('l', joints['arm_left']), ('r', mirrored(joints['arm_left']))):
        arm = [to_blender(p) for p in points]
        plan.append((f'arm_upper_{letter}', arm[0], arm[1], 'chest', True))
        plan.append((f'arm_lower_{letter}', arm[1], arm[2], f'arm_upper_{letter}', True))
        plan.append((f'hand_{letter}', arm[2], arm[3], f'arm_lower_{letter}', True))
    for letter, points in (('l', joints['leg_left']), ('r', mirrored(joints['leg_left']))):
        leg = [to_blender(p) for p in points]
        plan.append((f'leg_{letter}', leg[0], leg[1], 'hips', True))
        plan.append((f'foot_{letter}', leg[1], leg[2], f'leg_{letter}', True))
    tail = [to_blender(p) for p in joints['tail']]
    for i in range(len(tail) - 1):
        plan.append((f'tail{i + 1}', tail[i], tail[i + 1], 'hips' if i == 0 else f'tail{i}', True))
    return plan


# ---------- 6: clips ----------

class Walblum:
    """His clips, written against the bones this script builds."""

    def __init__(self, armature, guide):
        self.armature = armature
        self.guide = guide
        self.poser = quad.Poser(armature, {}, movable={'hips'})

    def turn(self, bone, by, move=None):
        """Turns a bone by `by` in the space its parents have carried it to, so 'forward' stays his forward however his body lies."""
        p = self.poser
        carried = p.carried(bone).to_3x3() @ p.rest[bone].to_3x3().inverted()
        q = carried.to_quaternion()
        p.place(bone, turn=q @ by @ q.inverted(), move=move)

    def body(self, lean=0.0, twist=0.0, tip=0.0, rise=0.0, forward=0.0, chest=0.0, chest_twist=0.0, nod=0.0, look=0.0, cock=0.0):
        """The trunk: `lean` tips him back (nose up), `twist` turns him to his left, `tip` leans him to his left side, `rise` lifts him. The chest bends forward by `chest`; the head nods down by `nod`, looks left by `look` and cocks by `cock`."""
        p = self.poser
        p.place('root')
        p.place('hips', turn=yaw(twist) @ pitch(lean) @ roll(tip), move=Vector((0, -forward, rise)))
        self.turn('chest', yaw(chest_twist) @ pitch(-chest))
        self.turn('head', yaw(look) @ pitch(-nod) @ roll(cock))

    def arm(self, side, up=0.0, forward=0.0, bend=0.0, twist=0.0, hand=0.0):
        """One arm, from held straight out to his side: `up` lifts it, `forward` swings it to the front, `bend` folds the elbow forward, `hand` curls the hand."""
        sign = 1 if side == 'l' else -1
        self.turn(f'arm_upper_{side}', yaw(-sign * forward) @ roll(-sign * up) @ Quaternion((sign, 0, 0), math.radians(twist)))
        self.turn(f'arm_lower_{side}', yaw(-sign * bend))
        self.turn(f'hand_{side}', yaw(-sign * hand))

    def leg(self, side, forward=0.0, out=0.0, toes=0.0):
        """One leg, from standing: `forward` kicks it to the front, `out` spreads it to its own side, `toes` lifts the toes."""
        sign = 1 if side == 'l' else -1
        self.turn(f'leg_{side}', pitch(forward) @ roll(-sign * out))
        self.turn(f'foot_{side}', pitch(toes))

    def tail(self, lift=0.0, sway=0.0):
        for i in (1, 2, 3):
            self.turn(f'tail{i}', pitch(lift * (0.6 if i == 1 else 0.3)) @ yaw(sway * (0.3 + 0.25 * i)))

    # ----- Each clip is a function from a share of the clip (0 to 1) to a pose. -----

    def idle(self, phase):
        breath = wave(phase)
        self.body(rise=0.006 * breath, chest=1.5 * breath, nod=2 + 2 * wave(phase, 0.2), look=5 * wave(phase * 0.5, 0.1))
        for side in 'lr':
            self.arm(side, up=-52 + 2 * breath, forward=18, bend=35, hand=10)
            self.leg(side)
        self.tail(sway=6 * wave(phase, 0.3))

    def kick(self, phase):
        # A flying karate kick: he lies back, the right leg straight out ahead, the left tucked under,
        # one fist forward and one drawn back to the hip. A small shake keeps it alive.
        shake = wave(phase * 2)
        self.body(lean=58 + 3 * shake, twist=-14, tip=6, rise=0.25, chest=22, chest_twist=10, nod=30, look=8)
        self.leg('r', forward=24 + 2 * shake, toes=-28)
        self.leg('l', forward=112, out=14, toes=30)
        self.arm('r', up=-18, forward=74, bend=18, hand=30)
        self.arm('l', up=-46, forward=-8, bend=96, hand=40)
        self.tail(lift=-26 + 6 * shake, sway=10 * wave(phase))

    def tumble(self, phase):
        # The way back: heels over head, once a clip, curled a little with the arms and legs flung out.
        p = self.poser
        p.place('root')
        spin = Quaternion((1, 0, 0), -math.tau * phase)
        # About his middle, not his hips: the hips ride round it.
        middle = Vector((0, 0, 0.45))
        swung = spin @ (-middle) + middle
        p.place('hips', turn=spin, move=swung + Vector((0, 0, 0.25)))
        self.turn('chest', pitch(-24))
        self.turn('head', pitch(-20))
        flap = wave(phase * 2)
        for side in 'lr':
            self.arm(side, up=18 + 10 * flap, forward=24, bend=30, hand=20)
            self.leg(side, forward=58, out=26 + 6 * flap, toes=20)
        self.tail(lift=-18, sway=18 * wave(phase))

    def scared(self, phase):
        # On his log with pike about: crouched low, arms hugged in, trembling, his head darting from side to side.
        tremble = wave(phase * 9)
        dart = keyed([(0.0, -32.0), (0.2, -32.0), (0.3, 30.0), (0.55, 30.0), (0.65, -10.0), (0.8, -10.0), (1.0, -32.0)], phase)
        self.body(lean=-16, rise=-0.12 + 0.004 * tremble, chest=20 + 1.5 * tremble, nod=-12, look=dart, cock=3 * tremble)
        for side in 'lr':
            self.arm(side, up=-30 + 3 * tremble, forward=70, bend=118, hand=40)
            self.leg(side, forward=58, out=10, toes=40)
        self.tail(lift=10, sway=5 * tremble)

    def paddle(self, phase):
        # Lying along his log on his belly, paddling with his arms in turn, his head up and looking where he is going.
        self.body(lean=-74, rise=-0.3, chest=-10, nod=-58, twist=5 * wave(phase), look=-4 * wave(phase))
        for side, offset in (('l', 0.0), ('r', 0.5)):
            stroke = wave(phase + offset)
            lift = wave(phase + offset, 0.25)
            self.arm(side, up=-34 + 30 * max(0.0, lift), forward=58 + 40 * stroke, bend=26 + 16 * max(0.0, lift), hand=18)
            self.leg(side, forward=-18 + 8 * wave(phase + offset + 0.25), out=14, toes=-40)
        self.tail(lift=-8, sway=20 * wave(phase))

    def cheer(self, phase):
        # Safe on the boards: two hops with both arms thrown up and waving.
        hop = max(0.0, math.sin(math.tau * phase * 2))
        crouch = max(0.0, -math.sin(math.tau * phase * 2))
        swing = wave(phase * 2, 0.1)
        self.body(lean=4 * hop, rise=0.16 * hop - 0.05 * crouch, chest=-6 * hop + 8 * crouch, nod=-12 * hop, look=6 * swing, cock=5 * swing)
        for side in 'lr':
            sign = 1 if side == 'l' else -1
            self.arm(side, up=58 + 14 * hop + 9 * swing * sign, forward=12, bend=14 + 18 * crouch, hand=16 * swing)
            self.leg(side, forward=12 * hop + 34 * crouch, out=8 * hop, toes=-24 * hop + 30 * crouch)
        self.tail(lift=-14 * hop, sway=12 * swing)

    def write(self):
        """Writes every clip into Blender, each on its own track so it is saved as its own animation."""
        armature = self.armature
        armature.animation_data_create()
        for name, seconds in self.guide['clips'].items():
            pose = getattr(self, name)
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
    if len(arguments) != 3:
        raise SystemExit('Usage: blender -b -P tools/rig-walblum.py -- <walblum-b.glb> <rigged.glb> tools/walblum.rig.json')
    source, out, guide_path = arguments
    with open(guide_path, encoding='utf8') as file:
        guide = json.load(file)
    mesh, armature = quad.open_model(source)
    if armature is not None:
        raise SystemExit('This file already has a skeleton. This script is for the model as it came.')
    say(f"opened {source}: {len(mesh.data.vertices)} points")
    quad.straighten(mesh, None, 0)
    quad.merge_seams(mesh)
    level_whiskers(mesh, guide['whiskers'])
    quad.thin(mesh, guide['triangles'])
    quad.skeleton_plan = walblum_plan
    armature, added = quad.build_skeleton(guide, None)
    say(f"skeleton: {len(armature.data.bones)} bones")
    quad.skin(mesh, armature, added, False)
    Walblum(armature, guide).write()
    quad.save(out)
    say(f"saved {out}")


if __name__ == '__main__':
    main()
