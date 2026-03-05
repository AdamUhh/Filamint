import { unzipSync } from "fflate";
import { useMemo } from "react";
import * as THREE from "three";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

import { BuildPlate } from "./BuildPlate";

const PLATE_SIZE = 256;
const PLATE_GAP = 80;

// ─── ZIP helpers ──────────────────────────────────────────────────────────────

function decodeEntry(zip: Record<string, Uint8Array>, key: string) {
    return new TextDecoder().decode(zip[key]);
}

function findKey(zip: Record<string, Uint8Array>, substring: string) {
    return Object.keys(zip).find((k) => k.toLowerCase().includes(substring));
}

function parseXml(xml: string) {
    return new DOMParser().parseFromString(xml, "application/xml");
}

// ─── Extract ordered object IDs from 3dmodel.model ───────────────────────────
//
// The root model XML lists every <object> (or <object> with <components>
// referencing per-file objects).  The ThreeMFLoader iterates these in document
// order and pushes one child per object — so loader.children[i] corresponds
// to the i-th <object id="N"> in the root model.
//
// We read that same order here to build index → objectId.

function extractObjectIdOrder(zip: Record<string, Uint8Array>): number[] {
    const modelKey =
        findKey(zip, "3d/3dmodel.model") ?? findKey(zip, "3dmodel.model");
    if (!modelKey) return [];

    const doc = parseXml(decodeEntry(zip, modelKey));
    const ids: number[] = [];

    doc.querySelectorAll("model > resources > object").forEach((obj) => {
        const id = parseInt(obj.getAttribute("id") ?? "0", 10);
        if (id) ids.push(id);
    });

    return ids;
}

// ─── Plate config parser ──────────────────────────────────────────────────────

interface PlateConfig {
    id: number;
    objectIds: number[];
}

function parsePlateConfig(
    zip: Record<string, Uint8Array>
): PlateConfig[] | null {
    const cfgKey =
        findKey(zip, "model_settings.config") ??
        findKey(zip, "model_settings.cfg");
    if (!cfgKey) return null;

    const doc = parseXml(decodeEntry(zip, cfgKey));
    const plates: PlateConfig[] = [];

    doc.querySelectorAll("plate").forEach((plate) => {
        const plateIdEl = plate.querySelector('metadata[key="plater_id"]');
        const plateId = parseInt(plateIdEl?.getAttribute("value") ?? "0", 10);

        const objectIds: number[] = [];
        plate.querySelectorAll("model_instance").forEach((inst) => {
            const el = inst.querySelector('metadata[key="object_id"]');
            const id = parseInt(el?.getAttribute("value") ?? "0", 10);
            if (id) objectIds.push(id);
        });

        if (objectIds.length > 0) plates.push({ id: plateId, objectIds });
    });

    return plates.length > 0 ? plates.sort((a, b) => a.id - b.id) : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThreeMFScene({ buffer }: { buffer: ArrayBuffer }) {
    const zip = useMemo(
        () => unzipSync(new Uint8Array(buffer)) as Record<string, Uint8Array>,
        [buffer]
    );

    // ThreeMFLoader parses all geometry + materials
    const rootGroup = useMemo(() => {
        const loader = new ThreeMFLoader();
        return loader.parse(buffer);
    }, [buffer]);

    // Map objectId → Object3D by matching the XML document order to
    // the loader's children order (they are both document-order).
    const objectMap = useMemo(() => {
        const idOrder = extractObjectIdOrder(zip);
        const map = new Map<number, THREE.Object3D>();

        idOrder.forEach((xmlId, index) => {
            const child = rootGroup.children[index];
            if (child) map.set(xmlId, child);
        });

        // Fallback: if we couldn't parse IDs, just use sequential indices
        if (map.size === 0) {
            rootGroup.children.forEach((child, index) => {
                map.set(index, child);
            });
        }

        console.log(
            "[ThreeMFScene] objectMap",
            [...map.entries()].map(([id, o]) => ({ xmlId: id, name: o.name }))
        );

        return map;
    }, [zip, rootGroup]);

    // Plate assignments
    const plateConfigs = useMemo((): PlateConfig[] => {
        const fromCfg = parsePlateConfig(zip);
        if (fromCfg) return fromCfg;
        return [{ id: 1, objectIds: [...objectMap.keys()] }];
    }, [zip, objectMap]);

    // One Group per plate, populated with clones of the right objects
    const plateGroups = useMemo(() => {
        return plateConfigs.map((cfg) => {
            const group = new THREE.Group();
            cfg.objectIds.forEach((id) => {
                const obj = objectMap.get(id);
                if (!obj) {
                    console.warn(`[ThreeMFScene] object id ${id} not found`);
                    return;
                }
                group.add(obj.clone(true));
            });
            return { id: cfg.id, group };
        });
    }, [plateConfigs, objectMap]);

    const totalWidth =
        plateGroups.length * PLATE_SIZE + (plateGroups.length - 1) * PLATE_GAP;

    return (
        <group>
            {plateGroups.map(({ id, group }, i) => {
                const offsetX =
                    i * (PLATE_SIZE + PLATE_GAP) -
                    totalWidth / 2 +
                    PLATE_SIZE / 2;

                // Rotate before measuring so Box3 is in final world space
                group.rotation.set(-Math.PI / 2, 0, 0);
                group.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(group);
                const centre = box.getCenter(new THREE.Vector3());

                return (
                    <group key={id} position={[offsetX, 0, 0]}>
                        <BuildPlate />
                        <primitive
                            object={group}
                            position={[-centre.x, -box.min.y, -centre.z]}
                        />
                    </group>
                );
            })}
        </group>
    );
}
