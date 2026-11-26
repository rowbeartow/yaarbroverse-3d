# Gives Walblum, a small muskrat who stands upright, a skeleton and his
# animation clips, in Blender, with no window. Meshy is not asked: the model
# was made standing with his arms out, so a simple two-legged skeleton fits.
#
#   blender -b -P tools/rig-walblum.py -- <source.glb> <rigged.glb> <guide.json>
#
#   source.glb   walblum-b.glb, as it came from Meshy (on the hero-models
#                release; never made again)
#   rigged.glb   where to save the rigged, animated model. Run
#                `node tools/compress-hero.mjs <rigged.glb> walblum 1024 heroes`
#                on it next, and commit only what that makes.
#   guide.json   tools/walblum.rig.json: where his joints are, where his
#                whiskers are, and how many triangles he keeps
#
# Needs Blender 4 with its glTF add-on and numpy, as tools/rig-quadruped.py
# does. It borrows that script's steps for opening, tidying, skinning and
# saving a model, so the two files must stay side by side.
#
# What it does:
#   1. Opens the model, stands it on the ground, and merges the doubled
#      points along the seams of its picture.
#   2. Straightens his whiskers (the owner's order): in the model they hang
#      down. Each whisker is found by its colour and place, and turned about
#      its root until it stands out level from his muzzle, the three on each
#      side fanned a little.
#   3. Thins the mesh to the guide's "triangles", keeping more of them on his
#      face and all of his whiskers, shades it smooth, and paints it a
#      picture of its own from the model as it came (Meshy's picture is cut
#      into more than a thousand patches, and a thinned mesh shows slivers of
#      the wrong colour along their seams).
#   4. Builds the skeleton from the guide: hips, spine, chest, head, two arms
#      (upper, lower, hand), two legs (upper, lower, foot) and a tail in three
#      parts. A right arm or leg the guide leaves out mirrors the left.
#   5. Skins the model with Blender's automatic weights, worked out on a
#      plain, evenly thinned copy and carried across (his whiskers are too
#      thin for them). His whiskers follow his head and nothing else.
#   6. Writes the clips, every one on the spot (the game moves him):
#        idle     standing, breathing, a nervous look left and right
#        scared   crouched small, trembling, clutching himself, glancing about
#        paddle   lying forward and swimming: legs kicking, tail sculling
#        cheer    jumping for joy with his arms up
#        kick     a flying karate kick held in the air, one leg straight out
#                 ahead, the other tucked, arms in guard, leaning back
#        spin     tucked into a ball, tumbling head over heels once a loop
#      In paddle, kick and spin his body turns about his middle (the guide's
#      "middle"), which stays where it is when he stands: the game puts that
#      point where it wants him.
#   7. Saves the result as a GLB with one animation per clip.

import colorsys
import importlib.util
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree

# The shared steps live in the four-legged rig script.
_spec = importlib.util.spec_from_file_location('rig_quadruped', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rig-quadruped.py'))
quad = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(quad)

FPS = quad.FPS
TAU = quad.TAU
say = quad.say
to_blender = quad.to_blender
pitch, yaw, roll, smoothstep, keyed = quad.pitch, quad.yaw, quad.roll, quad.smoothstep, quad.keyed


# ---------- 2: whiskers ----------

def colours_of(mesh):
    """The colour of the model's picture at every point, as (hue 0 to 360, saturation, value)."""
    data = mesh.data
    image = next(n.image for m in data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and n.image.colorspace_settings.name == 'sRGB')
    width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, -1)[:, :, :3]
    layer = data.uv_layers.active.data
    seen = [[] for _ in data.vertices]
    for loop in data.loops:
        u, v = layer[loop.index].uv
        seen[loop.vertex_index].append(pixels[int((v % 1) * height) % height, int((u % 1) * width) % width])
    out = []
    for each in seen:
        red, green, blue = np.mean(each, axis=0) if each else (0, 0, 0)
        hue, saturation, value = colorsys.rgb_to_hsv(float(red), float(green), float(blue))
        out.append((hue * 360, saturation, value))
    return out


def find_whiskers(mesh, guide):
    """Each whisker as a list of point numbers: pale points out beyond the muzzle, joined to each other along the mesh."""
    where = guide['whiskers']
    colours = colours_of(mesh)
    low, high = where['between']
    pale = set()
    for vert in mesh.data.vertices:
        _, saturation, value = colours[vert.index]
        if abs(vert.co.x) > where['beyond'] and low < vert.co.z < high and -vert.co.y > where['ahead_of'] and saturation < where['look']['saturation'] and value > where['look']['value']:
            pale.add(vert.index)
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bm.verts.ensure_lookup_table()
    whiskers, seen = [], set()
    for start in pale:
        if start in seen:
            continue
        seen.add(start)
        stack, group = [start], []
        while stack:
            at = stack.pop()
            group.append(at)
            for edge in bm.verts[at].link_edges:
                other = edge.other_vert(bm.verts[at]).index
                if other in pale and other not in seen:
                    seen.add(other)
                    stack.append(other)
        across = [abs(mesh.data.vertices[i].co.x) for i in group]
        # A whisker is long; a stray pale patch of cheek is not.
        if max(across) - min(across) <= where['at_least']:
            continue
        # The whole strand: a point at its tip may not look pale, but everything joined to it further out than its root is whisker.
        root = min(across)
        stack = list(group)
        while stack:
            at = stack.pop()
            for edge in bm.verts[at].link_edges:
                other = edge.other_vert(bm.verts[at]).index
                if other not in seen and abs(mesh.data.vertices[other].co.x) > root:
                    seen.add(other)
                    group.append(other)
                    stack.append(other)
        whiskers.append(group)
    bm.free()
    return whiskers


def straighten_whiskers(mesh, guide):
    """
    Turns each whisker about its root so it stands out from the muzzle at the
    guide's angle above level ("lift": the top whisker on each side first),
    and marks the whiskers' points (a vertex group) so they can be given to
    the head once the model is skinned.
    """
    whiskers = find_whiskers(mesh, guide)
    lifts = guide['whiskers']['lift']
    verts = mesh.data.vertices
    measured = []
    for group in whiskers:
        group = sorted(group, key=lambda i: abs(verts[i].co.x))
        some = max(3, len(group) // 10)
        root = sum((verts[i].co for i in group[:some]), Vector()) / some
        tip = sum((verts[i].co for i in group[-some:]), Vector()) / some
        line = tip - root
        measured.append((group, root, line, math.degrees(math.atan2(line.z, math.hypot(line.x, line.y)))))
    marked = mesh.vertex_groups.new(name='whiskers')
    for side, name in ((1, 'left'), (-1, 'right')):
        mine = sorted((m for m in measured if m[1].x * side > 0), key=lambda m: -m[3])
        for rank, (group, root, line, was) in enumerate(mine):
            share = rank / (len(mine) - 1) if len(mine) > 1 else 0.5
            # Between the first and last of the guide's angles, by where this whisker is in the fan.
            at = share * (len(lifts) - 1)
            lift = lifts[int(at)] + (lifts[min(len(lifts) - 1, int(at) + 1)] - lifts[int(at)]) * (at - int(at))
            level = Vector((line.x, line.y, 0)).normalized()
            wanted = level * math.cos(math.radians(lift)) + Vector((0, 0, 1)) * math.sin(math.radians(lift))
            turn = line.normalized().rotation_difference(wanted).to_matrix()
            for i in group:
                verts[i].co = root + turn @ (verts[i].co - root)
            marked.add(group, 1.0, 'REPLACE')
            say(f"whisker on his {name}, {len(group)} points, {line.length:.2f} m long: was {was:.0f} degrees above level, now {lift:.0f}")
    if len(whiskers) != guide['whiskers'].get('count', len(whiskers)):
        raise SystemExit(f"Found {len(whiskers)} whiskers, and the guide says he has {guide['whiskers']['count']}. Check \"whiskers\" in the guide.")
    mesh.data.update()


# ---------- 3: thinning, and a picture of his own ----------

def thin_keeping(mesh, triangles, fine):
    """
    Brings the mesh down to about `triangles` triangles, as the shared `thin`
    does, but keeps more of them where the guide's "fine" says: his face,
    which is looked at, and his whiskers, which are too thin to lose any.
    """
    keep = mesh.vertex_groups.new(name='fine')
    whiskers = mesh.vertex_groups['whiskers'].index
    for vert in mesh.data.vertices:
        if any(g.group == whiskers for g in vert.groups):
            keep.add([vert.index], 1.0, 'REPLACE')
        elif vert.co.z > fine['above'] and -vert.co.y > fine['ahead_of']:
            # Easing in over 10 cm, so the mesh does not change size along a line.
            keep.add([vert.index], smoothstep((vert.co.z - fine['above']) / 0.1) * smoothstep((-vert.co.y - fine['ahead_of']) / 0.1), 'REPLACE')
    def count():
        """How many triangles the mesh has, and how many of them are in the fine part."""
        mesh.data.calc_loop_triangles()
        index = mesh.vertex_groups['fine'].index
        inside = {vert.index for vert in mesh.data.vertices if any(g.group == index and g.weight > 0.5 for g in vert.groups)}
        return len(mesh.data.loop_triangles), sum(1 for triangle in mesh.data.loop_triangles if all(i in inside for i in triangle.vertices))

    def thin_part(wanted, the_rest):
        """Thins only the fine part, or only the rest, until the whole mesh has `wanted` triangles."""
        total, _ = count()
        modifier = mesh.modifiers.new('Thin', 'DECIMATE')
        modifier.decimate_type = 'COLLAPSE'
        modifier.ratio = wanted / total
        modifier.use_collapse_triangulate = True
        # A decimate modifier with a vertex group thins only inside it.
        modifier.vertex_group = 'fine'
        modifier.invert_vertex_group = the_rest
        bpy.ops.object.modifier_apply(modifier='Thin')

    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    before, fine_before = count()
    # First the fine part down to its own share, then the rest down to what is left.
    thin_part(before - fine_before + fine['triangles'], False)
    thin_part(triangles, True)
    after, fine_after = count()
    mesh.vertex_groups.remove(mesh.vertex_groups['fine'])
    mesh.data.validate(clean_customdata=True)
    mesh.data.update()
    mesh.data.calc_loop_triangles()
    if mesh.data.validate():
        raise SystemExit('The mesh is still faulty after thinning. Try a different number of triangles in the guide.')
    # He comes faceted: shade him smooth, with only real creases left sharp.
    for face in mesh.data.polygons:
        face.use_smooth = True
    mesh.data.use_auto_smooth = True
    mesh.data.auto_smooth_angle = math.radians(fine.get('smooth_up_to', 70))
    say(f"thinned the mesh: {before} triangles -> {after}, {fine_after} of them on his face and whiskers (which had {fine_before})")


def own_picture(mesh, full, size):
    """
    Gives the thinned mesh a picture of its own, painted from the model as it
    came (`full`). Thinning joins points across the seams of Meshy's picture,
    which is cut into more than a thousand patches, and every triangle left
    straddling a seam shows as a sliver of the wrong colour. So the thinned
    mesh is laid out on a new picture in a few large patches, and each dot of
    it takes the colour of the model as it came at the nearest place on its
    skin. (Blender's own baking gives a black picture with no window, so the
    painting is done here.)
    """
    source = next(n.image for m in full.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and n.image.colorspace_settings.name == 'sRGB')
    width, height = source.size
    colours = np.array(source.pixels[:], dtype=np.float32).reshape(height, width, -1)[:, :, :3]

    # The new layout.
    old = [layer.name for layer in mesh.data.uv_layers]
    layout = mesh.data.uv_layers.new(name='Own')
    mesh.data.uv_layers.active = layout
    layout.active_render = True
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    for name in old:
        mesh.data.uv_layers.remove(mesh.data.uv_layers[name])

    # The model as it came, as triangles that can be asked for their nearest point.
    was = full.data
    was.calc_loop_triangles()
    was_points = np.array([v.co[:] for v in was.vertices])
    was_corners = np.array([t.vertices[:] for t in was.loop_triangles])
    was_loops = np.array([t.loops[:] for t in was.loop_triangles])
    was_uv = np.zeros(len(was.loops) * 2)
    was.uv_layers.active.data.foreach_get('uv', was_uv)
    was_uv = was_uv.reshape(-1, 2)
    tree = BVHTree.FromPolygons([tuple(point) for point in was_points], [tuple(int(i) for i in corners) for corners in was_corners])

    # Every dot of the new picture that a triangle of the thinned mesh covers, and where on his skin it is.
    now = mesh.data
    now.calc_loop_triangles()
    now_uv = np.zeros(len(now.loops) * 2)
    now.uv_layers.active.data.foreach_get('uv', now_uv)
    now_uv = now_uv.reshape(-1, 2) * size
    columns, rows, places = [], [], []
    for triangle in now.loop_triangles:
        (ax, ay), (bx, by), (cx, cy) = now_uv[list(triangle.loops)]
        area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        if abs(area) < 1e-9:
            continue
        a, b, c = (np.array(now.vertices[i].co[:]) for i in triangle.vertices)
        x0, x1 = max(0, int(math.floor(min(ax, bx, cx))) - 1), min(size - 1, int(math.ceil(max(ax, bx, cx))) + 1)
        y0, y1 = max(0, int(math.floor(min(ay, by, cy))) - 1), min(size - 1, int(math.ceil(max(ay, by, cy))) + 1)
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        px, py = gx + 0.5, gy + 0.5
        w1 = ((px - ax) * (cy - ay) - (py - ay) * (cx - ax)) / area
        w2 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / area
        w0 = 1 - w1 - w2
        # A little past each edge, so the patches' rims are painted too.
        reach = 1.0 / max(1.0, math.sqrt(abs(area)))
        inside = (w0 >= -reach) & (w1 >= -reach) & (w2 >= -reach)
        columns.append(gx[inside])
        rows.append(gy[inside])
        places.append(w0[inside][:, None] * a + w1[inside][:, None] * b + w2[inside][:, None] * c)
    columns, rows, places = np.concatenate(columns), np.concatenate(rows), np.concatenate(places)
    hits = np.zeros(len(places), int)
    nearest = np.zeros((len(places), 3))
    for i, place in enumerate(places):
        location, _, index, _ = tree.find_nearest(Vector(place))
        hits[i] = index
        nearest[i] = location
    # Where each nearest point lies on its triangle's patch of the old picture.
    a, b, c = (was_points[was_corners[hits, k]] for k in range(3))
    v0, v1, v2 = b - a, c - a, nearest - a
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
    d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
    under = np.maximum(d00 * d11 - d01 * d01, 1e-18)
    w1 = np.clip((d11 * d20 - d01 * d21) / under, 0, 1)
    w2 = np.clip((d00 * d21 - d01 * d20) / under, 0, 1)
    w0 = np.clip(1 - w1 - w2, 0, 1)
    at = w0[:, None] * was_uv[was_loops[hits, 0]] + w1[:, None] * was_uv[was_loops[hits, 1]] + w2[:, None] * was_uv[was_loops[hits, 2]]
    taken = colours[np.clip(((at[:, 1] % 1) * height).astype(int), 0, height - 1), np.clip(((at[:, 0] % 1) * width).astype(int), 0, width - 1)]

    out = np.zeros((size, size, 4), np.float32)
    out[:, :, 3] = 1.0
    painted_here = np.zeros((size, size), bool)
    out[rows, columns, :3] = taken
    painted_here[rows, columns] = True
    # Spread the colours a few dots past each patch, so no dark rim shows when the picture is drawn small.
    for _ in range(8):
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            beside = np.roll(painted_here, (dy, dx), axis=(0, 1))
            take = beside & ~painted_here
            out[take] = np.roll(out, (dy, dx), axis=(0, 1))[take]
            painted_here |= take

    painted = bpy.data.images.new('Walblum', size, size, alpha=False)
    painted.pixels[:] = out.ravel()
    path = os.path.join(bpy.app.tempdir, 'walblum-picture.png')
    painted.filepath_raw = path
    painted.file_format = 'PNG'
    painted.save()
    painted.pack()
    skin = bpy.data.materials.new('Walblum')
    skin.use_nodes = True
    surface = skin.node_tree.nodes['Principled BSDF']
    surface.inputs['Roughness'].default_value = 0.9
    surface.inputs['Metallic'].default_value = 0.0
    picture = skin.node_tree.nodes.new('ShaderNodeTexImage')
    picture.image = painted
    skin.node_tree.links.new(picture.outputs['Color'], surface.inputs['Base Color'])
    mesh.data.materials.clear()
    mesh.data.materials.append(skin)
    bpy.data.objects.remove(full)
    say(f"picture: painted afresh from the model as it came, {size} pixels square, {len(places)} dots of it on his skin")


# ---------- 4: the skeleton ----------

SIDES = (('left', 'l', 1), ('right', 'r', -1))


def walblum_plan(guide):
    """Every bone: name, head, tail, parent, and whether it bends the skin."""
    joints = guide['joints']
    mirrored = lambda points: [[-across, up, forward] for across, up, forward in points]
    spine = [to_blender(p) for p in joints['spine']]
    plan = [('root', Vector((spine[0].x, spine[0].y, 0)), Vector((spine[0].x, spine[0].y - 0.25, 0)), None, False)]
    plan.append(('hips', spine[0], spine[1], 'root', True))
    plan.append(('spine', spine[1], spine[2], 'hips', True))
    plan.append(('chest', spine[2], spine[3], 'spine', True))
    plan.append(('head', spine[3], to_blender(joints['head_end']), 'chest', True))
    for side, letter, _ in SIDES:
        arm = [to_blender(p) for p in joints.get(f'arm_{side}', mirrored(joints['arm_left']))]
        plan.append((f'arm_upper_{letter}', arm[0], arm[1], 'chest', True))
        plan.append((f'arm_lower_{letter}', arm[1], arm[2], f'arm_upper_{letter}', True))
        plan.append((f'hand_{letter}', arm[2], arm[3], f'arm_lower_{letter}', True))
        leg = [to_blender(p) for p in joints.get(f'leg_{side}', mirrored(joints['leg_left']))]
        plan.append((f'leg_upper_{letter}', leg[0], leg[1], 'hips', True))
        plan.append((f'leg_lower_{letter}', leg[1], leg[2], f'leg_upper_{letter}', True))
        plan.append((f'foot_{letter}', leg[2], leg[3], f'leg_lower_{letter}', True))
    tail = [to_blender(p) for p in joints['tail']]
    for i in range(len(tail) - 1):
        plan.append((f'tail{i + 1}', tail[i], tail[i + 1], 'hips' if i == 0 else f'tail{i}', True))
    return plan


# ---------- 5: skinning ----------

def skin_by_plain_copy(mesh, plain, armature):
    """
    Skins the model. Blender's automatic weights spread warmth from each bone
    across the skin, and they fail on this mesh as it is thinned: his
    whiskers are kept whole, and they are too thin for it. So a plain copy,
    thinned evenly all over, is weighted, and each point of the real mesh
    takes the weights of the plain copy beside it. His whiskers then follow
    his head and nothing else.
    """
    marked = mesh.vertex_groups['whiskers'].index
    whiskers = [vert.index for vert in mesh.data.vertices if any(g.group == marked and g.weight > 0.5 for g in vert.groups)]
    plain_weights = quad.automatic_weights(plain, armature)
    quad.fill_unweighted(plain, plain_weights)
    weights = quad.carry_across(plain, plain_weights, mesh)
    bpy.data.objects.remove(plain)
    quad.fill_unweighted(mesh, weights)
    for index in whiskers:
        weights[index] = {'head': 1.0}
    quad.tidy_weights(weights)
    quad.write_weights(mesh, weights)
    mesh.modifiers.new('Skeleton', 'ARMATURE').object = armature
    mesh.parent = armature
    used = {name for own in weights for name in own}
    unused = sorted({bone.name for bone in armature.data.bones if bone.use_deform} - used)
    if unused:
        raise SystemExit(f"These bones move no part of the model, so the automatic weights failed for them: {', '.join(unused)}. Check their places in the guide.")
    say(f"skinned {len(weights)} points from a plain copy; {len(whiskers)} whisker points follow the head alone")


# ---------- 6: clips ----------

class Walblum:
    """
    His clips. Every turn is given in his own directions as he stands at rest
    (pitch tips a part back, or swings a hanging leg forward; yaw turns it to
    his left; roll drops its left side), on top of whatever the part it hangs
    from has done.
    """

    def __init__(self, armature, guide):
        self.armature = armature
        self.poser = quad.Poser(armature, {}, movable={'hips'})
        self.tail = sorted(bone.name for bone in armature.data.bones if bone.name.startswith('tail'))
        # The point his body turns about in the air and in the water.
        self.middle = to_blender(guide['middle'])
        self.settings = guide.get('clips', {})

    def setting(self, clip, name, default):
        return self.settings.get(clip, {}).get(name, default)

    # ----- The parts of a pose -----

    def turn(self, bone, turn):
        """Turns a bone in his own resting directions, carried round by the parts it hangs from."""
        p = self.poser
        frame = (p.carried(bone).to_3x3() @ p.rest[bone].to_3x3().inverted()).to_quaternion()
        p.place(bone, turn=frame @ turn @ frame.inverted())

    def body(self, lean=0.0, turn=0.0, tip=0.0, rise=0.0):
        """
        Places the hips, and with them the whole body. `lean` tips him back
        (below zero, forward) and `tip` drops his left side, both about his
        middle, which stays where it is; `turn` turns him to his left;
        `rise` lifts him, in metres.
        """
        p = self.poser
        p.place('root')
        spin = yaw(turn) @ roll(tip) @ pitch(lean)
        hips = p.rest_head('hips')
        move = self.middle - hips - spin @ (self.middle - hips) + Vector((0, 0, rise))
        p.place('hips', turn=spin, move=move)

    def back(self, spine=0.0, chest=0.0, twist=0.0):
        """Bends the back: below zero curls him forward. `twist` turns the chest to his left."""
        self.turn('spine', pitch(spine) @ yaw(twist * 0.5))
        self.turn('chest', pitch(chest) @ yaw(twist * 0.5))

    def head(self, look=0.0, nod=0.0, tilt=0.0):
        """Turns the head to his left by `look`, tips it back by `nod` (below zero, down) and tilts it by `tilt`."""
        self.turn('head', yaw(look) @ pitch(nod) @ roll(tilt))

    def arm(self, letter, down=0.0, ahead=0.0, elbow=0.0, elbow_up=0.0, wrist=0.0):
        """
        An arm, from how it is held at rest (straight out to the side): `down`
        lowers it (below zero raises it), `ahead` swings it forward, `elbow`
        bends the forearm forward and `elbow_up` upward, `wrist` bends the hand
        forward. Degrees.
        """
        s = 1 if letter == 'l' else -1
        self.turn(f'arm_upper_{letter}', yaw(-s * ahead) @ roll(s * down))
        self.turn(f'arm_lower_{letter}', yaw(-s * elbow) @ roll(-s * elbow_up))
        self.turn(f'hand_{letter}', yaw(-s * wrist))

    def leg(self, letter, swing=0.0, out=0.0, knee=0.0, foot=0.0):
        """A leg: `swing` lifts the thigh forward, `out` to its own side, `knee` folds the shin back, `foot` lifts the toes. Degrees."""
        s = 1 if letter == 'l' else -1
        self.turn(f'leg_upper_{letter}', roll(-s * out) @ pitch(swing))
        self.turn(f'leg_lower_{letter}', pitch(-knee))
        self.turn(f'foot_{letter}', pitch(foot))

    def tail_wave(self, sway, lift=0.0):
        """The tail: `sway(i)` swings part i to his left on top of the part before, `lift` raises each part. Degrees."""
        for i, bone in enumerate(self.tail):
            self.turn(bone, yaw(sway(i)) @ pitch(-lift))

    def crouch(self, deep, knees_out=0.0):
        """Folds both legs so he sinks onto them with his feet flat: `deep` from 0 to 1. Returns how far the hips come down, in metres."""
        fold = 38.0 * deep
        for letter in ('l', 'r'):
            self.leg(letter, swing=fold, out=knees_out * deep, knee=2 * fold, foot=fold)
        p = self.poser
        thigh = (p.rest_head('leg_lower_l') - p.rest_head('leg_upper_l')).length
        shin = (p.rest_head('foot_l') - p.rest_head('leg_lower_l')).length
        return (thigh + shin) * (1 - math.cos(math.radians(fold)))

    # ----- Each clip is a function from a share of the clip (0 to 1) to a pose. -----

    ARMS_DOWN = 56.0

    def idle(self, phase):
        # Standing, breathing, and never quite at ease: he looks left, then right.
        a = TAU * phase
        breath = math.sin(a * 2)
        look = 20.0 * math.sin(a) + 5.0 * math.sin(a * 3 + 0.6)
        self.body(turn=2.0 * math.sin(a), rise=0.006 * breath)
        self.back(spine=1.0 * breath, chest=1.5 * breath, twist=0.25 * look)
        self.head(look=0.75 * look, nod=2.0 * math.sin(a * 2 + 0.8), tilt=2.0 * math.sin(a))
        for letter, s in (('l', 1), ('r', -1)):
            self.arm(letter, down=self.ARMS_DOWN - 3.0 * breath, ahead=12.0, elbow=28.0 + 4.0 * math.sin(a + s), wrist=10.0)
            self.leg(letter)
        self.tail_wave(lambda i: 7.0 * math.sin(a - 0.7 * i))

    def scared(self, phase):
        # Stranded on a drifting log with a monster pike circling: crouched small, hugging himself, shaking, eyes everywhere.
        a = TAU * phase
        shake = math.sin(a * 12)
        glance = keyed([(0.0, -26.0), (0.12, 24.0), (0.45, 26.0), (0.55, -22.0), (0.9, -26.0), (1.0, -26.0)], phase)
        sink = self.crouch(1.0, knees_out=-3.0)
        self.body(lean=-10.0, turn=1.2 * shake + 0.12 * glance, rise=-sink + 0.004 * shake)
        self.back(spine=-18.0, chest=-17.0 + 1.0 * shake, twist=0.2 * glance)
        self.head(look=0.8 * glance + 1.5 * math.sin(a * 12 + 1.0), nod=24.0 + 3.0 * math.sin(a * 2), tilt=1.5 * shake)
        for letter, s in (('l', 1), ('r', -1)):
            self.arm(letter, down=44.0 + 2.0 * shake, ahead=72.0, elbow=92.0 + 2.5 * math.sin(a * 12 + s), wrist=20.0)
        self.tail_wave(lambda i: 16.0 + 3.0 * math.sin(a * 12 - i))

    def paddle(self, phase):
        # Swimming, lying forward: head up, hands paddling under his chin, legs kicking in turn, tail sculling behind.
        a = TAU * phase
        lie = self.setting('paddle', 'lie', 76.0)
        self.body(lean=-lie, turn=3.0 * math.sin(a), tip=5.0 * math.sin(a))
        self.back(spine=5.0, chest=8.0)
        self.head(look=-3.0 * math.sin(a), nod=lie - 20.0, tilt=-4.0 * math.sin(a))
        for letter, s in (('l', 1), ('r', -1)):
            stroke = math.sin(a + (0 if s > 0 else math.pi))
            reach = math.cos(a + (0 if s > 0 else math.pi))
            self.arm(letter, down=30.0 + 22.0 * stroke, ahead=62.0 + 16.0 * reach, elbow=30.0 + 22.0 * stroke, wrist=10.0 * stroke)
            kick = math.sin(a + (math.pi if s > 0 else 0))
            self.leg(letter, swing=-12.0 + 26.0 * kick, out=8.0, knee=24.0 - 18.0 * kick, foot=-52.0 - 10.0 * kick)
        self.tail_wave(lambda i: (16.0 + 8.0 * i) * math.sin(a * 2 - 0.9 * i), lift=self.setting('paddle', 'tail_lift', -8.0))

    def cheer(self, phase):
        # Jumping for joy: down onto his legs, up off the ground with both arms high, and down again.
        up_from, up_for = 0.15, 0.6
        air = math.sin(math.pi * (phase - up_from) / up_for) if up_from < phase < up_from + up_for else 0.0
        low = math.sin(math.pi * ((phase - (up_from + up_for)) % 1.0) / (1 - up_for)) if not air else 0.0
        a = TAU * phase
        sink = self.crouch(0.75 * low)
        self.body(lean=4.0 * air - 3.0 * low, rise=self.setting('cheer', 'height', 0.3) * air - sink)
        self.back(spine=3.0 * air - 6.0 * low, chest=5.0 * air - 5.0 * low)
        self.head(nod=14.0 + 10.0 * air - 6.0 * low, tilt=4.0 * math.sin(a))
        for letter, s in (('l', 1), ('r', -1)):
            self.arm(letter, down=-58.0 - 14.0 * air + 16.0 * low, ahead=8.0, elbow=14.0 - 10.0 * air, elbow_up=18.0 * low, wrist=8.0 * math.sin(a * 2 + s))
            if air:
                # Off the ground his legs hang, feet pointed, one a little ahead of the other.
                self.leg(letter, swing=10.0 * air * s + 8.0 * air, out=10.0 * air, knee=30.0 * air, foot=-38.0 * air)
        self.tail_wave(lambda i: 10.0 * math.sin(a - 0.6 * i), lift=16.0 * air - 4.0 * low)

    def kick(self, phase):
        # A flying karate kick, held: leaning back, right leg straight out ahead with the sole leading, left leg
        # tucked, fists up in guard. A small flutter keeps it alive.
        a = TAU * phase
        flutter = math.sin(a)
        back = self.setting('kick', 'lean', 46.0)
        self.body(lean=back + 1.5 * flutter, tip=2.0 * math.cos(a))
        self.back(spine=-10.0, chest=-12.0, twist=-8.0)
        self.head(look=6.0, nod=-(back - 22.0) + 1.5 * flutter)
        # The kicking leg lies along his way forward: the thigh makes up what the lean leaves.
        self.leg('r', swing=90.0 - back - 1.5 * flutter, out=2.0, knee=0.0, foot=self.setting('kick', 'foot', 8.0))
        self.leg('l', swing=100.0 + 3.0 * flutter, out=14.0, knee=118.0, foot=-25.0)
        self.arm('l', down=62.0, ahead=40.0 + 3.0 * flutter, elbow=112.0, wrist=12.0)
        self.arm('r', down=58.0, ahead=18.0 - 3.0 * flutter, elbow=100.0, wrist=12.0)
        self.tail_wave(lambda i: 9.0 * math.sin(a - 1.1 * i) - 6.0, lift=self.setting('kick', 'tail_lift', 38.0))

    def spin(self, phase):
        # His boomerang flight back: tucked into a ball, tumbling forward head over heels once a loop.
        self.body(lean=-360.0 * phase)
        self.back(spine=-22.0, chest=-22.0)
        self.head(nod=-30.0)
        for letter in ('l', 'r'):
            self.leg(letter, swing=104.0, out=10.0, knee=108.0, foot=12.0)
            self.arm(letter, down=34.0, ahead=78.0, elbow=64.0, wrist=20.0)
        self.tail_wave(lambda i: 0.0, lift=self.setting('spin', 'tail_lift', -24.0))

    def clips(self):
        return [
            ('idle', self.idle, 2.0),
            ('scared', self.scared, 1.2),
            ('paddle', self.paddle, 0.8),
            ('cheer', self.cheer, 1.0),
            ('kick', self.kick, 0.4),
            ('spin', self.spin, 0.4),
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
        for bone in armature.pose.bones:
            bone.location = (0, 0, 0)
            bone.rotation_quaternion = (1, 0, 0, 0)


def main():
    arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(arguments) != 3:
        raise SystemExit('Usage: blender -b -P tools/rig-walblum.py -- <source.glb> <rigged.glb> <guide.json>')
    source, out, guide_path = arguments
    with open(guide_path, encoding='utf8') as file:
        guide = json.load(file)

    mesh, armature = quad.open_model(source)
    if armature is not None:
        raise SystemExit('This file already has a skeleton. This script is for a model with none.')
    say(f"opened {source}: {len(mesh.data.vertices)} points")
    quad.straighten(mesh, None, guide.get('turned_left_degrees', 0))
    quad.merge_seams(mesh)
    if 'whiskers' in guide:
        straighten_whiskers(mesh, guide)
    full = mesh.copy()
    full.data = mesh.data.copy()
    bpy.context.scene.collection.objects.link(full)
    # A plain copy, thinned evenly, to work the weights out on (see skin_by_plain_copy).
    plain = mesh.copy()
    plain.data = mesh.data.copy()
    bpy.context.scene.collection.objects.link(plain)
    quad.thin(plain, guide['triangles'])
    thin_keeping(mesh, guide['triangles'], guide['fine'])
    own_picture(mesh, full, guide.get('picture', 2048))
    tall = max(v.co.z for v in mesh.data.vertices)
    say(f"he stands {tall:.2f} m tall as he came, facing forward; his middle is {guide['middle'][1] / tall:.2f} of that up")
    # The shared skeleton builder asks for a plan; give it his.
    quad.skeleton_plan = walblum_plan
    armature, added = quad.build_skeleton(guide, None)
    say(f"skeleton: {len(armature.data.bones)} bones")
    skin_by_plain_copy(mesh, plain, armature)
    Walblum(armature, guide).write()
    quad.save(out)
    say(f"saved {out}")


if __name__ == '__main__':
    main()
