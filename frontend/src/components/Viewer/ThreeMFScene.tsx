import { unzipSync } from "fflate";
import { useMemo } from "react";
import * as THREE from "three";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

import { BuildPlate } from "./BuildPlate";

const PLATE_SIZE = 256;
const PLATE_GAP = 80;

/**
 * ─── HOW ThreeMFScene WORKS - STEP BY STEP ───────────────────────────────────
 *
 * A .3mf file is a ZIP archive. This component unpacks it, parses its XML
 * metadata, loads all 3D geometry, then lays out each "build plate" side-by-side
 * in a Three.js scene.
 *
 * STEP 1 - Unzip the buffer
 *   We receive the .3mf file as a raw ArrayBuffer, but all the useful data
 *   (geometry, config, XML metadata) lives inside it as a ZIP.  We unzip it
 *   up-front into a flat { path: Uint8Array } map so every later step can do
 *   a simple key-lookup instead of re-parsing the archive each time.
 *
 * STEP 2 - Load all geometry with ThreeMFLoader
 *   ThreeMFLoader returns a single Group whose children are all
 *   the meshes in document order - giving us materials, UVs, and transforms.
 *   We do this once and treat the result as an immutable source of
 *   truth that later steps clone from.
 *
 * STEP 3 - Build an objectId → Object3D map
 *   ThreeMFLoader gives us an array of children but no way to ask "which child
 *   belongs to object id 7?".  We need that mapping because the plate config
 *   (Step 4) references objects by their XML id, not by array index.
 *   The trick: both the XML parser and ThreeMFLoader walk <resources> in the
 *   same document order, so children[i] reliably corresponds to idOrder[i].
 *   We exploit that alignment to build the id → Object3D lookup map without
 *   any fragile name-matching.
 *
 * STEP 4 - Parse plate assignments
 *   A single .3mf can contain objects destined for multiple independent build
 *   plates (common in Bambu/OrcaSlicer projects).  We read model_settings.config
 *   to find out which object IDs belong to which plate, so we can render them
 *   separately rather than dumping everything into one scene.
 *   If no config exists (generic .3mf files), we fall back to one plate with every
 *   object - so the component works with any .3mf, not just slicer-generated ones.
 *
 * STEP 5 - Build one THREE.Group per plate
 *   We clone the relevant objects into a fresh Group per plate rather than
 *   moving the originals.  Cloning matters because the same mesh could
 *   theoretically appear on multiple plates, and it keeps the source
 *   rootGroup intact as a clean pool to draw from.
 *
 * STEP 6 - Position & centre each plate group
 *   3MF files use a Y-up coordinate system, but Three.js scenes are Z-up, so
 *   we apply a -90° X rotation to flip the models upright.  We then force a
 *   matrixWorld update *before* measuring the bounding box - if we measured
 *   first the Box3 would reflect the un-rotated pose and the centring maths
 *   would be wrong.  With the correct box we translate each group so it sits
 *   flush on y = 0 and is centred at the origin of its plate slot.
 *
 * STEP 7 - Lay plates out side-by-side
 *   Multiple plates need to be visible at once without overlapping.  We space
 *   them PLATE_SIZE + PLATE_GAP apart along X, then subtract half the total
 *   row width so the whole arrangement is centred at the scene origin - making
 *   it easy for the camera to frame everything regardless of how many plates
 *   there are.  Each slot also renders a <BuildPlate /> so the user can see
 *   the physical print surface beneath the models.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── ZIP helpers ──────────────────────────────────────────────────────────────

function findKey(zip: Record<string, Uint8Array>, substring: string) {
    return Object.keys(zip).find((k) => k.toLowerCase().includes(substring));
}

function decodeEntry(zip: Record<string, Uint8Array>, key: string) {
    return new TextDecoder().decode(zip[key]);
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
