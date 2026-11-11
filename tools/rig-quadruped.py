# Gives a four-legged character a skeleton and its animation clips, in Blender,
# with no window. For characters Meshy cannot rig (see docs/decisions.md).
#
#   blender -b -P tools/rig-quadruped.py -- <source.glb> <rigged.glb> <guide.json>
#
#   source.glb   the model as it came from Meshy
#   rigged.glb   where to save the rigged, animated model. It is as big as the
#                source: run tools/compress-hero.mjs on it next, and commit
#                only what that makes.
#   guide.json   where this character's joints are (see tools/caputo.rig.json)
#
# Needs Blender 4 with its glTF add-on and numpy. On Ubuntu:
#   apt-get install -y blender python3-numpy
#
# What it does:
#   1. Opens the model, turns it to face straight ahead and stands it on the
#      ground.
#   2. Merges the doubled points along the seams of the model's picture.
#      Meshy splits the skin into hundreds of loose patches there, and weights
#      cannot spread across loose patches.
#   3. Builds the skeleton from the guide: hips, spine, chest, neck, head, four
#      legs (upper, lower, paw) and a tail. If the file already has a skeleton
#      it is kept, and only the bones it lacks are added.
#   4. Skins the model to the skeleton with Blender's automatic weights, then
#      checks every point got some. Small loose parts (a fang, a claw) take the
#      weights of the nearest part of the body. If the automatic weights fail
#      on the mesh as it is, a clean copy of it is weighted and the weights
#      are carried across.
#   5. Writes the clips: idle, walk, run, jump, falling, landing. Feet are
#      placed by working the leg joints back from where each paw should be, so
#      a paw on the ground stays where it is put.
#   6. Saves the result as a GLB with one animation per clip.

import json
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree

FPS = 60
TAU = math.pi * 2


# ---------- Small helpers ----------

def say(text):
    print(f"[rig] {text}", flush=True)


def to_blender(point):
    """A guide point (across, up, forward) as Blender's (x, y, z): up is z, forward is -y."""
    across, up, forward = point
    return Vector((across, -forward, up))


def pitch(angle):
    """Nose up by `angle` degrees."""
    return Quaternion((1, 0, 0), -math.radians(angle))


def yaw(angle):
    """Turn to the character's left by `angle` degrees."""
    return Quaternion((0, 0, 1), math.radians(angle))


def roll(angle):
    """Lean the left side down by `angle` degrees."""
    return Quaternion((0, 1, 0), math.radians(angle))


def wave(phase, peak=0.0):
    """A smooth swing between -1 and 1, once per cycle, highest at `peak`."""
    return math.cos(TAU * (phase - peak))


def smoothstep(value):
    value = min(1.0, max(0.0, value))
    return value * value * (3 - 2 * value)


# ---------- 1 and 2: open the model and tidy its mesh ----------

def open_model(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=path)
    # The model's own meshes have a material. (When a file has a skeleton,
    # Blender also adds a small bare mesh that it draws the bones with.)
    every = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    meshes = [o for o in every if len(o.data.materials) > 0] or every
    armatures = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    if not meshes:
        raise SystemExit('No mesh in the file')
    # One mesh is simpler to skin than several.
    if len(meshes) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for mesh in meshes:
            mesh.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
    return meshes[0], (armatures[0] if armatures else None)


def straighten(mesh, armature, turned_left):
    """Turns the model to face straight ahead and stands it on the ground."""
    fix = Matrix.Rotation(-math.radians(turned_left), 4, 'Z')
    # Work on the mesh by itself; skin() ties it back to the skeleton.
    world = mesh.matrix_world.copy()
    mesh.parent = None
    mesh.matrix_world = Matrix.Identity(4)
    mesh.data.transform(fix @ world)
    ground = min(v.co.z for v in mesh.data.vertices)
    drop = Matrix.Translation((0, 0, -ground))
    mesh.data.transform(drop)
    if armature:
        armature.data.transform(drop @ fix @ armature.matrix_world)
        armature.matrix_world = Matrix.Identity(4)
        # Any clips the file came with are written afresh below.
        armature.animation_data_clear()
        for action in list(bpy.data.actions):
            bpy.data.actions.remove(action)
    mesh.data.update()


def islands(mesh):
    """How many separate pieces the mesh is in, and how many points the biggest has."""
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    seen = set()
    sizes = []
    for vert in bm.verts:
        if vert.index in seen:
            continue
        stack = [vert]
        seen.add(vert.index)
        size = 0
        while stack:
            at = stack.pop()
            size += 1
            for edge in at.link_edges:
                other = edge.other_vert(at)
                if other.index not in seen:
                    seen.add(other.index)
                    stack.append(other)
        sizes.append(size)
    bm.free()
    return len(sizes), max(sizes)


def merge_seams(mesh):
    """Merges points that sit in the same place, which joins the loose patches into one skin."""
    before = len(mesh.data.vertices)
    pieces_before, _ = islands(mesh)
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()
    pieces, biggest = islands(mesh)
    say(f"merged seam points: {before} points in {pieces_before} pieces -> {len(mesh.data.vertices)} points in {pieces} pieces (the body has {biggest})")


# ---------- 3: the skeleton ----------

def skeleton_plan(guide):
    """Every bone the character should have: name, head, tail, parent, and whether it bends the skin."""
    joints = guide['joints']
    plan = []
    spine = [to_blender(p) for p in joints['spine']]
    if len(spine) < 4:
        raise SystemExit('The guide needs at least four spine points: hips, one or more spine joints, the chest, and the base of the neck')
    plan.append(('root', Vector((spine[0].x, spine[0].y, 0)), Vector((spine[0].x, spine[0].y - 0.25, 0)), None, False))
    names = ['hips'] + [f'spine{i}' for i in range(1, len(spine) - 2)] + ['chest']
    if len(names) == 3:
        names[1] = 'spine'
    for i, name in enumerate(names):
        plan.append((name, spine[i], spine[i + 1], names[i - 1] if i else 'root', True))
    head = to_blender(joints['head'])
    plan.append(('neck', spine[-1], head, 'chest', True))
    plan.append(('head', head, to_blender(joints['head_end']), 'neck', True))
    tail = [to_blender(p) for p in joints['tail']]
    if len(tail) < 6:
        raise SystemExit('The guide needs at least six tail points, for five tail bones')
    for i in range(len(tail) - 1):
        plan.append((f'tail{i + 1}', tail[i], tail[i + 1], 'hips' if i == 0 else f'tail{i}', True))
    for leg, parent in (('front', 'chest'), ('hind', 'hips')):
        for side, letter in (('left', 'l'), ('right', 'r')):
            points = [to_blender(p) for p in joints[f'{leg}_{side}']]
            parts = ['upper', 'lower', 'paw']
            for i, part in enumerate(parts):
                name = f'{leg}_{part}_{letter}'
                plan.append((name, points[i], points[i + 1], parent if i == 0 else f'{leg}_{parts[i - 1]}_{letter}', True))
    return plan


def build_skeleton(guide, armature):
    """Builds the skeleton, or adds the missing bones to the one the file came with. Returns it and the names added."""
    plan = skeleton_plan(guide)
    # A file's own bones may go by other names: the guide can say which is which.
    known_as = guide.get('bones', {})
    if armature is None:
        data = bpy.data.armatures.new('Skeleton')
        armature = bpy.data.objects.new('Skeleton', data)
        bpy.context.scene.collection.objects.link(armature)
    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='EDIT')
    bones = armature.data.edit_bones
    added = []
    for name, head, tail, parent, bends in plan:
        actual = known_as.get(name, name)
        if actual in bones:
            continue
        bone = bones.new(actual)
        bone.head = head
        bone.tail = tail
        bone.use_deform = bends
        if parent:
            bone.parent = bones[known_as.get(parent, parent)]
            bone.use_connect = (bone.parent.tail - head).length < 1e-4
        # Keep each bone's side axis level, so the skeleton is easy to read in Blender.
        bone.align_roll(Vector((0, 0, 1)) if abs((tail - head).normalized().z) < 0.9 else Vector((0, -1, 0)))
        added.append(actual)
    bpy.ops.object.mode_set(mode='OBJECT')
    return armature, added


# ---------- 4: skinning ----------

def weights_of(mesh):
    """Each point's weights as {bone name: weight}."""
    names = {group.index: group.name for group in mesh.vertex_groups}
    return [{names[g.group]: g.weight for g in vert.groups if g.weight > 0} for vert in mesh.data.vertices]


def write_weights(mesh, weights):
    for group in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(group)
    groups = {}
    for index, own in enumerate(weights):
        for name, weight in own.items():
            if name not in groups:
                groups[name] = mesh.vertex_groups.new(name=name)
            groups[name].add([index], weight, 'REPLACE')


def heat_weights(mesh, armature):
    """Blender's automatic weights for `mesh` on `armature`. Returns each point's weights."""
    for modifier in list(mesh.modifiers):
        if modifier.type == 'ARMATURE':
            mesh.modifiers.remove(modifier)
    for group in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(group)
    mesh.parent = None
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return weights_of(mesh)


def clean_copy(mesh):
    """
    A copy of the mesh rebuilt as one closed, even skin, with none of the
    faults the original has (edges shared by three faces, loose parts, gaps).
    It is only for working out weights and is never saved.
    """
    tall = max(v.co.z for v in mesh.data.vertices) - min(v.co.z for v in mesh.data.vertices)
    rough = mesh.copy()
    rough.data = mesh.data.copy()
    bpy.context.scene.collection.objects.link(rough)
    for modifier in list(rough.modifiers):
        rough.modifiers.remove(modifier)
    rough.parent = None
    remesh = rough.modifiers.new('Rebuild', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = tall * 0.012
    bpy.context.view_layer.update()
    rebuilt = bpy.data.meshes.new_from_object(rough.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(rough)
    clean = bpy.data.objects.new('Clean copy', rebuilt)
    bpy.context.scene.collection.objects.link(clean)
    return clean


def carry_across(clean, clean_weights, mesh):
    """Gives each point of the mesh the weights of the clean copy next to it."""
    tree = KDTree(len(clean.data.vertices))
    for vertex in clean.data.vertices:
        tree.insert(vertex.co, vertex.index)
    tree.balance()
    weights = []
    for vertex in mesh.data.vertices:
        mixed = {}
        total = 0.0
        for _, index, distance in tree.find_n(vertex.co, 4):
            near = 1.0 / (distance * distance + 1e-8)
            total += near
            for name, weight in clean_weights[index].items():
                mixed[name] = mixed.get(name, 0.0) + weight * near
        weights.append({name: weight / total for name, weight in mixed.items() if weight / total > 1e-4})
    return weights


def automatic_weights(mesh, armature):
    """
    Automatic weights for the mesh. Blender works them out by letting warmth
    spread from each bone across the skin, which needs a sound skin to spread
    over. If it fails on the mesh as it is, the cause is fixed and not
    papered over: a clean copy of the mesh is weighted, and its weights are
    carried across to the real one.
    """
    weights = heat_weights(mesh, armature)
    if sum(1 for own in weights if own) >= len(weights) / 2:
        return weights
    say('automatic weights failed on the mesh as it is; weighting a clean copy of it and carrying the weights across')
    clean = clean_copy(mesh)
    clean_weights = heat_weights(clean, armature)
    if sum(1 for own in clean_weights if own) < len(clean_weights) / 2:
        raise SystemExit('Automatic weights failed on a clean copy of the mesh too. Check the guide: the bones may lie outside the model.')
    weights = carry_across(clean, clean_weights, mesh)
    bpy.data.objects.remove(clean)
    # The failed try left the mesh tied to the skeleton with no weights; skin() fills them in.
    return weights


def fill_unweighted(mesh, weights):
    """Points the automatic weights missed take the weights of the nearest point that has some."""
    have = [i for i, own in enumerate(weights) if own]
    missed = [i for i, own in enumerate(weights) if not own]
    if not have:
        raise SystemExit('Automatic weights gave no weights at all. Check the guide: the bones may lie outside the model.')
    if missed:
        tree = KDTree(len(have))
        for i in have:
            tree.insert(mesh.data.vertices[i].co, i)
        tree.balance()
        for i in missed:
            _, nearest, _ = tree.find(mesh.data.vertices[i].co)
            weights[i] = dict(weights[nearest])
    return len(missed)


def tidy_weights(weights, most=4):
    """At most four bones a point (what the game's renderer reads), adding up to one."""
    for i, own in enumerate(weights):
        kept = sorted(own.items(), key=lambda item: -item[1])[:most]
        total = sum(weight for _, weight in kept)
        weights[i] = {name: weight / total for name, weight in kept}


def skin(mesh, armature, added, had_skeleton):
    deforming = {bone.name for bone in armature.data.bones if bone.use_deform}
    if had_skeleton and not added:
        say('the file already has every bone: its own weights are kept')
        weights = weights_of(mesh)
    elif had_skeleton:
        # Keep the file's weights, and make room in them for the new bones.
        old = weights_of(mesh)
        # A bone the file gives no weights to (a root, an end marker) moves
        # nothing, so it takes no part in weighting the new ones.
        weighted = {name for own in old for name in own}
        for bone in armature.data.bones:
            if bone.name not in weighted and bone.name not in added:
                bone.use_deform = False
        deforming = {bone.name for bone in armature.data.bones if bone.use_deform}
        copy = mesh.copy()
        copy.data = mesh.data.copy()
        bpy.context.scene.collection.objects.link(copy)
        fresh = automatic_weights(copy, armature)
        fill_unweighted(copy, fresh)
        bpy.data.objects.remove(copy)
        weights = []
        for own, new in zip(old, fresh):
            extra = {name: weight for name, weight in new.items() if name in added}
            share = sum(extra.values())
            mixed = {name: weight * (1 - share) for name, weight in own.items()}
            mixed.update(extra)
            weights.append(mixed)
        say(f"added bones {', '.join(added)} to the file's own skeleton and weighted them")
    else:
        weights = automatic_weights(mesh, armature)
    missed = fill_unweighted(mesh, weights)
    tidy_weights(weights)
    write_weights(mesh, weights)
    # Make sure the mesh follows the skeleton (it already does after automatic weights).
    if not any(m.type == 'ARMATURE' for m in mesh.modifiers):
        mesh.modifiers.new('Skeleton', 'ARMATURE').object = armature
    mesh.parent = armature
    used = {name for own in weights for name in own}
    # Every bone this script made has to move some of the model. A file's own
    # skeleton may hold bones that move nothing, and that is its business.
    unused = sorted((set(added) & deforming if had_skeleton else deforming) - used)
    say(f"skinned {len(weights)} points; {missed} loose points took the weights of the body next to them")
    if unused:
        raise SystemExit(f"These bones move no part of the model, so the automatic weights failed for them: {', '.join(unused)}. Check their places in the guide.")


# ---------- 5: clips ----------

class Poser:
    """
    Works out a pose one bone at a time, parents first, in the skeleton's own
    space, then turns it into what Blender stores for each bone.
    """

    def __init__(self, armature, known_as):
        self.armature = armature
        self.known_as = known_as
        self.rest = {bone.name: bone.matrix_local.copy() for bone in armature.data.bones}
        self.parent = {bone.name: (bone.parent.name if bone.parent else None) for bone in armature.data.bones}
        self.order = []
        todo = [bone for bone in armature.data.bones if bone.parent is None]
        while todo:
            bone = todo.pop(0)
            self.order.append(bone.name)
            todo.extend(bone.children)
        self.posed = {}
        self.local = {}

    def name(self, bone):
        return self.known_as.get(bone, bone)

    def begin(self):
        self.posed = {}
        self.local = {}

    def carried(self, bone):
        """Where the bone would be if only its parents had moved."""
        parent = self.parent[bone]
        if parent is None:
            return self.rest[bone].copy()
        if parent not in self.posed:
            self.place(parent)
        return self.posed[parent] @ (self.rest[parent].inverted() @ self.rest[bone])

    def place(self, bone, turn=None, move=None, aim=None):
        """
        Poses one bone. `aim` points it along a direction, `turn` then turns it
        (see pitch, yaw and roll), and `move` shifts it. All in the skeleton's space.
        """
        at = self.carried(bone)
        rotation = at.to_3x3()
        if aim is not None:
            along = (rotation @ Vector((0, 1, 0))).normalized()
            rotation = along.rotation_difference(aim.normalized()).to_matrix() @ rotation
        if turn is not None:
            rotation = turn.to_matrix() @ rotation
        head = at.to_translation() + (move if move is not None else Vector())
        posed = Matrix.Translation(head) @ rotation.to_4x4()
        self.posed[bone] = posed
        self.local[bone] = at.inverted() @ posed

    def head(self, bone):
        return self.carried(bone).to_translation()

    def rest_head(self, bone):
        return self.rest[bone].to_translation()

    def reach(self, upper, lower, paw, ankle, paw_turn=None):
        """
        Bends a leg so its ankle is at `ankle`: the two leg bones are worked
        back from there. The knee bends the way it does in the model as it
        came. The paw keeps the direction it has at rest, turned by `paw_turn`.
        """
        top = self.head(upper)
        first = (self.rest_head(lower) - self.rest_head(upper)).length
        second = (self.rest_head(paw) - self.rest_head(lower)).length
        line = ankle - top
        distance = min(max(line.length, abs(first - second) + 1e-4), first + second - 1e-4)
        along = line.normalized()
        # The side the knee is on at rest, carried round with the body.
        carried = self.carried(upper).to_3x3() @ self.rest[upper].to_3x3().inverted()
        rest_line = (self.rest_head(paw) - self.rest_head(upper)).normalized()
        rest_knee = self.rest_head(lower) - self.rest_head(upper)
        bend = rest_knee - rest_knee.dot(rest_line) * rest_line
        if bend.length < 1e-4:
            bend = Vector((0, 1, 0))
        bend = carried @ bend
        bend = bend - bend.dot(along) * along
        bend.normalize()
        near = (first * first + distance * distance - second * second) / (2 * first * distance)
        knee = top + first * (near * along + math.sqrt(max(0.0, 1 - near * near)) * bend)
        self.place(upper, aim=knee - top)
        self.place(lower, aim=top + along * distance - knee)
        rest_paw = self.rest[paw].to_3x3() @ Vector((0, 1, 0))
        self.place(paw, aim=(paw_turn.to_matrix() @ rest_paw) if paw_turn else rest_paw)

    def key(self, frame):
        """Stores the pose at `frame`. Bones not placed keep their resting place."""
        for bone in self.order:
            if bone not in self.local:
                self.place(bone)
            location, rotation, _ = self.local[bone].decompose()
            pose_bone = self.armature.pose.bones[bone]
            pose_bone.rotation_mode = 'QUATERNION'
            pose_bone.location = location
            pose_bone.rotation_quaternion = rotation
            pose_bone.keyframe_insert('rotation_quaternion', frame=frame)
            # Only the root and the hips are ever moved; the rest only turn.
            if self.parent[bone] is None or self.parent[self.parent[bone]] is None:
                pose_bone.keyframe_insert('location', frame=frame)


class Quadruped:
    """The clips, written against the bones this script builds."""

    def __init__(self, armature, guide):
        known_as = guide.get('bones', {})
        self.poser = Poser(armature, known_as)
        self.n = lambda bone: known_as.get(bone, bone)
        self.armature = armature
        names = {bone.name for bone in armature.data.bones}
        self.spine = [self.n(b) for b in ['spine', 'spine1', 'spine2', 'spine3'] if self.n(b) in names]
        self.tail = []
        while self.n(f'tail{len(self.tail) + 1}') in names:
            self.tail.append(self.n(f'tail{len(self.tail) + 1}'))
        self.legs = {}
        for leg in ('front', 'hind'):
            for side in ('l', 'r'):
                self.legs[f'{leg}_{side}'] = [self.n(f'{leg}_{part}_{side}') for part in ('upper', 'lower', 'paw')]
        self.settings = guide.get('clips', {})

    def setting(self, clip, name, default):
        return self.settings.get(clip, {}).get(name, default)

    def body(self, rise=0.0, lean=0.0, sway=0.0, forward=0.0, hips_turn=None, arch=0.0, chest_turn=None, neck_turn=None, head_turn=None):
        """
        Places the trunk. `rise`, `sway` and `forward` move the whole body
        (metres up, to its left and ahead), `lean` tips it nose up (degrees),
        `arch` rounds the back, the turns are extras for single parts.
        """
        p = self.poser
        p.place(self.n('root'))
        hips = pitch(lean + arch * 0.4)
        if hips_turn:
            hips = hips_turn @ hips
        p.place(self.n('hips'), turn=hips, move=Vector((sway, -forward, rise)))
        # The spine undoes the hips' share of the arch and adds its own, so the chest tips the other way.
        per_bone = pitch(-arch * 0.8 / max(len(self.spine) + 1, 1))
        for bone in self.spine:
            p.place(bone, turn=per_bone)
        chest = per_bone
        if chest_turn:
            chest = chest_turn @ chest
        p.place(self.n('chest'), turn=chest)
        p.place(self.n('neck'), turn=neck_turn)
        p.place(self.n('head'), turn=head_turn)

    def tail_wave(self, phase, swing=6.0, lift=0.0, bounce=0.0, lag=0.09):
        """
        Sways the tail side to side by `swing` degrees, each bone a little
        behind the one before, like a rope. `lift` raises the whole tail
        (degrees, shared out along it) and `bounce` bobs it twice a cycle.
        """
        count = len(self.tail)
        side = Vector((1, 0, 0))
        for i, bone in enumerate(self.tail):
            share = (i + 1) / count
            # Turn about whichever line swings this bone's far end sideways:
            # upright for a bone that points back, lengthways for one that
            # points up, as the end of a curled tail does.
            along = (self.poser.carried(bone).to_3x3() @ Vector((0, 1, 0))).normalized()
            axis = along.cross(side)
            axis = axis.normalized() if axis.length > 0.2 else Vector((0, 0, -1))
            turn = Quaternion(axis, -math.radians(swing * (0.4 + 0.6 * share) * wave(phase, i * lag)))
            # A tail points backward, so tipping it "nose down" raises it.
            turn = pitch(-(lift / count + bounce * share * wave(phase * 2, 0.1 + i * lag))) @ turn
            self.poser.place(bone, turn=turn)

    def foot(self, leg, forward=0.0, lift=0.0, out=0.0, toes=0.0):
        """Puts a paw `forward` and `lift` metres from where it rests, toes turned up by `toes` degrees."""
        upper, lower, paw = self.legs[leg]
        ankle = self.poser.rest_head(paw) + Vector((out if leg.endswith('_l') else -out, -forward, lift))
        self.poser.reach(upper, lower, paw, ankle, pitch(toes) if toes else None)

    @staticmethod
    def step(phase, on_ground, stride, lift):
        """
        One paw through one cycle: where it is ahead of its resting place, how
        high, and how its toes are turned. It is on the ground for the first
        `on_ground` share of the cycle, moving back at a steady speed, then
        swings forward.
        """
        phase %= 1.0
        if phase < on_ground:
            return stride * (0.5 - phase / on_ground), 0.0, 0.0
        swing = (phase - on_ground) / (1 - on_ground)
        # Leave and arrive at the ground's speed, so the paw neither skids nor stabs.
        speed = -stride * (1 - on_ground) / on_ground
        h00 = 2 * swing ** 3 - 3 * swing ** 2 + 1
        h10 = swing ** 3 - 2 * swing ** 2 + swing
        h01 = -2 * swing ** 3 + 3 * swing ** 2
        h11 = swing ** 3 - swing ** 2
        ahead = h00 * (-stride / 2) + h10 * speed + h01 * (stride / 2) + h11 * speed
        height = lift * math.sin(math.pi * swing) ** 1.2
        # Toes hang as the paw comes off the ground and lift before it lands.
        toes = -28 * math.sin(math.pi * min(swing * 1.6, 1)) * (1 - swing) + 10 * smoothstep((swing - 0.6) / 0.4) * (1 - smoothstep((swing - 0.9) / 0.1))
        return ahead, height, toes

    # Each clip is a function from a share of the clip (0 to 1) to a pose.

    def idle(self, phase):
        # Breathing: the chest rises and the back rounds a little, once a clip.
        breath = wave(phase, 0.3)
        self.body(
            rise=0.011 * breath,
            lean=0.8 * breath,
            arch=-2.4 * breath,
            neck_turn=pitch(-1.4 * breath),
            head_turn=pitch(1.0 * wave(phase, 0.45)) @ yaw(1.5 * wave(phase, 0.1)),
        )
        self.tail_wave(phase, swing=self.setting('idle', 'tail_swing', 8.0), lift=3.0 * breath)
        for leg in self.legs:
            self.foot(leg)

    def walk(self, phase):
        stride = self.setting('walk', 'stride', 0.32)
        lift = self.setting('walk', 'lift', 0.09)
        on_ground = 0.62
        # Left hind, left front, right hind, right front: a cat's walk.
        starts = {'hind_l': 0.0, 'front_l': 0.25, 'hind_r': 0.5, 'front_r': 0.75}
        # The hips swing toward the hind paw that is forward, the shoulders toward the front one.
        hips_yaw = -4.0 * wave(phase, 0.0)
        chest_yaw = -3.0 * wave(phase, 0.25)
        self.body(
            rise=-0.02 - 0.008 * wave(phase * 2, 0.1),
            sway=0.018 * wave(phase, 0.31),
            hips_turn=roll(1.5 * wave(phase, 0.3)) @ yaw(hips_yaw),
            chest_turn=yaw(chest_yaw - hips_yaw),
            neck_turn=pitch(1.5 * wave(phase * 2, 0.35)) @ yaw(-chest_yaw * 0.6),
            head_turn=yaw(-chest_yaw * 0.4),
        )
        self.tail_wave(phase, swing=self.setting('walk', 'tail_swing', 7.0), bounce=1.0)
        for leg, start in starts.items():
            ahead, height, toes = self.step(phase - start, on_ground, stride, lift)
            self.foot(leg, forward=ahead, lift=height, toes=toes)

    def run(self, phase):
        stride = self.setting('run', 'stride', 0.66)
        lift = self.setting('run', 'lift', 0.16)
        on_ground = 0.32
        # A gallop: both hind paws land close together and push, the cat is in
        # the air stretched out, both front paws land, and it gathers again.
        starts = {'hind_l': 0.0, 'hind_r': 0.09, 'front_l': 0.48, 'front_r': 0.58}
        arch = 13.0 * wave(phase, 0.95)
        lean = 6.0 * wave(phase, 0.24)
        self.body(
            rise=-0.085 + 0.035 * wave(phase, 0.42),
            forward=0.02 * wave(phase, 0.3),
            lean=lean,
            arch=arch,
            neck_turn=pitch(-(lean - arch * 0.4) * 0.6),
            head_turn=pitch(-(lean - arch * 0.4) * 0.3),
        )
        self.tail_wave(phase, swing=2.0, lift=-22.0, bounce=4.0)
        for leg, start in starts.items():
            ahead, height, toes = self.step(phase - start, on_ground, stride, lift)
            # In the air the hind paws tuck under and the front paws reach out.
            self.foot(leg, forward=ahead + (0.03 if leg.startswith('front') else 0.0), lift=height, toes=toes)

    def jump(self, _phase):
        # A leap, held: nose up, front paws reaching, hind legs trailing.
        self.body(lean=17.0, arch=-7.0, neck_turn=pitch(-9.0), head_turn=pitch(-4.0))
        self.tail_wave(0.0, swing=0.0, lift=-10.0)
        for leg in self.legs:
            if leg.startswith('front'):
                self.foot(leg, forward=0.2, lift=0.2, toes=-18.0)
            else:
                self.foot(leg, forward=-0.24, lift=0.06, toes=-40.0)

    def falling(self, _phase):
        # Coming down, held: nose down, front paws out to meet the ground, hind legs tucked.
        self.body(lean=-13.0, arch=6.0, neck_turn=pitch(9.0), head_turn=pitch(3.0))
        self.tail_wave(0.0, swing=0.0, lift=16.0)
        for leg in self.legs:
            if leg.startswith('front'):
                self.foot(leg, forward=0.17, lift=0.03, toes=16.0)
            else:
                self.foot(leg, forward=0.1, lift=0.2, toes=-25.0)

    def landing(self, _phase):
        # Touching down, held: the legs fold to take the drop.
        self.body(rise=-0.15, lean=-4.0, arch=5.0, neck_turn=pitch(6.0))
        self.tail_wave(0.0, swing=0.0, lift=-12.0)
        for leg in self.legs:
            self.foot(leg, out=0.02)

    def write(self):
        """Writes every clip into Blender, each on its own track so it is saved as its own animation."""
        clips = [
            ('idle', self.idle, self.setting('idle', 'seconds', 3.0), True),
            ('walk', self.walk, self.setting('walk', 'seconds', 0.8), True),
            ('run', self.run, self.setting('run', 'seconds', 0.46), True),
            ('jump', self.jump, 0.5, False),
            ('falling', self.falling, 0.5, False),
            ('landing', self.landing, 0.3, False),
        ]
        armature = self.armature
        armature.animation_data_create()
        for name, pose, seconds, moving in clips:
            action = bpy.data.actions.new(name)
            armature.animation_data.action = action
            frames = max(1, round(seconds * FPS))
            # A held pose needs only its two ends.
            for frame in (range(frames + 1) if moving else (0, frames)):
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
            say(f"clip {name}: {seconds:.2f} s, {'moving' if moving else 'a held pose'}")
        # Leave the skeleton at rest.
        for bone in armature.pose.bones:
            bone.location = (0, 0, 0)
            bone.rotation_quaternion = (1, 0, 0, 0)


# ---------- 6: save ----------

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
    arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(arguments) != 3:
        raise SystemExit('Usage: blender -b -P tools/rig-quadruped.py -- <source.glb> <rigged.glb> <guide.json>')
    source, out, guide_path = arguments
    with open(guide_path, encoding='utf8') as file:
        guide = json.load(file)

    mesh, armature = open_model(source)
    had_skeleton = armature is not None
    say(f"opened {source}: {len(mesh.data.vertices)} points, {'with' if had_skeleton else 'no'} skeleton")
    straighten(mesh, armature, guide.get('turned_left_degrees', 0))
    merge_seams(mesh)
    armature, added = build_skeleton(guide, armature)
    say(f"skeleton: {len(armature.data.bones)} bones" + (f", {len(added)} of them added" if had_skeleton else ''))
    skin(mesh, armature, added, had_skeleton)
    Quadruped(armature, guide).write()
    save(out)
    say(f"saved {out}")


main()
