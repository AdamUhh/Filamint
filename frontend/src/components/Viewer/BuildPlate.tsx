import { useFrame } from "@react-three/fiber";
import { useState } from "react";

const PLATE_SIZE = 256;
const PLATE_Y = -1;

export function BuildPlate() {
    const [visible, setVisible] = useState(true);

    useFrame(({ camera }) => {
        setVisible(camera.position.y > PLATE_Y);
    });

    if (!visible) return null;

    return (
        <mesh position={[0, PLATE_Y, 0]} receiveShadow>
            <boxGeometry args={[PLATE_SIZE, 0, PLATE_SIZE]} />
            <meshStandardMaterial color="#bbb" roughness={1} metalness={0} />
            {/* Minor grid */}
            <gridHelper
                args={[PLATE_SIZE - 8, 40, "#555", "#555"]}
                position={[0, 0.05, 0]}
            />
            {/* Major grid */}
            <gridHelper
                args={[PLATE_SIZE - 8, 8, "#999", "#999"]}
                position={[0, 0.05, 0]}
            />
        </mesh>
    );
}
