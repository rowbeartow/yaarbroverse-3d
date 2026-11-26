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
#   5. For a fish whose entry in the guide has a "jaw" (the pike, which the
#      monster pike is drawn from): cuts the mouth open along the line of the
#      closed lips, gives the lower jaw a bone of its own, and closes the
#      inside of the mouth with dark faces, so nothing shows through when it
#      opens. This comes after the skinning, so every other weight is as it
#      was and the first four clips move the fish exactly as before.
#   6. Writes the clips: idle (holding its place in the water), swim, thrash
#      (fighting the line) and flop (landed, lying on its side); and for a
#      fish with a jaw gape (the tell: jaws wide, held), snap (the bite) and
#      beaten (belly up and limp). Every clip happens on the spot: the game
#      moves the fish.
#   7. Saves the result as a GLB with one animation per clip.

import importlib.util
import json
import math
import os
import sys

import bmesh
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
keyed = quad.keyed


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


# ---------- 5: a mouth that opens ----------

def free_patch(mesh, cells=256):
    """A square of the model's picture that no triangle uses, as (u, v, size) in shares of the picture, the biggest of a few sizes tried."""
    layer = mesh.data.uv_layers.active.data
    uv = np.zeros(len(layer) * 2)
    layer.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2) % 1.0
    used = np.zeros((cells, cells), bool)
    mesh.data.calc_loop_triangles()
    for triangle in mesh.data.loop_triangles:
        corners = uv[list(triangle.loops)] * cells
        low = np.clip(np.floor(corners.min(axis=0)).astype(int) - 1, 0, cells - 1)
        high = np.clip(np.ceil(corners.max(axis=0)).astype(int) + 1, 0, cells - 1)
        used[low[1]:high[1] + 1, low[0]:high[0] + 1] = True
    total = np.zeros((cells + 1, cells + 1), int)
    total[1:, 1:] = used.cumsum(axis=0).cumsum(axis=1)
    for side in (12, 10, 8, 6, 4):
        inside = total[side:, side:] - total[:-side, side:] - total[side:, :-side] + total[:-side, :-side]
        rows, columns = np.nonzero(inside == 0)
        if len(rows):
            return columns[0] / cells, rows[0] / cells, side / cells
    raise SystemExit("The model's picture has no empty corner to paint the inside of the mouth on.")


def paint_patch(mesh, patch, throat, lips):
    """Paints the patch of the picture: `throat` colour at its low edge easing to `lips` at its high edge. Colours are (red, green, blue), 0 to 1, as they look."""
    u, v, size = patch
    for material in mesh.data.materials:
        for node in material.node_tree.nodes:
            # Only the colour picture: the others are left as they came.
            if node.type != 'TEX_IMAGE' or not node.image or node.image.colorspace_settings.name != 'sRGB':
                continue
            image = node.image
            width, height = image.size
            pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, -1)
            x0, x1 = round(u * width), round((u + size) * width)
            y0, y1 = round(v * height), round((v + size) * height)
            share = np.linspace(0.0, 1.0, y1 - y0)[:, None, None]
            pixels[y0:y1, x0:x1, :3] = np.array(throat)[None, None, :] * (1 - share) + np.array(lips)[None, None, :] * share
            image.pixels[:] = pixels.ravel()
            image.update()
            say(f"painted the inside of the mouth on the picture: {x1 - x0} by {y1 - y0} pixels at ({x0}, {y0}) of {width}")


def open_mouth(mesh, armature, jaw, nose, length):
    """
    Cuts the mouth open along the line of the closed lips and gives the lower
    jaw to a new `jaw` bone, hinged at the corner of the mouth. `jaw['mouth']`
    is that line, corner first then the front of the lips, each as [share of
    the fish's length from its nose, metres up from the ground as it came].

    The skin is cut along the line, round the snout from one corner of the
    mouth to the other. Each jaw is then closed with a shallow dark bowl, the
    roof of the mouth and its floor, so the mouth is never see-through. Points
    below the line go to the jaw bone; just behind the corner the jaw lets go
    over `lets_go` metres, so the skin of the cheek stretches and does not tear.
    """
    (back_share, back_up), (front_share, front_up) = jaw['mouth']
    back = Vector((0.0, -(nose - back_share * length), back_up))
    front = Vector((0.0, -(nose - front_share * length), front_up))
    along = (front - back).normalized()
    upward = Vector((1, 0, 0)).cross(along)
    if upward.z < 0:
        upward = -upward
    lets_go = jaw.get('lets_go', 0.06)
    depth = jaw.get('depth', 0.02)

    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='EDIT')
    bone = armature.data.edit_bones.new('jaw')
    bone.head = back
    bone.tail = front - upward * jaw.get('chin', 0.03)
    bone.parent = armature.data.edit_bones['head']
    bone.use_connect = False
    bone.use_deform = True
    bone.align_roll(Vector((0, 0, 1)))
    bpy.ops.object.mode_set(mode='OBJECT')
    group = mesh.vertex_groups.new(name='jaw').index

    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    weights = bm.verts.layers.deform.verify()
    picture = bm.loops.layers.uv.verify()
    before = sum(len(face.verts) - 2 for face in bm.faces)

    # The cut: only the snout, ahead of the corner of the mouth.
    ahead = lambda vert: vert.co.y < back.y
    geometry = [v for v in bm.verts if ahead(v)]
    geometry += [e for e in bm.edges if all(ahead(v) for v in e.verts)]
    geometry += [f for f in bm.faces if all(ahead(v) for v in f.verts)]
    cut = bmesh.ops.bisect_plane(bm, geom=geometry, dist=1e-6, plane_co=back, plane_no=upward)
    height = lambda point: (point - back).dot(upward)
    # The cut makes a point on every edge it crosses, far more than the lips need: merge the ones close together.
    bmesh.ops.remove_doubles(bm, verts=[item for item in cut['geom_cut'] if isinstance(item, bmesh.types.BMVert)], dist=jaw.get('lip_step', 0.012))
    lips = [e for e in bm.edges if all(ahead(v) and abs(height(v.co)) < 1e-5 for v in e.verts)]
    bmesh.ops.split_edges(bm, edges=lips)

    def rim(above):
        """The open edge of one jaw, as points in order from one corner of the mouth round the snout to the other."""
        edges = [e for e in bm.edges if e.is_boundary and ahead(e.verts[0]) and ahead(e.verts[1]) and (height(e.link_faces[0].calc_center_median()) > 0) == above]
        beside = {}
        for edge in edges:
            for a, b in (edge.verts, reversed(edge.verts)):
                beside.setdefault(a, []).append(b)
        ends = [v for v, others in beside.items() if len(others) == 1]
        best = []
        for start in ends:
            path, seen = [start], {start}
            while True:
                onward = [v for v in beside[path[-1]] if v not in seen]
                if not onward:
                    break
                path.append(onward[0])
                seen.add(onward[0])
            if len(path) > len(best):
                best = path
        if len(best) < 8:
            raise SystemExit('The cut along the mouth did not make one open edge round the snout. Check "mouth" in the guide.')
        return best

    patch = free_patch(mesh)
    faces_made = []
    floor = set()
    for above in (True, False):
        path = rim(above)
        into = upward if above else -upward
        middle = sum((v.co for v in path), Vector()) / len(path)
        # The lip, a ring part way in and sunk into the jaw, and the middle of the bowl.
        lip = [bm.verts.new(v.co, v) for v in path]
        ring = [bm.verts.new(v.co.lerp(middle, 0.4) + into * depth, v) for v in path]
        centre = bm.verts.new(middle + into * depth, path[len(path) // 2])
        count = len(path)
        made = []
        for i in range(count):
            j = (i + 1) % count
            made.append(bm.faces.new((lip[i], lip[j], ring[j], ring[i])))
            made.append(bm.faces.new((ring[i], ring[j], centre)))
        for face in made:
            face.normal_update()
            # The roof of the mouth faces down, its floor up.
            if face.normal.dot(into) > 0:
                face.normal_flip()
            face.smooth = True
            face.material_index = 0
            for loop in face.loops:
                # Where on the painted patch: across it by side, and from the throat (dark) to the lips.
                across = 0.5 + 0.3 * max(-1.0, min(1.0, loop.vert.co.x / 0.08))
                forward = 0.2 + 0.6 * max(0.0, min(1.0, (back.y - loop.vert.co.y) / (back.y - front.y)))
                loop[picture].uv = (patch[0] + patch[2] * across, patch[1] + patch[2] * forward)
        faces_made += made
        if not above:
            floor.update(lip + ring + [centre])

    # Weights: everything below the line of the mouth, ahead of where the jaw lets go, follows the jaw.
    made_verts = {v for face in faces_made for v in face.verts}
    moved = 0
    for vert in bm.verts:
        reach = smoothstep((back.y + lets_go - vert.co.y) / lets_go)
        if reach <= 0.0:
            continue
        if vert in made_verts:
            # A bowl belongs to the jaw whose rim it was made from.
            below = vert in floor
        elif abs(height(vert.co)) > 1e-4:
            below = height(vert.co) < 0
        else:
            # A point on the cut itself: the side its faces are on.
            below = sum(height(face.calc_center_median()) for face in vert.link_faces) < 0
        if not below:
            continue
        own = vert[weights]
        for index in list(own.keys()):
            own[index] *= 1 - reach
        own[group] = reach
        moved += 1
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()
    paint_patch(mesh, patch, jaw.get('throat', [0.1, 0.02, 0.03]), jaw.get('inside', [0.5, 0.2, 0.2]))
    mesh.data.calc_loop_triangles()
    say(f"mouth: cut along the lips and closed inside; {moved} points follow the jaw; {before} triangles -> {len(mesh.data.loop_triangles)}")


# ---------- 6: clips ----------

class Fish:
    """A fish's clips, written against the bones this script builds."""

    def __init__(self, armature):
        self.armature = armature
        self.poser = quad.Poser(armature, {}, movable={'body'})
        self.tail = sorted(bone.name for bone in armature.data.bones if bone.name.startswith('tail'))
        self.has_jaw = 'jaw' in armature.data.bones

    def pose(self, bend, head=0.0, turn=0.0, lean=0.0, nose=0.0, rise=0.0, sway=0.0, lift=0.0, jaw=0.0, forward=0.0, droop=0.0):
        """
        `bend(i)` is how far tail part i swings to the fish's left, in degrees,
        on top of the part before it. `head` swings the head, `turn`, `lean`
        and `nose` turn the whole fish, `rise` and `sway` move it, in metres.
        For a fish with a jaw: `lift` tips the head up, `jaw` opens the lower
        jaw, both in degrees, `forward` moves the fish ahead, in metres, and
        `droop` lets each part of the tail hang, in degrees.
        """
        p = self.poser
        p.place('root')
        p.place('body', turn=yaw(turn) @ roll(lean) @ pitch(nose), move=Vector((sway, -forward, rise)))
        p.place('head', turn=yaw(head) @ pitch(lift) if lift else yaw(head))
        for i, bone in enumerate(self.tail):
            p.place(bone, turn=yaw(bend(i)) @ pitch(droop) if droop else yaw(bend(i)))
        if self.has_jaw:
            p.place('jaw', turn=pitch(-jaw))

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

    # ----- A fish with a jaw (the pike, for the monster pike's fight) -----

    GAPE_SECONDS = 1.0
    # The jaws are wide from this share of the gape on, and the clip's last pose is the pose here: the game holds
    # the tell as long as it likes by playing from here to the end again and again.
    GAPE_HELD_FROM = 0.3
    GAPE = {'lift': 16.0, 'jaw': 44.0, 'nose': 7.0, 'rise': 0.03}

    def gape(self, phase):
        """The tell: the head lifts and the jaws open wide, and stay wide with a slight shudder."""
        wide = smoothstep(phase / self.GAPE_HELD_FROM)
        held = max(0.0, (phase - self.GAPE_HELD_FROM) / (1 - self.GAPE_HELD_FROM))
        # Seven shudders in the held part, so its end meets its start.
        shudder = math.sin(quad.TAU * 7 * held) if held > 0 else 0.0
        slow = math.sin(quad.TAU * held) if held > 0 else 0.0
        g = self.GAPE
        self.pose(
            lambda i: (3.0 + 3.0 * i) * wave(phase * 2 - 0.11 * i) * (1 - 0.5 * wide) + 1.5 * shudder,
            head=1.6 * shudder,
            lift=g['lift'] * wide + 0.8 * slow,
            jaw=g['jaw'] * wide + 1.6 * shudder,
            nose=g['nose'] * wide,
            rise=g['rise'] * wide,
            turn=0.6 * shudder,
        )

    SNAP_SECONDS = 0.8
    SNAP_AT = 0.375  # of the clip: 0.3 s in

    def snap(self, phase):
        """The bite: from the gape the jaws draw wider still, snap shut hard with the head thrown forward and down, and ease back."""
        g = self.GAPE
        at = self.SNAP_AT
        jaw = keyed([(0.0, g['jaw']), (at - 0.11, g['jaw'] + 8.0), (at - 0.05, g['jaw'] + 6.0), (at, 0.0), (at + 0.07, 5.0), (at + 0.14, 0.0), (1.0, 0.0)], phase)
        lift = keyed([(0.0, g['lift']), (at - 0.1, g['lift'] + 8.0), (at, -10.0), (at + 0.2, -4.0), (1.0, 0.0)], phase)
        nose = keyed([(0.0, g['nose']), (at - 0.1, g['nose'] + 4.0), (at, -6.0), (at + 0.25, -2.0), (1.0, 0.0)], phase)
        lunge = keyed([(0.0, 0.0), (at - 0.1, -0.04), (at, 0.09), (at + 0.2, 0.06), (1.0, 0.0)], phase)
        rise = keyed([(0.0, g['rise']), (at, -0.01), (1.0, 0.0)], phase)
        whip = keyed([(0.0, 0.0), (at - 0.1, 1.0), (at + 0.02, -1.0), (at + 0.25, 0.3), (1.0, 0.0)], phase)
        self.pose(lambda i: (5.0 + 7.0 * i) * whip, head=-3.0 * whip, lift=lift, jaw=jaw, nose=nose, rise=rise, forward=lunge)

    BEATEN_SECONDS = 1.6

    def beaten(self, phase):
        """Beaten: a last shiver, then it rolls belly up and goes limp, jaw slack. It holds its last pose; the game lets it sink."""
        over = 180.0 * quad.smootherstep((phase - 0.08) / 0.62)
        limp = smoothstep((phase - 0.3) / 0.6)
        shiver = math.sin(quad.TAU * 6 * phase) * (1 - smoothstep(phase / 0.35))
        self.pose(
            lambda i: (8.0 + 5.0 * i) * shiver + (4.0 + 3.0 * i) * limp,
            head=-5.0 * shiver - 4.0 * limp,
            lean=over,
            jaw=14.0 * smoothstep(phase / 0.5),
            lift=-3.0 * limp,
            droop=-4.0 * limp,
            rise=0.03 * math.sin(math.pi * min(1.0, phase / 0.7)),
        )

    def clips(self):
        clips = [('idle', self.idle, 2.0), ('swim', self.swim, 0.8), ('thrash', self.thrash, 0.9), ('flop', self.flop, 1.6)]
        if self.has_jaw:
            clips += [('gape', self.gape, self.GAPE_SECONDS), ('snap', self.snap, self.SNAP_SECONDS), ('beaten', self.beaten, self.BEATEN_SECONDS)]
        return clips

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
        if self.has_jaw:
            say(f"gape: the jaws are wide, and the held part starts, {self.GAPE_HELD_FROM * self.GAPE_SECONDS:.2f} s in; snap: the jaws shut {self.SNAP_AT * self.SNAP_SECONDS:.2f} s in")
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
    # A mouth that opens takes some triangles of its own (the cut, and the inside): leave room for them.
    quad.thin(mesh, fish['triangles'] - fish.get('jaw', {}).get('triangles', 0))
    line, length = middle_line(mesh)
    say(f"{name}: {length:.2f} m from nose to tail as it came")
    plan_guide = {'line': line, 'bends': {'body': fish.get('body', guide['bends']['body']), 'tail': fish.get('tail', guide['bends']['tail'])}}
    # The shared skeleton builder asks for a plan; give it the fish's.
    quad.skeleton_plan = fish_plan
    armature, added = quad.build_skeleton(plan_guide, None)
    say(f"skeleton: {len(armature.data.bones)} bones")
    quad.skin(mesh, armature, added, False)
    if 'jaw' in fish:
        across, up, forward = measure(mesh)
        open_mouth(mesh, armature, fish['jaw'], float(forward.max()), length)
    Fish(armature).write()
    quad.save(out)
    say(f"saved {out}")


if __name__ == '__main__':
    main()
