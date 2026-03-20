import { useEffect, useMemo } from "react";
import { MeshStandardMaterial, Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

import { BuildPlate } from "./BuildPlate";

export function STLScene({
    buffer,
    onReady,
}: {
    buffer: ArrayBuffer;
    onReady: () => void;
}) {
    // Parse the .stl bytes into Three.js geometry, rotate upright, and centre on the plate
    const geometry = useMemo(() => {
        const loader = new STLLoader();
        const geo = loader.parse(buffer);
        // STL is Y-up; rotate to match Three.js Z-up convention
        geo.rotateX(-Math.PI / 2);
        // Centre XZ at origin and sit the bottom flush on y = 0
        geo.computeBoundingBox();
        const center = new Vector3();
        if (geo.boundingBox) {
            geo.boundingBox.getCenter(center);
            geo.translate(-center.x, -geo.boundingBox.min.y, -center.z);
        }
        return geo;
    }, [buffer]);

    // Shared material for all STL renders - memoized to avoid leaking instances on re-render
    const material = useMemo(
        () =>
            new MeshStandardMaterial({
                color: 0xff6600,
                roughness: 0.5,
                metalness: 0.1,
            }),
        []
    );

    // Free GPU memory when geometry is replaced or component unmounts
    useEffect(() => {
        onReady(); // Notify parent that geometry is ready to render

        return () => geometry.dispose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geometry]);

    // Free GPU memory when material is replaced or component unmounts
    useEffect(() => {
        return () => material.dispose();
    }, [material]);

    return (
        <>
            <BuildPlate />
            <mesh geometry={geometry} material={material} castShadow />
        </>
    );
}
