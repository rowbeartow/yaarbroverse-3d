# Adds a clip of test poses to a rigged model, one pose a frame, so its skin
# can be looked at in poses that show up weighting problems.
#
#   blender -b -P tools/pose-test.py -- <model.glb> <out.glb> <guide.json>
#
# The poses come from the guide's "pose_test" list. Each names bones and how
# far to turn them, in degrees: "forward" swings a limb toward the front,
# "out" lifts it away from the body to its own side, "twist" turns it about
# its length.

import json
import math
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

FPS = 30


def main():
    source, out, guide_path = sys.argv[sys.argv.index('--') + 1:]
    with open(guide_path, encoding='utf8') as file:
        guide = json.load(file)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=source)
    armature = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    armature.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    armature.animation_data_create()
    action = bpy.data.actions.new('poses')
    armature.animation_data.action = action

    def turn(name, axis, degrees):
        """Turns a bone about its own head, by an axis given in the model's space (x left, y back, z up)."""
        bone = armature.pose.bones[name]
        head = bone.matrix.to_translation()
        spin = Quaternion(Vector(axis), math.radians(degrees)).to_matrix().to_4x4()
        bone.matrix = Matrix.Translation(head) @ spin @ Matrix.Translation(-head) @ bone.matrix
        bpy.context.view_layer.update()

    for frame, pose in enumerate(guide['pose_test']):
        for bone in armature.pose.bones:
            bone.rotation_mode = 'QUATERNION'
            bone.location = (0, 0, 0)
            bone.rotation_quaternion = (1, 0, 0, 0)
            bone.scale = (1, 1, 1)
        bpy.context.view_layer.update()
        for name, moves in pose['bones'].items():
            # The side a bone is on, from where it sits at rest: its own "out" is away from the middle.
            side = 1 if armature.data.bones[name].head_local.x >= 0 else -1
            if 'forward' in moves:
                turn(name, (1, 0, 0), -moves['forward'])
            if 'out' in moves:
                turn(name, (0, 1, 0), -side * moves['out'])
            if 'twist' in moves:
                bone = armature.pose.bones[name]
                turn(name, bone.matrix.to_3x3() @ Vector((0, 1, 0)), moves['twist'])
        for bone in armature.pose.bones:
            bone.keyframe_insert('rotation_quaternion', frame=frame)
        print(f"[pose-test] {frame}: {pose['name']}", flush=True)
    for curve in action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = 'CONSTANT'
    armature.animation_data.action = None
    track = armature.animation_data.nla_tracks.new()
    track.name = 'poses'
    track.strips.new('poses', 0, action)
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
        export_force_sampling=True, export_optimize_animation_size=False, export_skins=True, export_yup=True,
    )
    print(f"[pose-test] saved {out}", flush=True)


main()
