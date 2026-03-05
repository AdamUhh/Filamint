import { unzipSync } from "fflate";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlateInstance {
    objectId: number;
    transform: THREE.Matrix4;
}

interface Plate {
    id: number;
    instances: PlateInstance[];
}

interface ParsedThreeMF {
    geometries: Map<number, THREE.BufferGeometry>;
    plates: Plate[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATE_SIZE = 256;
const PLATE_GAP = 80;

const EXTRUDER_COLORS: Record<number, string> = {
    1: "#c8c8c8",
    2: "#e07b39",
    3: "#4a90d9",
};
const extruderColor = (e: number) => EXTRUDER_COLORS[e] ?? "#c8c8c8";

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseThreeMF(buffer: ArrayBuffer): ParsedThreeMF {
    const zip = unzipSync(new Uint8Array(buffer));

    // Find the primary model XML
    const modelKey = Object.keys(zip).find(
        (k) =>
            k.toLowerCase().endsWith("3dmodel.model") ||
            k.toLowerCase().endsWith(".model")
    );
    if (!modelKey) throw new Error("No .model file found inside 3MF");

    const modelXml = new TextDecoder().decode(zip[modelKey]);
    const modelDoc = new DOMParser().parseFromString(
        modelXml,
        "application/xml"
    );

    // Build geometry per object id
    const geometries = new Map<number, THREE.BufferGeometry>();

    modelDoc.querySelectorAll("object").forEach((obj) => {
        const id = parseInt(obj.getAttribute("id") ?? "0", 10);
        const meshEl = obj.querySelector("mesh");
        if (!meshEl) return;

        const vertices: number[] = [];
        meshEl.querySelectorAll("vertex").forEach((v) => {
            vertices.push(
                parseFloat(v.getAttribute("x") ?? "0"),
                parseFloat(v.getAttribute("y") ?? "0"),
                parseFloat(v.getAttribute("z") ?? "0")
            );
        });

        const indices: number[] = [];
        meshEl.querySelectorAll("triangle").forEach((t) => {
            indices.push(
                parseInt(t.getAttribute("v1") ?? "0", 10),
                parseInt(t.getAttribute("v2") ?? "0", 10),
                parseInt(t.getAttribute("v3") ?? "0", 10)
            );
        });

        if (vertices.length === 0) return;

        // 3MF uses a right-handed Z-up coordinate system.
        // Convert to Three.js Y-up by swapping Y and Z, then negating the new Z.
        // (x, y, z)_3mf  →  (x, z, -y)_three
        const converted: number[] = [];
        for (let i = 0; i < vertices.length; i += 3) {
            converted.push(vertices[i], vertices[i + 2], -vertices[i + 1]);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(converted, 3)
        );
        geo.setIndex(indices);
        geo.computeVertexNormals();
        geometries.set(id, geo);
    });

    // Find slicer config (Bambu / OrcaSlicer style)
    const cfgKey = Object.keys(zip).find(
        (k) =>
            k.toLowerCase().includes("model_settings.cfg") ||
            k.toLowerCase().includes("slice_info.config")
    );

    const plateMap = new Map<number, PlateInstance[]>();
    const cfgExtruder = new Map<number, number>();

    if (cfgKey) {
        const cfgXml = new TextDecoder().decode(zip[cfgKey]);
        const cfgDoc = new DOMParser().parseFromString(
            cfgXml,
            "application/xml"
        );

        // Extruder assignments
        cfgDoc.querySelectorAll("object").forEach((obj) => {
            const id = parseInt(obj.getAttribute("id") ?? "0", 10);
            const extEl = obj.querySelector('metadata[key="extruder"]');
            if (extEl) {
                cfgExtruder.set(
                    id,
                    parseInt(extEl.getAttribute("value") ?? "1", 10)
                );
            }
        });

        // World-space transform per object from <assemble_item>
        // 3MF stores a row-major 3×4 matrix (12 values)
        const assembleTransforms = new Map<number, THREE.Matrix4>();
        cfgDoc.querySelectorAll("assemble_item").forEach((item) => {
            const objectId = parseInt(
                item.getAttribute("object_id") ?? "0",
                10
            );
            const vals = (item.getAttribute("transform") ?? "")
                .trim()
                .split(/\s+/)
                .map(Number);

            if (vals.length === 12) {
                // 3MF row-major 3×4:
                // [ r00 r01 r02  r10 r11 r12  r20 r21 r22  tx ty tz ]
                // Convert Z-up → Y-up:  (x,y,z) → (x, z, -y)
                // Apply basis change: B = [[1,0,0],[0,0,1],[0,-1,0]]
                // M_three = B * M_3mf * B^-1   (B^-1 = B^T here)
                // Translation: (tx, tz, -ty)
                const [
                    r00,
                    r01,
                    r02,
                    r10,
                    r11,
                    r12,
                    r20,
                    r21,
                    r22,
                    tx,
                    ty,
                    tz,
                ] = vals;

                const m = new THREE.Matrix4();
                // THREE.Matrix4.set is row-major
                m.set(
                    r00,
                    r02,
                    -r01,
                    tx,
                    r20,
                    r22,
                    -r21,
                    tz,
                    -r10,
                    -r12,
                    r11,
                    -ty,
                    0,
                    0,
                    0,
                    1
                );
                assembleTransforms.set(objectId, m);
            }
        });

        // Build plates
        cfgDoc.querySelectorAll("plate").forEach((plate) => {
            const plateIdEl = plate.querySelector('metadata[key="plater_id"]');
            const plateId = parseInt(
                plateIdEl?.getAttribute("value") ?? "0",
                10
            );
            const instances: PlateInstance[] = [];

            plate.querySelectorAll("model_instance").forEach((inst) => {
                const objIdEl = inst.querySelector('metadata[key="object_id"]');
                const objectId = parseInt(
                    objIdEl?.getAttribute("value") ?? "0",
                    10
                );
                const transform =
                    assembleTransforms.get(objectId) ?? new THREE.Matrix4();
                instances.push({ objectId, transform });
            });

            if (instances.length > 0) {
                plateMap.set(plateId, instances);
            }
        });
    }

    // Fallback: one plate with everything
    if (plateMap.size === 0) {
        const all: PlateInstance[] = [];
        geometries.forEach((_, id) =>
            all.push({ objectId: id, transform: new THREE.Matrix4() })
        );
        plateMap.set(1, all);
    }

    // Tag geometries with extruder index for colour lookup
    cfgExtruder.forEach((ext, id) => {
        const geo = geometries.get(id);
        if (geo) geo.userData.extruder = ext;
    });

    const plates: Plate[] = [...plateMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([id, instances]) => ({ id, instances }));

    return { geometries, plates };
}

// ─── Components ───────────────────────────────────────────────────────────────

function PlateObject({
    geometry,
    worldTransform,
    plateOrigin,
    extruder,
}: {
    geometry: THREE.BufferGeometry;
    worldTransform: THREE.Matrix4;
    plateOrigin: THREE.Vector3;
    extruder: number;
}) {
    useEffect(() => () => geometry.dispose(), [geometry]);

    // Re-centre on the plate in X/Z only — never touch Y so the model
    // keeps its correct height above the build plate.
    const matrix = useMemo(() => {
        const m = worldTransform.clone();
        m.elements[12] -= plateOrigin.x; // X
        // elements[13] = Y (height) — leave alone
        m.elements[14] -= plateOrigin.z; // Z
        return m;
    }, [worldTransform, plateOrigin]);

    return (
        <mesh matrixAutoUpdate={false} matrix={matrix} castShadow receiveShadow>
            <primitive object={geometry} attach="geometry" />
            <meshStandardMaterial
                color={extruderColor(extruder)}
                roughness={0.5}
                metalness={0.1}
            />
        </mesh>
    );
}

function PlateGroup({
    plate,
    geometries,
    plateOffset,
}: {
    plate: Plate;
    geometries: Map<number, THREE.BufferGeometry>;
    plateOffset: number;
}) {
    // Re-centre instances on the build plate:
    // X/Z: centroid so the group is centred on the plate
    // Y: minimum so the lowest object floor sits at Y=0
    const plateOrigin = useMemo(() => {
        if (plate.instances.length === 0) return new THREE.Vector3();
        let sumX = 0,
            sumZ = 0,
            minY = Infinity;
        plate.instances.forEach(({ transform }) => {
            sumX += transform.elements[12];
            sumZ += transform.elements[14];
            if (transform.elements[13] < minY) minY = transform.elements[13];
        });
        return new THREE.Vector3(
            sumX / plate.instances.length,
            isFinite(minY) ? minY : 0,
            sumZ / plate.instances.length
        );
    }, [plate]);

    return (
        <group position={[plateOffset, 0, 0]}>
            {/* Build plate slab */}
            <mesh position={[0, -1, 0]} receiveShadow>
                <boxGeometry args={[PLATE_SIZE, 2, PLATE_SIZE]} />
                <meshStandardMaterial
                    color="#333333"
                    roughness={0.9}
                    metalness={0}
                />
            </mesh>

            {plate.instances.map(({ objectId, transform }, i) => {
                const geo = geometries.get(objectId);
                if (!geo) return null;
                return (
                    <PlateObject
                        key={`${objectId}-${i}`}
                        geometry={geo}
                        worldTransform={transform}
                        plateOrigin={plateOrigin}
                        extruder={geo.userData.extruder ?? 1}
                    />
                );
            })}
        </group>
    );
}

// ─── Public export ────────────────────────────────────────────────────────────

export function ThreeMFScene({ buffer }: { buffer: ArrayBuffer }) {
    const parsed = useMemo(() => {
        try {
            return parseThreeMF(buffer);
        } catch (e) {
            console.error("Failed to parse 3MF:", e);
            return null;
        }
    }, [buffer]);

    if (!parsed) return null;

    const { geometries, plates } = parsed;
    const totalWidth =
        plates.length * PLATE_SIZE + (plates.length - 1) * PLATE_GAP;

    return (
        <group>
            {plates.map((plate, i) => {
                const offset =
                    i * (PLATE_SIZE + PLATE_GAP) -
                    totalWidth / 2 +
                    PLATE_SIZE / 2;
                return (
                    <PlateGroup
                        key={plate.id}
                        plate={plate}
                        geometries={geometries}
                        plateOffset={offset}
                    />
                );
            })}
        </group>
    );
}
