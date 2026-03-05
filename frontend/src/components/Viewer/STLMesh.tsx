import { useEffect, useMemo } from "react";
import { Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

import { BuildPlate } from "./BuildPlate";

export function STLScene({
    buffer,
    onReady,
}: {
    buffer: ArrayBuffer;
    onReady: () => void;
}) {
    // Parse the raw .stl file bytes into a Three.js geometry object (triangles/vertices)
    // and position it correctly
    const geometry = useMemo(() => {
        const loader = new STLLoader();

        const geo = loader.parse(buffer);

        // STL files are Y-up; Three.js scenes are Z-up
        // Rotating -90° around X flips the model so it stands upright
        // instead of lying on its back
        geo.rotateX(-Math.PI / 2);

        // Measure the model's axis-aligned bounding box
        // (the smallest box that fully contains the geometry)
        // We need this to know where the centre and bottom of the model are
        geo.computeBoundingBox();

        const center = new Vector3();
        if (geo.boundingBox) {
            // Find the geometric centre of the bounding box
            geo.boundingBox.getCenter(center);

            // Shift all the vertices so that:
            // - X and Z are centred at the origin (model sits in the middle of the plate)
            // - Y starts at 0 (the bottom of the model sits flush on the build plate, not floating or clipping through it)
            geo.translate(-center.x, -geo.boundingBox.min.y, -center.z);
        }

        // Recalculate surface normals after moving the vertices
        // Normals are the tiny arrows perpendicular to each face that tell
        // the renderer which way the surface is "pointing" - without them
        // lighting and shading won't look correct
        geo.computeVertexNormals();

        return geo;
    }, [buffer]);

    useEffect(() => {
        onReady();

        // Free the GPU memory that was allocated for this geometry
        return () => geometry.dispose();
    }, [geometry, onReady]);

    return (
        <>
            <BuildPlate />

            <mesh geometry={geometry} castShadow>
                <meshStandardMaterial
                    color="#ff6600"
                    roughness={0.5}
                    metalness={0.1}
                />
            </mesh>
        </>
    );
}
