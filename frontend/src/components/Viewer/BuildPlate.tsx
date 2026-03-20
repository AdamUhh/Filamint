import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group } from "three";

import { PLATE_SIZE, PLATE_Y } from "@/lib/constant-three";

export function BuildPlate() {
    const groupRef = useRef<Group>(null);

    useFrame(({ camera }) => {
        if (groupRef.current) {
            groupRef.current.visible = camera.position.y > PLATE_Y;
        }
    });

    return (
        <group ref={groupRef} position={[0, PLATE_Y, 0]}>
            <mesh receiveShadow>
                <boxGeometry args={[PLATE_SIZE, 0, PLATE_SIZE]} />
                <meshStandardMaterial
                    color="#bbb"
                    roughness={1}
                    metalness={0}
                />
            </mesh>
            <gridHelper
                args={[PLATE_SIZE - 8, 40, "#555", "#555"]}
                position={[0, 0.05, 0]}
            />
            <gridHelper
                args={[PLATE_SIZE - 8, 8, "#999", "#999"]}
                position={[0, 0.05, 0]}
            />
        </group>
    );
}
