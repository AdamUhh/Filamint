import { PrintService } from "@bindings/services";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Loader2Icon } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { PLATE_GAP, PLATE_SIZE } from "@/lib/constant-three";

import { STLScene } from "./STLMesh";
import { ThreeMFScene } from "./ThreeMFScene";

type ModelBuffer = { buffer: ArrayBuffer; ext: "stl" | "3mf" };

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

        const rawExt = modelPath.split(".").pop()?.toLowerCase();
        if (!rawExt || (rawExt !== "stl" && rawExt !== "3mf")) {
            setError("Unsupported file type");
            setData(null);
            return;
        }
        const ext = rawExt as ModelBuffer["ext"];

        let cancelled = false;

        async function load() {
            try {
                const base64 = await PrintService.GetModelData(
                    modelPath as string
                );

                if (!base64) {
                    if (!cancelled)
                        setError(`Model not found: /models/${modelPath}`);
                    return;
                }

                const binary = atob(base64);
                const buffer = Uint8Array.from(binary, (c) =>
                    c.charCodeAt(0)
                ).buffer;

                if (!cancelled) setData({ buffer, ext: ext });
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

export default function ViewerPage() {
    const { data, error } = useModelBuffer();
    const [modelReady, setModelReady] = useState(false);

    const handleReady = useCallback(() => setModelReady(true), []);

    // Reset ready state when the model changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setModelReady(false);
    }, [data]);

    if (error) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-[#333] text-2xl text-destructive">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="relative h-screen w-screen bg-[#333]">
            {/* Overlay stays visible until geometry is parsed and mounted */}

            {!modelReady && (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#333]">
                    <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
                        Loading model...
                    </p>
                </div>
            )}

            <Canvas
                gl={{ powerPreference: "high-performance", antialias: true }}
                camera={{ fov: 45, near: 0.1, far: 5000 }}
                className="h-screen w-screen bg-[#333]"
                shadows
            >
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
                <directionalLight
                    position={[-100, 100, -100]}
                    intensity={0.3}
                />

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
                    <Suspense fallback={null}>
                        {data?.ext === "stl" && (
                            <STLScene
                                buffer={data.buffer}
                                onReady={handleReady}
                            />
                        )}
                        {data?.ext === "3mf" && (
                            <ThreeMFScene
                                buffer={data.buffer}
                                onReady={handleReady}
                            />
                        )}
                    </Suspense>
                )}
            </Canvas>
        </div>
    );
}

function CameraRig() {
    const { camera } = useThree();
    useEffect(() => {
        const spread = PLATE_SIZE + PLATE_GAP;
        camera.position.set(0, spread * 0.5, spread * 0.9);
        camera.lookAt(0, 0, 0);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}
