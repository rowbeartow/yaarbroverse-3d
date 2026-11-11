# Prepares a character that Meshy rigged and animated, in Blender, with no
# window. Meshy exports one file per clip, each with the whole model in it.
# This takes the model from one and puts every clip on it.
#
#   blender -b -P tools/prepare-rigged.py -- <folder> <out.glb> <guide.json>
#
#   folder       where the Meshy files are (the owner keeps them on the
#                "hero-models" release of this repo)
#   out.glb      where to save the one model with all its clips. It is as big
#                as one of the originals: run tools/compress-hero.mjs on it
#                next, and commit only what that makes.
#   guide.json   which file holds which clip, and what to do to each
#                (see tools/yaarbro.guide.json)
#   --as-it-came leaves the skin untouched (no cleanup), for a before picture
#
# Needs Blender 4 with its glTF add-on and numpy. On Ubuntu:
#   apt-get install -y blender python3-numpy
#
# What it does to the clips:
#   - Cuts each to the part the guide asks for, and can join two parts.
#   - Takes out the travel. Library clips carry the body across the floor or
#     through the air (a roll that covers five metres, a dive that starts
#     fourteen metres up). In the game the rules own where a hero is, so each
#     clip is made to happen on the spot: the hips stay over one place, a
#     body in the air is brought down to stand on the ground, and a body
#     pushed into the ground is lifted out of it.
#   - Lifts a hand that a clip pushes below the ground back onto it.
#
# What it does to the skin, when the guide has a "cleanup" part. Each fix is
# for something seen to be wrong in a pose test (tools/pose-test.py), and
# nothing else is touched:
#   - Belt: Meshy weights the belt mostly to the legs, so it skews and
#     stretches when they move. The belt and buckle are given to the hips, the
#     cloth above loses its leg weights, and the cloth just below eases from
#     the hips into the legs.
#   - Beard: it follows the head and so sinks into the chest when the head
#     tips down. The lower beard is given to the chest and eases into
#     following the head toward the chin. The cloth in front of the chest is
#     taken off the head, so it does not stretch when the head lifts.
#   - Shading: the model comes faceted. Its doubled points are merged and it is
#     shaded smooth, with edges left sharp where the guide says (the buckle,
#     the boot soles) and wherever a fold is sharper than the guide allows.
# The skeleton and the pictures are passed through as they came.

import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

FPS = 30


def say(text):
    print(f"[prepare] {text}", flush=True)


# ---------- Opening the files ----------

def model_parts():
    """The skeleton and the model's own mesh in the scene."""
    armature = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    # The model's own mesh has a material. Blender adds a bare one to draw bones with.
    mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and len(o.data.materials) > 0)
    return armature, mesh


def open_body(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=path)
    armature, mesh = model_parts()
    action = armature.animation_data.action if armature.animation_data else None
    return armature, mesh, action


def borrow_clip(path, armature):
    """Reads another file's clip. Its copy of the model is thrown away."""
    before = set(bpy.data.objects)
    actions_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    action = next(a for a in bpy.data.actions if a not in actions_before)
    action.use_fake_user = True
    other = next(o for o in bpy.data.objects if o not in before and o.type == 'ARMATURE')
    names = {bone.name for bone in other.data.bones}
    if names != {bone.name for bone in armature.data.bones}:
        raise SystemExit(f"{os.path.basename(path)} has a different skeleton from the body file")
    for obj in [o for o in bpy.data.objects if o not in before]:
        bpy.data.objects.remove(obj, do_unlink=True)
    # The copies of the mesh, skeleton and pictures that came with it.
    for block in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
    return action


# ---------- The skin: regions, weights and shading ----------

def weld(mesh):
    """Merges points that sit in the same place, so shading can run smoothly across them."""
    import bmesh
    before = len(mesh.data.vertices)
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()
    say(f"merged doubled points: {before} -> {len(mesh.data.vertices)}")


class Skin:
    """Each point of the model at rest: where it is, what colour its picture is there, and which bones move it."""

    def __init__(self, armature, mesh):
        self.armature = armature
        self.mesh = mesh
        data = mesh.data
        count = len(data.vertices)
        world = np.array(mesh.matrix_world)
        local = np.empty(count * 3)
        data.vertices.foreach_get('co', local)
        self.at = local.reshape(count, 3) @ world[:3, :3].T + world[:3, 3]
        # Across (to his left), up from the ground, and forward. He faces -y in Blender.
        self.across = self.at[:, 0]
        self.forward = -self.at[:, 1]
        self.up = self.at[:, 2] - self.at[:, 2].min()

        # The colour of the picture at each point: read a small copy of it at the point's place on it.
        material = data.materials[0]
        image = next(node.image for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image and node.image.colorspace_settings.name == 'sRGB')
        small = image.copy()
        small.scale(1024, 1024)
        pixels = np.empty(1024 * 1024 * 4, dtype=np.float32)
        small.pixels.foreach_get(pixels)
        bpy.data.images.remove(small)
        pixels = pixels.reshape(1024, 1024, 4)
        uv = np.empty(len(data.loops) * 2)
        data.uv_layers.active.data.foreach_get('uv', uv)
        uv = uv.reshape(-1, 2)
        loop_vertex = np.empty(len(data.loops), dtype=np.int64)
        data.loops.foreach_get('vertex_index', loop_vertex)
        first = np.full(count, -1)
        first[loop_vertex[::-1]] = np.arange(len(loop_vertex))[::-1]
        x = np.clip((uv[first, 0] * 1024).astype(int), 0, 1023)
        y = np.clip((uv[first, 1] * 1024).astype(int), 0, 1023)
        rgb = pixels[y, x, :3]
        high = rgb.max(axis=1)
        low = rgb.min(axis=1)
        spread = high - low
        hue = np.zeros(count)
        nonzero = spread > 1e-6
        r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
        is_r = nonzero & (high == r)
        is_g = nonzero & (high == g) & ~is_r
        is_b = nonzero & ~is_r & ~is_g
        hue[is_r] = ((g[is_r] - b[is_r]) / spread[is_r]) % 6
        hue[is_g] = (b[is_g] - r[is_g]) / spread[is_g] + 2
        hue[is_b] = (r[is_b] - g[is_b]) / spread[is_b] + 4
        self.hue = hue * 60
        self.saturation = np.where(high > 0, spread / np.maximum(high, 1e-6), 0)
        # The picture is stored for a screen; this is how bright it looks on one.
        self.value = high ** (1 / 2.2)

        self.names = [group.name for group in mesh.vertex_groups]
        index = {name: i for i, name in enumerate(self.names)}
        self.weights = np.zeros((count, len(self.names)))
        for vertex in data.vertices:
            for group in vertex.groups:
                self.weights[vertex.index, group.group] = group.weight
        self.column = index

    def coloured(self, look):
        """Points whose picture colour is inside the ranges a guide entry gives."""
        inside = np.ones(len(self.hue), dtype=bool)
        if 'hue' in look:
            inside &= (self.hue >= look['hue'][0]) & (self.hue <= look['hue'][1])
        if 'saturation' in look:
            inside &= (self.saturation >= look['saturation'][0]) & (self.saturation <= look['saturation'][1])
        if 'value' in look:
            inside &= (self.value >= look['value'][0]) & (self.value <= look['value'][1])
        return inside

    def give(self, points, takers, share, to):
        """Takes `share` (0 to 1, per point) of what the `takers` bones hold at the points and gives it to bone `to`."""
        columns = [self.column[name] for name in takers if name in self.column]
        share = np.broadcast_to(share, (len(self.up),))[points]
        taken = self.weights[np.ix_(points, columns)] * share[:, None]
        self.weights[np.ix_(points, columns)] -= taken
        self.weights[points, self.column[to]] += taken.sum(axis=1)

    def write(self):
        """Stores the weights back on the mesh: at most four bones a point, adding up to one."""
        mesh = self.mesh
        order = np.argsort(-self.weights, axis=1)[:, :4]
        for group in list(mesh.vertex_groups):
            mesh.vertex_groups.remove(group)
        groups = [mesh.vertex_groups.new(name=name) for name in self.names]
        for vertex in range(len(self.weights)):
            kept = [(c, self.weights[vertex, c]) for c in order[vertex] if self.weights[vertex, c] > 1e-4]
            total = sum(weight for _, weight in kept)
            for column, weight in kept:
                groups[column].add([vertex], weight / total, 'REPLACE')


def smoothstep(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def clean_belt(skin, spec):
    """Gives the belt to the hips, and eases the cloth round it."""
    torso = np.abs(skin.across) < spec['within']
    band = (skin.up >= spec['between'][0]) & (skin.up <= spec['between'][1])
    belt = torso & band & np.any([skin.coloured(look) for look in spec['looks']], axis=0)
    if not belt.any():
        raise SystemExit('The guide\'s belt was not found on the model. Check its height and colours.')
    low = skin.up[belt].min()
    high = skin.up[belt].max()
    legs = spec['legs']
    hips = spec['stays_with']
    others = [name for name in skin.names if name != hips]
    # The belt itself: all of it with the hips.
    skin.give(np.where(belt)[0], others, 1.0, hips)
    # Above the belt nothing on the body should follow a leg.
    above = torso & ~belt & (skin.up > low)
    skin.give(np.where(above)[0], legs, 1.0, hips)
    # Just below it the cloth eases from the hips into the legs.
    reach = spec['eases_below']
    below = torso & ~belt & (skin.up <= low) & (skin.up > low - reach)
    skin.give(np.where(below)[0], legs, 1 - smoothstep((low - skin.up) / reach), hips)
    say(f"belt: {int(belt.sum())} points from {low:.2f} to {high:.2f} m given to {hips}; {int(above.sum())} points above freed from the legs, {int(below.sum())} below eased")


def clean_beard(skin, spec):
    """Keeps the lower beard on the chest, and the chest's cloth off the head."""
    front = skin.forward > spec['in_front_of']
    middle = np.abs(skin.across) < spec['within']
    band = (skin.up >= spec['between'][0]) & (skin.up <= spec['between'][1])
    beard = front & middle & band & skin.coloured(spec['look'])
    if not beard.any():
        raise SystemExit('The guide\'s beard was not found on the model. Check its height and colour.')
    chest = spec['stays_on']
    head = spec['head']
    # Whatever else holds the beard (Meshy gives much of it to the shoulders) goes to the chest.
    others = [name for name in skin.names if name not in head and name != chest]
    skin.give(np.where(beard)[0], others, 1.0, chest)
    # The tip stays on the chest; toward the chin it follows the head as it came.
    free, full = spec['follows_head_from']
    skin.give(np.where(beard)[0], head, 1 - smoothstep((skin.up - free) / (full - free)), chest)
    # The cloth in front of the chest does not follow the head at all.
    cloth = front & middle & (skin.up < spec['cloth_below']) & np.any([skin.coloured(look) for look in spec['cloth_looks']], axis=0)
    skin.give(np.where(cloth)[0], head, 1.0, chest)
    say(f"beard: {int(beard.sum())} points, the lower ones given to {chest}; {int(cloth.sum())} points of cloth in front of the chest taken off the head")


def shade(skin, spec):
    """Smooth shading everywhere, with edges kept sharp where the guide asks and at sharp folds."""
    import bmesh
    mesh = skin.mesh
    data = mesh.data
    for polygon in data.polygons:
        polygon.use_smooth = True
    # Which points are in a part that keeps its edges.
    crisp = np.zeros(len(skin.up), dtype=bool)
    for part in spec['sharp']:
        inside = (skin.up >= part['between'][0]) & (skin.up <= part['between'][1])
        if 'within' in part:
            inside &= np.abs(skin.across) < part['within']
        if 'looks' in part:
            inside &= np.any([skin.coloured(look) for look in part['looks']], axis=0)
        crisp |= inside
        say(f"shading: {part['name']} keeps its edges ({int(inside.sum())} points)")
    fold = math.radians(spec['smooth_up_to'])
    crisp_fold = math.radians(spec['sharp_from'])
    bm = bmesh.new()
    bm.from_mesh(data)
    bm.verts.ensure_lookup_table()
    sharp = 0
    for edge in bm.edges:
        if len(edge.link_faces) != 2:
            continue
        angle = edge.calc_face_angle(0.0)
        in_part = crisp[edge.verts[0].index] and crisp[edge.verts[1].index]
        edge.smooth = not (angle > (crisp_fold if in_part else fold))
        sharp += 0 if edge.smooth else 1
    bm.to_mesh(data)
    bm.free()
    data.use_auto_smooth = True
    data.auto_smooth_angle = math.pi
    # The file came with a facing direction stored for every corner of every
    # face, which is what made it faceted. Setting them all to nothing makes
    # Blender work them out again from the smooth and sharp edges above.
    data.normals_split_custom_set([(0.0, 0.0, 0.0)] * len(data.loops))
    data.update()
    say(f"shading: smooth, with {sharp} edges kept sharp")


def clean_up(armature, mesh, spec):
    weld(mesh)
    skin = Skin(armature, mesh)
    if 'belt' in spec:
        clean_belt(skin, spec['belt'])
    if 'beard' in spec:
        clean_beard(skin, spec['beard'])
    skin.write()
    if 'shading' in spec:
        shade(skin, spec['shading'])


# ---------- Reading a pose ----------

class Body:
    """The model in whatever pose it is in, measured in metres from the ground up."""

    def __init__(self, armature, mesh, hips):
        self.armature = armature
        self.mesh = mesh
        self.hips = armature.pose.bones[hips]
        self.count = len(mesh.data.vertices)
        self.buffer = np.empty(self.count * 3)
        # Which bone each point follows most, for finding the hands.
        names = {group.index: group.name for group in mesh.vertex_groups}
        self.owner = []
        for vertex in mesh.data.vertices:
            best = max(vertex.groups, key=lambda g: g.weight, default=None)
            self.owner.append(names[best.group] if best else '')
        self.owner = np.array(self.owner)

    def points(self):
        """Where every point of the skin is now."""
        bpy.context.view_layer.update()
        shape = self.mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        shape.data.vertices.foreach_get('co', self.buffer)
        local = self.buffer.reshape(self.count, 3)
        world = np.array(shape.matrix_world)
        return local @ world[:3, :3].T + world[:3, 3]

    def shift(self, pose_bone, by):
        """Moves a bone by a distance in metres. (The skeleton itself may be in other units.)"""
        own = self.armature.matrix_world.inverted().to_3x3() @ by
        pose_bone.matrix = Matrix.Translation(own) @ pose_bone.matrix
        bpy.context.view_layer.update()

    def descendants(self, bone_name):
        bone = self.armature.data.bones[bone_name]
        return [bone.name] + [child.name for child in bone.children_recursive]


def stay_put(body, home):
    """Holds the hips over one spot, so the clip happens in place."""
    at = body.armature.matrix_world @ body.hips.matrix.to_translation()
    body.shift(body.hips, Vector((home.x - at.x, home.y - at.y, 0)))


def stand_on_ground(body, bring_down, lift_out):
    """
    Brings a body that is in the air down until it touches the ground, and
    lifts one that is pushed into the ground out of it.
    """
    lowest = body.points()[:, 2].min()
    if (bring_down and lowest > 0) or (lift_out and lowest < -0.02):
        body.shift(body.hips, Vector((0, 0, -lowest)))


def hands_on_ground(body, arms):
    """Raises an arm by the shoulder until its hand is back on the ground."""
    for arm in arms:
        for _ in range(3):
            points = body.points()
            own = np.isin(body.owner, body.descendants(arm)[1:])
            if not own.any():
                break
            low = points[own][:, 2].argmin()
            hand = Vector(points[own][low])
            if hand.z >= -0.01:
                break
            bone = body.armature.pose.bones[arm]
            shoulder = body.armature.matrix_world @ bone.matrix.to_translation()
            reach = hand - shoulder
            flat = math.hypot(reach.x, reach.y)
            length = reach.length
            # Swing the arm up about the shoulder until the hand's height is zero.
            wanted = min(1.0, max(-1.0, (0 - shoulder.z) / length))
            turn = math.asin(wanted) - math.atan2(reach.z, flat)
            axis = Vector((reach.x, reach.y, 0)).cross(Vector((0, 0, 1)))
            if axis.length < 1e-6:
                break
            swing = Matrix.Translation(shoulder) @ Quaternion(axis.normalized(), turn).to_matrix().to_4x4() @ Matrix.Translation(-shoulder)
            bone.matrix = body.armature.matrix_world.inverted() @ swing @ body.armature.matrix_world @ bone.matrix
            bpy.context.view_layer.update()


# ---------- Writing the clips ----------

def read_pose(armature):
    return {bone.name: bone.matrix_basis.copy() for bone in armature.pose.bones}


def blend_poses(a, b, share):
    out = {}
    for name in a:
        la, ra, sa = a[name].decompose()
        lb, rb, sb = b[name].decompose()
        out[name] = Matrix.LocRotScale(la.lerp(lb, share), ra.slerp(rb, share), sa.lerp(sb, share))
    return out


def make_clip(body, spec, source, home):
    """Samples the wanted part of a clip, pose by pose, fixing each pose as the guide asks."""
    armature = body.armature
    start, end = source.frame_range
    length = (end - start) / FPS
    parts = spec.get('parts') or [[spec.get('from', 0.0), spec.get('to', length)]]
    armature.animation_data.action = source
    poses = []
    seams = []
    for part_from, part_to in parts:
        first = round(start + part_from * FPS)
        last = round(start + min(part_to, length) * FPS)
        if poses:
            seams.append(len(poses))
        for frame in range(first, last + 1):
            bpy.context.scene.frame_set(frame)
            if spec.get('stay'):
                stay_put(body, home)
            if spec.get('airborne') or spec.get('lift'):
                stand_on_ground(body, spec.get('airborne', False), spec.get('lift', False))
            if spec.get('hands_on_ground'):
                hands_on_ground(body, spec['hands_on_ground'])
            poses.append(read_pose(armature))
    # Where two parts meet, ease from one into the other over a few poses.
    for seam in seams:
        reach = min(3, seam - 1, len(poses) - seam - 1)
        if reach < 1:
            continue
        before = poses[seam - reach - 1]
        after = poses[seam + reach]
        for k in range(2 * reach):
            share = (k + 1) / (2 * reach + 1)
            poses[seam - reach + k] = blend_poses(before, after, share * share * (3 - 2 * share))
    # A clip that repeats has to end where it began.
    if spec.get('loop'):
        reach = min(4, len(poses) // 4)
        for i in range(reach):
            share = (i + 1) / reach
            poses[len(poses) - reach + i] = blend_poses(poses[len(poses) - reach + i], poses[0], share * share * (3 - 2 * share))

    armature.animation_data.action = None
    action = bpy.data.actions.new(spec['name'])
    armature.animation_data.action = action
    moved = {body.hips.name}
    for frame, pose in enumerate(poses):
        for bone in armature.pose.bones:
            location, rotation, _ = pose[bone.name].decompose()
            bone.rotation_mode = 'QUATERNION'
            bone.location = location
            bone.rotation_quaternion = rotation
            bone.scale = (1, 1, 1)
            bone.keyframe_insert('rotation_quaternion', frame=frame)
            if bone.name in moved:
                bone.keyframe_insert('location', frame=frame)
    for curve in action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = 'LINEAR'
    armature.animation_data.action = None
    say(f"clip {spec['name']}: {(len(poses) - 1) / FPS:.2f} s from {spec['file']}")
    return action


def save(path):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_force_sampling=True,
        export_anim_slide_to_zero=True,
        export_optimize_animation_size=False,
        export_skins=True,
        export_def_bones=False,
        export_yup=True,
        export_apply=False,
        export_image_format='AUTO',
        export_tangents=False,
    )


def main():
    arguments = [a for a in sys.argv[sys.argv.index('--') + 1:] if a != '--as-it-came'] if '--' in sys.argv else []
    if len(arguments) != 3:
        raise SystemExit('Usage: blender -b -P tools/prepare-rigged.py -- <folder> <out.glb> <guide.json> [--as-it-came]')
    folder, out, guide_path = arguments
    with open(guide_path, encoding='utf8') as file:
        guide = json.load(file)

    armature, mesh, own_action = open_body(os.path.join(folder, guide['body']))
    say(f"body from {guide['body']}: {len(mesh.data.vertices)} points, {len(armature.data.bones)} bones")
    sources = {guide['body']: own_action}
    for spec in guide['clips']:
        if spec['file'] not in sources:
            sources[spec['file']] = borrow_clip(os.path.join(folder, spec['file']), armature)
    for action in sources.values():
        action.use_fake_user = True

    if guide.get('cleanup') and '--as-it-came' not in sys.argv:
        clean_up(armature, mesh, guide['cleanup'])

    body = Body(armature, mesh, guide['hips'])
    # The spot the hips stay over: where they are, on average, standing still.
    armature.animation_data.action = sources[guide['clips'][0]['file']]
    start, end = sources[guide['clips'][0]['file']].frame_range
    spots = []
    for frame in range(round(start), round(end) + 1):
        bpy.context.scene.frame_set(frame)
        spots.append(armature.matrix_world @ body.hips.matrix.to_translation())
    home = sum(spots, Vector()) / len(spots)

    made = [make_clip(body, spec, sources[spec['file']], home) for spec in guide['clips']]
    # Only the clips made here are saved, each on its own track so it is its own animation.
    for action in list(bpy.data.actions):
        if action not in made:
            bpy.data.actions.remove(action)
    for track in list(armature.animation_data.nla_tracks):
        armature.animation_data.nla_tracks.remove(track)
    for action in made:
        track = armature.animation_data.nla_tracks.new()
        track.name = action.name
        track.strips.new(action.name, 0, action)
    for bone in armature.pose.bones:
        bone.location = (0, 0, 0)
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.scale = (1, 1, 1)
    bpy.context.scene.frame_set(0)
    save(out)
    say(f"saved {out}")


main()
