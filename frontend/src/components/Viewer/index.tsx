import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import JSZip from "jszip";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import * as THREE from "three";
import type { Group, Mesh } from "three";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

type ModelBuffer = { buffer: ArrayBuffer; ext: "stl" | "3mf" };

const PLATE_SIZE = 256;
const PLATE_GAP = 80;

interface PlateJson {
    bbox_all: [number, number, number, number];
    bbox_objects: { id: number; name: string }[];
}

interface PlateData {
    plateIdx: number;
    objectIds: Set<number>;
    bboxAll: [number, number, number, number];
}

function useModelBuffer(): { data: ModelBuffer | null; error: string | null } {
    const [data, setData] = useState<ModelBuffer | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searchParams] = useSearchParams();
    const modelId = searchParams.get("modelId");

    useEffect(() => {
        if (!modelId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError("No modelId in URL (?modelId=xxx)");
            return;
        }
        let cancelled = false;
        async function load() {
            for (const ext of ["stl", "3mf"] as const) {
                try {
                    const res = await fetch(`/models/${modelId}.${ext}`);
                    if (!res.ok) continue;
                    const buffer = await res.arrayBuffer();
                    if (!cancelled) setData({ buffer, ext });
                    return;
                } catch {
                    /* try next */
                }
            }
            if (!cancelled)
                setError(`Model not found: /models/${modelId}.{stl,3mf}`);
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [modelId]);

    return { data, error };
}

async function parsePlates(buffer: ArrayBuffer): Promise<PlateData[]> {
    const zip = await JSZip.loadAsync(buffer);

    const plateFiles: { idx: number; filename: string }[] = [];
    for (const filename of Object.keys(zip.files)) {
        const m = filename.match(/^Metadata\/plate_(\d+)\.json$/);
        if (m) plateFiles.push({ idx: parseInt(m[1]) - 1, filename }); // 1-based → 0-based
    }
    plateFiles.sort((a, b) => a.idx - b.idx);

    if (plateFiles.length === 0) {
        return [
            {
                plateIdx: 0,
                objectIds: new Set(),
                bboxAll: [0, 0, PLATE_SIZE, PLATE_SIZE],
            },
        ];
    }

    const plates: PlateData[] = [];
    for (const { idx, filename } of plateFiles) {
        const text = await zip.files[filename].async("text");
        const json: PlateJson = JSON.parse(text);
        plates.push({
            plateIdx: idx,
            objectIds: new Set((json.bbox_objects ?? []).map((o) => o.id)),
            bboxAll: json.bbox_all,
        });
    }
    return plates;
}

function ThreeMFScene({ buffer }: { buffer: ArrayBuffer }) {
    const [plates, setPlates] = useState<PlateData[]>([]);

    useEffect(() => {
        parsePlates(buffer).then(setPlates);
    }, [buffer]);

    const parsedGroup = useMemo(() => {
        const loader = new ThreeMFLoader();
        const g = loader.parse(buffer) as Group;
        g.updateMatrixWorld(true);
        return g;
    }, [buffer]);

    useEffect(
        () => () => {
            parsedGroup.traverse((obj) => {
                if ((obj as Mesh).isMesh) {
                    const mesh = obj as Mesh;
                    mesh.geometry?.dispose();
                    const mats = Array.isArray(mesh.material)
                        ? mesh.material
                        : [mesh.material];
                    mats.forEach((m) => m?.dispose());
                }
            });
        },
        [parsedGroup]
    );

    // Compute world-space layout for each plate
    const plateLayouts = useMemo(() => {
        if (plates.length === 0) return [];

        const plateDims = plates.map((p) => {
            const [minX, minY, maxX, maxY] = p.bboxAll;
            return {
                width: maxX - minX,
                depth: maxY - minY,
                slicerCenterX: (minX + maxX) / 2,
                slicerCenterY: (minY + maxY) / 2,
                gridSize: Math.max(maxX - minX, maxY - minY, PLATE_SIZE),
            };
        });

        // Pack left to right
        let cursorX = 0;
        const worldXCenters: number[] = [];
        for (let i = 0; i < plateDims.length; i++) {
            worldXCenters.push(cursorX + plateDims[i].gridSize / 2);
            cursorX += plateDims[i].gridSize + PLATE_GAP;
        }
        const totalWidth = cursorX - PLATE_GAP;
        const offsetX = -totalWidth / 2;

        return plates.map((plate, i) => ({
            plate,
            worldX: worldXCenters[i] + offsetX,
            slicerCenterX: plateDims[i].slicerCenterX,
            slicerCenterY: plateDims[i].slicerCenterY,
            gridSize: plateDims[i].gridSize,
        }));
    }, [plates]);

    // Match Three.js children to plates via object id
    // ThreeMFLoader names children by their <object> id from the 3MF XML,
    // but the plate JSON uses a different "identify_id" system.
    // We also check userData for any id fields the loader may populate.
    const childrenByPlate = useMemo(() => {
        if (plateLayouts.length === 0)
            return new Map<number, THREE.Object3D[]>();

        const allChildren = [...parsedGroup.children];
        const result = new Map<number, THREE.Object3D[]>();

        // Debug: log available child names/userData to help diagnose mismatches
        console.log(
            "[3MF] parsed children:",
            allChildren.map((c) => ({
                name: c.name,
                userData: c.userData,
            }))
        );
        console.log(
            "[3MF] plates:",
            plateLayouts.map((l) => ({
                idx: l.plate.plateIdx,
                ids: [...l.plate.objectIds],
            }))
        );

        for (const layout of plateLayouts) {
            const { plate } = layout;
            if (plate.objectIds.size === 0) {
                result.set(plate.plateIdx, allChildren);
                continue;
            }

            const matched = allChildren.filter((child) => {
                // Check every numeric field we can find on the child
                const candidates = [
                    parseInt(child.name),
                    child.userData?.id,
                    child.userData?.object_id,
                    child.userData?.identify_id,
                    child.userData?.objectId,
                ].filter((v) => typeof v === "number" && !isNaN(v));

                return candidates.some((id) => plate.objectIds.has(id));
            });

            result.set(plate.plateIdx, matched);
        }

        // Fallback: if nothing matched at all, put everything on first plate
        const total = [...result.values()].reduce((s, v) => s + v.length, 0);
        if (total === 0) {
            console.warn(
                "[3MF] No objects matched to plates — dumping all on plate 0"
            );
            result.set(plateLayouts[0].plate.plateIdx, allChildren);
        }

        return result;
    }, [parsedGroup, plateLayouts]);

    if (plateLayouts.length === 0) return null;

    return (
        <>
            {plateLayouts.map(
                ({ plate, worldX, slicerCenterX, slicerCenterY, gridSize }) => {
                    const children = childrenByPlate.get(plate.plateIdx) ?? [];

                    return (
                        <group key={plate.plateIdx}>
                            {/* Place the BuildPlate at worldX, 0, worldZ (Z = slicer Y) */}
                            <BuildPlate
                                position={[
                                    slicerCenterY - worldX - 256 * 2,
                                    0,
                                    slicerCenterY - 128,
                                ]}
                                size={gridSize}
                            />

                            {/* Rotate objects to match slicer coordinate system */}
                            <group
                                rotation={[-Math.PI / 2, 0, 0]}
                                position={[
                                    worldX - slicerCenterX,
                                    0,
                                    slicerCenterY - 20,
                                ]}
                            >
                                {children.map((child, ci) => (
                                    <primitive key={ci} object={child} />
                                ))}
                            </group>
                        </group>
                    );
                }
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// STL viewer
// ---------------------------------------------------------------------------
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
    return (
        <group position={position}>
            <mesh position={[0, -1, 0]} receiveShadow>
                <boxGeometry args={[size, 2, size]} />
                <meshStandardMaterial
                    color="#333333"
                    roughness={0.9}
                    metalness={0}
                />
            </mesh>
            <Grid
                position={[0, 0.01, 0]}
                args={[size, size]}
                cellSize={10}
                cellThickness={0.4}
                cellColor="#999999"
                sectionSize={50}
                sectionThickness={0.8}
                sectionColor="#3d3d3d"
                fadeDistance={1500}
                fadeStrength={1.5}
                infiniteGrid={false}
            />
        </group>
    );
}

function CameraRig({ plateCount }: { plateCount: number }) {
    const { camera } = useThree();
    useEffect(() => {
        const spread = Math.max(1, plateCount) * (PLATE_SIZE + PLATE_GAP);
        camera.position.set(0, spread * 0.5, spread * 0.9);
        camera.lookAt(0, 0, 0);
    }, [camera, plateCount]);
    return null;
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

export default function ModelViewer() {
    const { data, error } = useModelBuffer();
    const [plateCount, setPlateCount] = useState(1);

    useEffect(() => {
        if (data?.ext === "3mf") {
            parsePlates(data.buffer).then((p) => setPlateCount(p.length));
        }
    }, [data]);

    if (error) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-[#111] text-[#f55]">
                {error}
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-[#111]">
            <Canvas
                gl={{ powerPreference: "high-performance", antialias: true }}
                camera={{ fov: 45, near: 0.1, far: 5000 }}
                className="h-screen w-screen"
                shadows
            >
                <Lighting />
                <CameraRig plateCount={plateCount} />
                <OrbitControls
                    makeDefault
                    target={[0, 30, 0]}
                    minDistance={50}
                    maxDistance={3000}
                    maxPolarAngle={Math.PI / 2 - 0.02}
                    enableDamping
                    dampingFactor={0.08}
                />
                {data && (
                    <Suspense fallback={null}>
                        <Model data={data} />
                    </Suspense>
                )}
            </Canvas>
            {!data && !error && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#888]">
                    Loading model…
                </div>
            )}
        </div>
    );
}
