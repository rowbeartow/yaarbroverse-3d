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
#      cannot spread across loose patches. If the guide gives "triangles",
#      the mesh is then thinned to about that many.
#   3. Builds the skeleton from the guide: hips, spine, chest, neck, head, four
#      legs (upper, lower, paw) and a tail, plus shoulder blades and ears when
#      the guide gives them. If the file already has a skeleton it is kept,
#      and only the bones it lacks are added.
#   4. Skins the model to the skeleton with Blender's automatic weights, then
#      checks every point got some. Small loose parts (a fang, a claw) take the
#      weights of the nearest part of the body. If the automatic weights fail
#      on the mesh as it is, a clean copy of it is weighted and the weights
#      are carried across.
#   5. Writes the clips: idle, walk, trot, run, jump, falling, landing, pounce.
#      They are a cat's (see the Quadruped class). Paws are placed by working the
#      leg joints back from where the toes should be, so a paw on the ground
#      stays where it is put, and the script stops if a clip asks a planted
#      paw to reach further than its leg is long. The walk, the trot and the
#      run (a gallop) share one clock, so the game can change gait in mid
#      stride. The script prints the speed each covers ground at and when
#      each paw lands: the game needs the three speeds (walkSpeed, trotSpeed
#      and runSpeed in src/view/hero-model.ts, times the size he is drawn
#      at, which tools/preview/measure.mjs prints).
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


def smootherstep(value):
    """Like smoothstep, but it also starts and ends with no change of speed."""
    value = min(1.0, max(0.0, value))
    return value * value * value * (value * (value * 6 - 15) + 10)


def flowing(keys, time):
    """
    The number at `time` from a list of (time, number) keys, on one smooth
    curve through them all: it passes each key without stopping there, and is
    level at the first and last. (`keyed` eases to a stop at every key, which
    suits a held pose and not a paw in the middle of a step.)
    """
    if time <= keys[0][0]:
        return keys[0][1]
    if time >= keys[-1][0]:
        return keys[-1][1]
    slopes = [0.0]
    for (t0, v0), (t1, v1), (t2, v2) in zip(keys, keys[1:], keys[2:]):
        before, after = (v1 - v0) / (t1 - t0), (v2 - v1) / (t2 - t1)
        # Level at a key that is a peak or a dip, so the curve never goes past it.
        slopes.append(0.0 if before * after <= 0 else (before * (t2 - t1) + after * (t1 - t0)) / (t2 - t0))
    slopes.append(0.0)
    for i, ((t0, v0), (t1, v1)) in enumerate(zip(keys, keys[1:])):
        if time <= t1:
            span = t1 - t0
            x = (time - t0) / span
            return ((2 * x ** 3 - 3 * x ** 2 + 1) * v0 + (x ** 3 - 2 * x ** 2 + x) * span * slopes[i]
                    + (-2 * x ** 3 + 3 * x ** 2) * v1 + (x ** 3 - x ** 2) * span * slopes[i + 1])


def bump(time, start, end, ease):
    """0 before `start` and after `end`, 1 between, easing over `ease` at each side."""
    return smoothstep((time - start) / ease) * (1 - smoothstep((time - (end - ease)) / ease))


def flick(time, start, length):
    """A quick there-and-back, from 0 to 1 to 0, starting at `start` and lasting `length`."""
    share = (time - start) / length
    return math.sin(math.pi * share) ** 2 if 0 < share < 1 else 0.0


def keyed(keys, time):
    """
    The value at `time` from a list of (time, value) keys, eased from each key
    to the next. A value is a number, a list of numbers, or a dict of those.
    """
    def mix(a, b, share):
        if isinstance(a, dict):
            return {name: mix(a[name], b[name], share) for name in a}
        if isinstance(a, (tuple, list)):
            return tuple(mix(x, y, share) for x, y in zip(a, b))
        return a + (b - a) * share
    if time <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if time <= t1:
            return mix(v0, v1, smoothstep((time - t0) / (t1 - t0)))
    return keys[-1][1]


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


def thin(mesh, triangles):
    """
    Brings the mesh down to about `triangles` triangles, keeping its shape and
    its picture. Meshy's models have far more than a small enemy on screen
    needs, and every one of them is moved by the skeleton on every frame.
    """
    mesh.data.calc_loop_triangles()
    before = len(mesh.data.loop_triangles)
    if not triangles or before <= triangles:
        return
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    modifier = mesh.modifiers.new('Thin', 'DECIMATE')
    modifier.decimate_type = 'COLLAPSE'
    modifier.ratio = triangles / before
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='Thin')
    # Thinning can leave the odd face with no area, or normals that no longer
    # fit, and the saver drops a mesh it finds faulty: put it right first.
    mesh.data.validate(clean_customdata=True)
    mesh.data.update()
    mesh.data.calc_loop_triangles()
    if mesh.data.validate():
        raise SystemExit('The mesh is still faulty after thinning. Try a different number of triangles in the guide.')
    say(f"thinned the mesh: {before} triangles -> {len(mesh.data.loop_triangles)}")


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
    # Extras a guide may give: shoulder blades, which ride on the chest and
    # show above the back as a cat walks, and ears.
    for name, parent in (('blade', 'chest'), ('ear', 'head')):
        for side, letter in (('left', 'l'), ('right', 'r')):
            if f'{name}_{side}' in joints:
                low, high = [to_blender(p) for p in joints[f'{name}_{side}']]
                plan.append((f'{name}_{letter}', low, high, parent, True))
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

    def __init__(self, armature, known_as, movable=()):
        self.armature = armature
        self.known_as = known_as
        self.rest = {bone.name: bone.matrix_local.copy() for bone in armature.data.bones}
        self.rest_tail = {bone.name: bone.tail_local.copy() for bone in armature.data.bones}
        # Bones that are moved as well as turned: the root, the hips, and any named.
        self.movable = set(movable) | {bone.name for bone in armature.data.bones if bone.parent is None or bone.parent.parent is None}
        # The furthest any paw has been asked to go past the length of its leg.
        self.short = 0.0
        self.short_where = ''
        self.frame = 0
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

    def place(self, bone, turn=None, move=None, aim=None, hold=None):
        """
        Poses one bone. `aim` points it along a direction, `turn` then turns it
        (see pitch, yaw and roll), and `move` shifts it. All in the skeleton's
        space. `hold` gives the bone a facing of its own (a 3 by 3 matrix)
        whatever its parents have done, for a head that stays level.
        """
        at = self.carried(bone)
        rotation = at.to_3x3() if hold is None else hold.copy()
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

    def reach(self, upper, lower, paw, toe, tipped=0.0, planted=True, soft=False):
        """
        Bends a leg so the paw's toes are at `toe`: the two leg bones are
        worked back from there. The knee bends the way it does in the model as
        it came. The paw lies as it does at rest, tipped about its toes by
        `tipped` degrees (below zero the heel comes up, above zero the toes).
        A paw in the air (`planted` false) may ask for more than the leg's
        length: the leg just stretches right out. With `soft`, a leg in the
        air nears its full length gently and never quite gets there: in a
        stride, a leg pulled dead straight snaps at the knee as it gets there.
        """
        paw_line = pitch(tipped).to_matrix() @ (self.rest_tail[paw] - self.rest_head(paw))
        ankle = toe - paw_line
        top = self.head(upper)
        first = (self.rest_head(lower) - self.rest_head(upper)).length
        second = (self.rest_head(paw) - self.rest_head(lower)).length
        line = ankle - top
        if planted and line.length - (first + second) > self.short:
            self.short = line.length - (first + second)
            self.short_where = f'{paw} at frame {self.frame}'
        distance = min(max(line.length, abs(first - second) + 1e-4), first + second - 1e-4)
        full = first + second
        eases_from = 0.955 * full
        if soft and not planted and line.length > eases_from:
            room = 0.995 * full - eases_from
            distance = eases_from + room * (1 - math.exp(-(line.length - eases_from) / room))
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
        self.place(paw, aim=paw_line)

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
            # Most bones only turn.
            if bone in self.movable:
                pose_bone.keyframe_insert('location', frame=frame)


class Quadruped:
    """
    The clips, written against the bones this script builds. They are a cat's:
    a four-beat walk in which each hind paw lands where the front paw on its
    side just was, a trot in diagonal pairs, a rotary gallop in which each paw
    lands by itself, a standing idle that is never still, and a jump, a fall
    and a landing.
    """

    def __init__(self, armature, guide):
        known_as = guide.get('bones', {})
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
        # Shoulder blades and ears are extras: a character without them still gets every clip.
        self.blades = {side: self.n(f'blade_{side}') for side in ('l', 'r') if self.n(f'blade_{side}') in names}
        self.ears = {side: self.n(f'ear_{side}') for side in ('l', 'r') if self.n(f'ear_{side}') in names}
        self.poser = Poser(armature, known_as, movable=set(self.blades.values()))
        self.settings = guide.get('clips', {})
        # Where each paw's toes rest, and how far forward that is.
        self.toe = {leg: self.poser.rest_tail[bones[2]].copy() for leg, bones in self.legs.items()}

    def setting(self, clip, name, default):
        return self.settings.get(clip, {}).get(name, default)

    # ----- The parts of a pose -----

    def trunk(self, rise=0.0, sway=0.0, forward=0.0, lean=0.0, arch=0.0, hips_yaw=0.0, hips_roll=0.0, chest_yaw=0.0, chest_roll=0.0):
        """
        Places the hips, spine and chest. `rise`, `sway` and `forward` move the
        whole body (metres up, to its left and ahead). `lean` tips it nose up
        and `arch` rounds the back upward (degrees; a negative arch hollows
        it). The hips and the chest can each turn to the left (`yaw`) and drop
        their left side (`roll`); the spine between them bends to join the two.
        """
        p = self.poser
        p.place(self.n('root'))
        p.place(self.n('hips'), turn=roll(hips_roll) @ yaw(hips_yaw) @ pitch(lean + arch * 0.4), move=Vector((sway, -forward, rise)))
        # The spine undoes the hips' share of the arch and adds its own, so the chest tips the other way.
        joints = len(self.spine) + 1
        each = roll((chest_roll - hips_roll) / joints) @ yaw((chest_yaw - hips_yaw) / joints) @ pitch(-arch * 0.8 / joints)
        for bone in self.spine:
            p.place(bone, turn=each)
        p.place(self.n('chest'), turn=each)

    def head(self, follow=0.0, turn=None, neck_turn=None, shift=None):
        """
        Holds the head steady while the body moves under it, as a cat does. It
        stays where and how it is at rest, and takes only the `follow` share
        (0 to 1) of the chest's movement. `turn` then turns the head, and
        `neck_turn` the neck; `shift` moves the head (metres).
        """
        p = self.poser
        neck, head = self.n('neck'), self.n('head')
        neck_at = p.carried(neck)
        carried = neck_at @ (p.rest[neck].inverted() @ p.rest[head])
        rest_place = p.rest[head].to_translation()
        place = rest_place.lerp(carried.to_translation(), follow) + (shift if shift is not None else Vector())
        p.place(neck, aim=place - neck_at.to_translation(), turn=neck_turn)
        facing = p.rest[head].to_quaternion().slerp(carried.to_quaternion(), follow)
        if turn is not None:
            facing = turn @ facing
        p.place(head, hold=facing.to_matrix())

    def paw(self, leg, at=None, forward=0.0, lift=0.0, out=0.0, toes=0.0, soft=False):
        """
        Puts a paw's toes `forward`, `lift` and `out` (away from the body)
        metres from where they rest, or with `at` that far forward along the
        body whichever side the paw is on. `toes` tips the paw about its toes:
        below zero the heel comes up and the paw hangs, above zero the toes lift.
        """
        upper, lower, paw = self.legs[leg]
        toe = self.toe[leg] + Vector((out if leg.endswith('_l') else -out, -forward, lift))
        if at is not None:
            toe.y = -at
        self.poser.reach(upper, lower, paw, toe, toes, planted=lift <= 0.005, soft=soft)

    def blade(self, side, rise=0.0, tip=0.0):
        """Slides a shoulder blade up along the ribs by `rise` metres and tips it by `tip` degrees."""
        if side in self.blades:
            self.poser.place(self.blades[side], turn=pitch(tip), move=Vector((0, 0, rise)))

    def ear(self, side, flick=0.0):
        """Flicks an ear back and out by `flick` degrees."""
        if side in self.ears:
            self.poser.place(self.ears[side], turn=pitch(flick) @ yaw(flick * (0.6 if side == 'l' else -0.6)))

    def tail_curve(self, time, sway, lift, lag, tip=None):
        """
        Poses the tail as a curve that follows the body late. `sway` and
        `lift` say how far the whole tail swings to the side and how far it
        curls up (degrees, for a moment in time; a lift below zero uncurls it
        and lets it stream out behind). Each bone reads them `lag` later than
        the one before, so a movement runs down the tail like a wave along a
        rope, and the end swings widest. `tip` is an extra flick of the last
        two bones.
        """
        count = len(self.tail)
        side = Vector((1, 0, 0))
        for i, bone in enumerate(self.tail):
            share = (i + 1) / count
            then = time - i * lag
            # Turn about whichever line swings this bone's far end sideways:
            # upright for a bone that points back, lengthways for one that
            # points up, as the end of a curled tail does.
            along = (self.poser.carried(bone).to_3x3() @ Vector((0, 1, 0))).normalized()
            axis = along.cross(side)
            axis = axis.normalized() if axis.length > 0.2 else Vector((0, 0, -1))
            swing = sway(then) * (0.35 + 0.65 * share)
            if tip is not None and i >= count - 2:
                swing += tip(time) * (1.0 if i == count - 1 else 0.5)
            # A tail points backward, so tipping it "nose down" raises it.
            turn = pitch(-lift(then) / count) @ Quaternion(axis, -math.radians(swing))
            self.poser.place(bone, turn=turn)

    @staticmethod
    def step(phase, on_ground, front, back, lift, heel, curl, toes_up, follow=0.4, heel_from=0.6, early=0.35):
        """
        One paw through one cycle. Returns how far forward along the body its
        toes are, how high, how the paw is tipped (see `paw`), and how much
        weight is on it (0 to 1).

        For the first `on_ground` share of the cycle the toes are planted and
        move back at the ground's speed from `front` to `back`, and the heel
        rolls up by `heel` degrees as the paw is about to leave. Then the paw
        swings forward: it curls back by `curl` degrees as it lifts, reaches
        forward with the toes up by `toes_up`, and sets down.

        The whole path is one continuous movement. The paw leaves the ground
        still moving back with it and comes down already moving back with it,
        so it neither skids nor stabs, and its speed never changes in a jump:
        it eases off the ground, and eases onto it. `follow` is the share of
        the swing over which it lets go of the ground's speed at one end and
        picks it up at the other. `early` says when in the swing the paw is
        highest: above zero in the first half, below zero in the second.
        """
        phase %= 1.0
        stride = front - back
        # How the paw is tipped, as one curve round the whole cycle: flat for
        # most of its time on the ground, heel up as it leaves, curled as it
        # lifts, toes up as it reaches, flat again as it lands.
        air = 1 - on_ground
        tipped = flowing([
            (0.0, 0.0),
            (on_ground * heel_from, 0.0),
            (on_ground, -heel),
            (on_ground + air * 0.3, -curl),
            (on_ground + air * 0.8, toes_up),
            (1.0, 0.0),
        ], phase)
        if phase < on_ground:
            share = phase / on_ground
            return front - stride * share, 0.0, tipped, math.sin(math.pi * share) ** 1.5
        swing = (phase - on_ground) / air
        # The ground's speed, in metres for the whole swing.
        speed = -stride * air / on_ground
        # Across from back to front with no speed at either end, plus the
        # ground's speed fading out after the paw leaves and in before it lands.
        leaving = 1 - smootherstep(swing / follow)
        arriving = smootherstep((swing - (1 - follow)) / follow)
        ahead = back + stride * smootherstep(swing) + speed * swing * leaving + speed * (swing - 1) * arriving
        # No upward speed at the moment it leaves or lands.
        height = lift * math.sin(math.pi * swing * (1 + early * (1 - swing))) ** 2
        return ahead, height, tipped, 0.0

    # ----- The clips. Each is a function from a share of the clip (0 to 1) to a pose. -----

    def idle(self, phase):
        seconds = self.setting('idle', 'seconds', 8.0)
        t = phase * seconds
        beat = lambda at, rate, peak=0.0: wave(at / seconds * rate, peak)
        breath = beat(t, 2, 0.15)            # two slow breaths
        weight = beat(t, 1, 0.2)             # weight eases onto the left paws, then the right
        # Twice he looks round: to his left for a while, later a shorter look to his right.
        look = 30 * bump(t, 1.3, 3.7, 0.7) - 22 * bump(t, 5.0, 6.7, 0.6)
        nod = 5 * bump(t, 1.3, 3.7, 0.7) - 3 * bump(t, 5.0, 6.7, 0.6)
        self.trunk(
            rise=0.008 * breath - 0.006 * weight * weight,
            sway=0.024 * weight,
            lean=0.5 * breath,
            arch=-1.8 * breath,
            hips_roll=1.4 * weight,
            hips_yaw=0.8 * weight,
            chest_roll=-0.9 * weight,
        )
        # The blade on the side that holds the weight stands a little higher.
        self.blade('l', rise=0.006 * breath + 0.012 * weight)
        self.blade('r', rise=0.006 * breath - 0.012 * weight)
        self.head(follow=0.35, turn=yaw(look * 0.65) @ pitch(nod + 0.8 * breath), neck_turn=yaw(look * 0.35))
        self.ear('r', 26 * flick(t, 0.85, 0.2))
        self.ear('l', 24 * flick(t, 4.3, 0.2) + 20 * flick(t, 7.05, 0.16) + 22 * flick(t, 7.3, 0.16))
        self.tail_curve(
            t,
            sway=lambda at: 9 * beat(at, 1, 0.45) + 4 * beat(at, 2, 0.1),
            lift=lambda at: 6 * beat(at, 2, 0.3),
            lag=0.16,
            tip=lambda at: 34 * flick(at, 2.2, 0.24) - 28 * flick(at, 2.5, 0.22) + 30 * flick(at, 5.9, 0.24) - 20 * flick(at, 6.2, 0.2),
        )
        for leg in self.legs:
            self.paw(leg)

    def walk_plan(self):
        """
        Where the paws go in a walk. The four take turns a quarter of a cycle
        apart: left hind, left front, right hind, right front. So a hind paw
        lands three quarters of a cycle after the front paw on its side, and
        to land in that paw's print it must land that much ground behind it.
        """
        on_ground = self.setting('walk', 'on_ground', 0.64)
        stride = self.setting('walk', 'stride', 0.62)
        front_middle = self.setting('walk', 'front_middle', 0.5)
        travel = stride / on_ground                    # ground covered in one cycle
        hind_middle = front_middle - 0.75 * travel
        return on_ground, stride, front_middle, hind_middle, travel

    def walk(self, phase):
        on_ground, stride, front_middle, hind_middle, _ = self.walk_plan()
        starts = {'hind_l': 0.0, 'front_l': 0.25, 'hind_r': 0.5, 'front_r': 0.75}
        paws = {}
        for leg, start in starts.items():
            front = leg.startswith('front')
            middle = front_middle if front else hind_middle
            paws[leg] = self.step(
                phase - start, on_ground, middle + stride / 2, middle - stride / 2,
                lift=self.setting('walk', 'lift', 0.13) * (1.0 if front else 0.75),
                # The front paw peels off the ground early and far: without that
                # his short front leg would be pulled straight as the paw leaves,
                # and the elbow would snap.
                heel=40 if front else 34,
                heel_from=0.5 if front else 0.6,
                curl=78 if front else 42,
                toes_up=14 if front else 6,
            )
        # The hips turn toward the hind paw that is forward and the shoulders
        # toward the front one, so the spine bends a little from side to side.
        hips_yaw = -5.0 * wave(phase, 0.0)
        chest_yaw = -4.0 * wave(phase, 0.25)
        self.trunk(
            rise=-0.035 - 0.006 * wave(phase * 2, 0.2),
            sway=0.014 * wave(phase, 0.45),
            hips_yaw=hips_yaw,
            chest_yaw=chest_yaw,
            # A hip drops as its leg swings forward.
            hips_roll=2.4 * wave(phase, 0.82),
            chest_roll=-1.0 * wave(phase, 0.07),
        )
        # Each shoulder blade stands up above the back while its leg carries
        # weight and sinks as that leg swings: one, then the other.
        for side in ('l', 'r'):
            ahead, _, _, weight = paws[f'front_{side}']
            self.blade(side, rise=0.06 * weight - 0.016, tip=-14 * (ahead - front_middle) / stride)
        self.head(follow=0.1, shift=Vector((0, 0, 0.004 * wave(phase * 2, 0.3))))
        self.tail_curve(phase, sway=lambda at: 11 * wave(at, 0.12), lift=lambda at: 4 * wave(at * 2, 0.3), lag=0.07)
        for leg, (ahead, height, tipped, _) in paws.items():
            self.paw(leg, at=ahead, lift=height, toes=tipped, soft=True)

    # The three gaits share one clock, so the game can switch between them in
    # mid stride. A paw's place in its own step is set by the middle of its
    # time on the ground, when it is under the body. The walk fixes those
    # moments; the trot and the gallop are timed to sit as near them as their
    # own orders allow: every paw of the trot is an eighth of a cycle from the
    # walk's, and every paw of the gallop under a third from the trot's.
    def walk_middles(self):
        """When each paw is in the middle of its time on the ground in the walk (shares of the cycle)."""
        on_ground = self.walk_plan()[0]
        return {leg: (start + on_ground / 2) % 1 for leg, start in (('hind_l', 0.0), ('front_l', 0.25), ('hind_r', 0.5), ('front_r', 0.75))}

    def trot_plan(self):
        """Where and when the paws go in a trot: diagonal pairs, left hind with right front, then right hind with left front."""
        on_ground = self.setting('trot', 'on_ground', 0.44)
        stride = self.setting('trot', 'stride', 0.48)
        # The left hind paw is an eighth of a cycle earlier than in the walk,
        # and the left front an eighth later, which brings each diagonal pair together.
        first = self.walk_middles()['hind_l'] - 0.125 - on_ground / 2
        starts = {'hind_l': first % 1, 'front_r': first % 1, 'hind_r': (first + 0.5) % 1, 'front_l': (first + 0.5) % 1}
        return on_ground, stride, stride / on_ground, starts

    def trot(self, phase):
        on_ground, stride, _, starts = self.trot_plan()
        front_middle = self.setting('trot', 'front_middle', 0.46)
        hind_middle = self.setting('trot', 'hind_middle', -0.34)
        paws = {}
        for leg, start in starts.items():
            front = leg.startswith('front')
            middle = front_middle if front else hind_middle
            paws[leg] = self.step(
                phase - start, on_ground, middle + stride / 2, middle - stride / 2,
                lift=self.setting('trot', 'lift', 0.12) * (1.0 if front else 0.8),
                heel=36 if front else 34,
                curl=64 if front else 44,
                toes_up=10 if front else 4,
                heel_from=0.5 if front else 0.6,
            )
        # Time from the moment the first pair (left hind, right front) lands.
        beat = phase - starts['hind_l']
        # The back stays level. The body dips a little as each pair takes the
        # weight and floats between pairs: two small bobs a cycle.
        self.trunk(
            rise=-0.035 + 0.011 * wave(beat * 2, 0.94),
            # The hips turn toward the hind paw that is forward and the
            # shoulders toward the front one. In a trot those are opposite
            # sides, so the spine bends one way, then the other.
            hips_yaw=-3.0 * wave(beat, 0.0),
            chest_yaw=2.5 * wave(beat, 0.0),
            hips_roll=1.4 * wave(beat, 0.72),
            chest_roll=0.8 * wave(beat, 0.22),
        )
        for side in ('l', 'r'):
            ahead, _, _, weight = paws[f'front_{side}']
            self.blade(side, rise=0.05 * weight - 0.012, tip=-12 * (ahead - front_middle) / stride)
        # The head is held where it is and does not bob with the body.
        self.head(follow=0.08)
        # Tail up, with a small sway and a bounce on each beat.
        self.tail_curve(phase, sway=lambda at: 6 * wave(at - starts['hind_l'], 0.15), lift=lambda at: 14 + 4 * wave((at - starts['hind_l']) * 2, 0.1), lag=0.06)
        for leg, (ahead, height, tipped, _) in paws.items():
            self.paw(leg, at=ahead, lift=height, toes=tipped, soft=True)

    def run_plan(self):
        """
        Where and when the paws go in a gallop. It is a rotary gallop: each
        paw lands by itself, going round the body: left hind, right hind,
        right front, left front. The hind paws land close together and so do
        the front paws, and he is off the ground twice: stretched out after
        the hind legs push, and for a moment gathered up after the front legs push.
        """
        on_ground = self.setting('run', 'on_ground', 0.24)
        stride = self.setting('run', 'stride', 0.56)
        between = self.setting('run', 'between', 0.13)        # from one paw of a pair landing to the other
        to_front = self.setting('run', 'to_front', 0.57)      # from the first hind paw landing to the first front paw
        after = {'hind_l': 0.0, 'hind_r': between, 'front_r': to_front, 'front_l': to_front + between}
        # When the first hind paw lands: wherever puts the paws nearest their
        # places in the trot (see `walk_middles`), counting the paw furthest from its own.
        trot_on_ground, _, _, trot_starts = self.trot_plan()
        def furthest(first):
            return max(abs(((first + after[leg] + on_ground / 2) - (trot_starts[leg] + trot_on_ground / 2) + 0.5) % 1 - 0.5) for leg in after)
        first = min((i / 200 for i in range(200)), key=furthest)
        return on_ground, stride, stride / on_ground, {leg: (first + wait) % 1 for leg, wait in after.items()}

    def run(self, phase):
        on_ground, stride, _, starts = self.run_plan()
        front_middle = self.setting('run', 'front_middle', 0.5)
        hind_middle = self.setting('run', 'hind_middle', -0.2)
        # The second paw of each pair to land is the leading one: it reaches a little further.
        lead = self.setting('run', 'lead', 0.04)
        paws = {}
        for leg, start in starts.items():
            front = leg.startswith('front')
            middle = (front_middle if front else hind_middle) + (lead if leg in ('hind_r', 'front_l') else 0.0)
            paws[leg] = self.step(
                phase - start, on_ground, middle + stride / 2, middle - stride / 2,
                lift=self.setting('run', 'lift', 0.24) * (1.0 if front else 0.85),
                heel=30 if front else 38,
                curl=85 if front else 55,
                toes_up=16 if front else 4,
                follow=0.3,
                heel_from=0.4,
                # The front paws stay up as they reach and come down late, so
                # he is seen to be off the ground. The hind paws snatch up.
                early=-0.45 if front else 0.35,
            )
        # Time from the moment the first hind paw lands.
        beat = phase - starts['hind_l']
        # The spine is a spring: curled tight as the legs gather under him
        # (just before the hind paws land), stretched long in the air after
        # they push.
        curl = wave(beat, 0.96)
        # He is highest in the air after the hind legs push, and rises a
        # little again as the front legs push.
        high = on_ground + self.setting('run', 'between', 0.13) + (self.setting('run', 'to_front', 0.57) - on_ground - self.setting('run', 'between', 0.13)) / 2
        self.trunk(
            rise=self.setting('run', 'rise', -0.06) + self.setting('run', 'bound', 0.035) * wave(beat, high) + self.setting('run', 'bob', 0.025) * wave(beat * 2, high * 2),
            # Nose up as the hind legs drive, nose down to meet the ground with the front paws.
            lean=self.setting('run', 'lean', 6.5) * wave(beat, 0.16),
            arch=5.0 + self.setting('run', 'arch', 21.0) * curl,
            # The body rolls a little onto each paw that lands first: the
            # left hind, then the right front.
            hips_roll=1.6 * wave(beat, 0.08),
            chest_roll=-1.6 * wave(beat, 0.62),
        )
        for side in ('l', 'r'):
            self.blade(side, rise=0.05 * paws[f'front_{side}'][3] - 0.01)
        self.head(follow=0.3)
        self.tail_curve(phase, sway=lambda at: 3 * wave(at - starts['hind_l'], 0.3), lift=lambda at: -52 - 16 * wave(at - starts['hind_l'], 0.1), lag=0.06)
        for leg, (ahead, height, tipped, _) in paws.items():
            self.paw(leg, at=ahead, lift=height, toes=tipped, soft=True)

    @staticmethod
    def footfalls(on_ground, starts):
        """The order the paws land in, and the shares of a cycle with no paw on the ground."""
        order = sorted(starts.items(), key=lambda item: item[1])
        marks = sorted({round(edge % 1, 6) for start in starts.values() for edge in (start, start + on_ground)})
        air = 0.0
        for a, b in zip(marks, marks[1:] + [marks[0] + 1]):
            middle = (a + b) / 2
            if not any((middle - start) % 1 < on_ground for start in starts.values()):
                air += b - a
        return order, air

    def shape(self, s, time=0.0, lag=0.0, tail=None):
        """Poses the whole cat from a few numbers, for the jump, the fall and the landing."""
        self.trunk(rise=s['rise'], lean=s['lean'], arch=s['arch'])
        self.blade('l', rise=s.get('blades', 0.0))
        self.blade('r', rise=s.get('blades', 0.0))
        self.head(follow=s.get('follow', 0.5), turn=pitch(s.get('look', 0.0)))
        for leg in self.legs:
            forward, lift, toes, out = s['front'] if leg.startswith('front') else s['hind']
            self.paw(leg, forward=forward, lift=lift, toes=toes, out=out)
        self.tail_curve(time, sway=lambda at: 0.0, lift=tail if tail else (lambda at: s.get('tail', 0.0)), lag=lag)

    # The jump is one movement from a crouch to the top of the leap and over.
    # The game plays its first part (to JUMP_PUSH) once, quickly, as he leaves
    # the ground, and holds the rest as a pose moved along by his upward speed.
    JUMP_PUSH = 0.2
    JUMP = [
        # Crouched low, hind legs gathered under him, looking where he is going.
        (0.0, dict(rise=-0.25, lean=-2, arch=15, follow=0.6, look=8, front=(0.03, 0, 0, 0), hind=(0.17, 0, 0, 0), tail=-8)),
        (0.09, dict(rise=-0.22, lean=7, arch=12, follow=0.6, look=8, front=(0.05, 0.03, -20, 0), hind=(0.15, 0, 0, 0), tail=-4)),
        # The hind legs drive straight; the front paws are already reaching.
        (0.2, dict(rise=0.07, lean=26, arch=-6, follow=0.6, look=-8, front=(0.2, 0.32, -25, 0), hind=(-0.3, -0.03, -52, 0), tail=-30)),
        # Fully stretched: front paws ahead, hind legs trailing, back long.
        (0.42, dict(rise=0.05, lean=11, arch=-15, follow=0.55, look=-4, front=(0.3, 0.36, 12, 0), hind=(-0.48, 0.12, -66, 0), tail=-115)),
        (0.62, dict(rise=0.04, lean=3, arch=-12, follow=0.55, look=0, front=(0.3, 0.3, 12, 0), hind=(-0.44, 0.14, -60, 0), tail=-120)),
        # Over the top: the front paws start down, the hind legs come under.
        (1.0, dict(rise=0.0, lean=-9, arch=4, follow=0.5, look=5, front=(0.2, 0.08, 10, 0.03), hind=(-0.2, 0.1, -34, 0.04), tail=-90)),
    ]

    def jump(self, phase):
        seconds = 0.6
        self.shape(keyed(self.JUMP, phase), time=phase * seconds, lag=0.035, tail=lambda at: keyed(self.JUMP, max(0.0, at) / seconds)['tail'])

    # The pounce is one movement: he gathers, drives off his hind legs and
    # goes out long and flat, front paws reaching ahead with the claws up. The
    # game holds it as a pose that follows how far through the burst he is,
    # so the clip's length does not matter. It ends near the jump's own pose
    # over the top, which is what takes over when the burst is done.
    POUNCE = [
        (0.0, dict(rise=-0.2, lean=4, arch=12, follow=0.6, look=4, front=(0.06, 0.02, -10, 0), hind=(0.14, 0, 0, 0), tail=-10)),
        (0.2, dict(rise=-0.02, lean=10, arch=-8, follow=0.6, look=-6, front=(0.26, 0.3, -10, 0.02), hind=(-0.34, 0.0, -50, 0), tail=-60)),
        (0.55, dict(rise=0.0, lean=2, arch=-16, follow=0.55, look=-2, front=(0.36, 0.38, 25, 0.04), hind=(-0.5, 0.14, -66, 0), tail=-125)),
        (1.0, dict(rise=0.0, lean=-10, arch=-4, follow=0.5, look=6, front=(0.3, 0.16, 30, 0.05), hind=(-0.36, 0.14, -50, 0.03), tail=-100)),
    ]

    def pounce(self, phase):
        seconds = 0.3
        self.shape(keyed(self.POUNCE, phase), time=phase * seconds, lag=0.03, tail=lambda at: keyed(self.POUNCE, max(0.0, at) / seconds)['tail'])

    def falling(self, phase):
        # Dropping: legs reaching down and spread to meet the ground, back a
        # little rounded, tail out behind and working for balance.
        paddle = lambda peak: wave(phase, peak)
        self.trunk(rise=0.0, lean=-6.0 + 1.0 * paddle(0.0), arch=9.0 + 1.5 * paddle(0.25))
        self.blade('l', rise=0.01)
        self.blade('r', rise=0.01)
        self.head(follow=0.45, turn=pitch(4.0))
        self.paw('front_l', forward=0.1 + 0.025 * paddle(0.0), lift=-0.01, toes=12, out=0.07)
        self.paw('front_r', forward=0.1 + 0.025 * paddle(0.5), lift=-0.01, toes=12, out=0.07)
        self.paw('hind_l', forward=-0.14 + 0.03 * paddle(0.3), lift=-0.035, toes=-28, out=0.09)
        self.paw('hind_r', forward=-0.14 + 0.03 * paddle(0.8), lift=-0.035, toes=-28, out=0.09)
        self.tail_curve(phase, sway=lambda at: 12 * wave(at, 0.0), lift=lambda at: -92 + 12 * wave(at, 0.25), lag=0.09)

    # The landing, played once as he touches down.
    LANDING_SECONDS = 0.6
    LANDING = [
        # Front paws take the ground first, hind paws still in the air.
        (0.0, dict(rise=-0.025, lean=-13, arch=6, follow=0.5, look=6, front=(0.0, 0, 6, 0.0), hind=(0.02, 0.14, -26, 0.0), tail=-44, blades=0.02)),
        # Hind paws down.
        (0.15, dict(rise=-0.06, lean=-7, arch=8, follow=0.5, look=4, front=(0.0, 0, 0, 0.0), hind=(0.05, 0, 0, 0.0), tail=-30, blades=0.045)),
        # The body sinks between the shoulders to take the drop.
        (0.36, dict(rise=-0.25, lean=-2, arch=11, follow=0.45, look=0, front=(0.0, 0, 0, 0.0), hind=(0.05, 0, 0, 0.0), tail=14, blades=0.06)),
        # And stands again.
        (0.72, dict(rise=-0.02, lean=0.5, arch=2, follow=0.4, look=0, front=(0.0, 0, 0, 0.0), hind=(0.05, 0, 0, 0.0), tail=-6, blades=0.0)),
        (1.0, dict(rise=0.0, lean=0, arch=0, follow=0.35, look=0, front=(0.0, 0, 0, 0.0), hind=(0.05, 0, 0, 0.0), tail=0, blades=0.0)),
    ]

    def landing(self, phase):
        seconds = self.LANDING_SECONDS
        self.shape(keyed(self.LANDING, phase), time=phase * seconds, lag=0.04, tail=lambda at: keyed(self.LANDING, max(0.0, at) / seconds)['tail'])

    # Clips in which a paw on the ground may be asked for more than its leg's length.
    stretched = ('jump', 'falling', 'pounce')

    def clips(self):
        """Every clip: its name, the function that poses it, and how long it lasts in seconds."""
        return [
            ('idle', self.idle, self.setting('idle', 'seconds', 8.0)),
            ('walk', self.walk, self.setting('walk', 'seconds', 0.8)),
            ('trot', self.trot, self.setting('trot', 'seconds', 0.4)),
            ('run', self.run, self.setting('run', 'seconds', 0.4667)),
            ('jump', self.jump, 0.6),
            ('falling', self.falling, 1.0),
            ('landing', self.landing, self.LANDING_SECONDS),
            ('pounce', self.pounce, 0.3),
        ]

    def report(self, lasts):
        """Prints what the game needs to know about the gaits: speeds, and when each paw lands."""
        on_ground, stride, front_middle, hind_middle, travel = self.walk_plan()
        say(f"walk: {travel:.2f} m of ground a cycle, {travel / lasts['walk']:.2f} m a second. Front paws work from {front_middle + stride / 2:.2f} to {front_middle - stride / 2:.2f} m ahead of the middle, hind paws from {hind_middle + stride / 2:.2f} to {hind_middle - stride / 2:.2f}: each hind paw lands in the print of the front paw on its side")
        names = {'hind_l': 'left hind', 'hind_r': 'right hind', 'front_l': 'left front', 'front_r': 'right front'}
        for name, plan in (('trot', self.trot_plan()), ('run', self.run_plan())):
            on_ground, _, travel, starts = plan
            seconds = lasts[name]
            order, air = self.footfalls(on_ground, starts)
            landings = ', '.join(f"{names[leg]} at {start:.2f}" for leg, start in order)
            say(f"{name}: {travel:.2f} m of ground a cycle, {travel / seconds:.2f} m a second. Paws land: {landings} of the cycle, each down for {on_ground:.2f} of it. No paw is down for {air:.2f} of it")

    def write(self):
        """Writes every clip into Blender, each on its own track so it is saved as its own animation."""
        armature = self.armature
        armature.animation_data_create()
        lasts = {}
        for name, pose, seconds in self.clips():
            action = bpy.data.actions.new(name)
            armature.animation_data.action = action
            frames = max(1, round(seconds * FPS))
            # A clip is a whole number of frames long.
            seconds = lasts[name] = frames / FPS
            self.poser.short = 0.0
            for frame in range(frames + 1):
                self.poser.frame = frame
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
            say(f"clip {name}: {seconds:.2f} s")
            # A paw on the ground asked to go further than its leg is long would not
            # be where the clip put it. (In the air a leg may stretch right out.)
            if name not in self.stretched and self.poser.short > 0.002:
                raise SystemExit(f"In the {name} clip a paw on the ground ({self.poser.short_where}) is asked to reach {self.poser.short * 100:.1f} cm further than its leg is long. Shorten the stride or move the paws' path (see the guide's \"clips\").")
        self.report(lasts)
        # Leave the skeleton at rest.
        for bone in armature.pose.bones:
            bone.location = (0, 0, 0)
            bone.rotation_quaternion = (1, 0, 0, 0)


class MarmotScout(Quadruped):
    """
    The marmot scout's clips, one for each thing it does in the game (its
    behaviour is Caputo Mountain's): it watches on all fours, shuffles toward
    or away from a hero, rears up with an acorn as a warning, throws, stands
    winded after a throw, hops back out of the way, flinches when struck, and
    goes over on its back when beaten. A guide picks these with
    "character": "marmot". Its front legs are its arms.
    """

    stretched = ('hop',)

    # A whole-body pose in a few numbers. Each paw is (forward, lift, toes,
    # out), as `paw` takes them; fl is the front left paw, hr the hind right.
    DOWN = (0.0, 0.0, 0.0, 0.0)
    ALERT = dict(rise=0.0, lean=0.0, arch=0.0, roll=0.0, follow=0.4, look=0.0, drop=0.0, fl=DOWN, fr=DOWN, hl=DOWN, hr=DOWN, tail=0.0, ears=0.0)
    # Up on its hind legs, right arm back over the shoulder with the acorn,
    # left paw at its chest.
    REARED = dict(ALERT, rise=-0.05, lean=50.0, arch=-6.0, follow=1.0, look=-46.0, fl=(-0.44, 0.7, -30.0, -0.1), fr=(-0.86, 1.3, -25.0, 0.06), tail=-16.0, ears=10.0)
    # Head hung, back rounded, sagging over its front paws.
    WINDED = dict(ALERT, rise=-0.08, lean=-7.0, arch=9.0, follow=1.0, look=-20.0, drop=-0.05, tail=-22.0, ears=22.0)

    def stance(self, s, time=0.0, tail_sway=None, turn=0.0):
        """Poses the whole marmot from one of the dicts above."""
        self.trunk(rise=s['rise'], lean=s['lean'], arch=s['arch'], hips_roll=s['roll'], chest_roll=s['roll'])
        self.head(follow=s['follow'], turn=yaw(turn) @ pitch(s['look']), neck_turn=yaw(turn * 0.4), shift=Vector((0, 0, s['drop'])))
        self.ear('l', s['ears'])
        self.ear('r', s['ears'])
        for leg, key in (('front_l', 'fl'), ('front_r', 'fr'), ('hind_l', 'hl'), ('hind_r', 'hr')):
            forward, lift, toes, out = s[key]
            self.paw(leg, forward=forward, lift=lift, toes=toes, out=out)
        self.tail_curve(time, sway=tail_sway or (lambda at: 0.0), lift=lambda at: s['tail'], lag=0.05)

    def idle(self, phase):
        # On watch: breathing, sniffing the air, a look to each side, ears and tail twitching.
        seconds = 4.0
        t = phase * seconds
        breath = wave(phase * 3, 0.1)
        look = 26 * bump(t, 0.6, 1.7, 0.35) - 22 * bump(t, 2.3, 3.3, 0.35)
        sniff = 5 * flick(t, 0.2, 0.18) + 5 * flick(t, 0.42, 0.18) + 4 * flick(t, 1.9, 0.16) + 4 * flick(t, 2.1, 0.16)
        s = dict(self.ALERT, rise=0.008 * breath, arch=-1.5 * breath, look=sniff + 1.0 * breath, ears=18 * flick(t, 1.2, 0.18) + 16 * flick(t, 3.5, 0.18))
        self.stance(s, t, tail_sway=lambda at: 10 * flick(at, 0.9, 0.3) - 9 * flick(at, 2.8, 0.3), turn=look)

    def walk_plan(self):
        on_ground = 0.62
        stride = self.setting('walk', 'stride', 0.16)
        return on_ground, stride, stride / on_ground

    def walk(self, phase):
        # A low shuffle in diagonal pairs, rocking from side to side.
        on_ground, stride, _ = self.walk_plan()
        starts = {'hind_l': 0.0, 'front_r': 0.06, 'hind_r': 0.5, 'front_l': 0.56}
        for leg, start in starts.items():
            front = leg.startswith('front')
            middle = -self.toe[leg].y - (0.09 if front else 0.0)
            ahead, height, tipped, _ = self.step(phase - start, on_ground, middle + stride / 2, middle - stride / 2,
                                                 lift=0.08 if front else 0.06, heel=24, curl=30, toes_up=8)
            self.paw(leg, at=ahead, lift=height, toes=tipped, soft=True)
        self.trunk(rise=-0.07 - 0.008 * wave(phase * 2, 0.25), sway=0.015 * wave(phase, 0.3),
                   hips_roll=4.0 * wave(phase, 0.3), chest_roll=-2.5 * wave(phase, 0.3),
                   hips_yaw=-4.0 * wave(phase, 0.0), chest_yaw=3.0 * wave(phase, 0.0))
        self.head(follow=0.3)
        self.ear('l')
        self.ear('r')
        self.tail_curve(phase, sway=lambda at: 12 * wave(at, 0.15), lift=lambda at: 0.0, lag=0.06)

    def warning(self, phase):
        # Rears up with the acorn, then holds it there, arm trembling, until the throw.
        s = keyed([(0.0, self.ALERT), (0.16, dict(self.ALERT, rise=-0.07, arch=8.0, look=6.0)), (0.5, self.REARED), (1.0, self.REARED)], phase)
        held = smoothstep((phase - 0.5) / 0.1)
        shake = 0.02 * held * wave(phase * 9)
        forward, lift, toes, out = s['fr']
        s = dict(s, fr=(forward - shake, lift + shake, toes, out), lean=s['lean'] + 1.2 * held * wave(phase * 4.5))
        self.stance(s, phase)

    def throw(self, phase):
        # The arm whips over and forward, the acorn leaves at the top, and it drops back onto all fours.
        s = keyed([
            (0.0, self.REARED),
            # The acorn leaves the paw here.
            (0.2, dict(self.REARED, lean=38.0, look=-28.0, fr=(-0.2, 1.0, 5.0, 0.0), fl=(-0.5, 0.5, -30.0, -0.06), tail=-6.0)),
            (0.42, dict(self.REARED, rise=-0.03, lean=20.0, look=-14.0, fr=(-0.02, 0.5, 10.0, 0.0), fl=(-0.3, 0.3, -20.0, -0.03), tail=6.0)),
            (0.75, dict(self.ALERT, rise=-0.06, lean=-3.0, arch=6.0, look=-6.0, follow=1.0)),
            (1.0, dict(self.ALERT, follow=1.0)),
        ], phase)
        self.stance(s, phase)

    def winded(self, phase):
        # Getting its breath back: heavy, quick breaths, head hung.
        pant = wave(phase * 4, 0.1)
        s = dict(self.WINDED, rise=self.WINDED['rise'] + 0.014 * pant, arch=self.WINDED['arch'] - 3.0 * pant, look=self.WINDED['look'] + 2.5 * pant)
        self.stance(s, phase * 2.0, tail_sway=lambda at: 3 * wave(at, 0.0))

    def hit(self, phase):
        # Struck: it rocks back off its front paws, then sags, winded.
        s = keyed([
            (0.0, self.ALERT),
            (0.3, dict(self.ALERT, rise=0.03, lean=16.0, look=14.0, follow=1.0, fl=(-0.08, 0.14, -20.0, 0.04), fr=(-0.08, 0.14, -20.0, 0.04), tail=14.0, ears=30.0)),
            (0.7, dict(self.WINDED, rise=-0.1)),
            (1.0, self.WINDED),
        ], phase)
        self.stance(s, phase)

    def hop(self, phase):
        # A hop out of the way. The game moves it; here it only crouches, tucks its legs and lands.
        tucked = (0.0, 0.13, -30.0, 0.0)
        s = keyed([
            (0.0, dict(self.ALERT, rise=-0.1, arch=10.0)),
            (0.25, dict(self.ALERT, lean=12.0, arch=-4.0, look=-8.0, follow=1.0, fl=(0.0, 0.16, -30.0, 0.0), fr=(0.0, 0.16, -30.0, 0.0), hl=tucked, hr=tucked, tail=20.0)),
            (0.7, dict(self.ALERT, lean=-8.0, arch=4.0, look=6.0, follow=1.0, fl=(0.04, 0.03, 10.0, 0.0), fr=(0.04, 0.03, 10.0, 0.0), hl=(0.0, 0.07, -15.0, 0.0), hr=(0.0, 0.07, -15.0, 0.0), tail=-10.0)),
            (0.86, dict(self.WINDED, rise=-0.12)),
            (1.0, self.WINDED),
        ], phase)
        self.stance(s, phase)

    def defeated(self, phase):
        # Beaten: it tips over sideways onto its back and lies there, paws in the air.
        over = keyed([(0.0, 0.0), (0.12, -8.0), (0.6, 186.0), (0.8, 176.0), (1.0, 180.0)], phase)
        on_back = smoothstep(over / 180.0)
        drop = self.setting('defeated', 'drop', 0.2)
        self.trunk(rise=0.05 * math.sin(math.pi * min(1.0, phase / 0.6)) - drop * on_back, lean=-self.setting('defeated', 'level', 8.0) * on_back,
                   arch=6.0 * on_back, hips_roll=over, chest_roll=over)
        self.head(follow=1.0, turn=pitch(-10.0 * on_back))
        self.ear('l', 25 * on_back)
        self.ear('r', 25 * on_back)
        # The legs go with the body, and the paws fold in a little.
        kick = wave(phase * 3) * (1 - on_back) * 10
        for leg, (upper, lower, paw) in self.legs.items():
            self.poser.place(upper)
            self.poser.place(lower, turn=pitch((-18.0 if leg.startswith('front') else 14.0) * on_back + kick))
            self.poser.place(paw)
        self.tail_curve(phase, sway=lambda at: 0.0, lift=lambda at: -14.0 * on_back, lag=0.04)

    def clips(self):
        return [
            ('idle', self.idle, 4.0),
            ('walk', self.walk, self.setting('walk', 'seconds', 0.6)),
            ('warning', self.warning, 0.8),
            ('throw', self.throw, 0.5),
            ('winded', self.winded, 2.0),
            ('hit', self.hit, 0.4),
            ('hop', self.hop, 0.5),
            ('defeated', self.defeated, 0.9),
        ]

    def report(self, lasts):
        _, _, travel = self.walk_plan()
        say(f"walk: {travel:.2f} m of ground a cycle, {travel / lasts['walk']:.2f} m a second, in the model's own size")
        say('throw: the acorn leaves the paw a fifth of the way through the clip')


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


CHARACTERS = {'cat': Quadruped, 'marmot': MarmotScout}


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
    thin(mesh, guide.get('triangles'))
    armature, added = build_skeleton(guide, armature)
    say(f"skeleton: {len(armature.data.bones)} bones" + (f", {len(added)} of them added" if had_skeleton else ''))
    skin(mesh, armature, added, had_skeleton)
    CHARACTERS[guide.get('character', 'cat')](armature, guide).write()
    save(out)
    say(f"saved {out}")


if __name__ == '__main__':
    main()
