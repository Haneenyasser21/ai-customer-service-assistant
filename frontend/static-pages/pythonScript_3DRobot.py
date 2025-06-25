import bpy
import math
import os

# Configuration
face_mesh_name = "face"  # Name of the face mesh object
texture_paths = [
    r"C:\Users\Acer\Downloads\ha.png",
    r"C:\Users\Acer\Downloads\sa.png",
    r"C:\Users\Acer\Downloads\an.png",
    r"C:\Users\Acer\Downloads\su.png",
    r"C:\Users\Acer\Downloads\ofs.png"
]  # Paths to your texture images

# Ensure we're in Object Mode
bpy.ops.object.mode_set(mode='OBJECT')

# Select the face mesh
face_mesh = bpy.data.objects.get(face_mesh_name)
if not face_mesh:
    print(f"Error: Mesh '{face_mesh_name}' not found.")
else:
    bpy.context.view_layer.objects.active = face_mesh
    face_mesh.select_set(True)

    # Enter Edit Mode
    bpy.ops.object.mode_set(mode='EDIT')

    # Select all faces
    bpy.ops.mesh.select_all(action='SELECT')

    # Ensure UV map exists
    if not face_mesh.data.uv_layers:
        bpy.ops.mesh.uv_texture_add()

    # Perform Smart UV Project to reset UV map
    bpy.ops.uv.smart_project(angle_limit=66.0, island_margin=0.02)

    # Return to Object Mode
    bpy.ops.object.mode_set(mode='OBJECT')

    # Clear existing materials
    face_mesh.data.materials.clear()

    # Create a material for each texture
    for i, tex_path in enumerate(texture_paths):
        # Create new material
        material = bpy.data.materials.new(name=f"ExpressionMaterial_{i}")
        material.use_nodes = True
        nodes = material.node_tree.nodes
        links = material.node_tree.links

        # Clear default nodes
        nodes.clear()

        # Add nodes
        principled_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
        output = nodes.new(type='ShaderNodeOutputMaterial')
        tex_image = nodes.new(type='ShaderNodeTexImage')
        tex_coord = nodes.new(type='ShaderNodeTexCoord')
        mapping = nodes.new(type='ShaderNodeMapping')

        # Load texture
        if os.path.exists(tex_path):
            tex_image.image = bpy.data.images.load(tex_path)
        else:
            print(f"Error: Texture file '{tex_path}' not found.")


        # Connect nodes
        links.new(tex_coord.outputs['UV'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], tex_image.inputs['Vector'])
        links.new(tex_image.outputs['Color'], principled_bsdf.inputs['Base Color'])
        links.new(principled_bsdf.outputs['BSDF'], output.inputs['Surface'])

        # Position nodes for clarity
        tex_coord.location = (-800, -200 * i)
        mapping.location = (-600, -200 * i)
        tex_image.location = (-400, -200 * i)
        principled_bsdf.location = (0, -200 * i)
        output.location = (200, -200 * i)

        # Append material to mesh
        face_mesh.data.materials.append(material)

    # Assign the first material to all faces (default state)
    for poly in face_mesh.data.polygons:
        poly.material_index = 0
