import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

import { ThreeMFScene } from "./ThreeMFScene";

type ModelBuffer = { buffer: ArrayBuffer; ext: "stl" | "3mf" };

const PLATE_SIZE = 256;
const PLATE_GAP = 80;

function useModelBuffer(): { data: ModelBuffer | null; error: string | null } {
    const [data, setData] = useState<ModelBuffer | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searchParams] = useSearchParams();
    const modelPath = searchParams.get("modelPath");

    useEffect(() => {
        if (!modelPath) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError("No modelPath provided in URL (?modelPath=xxx)");
            setData(null);
            return;
        }

        let cancelled = false;

        async function load() {
            try {
                const res = await fetch(`/models/${modelPath}`);
                if (!res.ok) {
                    if (!cancelled)
                        setError(`Model not found: /models/${modelPath}`);
                    return;
                }
                const ext = modelPath!.split(".").pop() as ModelBuffer["ext"];
                if (!ext) {
                    if (!cancelled) setError("Unknown model extension");
                    return;
                }
                const buffer = await res.arrayBuffer();
                if (!cancelled) setData({ buffer, ext });
            } catch {
                if (!cancelled)
                    setError(`Failed to load model: /models/${modelPath}`);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [modelPath]);

    return { data, error };
}

function StlMesh({ buffer }: { buffer: ArrayBuffer }) {
    const geometry = useMemo(() => {
        const loader = new STLLoader();
        const geo = loader.parse(buffer);
        geo.computeVertexNormals();
        return geo;
    }, [buffer]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return (
        <mesh geometry={geometry} castShadow>
            <meshStandardMaterial
                color="#c8c8c8"
                roughness={0.5}
                metalness={0.1}
            />
        </mesh>
    );
}

function Model({ data }: { data: ModelBuffer }) {
    if (data.ext === "stl") {
        return (
            <>
                <BuildPlate position={[0, 0, 0]} size={PLATE_SIZE} />
                <StlMesh buffer={data.buffer} />
            </>
        );
    }
    return <ThreeMFScene buffer={data.buffer} />;
}

function BuildPlate({
    position,
    size,
}: {
    position: [number, number, number];
    size: number;
}) {
    const matRef = useRef<THREE.MeshStandardMaterial>(null);
    const { camera } = useThree();

    const normal = new THREE.Vector3(0, 1, 0);
    const camForward = new THREE.Vector3();

    useFrame(() => {
        if (!matRef.current) return;

        camera.getWorldDirection(camForward);

        const dot = normal.dot(camForward);

        matRef.current.opacity = dot < 0.15 ? 1 : 0.01;
    });

    return (
        <group position={position}>
            <mesh position={[0, -1, 0]} receiveShadow>
                <boxGeometry args={[size, 2, size]} />
                <meshStandardMaterial
                    ref={matRef}
                    color="#333333"
                    roughness={0.9}
                    metalness={0}
                    transparent
                />
            </mesh>
            <Grid
                position={[0, 0, 0]}
                args={[size, size]}
                sectionSize={50}
                sectionThickness={2}
                sectionColor="#7d7d7d"
                fadeDistance={1500}
                fadeStrength={1.5}
                infiniteGrid={false}
            />
        </group>
    );
}

export default function ModelViewer() {
    const { data, error } = useModelBuffer();

    if (error) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-[#111] text-2xl text-destructive">
                Error: {error}
            </div>
        );
    }

    const isLoading = !data;

    return (
        <div className="relative h-screen w-screen">
            {isLoading && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-gray-500 text-white">
                    Loading model…
                </div>
            )}

            <Canvas
                gl={{ powerPreference: "high-performance", antialias: true }}
                camera={{ fov: 45, near: 0.1, far: 5000 }}
                className="h-screen w-screen"
                shadows
            >
                <Lighting />
                <CameraRig />
                <OrbitControls
                    makeDefault
                    target={[0, 30, 0]}
                    minDistance={50}
                    maxDistance={3000}
                    maxPolarAngle={Math.PI}
                    enableDamping
                    dampingFactor={0.08}
                />
                {data && (
                    <Suspense
                        fallback={
                            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-gray-500 text-white">
                                Loading model...
                            </div>
                        }
                    >
                        <Model data={data} />
                    </Suspense>
                )}
            </Canvas>
        </div>
    );
}

function Lighting() {
    return (
        <>
            <hemisphereLight
                args={[0xffffff, 0x8d8d8d, 1.5]}
                position={[0, 100, 0]}
            />
            <directionalLight
                position={[150, 300, 150]}
                intensity={1.2}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-top={300}
                shadow-camera-bottom={-100}
                shadow-camera-left={-300}
                shadow-camera-right={300}
                shadow-camera-near={0.1}
                shadow-camera-far={1200}
            />
            <directionalLight position={[-100, 100, -100]} intensity={0.3} />
        </>
    );
}

function CameraRig() {
    const { camera } = useThree();

    useEffect(() => {
        const spread = PLATE_SIZE + PLATE_GAP;
        camera.position.set(0, spread * 0.5, spread * 0.9);
        camera.lookAt(0, 0, 0);
    }, [camera]);

    return null;
}
