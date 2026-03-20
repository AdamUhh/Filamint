import { useEffect, useMemo } from "react";
import {
    Box3,
    Group,
    Mesh,
    MeshStandardMaterial,
    type Object3D,
    Vector3,
} from "three";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

import { PLATE_GAP, PLATE_SIZE } from "@/lib/constant-three";

import { BuildPlate } from "./BuildPlate";

interface PlateConfig {
    id: number;
    objectIds: number[];
}

// Search a ZIP's file list for a path that contains the given substring
// e.g. findKey(zip, "3dmodel.model") finds "3D/3dmodel.model"
function findKey(zip: Record<string, Uint8Array>, substring: string) {
    return Object.keys(zip).find((k) => k.toLowerCase().includes(substring));
}

// Convert a raw binary file from the ZIP into a normal JS string
function decodeEntry(zip: Record<string, Uint8Array>, key: string) {
    return new TextDecoder().decode(zip[key]);
}

// Turn an XML string into a searchable DOM so we can use querySelector on it
function parseXml(xml: string) {
    return new DOMParser().parseFromString(xml, "application/xml");
}

// STEP 3 HELPER: figure out which XML object ID maps to which index
//
// A .3mf file has a main XML document ("3dmodel.model") that lists every
// object like: <object id="5">, <object id="7">, ...
//
// The ThreeMFLoader also reads this same list and creates one Three.js child
// per object, in the same order.  So children[0] = id 5, children[1] = id 7, etc.
//
// We read the XML here to get that ordered list of IDs so we can later say
// "give me the Three.js object for id 7" efficiently
function extractObjectIdOrder(zip: Record<string, Uint8Array>): number[] {
    // Find the main model file regardless of its exact path in the ZIP.
    const modelKey =
        findKey(zip, "3d/3dmodel.model") ?? findKey(zip, "3dmodel.model");
    if (!modelKey) return [];

    const doc = parseXml(decodeEntry(zip, modelKey));
    const ids: number[] = [];

    // Walk every <object> tag under <resources> and collect its "id" attribute.
    doc.querySelectorAll("model > resources > object").forEach((obj) => {
        const id = parseInt(obj.getAttribute("id") ?? "0", 10);
        if (id) ids.push(id);
    });

    return ids;
}

// STEP 4 HELPER: read which objects belong to which print plate
//
// Slicer apps like Bambu Studio / OrcaSlicer save a "model_settings.config"
// file inside the .3mf ZIP. It roughly looks like:
//
//   <plate>
//     <metadata key="plater_id" value="1"/>
//     <model_instance>
//       <metadata key="object_id" value="5"/>
//     </model_instance>
//   </plate>
//
// We parse that here to know which objects go on plate 1, plate 2, etc.
// If the file doesn't exist (e.g. a generic .3mf not from a slicer) we
// return null, and the caller will just put everything on one plate
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
        // Read the plate's own ID number.
        const plateIdEl = plate.querySelector('metadata[key="plater_id"]');
        const plateId = parseInt(plateIdEl?.getAttribute("value") ?? "0", 10);

        // Collect every object ID assigned to this plate
        const objectIds: number[] = [];
        plate.querySelectorAll("model_instance").forEach((inst) => {
            const el = inst.querySelector('metadata[key="object_id"]');
            const id = parseInt(el?.getAttribute("value") ?? "0", 10);
            if (id) objectIds.push(id);
        });

        // Only record the plate if it actually has objects on it
        if (objectIds.length > 0) plates.push({ id: plateId, objectIds });
    });

    // Sort by plate ID (1, 2, 3 …) so the display order is predictable
    return plates.length > 0 ? plates.sort((a, b) => a.id - b.id) : null;
}

// Receives the raw bytes of a .3mf file and renders all its print plates
export function ThreeMFScene({
    buffer,
    onReady,
}: {
    buffer: ArrayBuffer;
    onReady: () => void;
}) {
    // STEP 1: Unzip the .3mf file
    // A .3mf file is really just a ZIP archive
    // We unzip it once into a plain { "path/to/file": Uint8Array } dictionary
    // so every later step can look up files by name without re-parsing the archive
    const zip = useMemo(
        () => unzipSync(new Uint8Array(buffer)) as Record<string, Uint8Array>,
        [buffer]
    );

    // STEP 2: Load all 3D geometry using Three.js's built-in 3MF loader
    // This gives us a single Group containing one child mesh per object
    // We treat this as a read-only pool - we never touch these,
    // we only clone from them later
    const rootGroup = useMemo(() => {
        const loader = new ThreeMFLoader();
        return loader.parse(buffer);
    }, [buffer]);

    useEffect(() => {
        return () => {
            // Free GPU memory for every mesh in the original source pool
            rootGroup.traverse((child) => {
                if ((child as Mesh).isMesh) {
                    const mesh = child as Mesh;
                    mesh.geometry?.dispose();
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach((m) => m.dispose());
                    } else {
                        mesh.material?.dispose();
                    }
                }
            });
        };
    }, [rootGroup]);

    // STEP 3: Build a lookup table: objectId (from XML) -> Three.js Object3D
    // The loader's children array and the XML's <object> list are both in
    // document order, so children[i] reliably matches idOrder[i]
    // We exploit that alignment to pair them up
    const objectMap = useMemo(() => {
        const idOrder = extractObjectIdOrder(zip); // e.g. [5, 7, 12]
        const map = new Map<number, Object3D>();

        if (idOrder.length > 0) {
            // Normal case: pair each XML id with the loader child at the same index.
            idOrder.forEach((xmlId, index) => {
                const child = rootGroup.children[index];
                if (child) map.set(xmlId, child);
            });
        } else {
            // Fallback for files with no readable XML: use 0, 1, 2, … as fake IDs.
            rootGroup.children.forEach((child, index) => {
                map.set(index, child);
            });
        }

        return map; // e.g. Map { 5 -> Mesh, 7 -> Mesh, 12 -> Mesh }
    }, [zip, rootGroup]);

    // STEP 4: Decide which objects go on which plate
    // Use the slicer config if it exists; otherwise put everything on one plate
    const plateConfigs = useMemo((): PlateConfig[] => {
        const fromConfig = parsePlateConfig(zip);
        if (fromConfig) return fromConfig;
        // Generic fallback: one plate containing every object.
        return [{ id: 1, objectIds: [...objectMap.keys()] }];
    }, [zip, objectMap]);

    // A single shared material applied to all meshes so they render
    // consistently regardless of whatever material the .3mf file specifies.
    const orangeMaterial = useMemo(
        () => new MeshStandardMaterial({ color: 0xff6600 }),
        []
    );
    useEffect(() => {
        return () => orangeMaterial.dispose();
    }, [orangeMaterial]);

    // STEPS 5 & 6: Build one Three.js Group per plate, then centre and ground it
    const plateGroups = useMemo(() => {
        const _box = new Box3();
        const _centre = new Vector3();

        return plateConfigs.map((config) => {
            // STEP 5: Clone the relevant objects into a fresh group
            // We clone rather than move so the original rootGroup stays intact
            // as a clean pool
            const group = new Group();

            config.objectIds.forEach((id) => {
                const obj = objectMap.get(id);
                if (!obj) {
                    console.error(`[ThreeMFScene] object id ${id} not found`);
                    return;
                }
                const clone = obj.clone(true); // true = deep clone (includes children)

                // Paint every mesh in the clone with our orange material
                clone.traverse((child) => {
                    if ((child as Mesh).isMesh) {
                        (child as Mesh).material = orangeMaterial;
                    }
                });
                group.add(clone);
            });

            // STEP 6: Flip the group upright and centre it on its plate
            // .3mf uses a Y-up coordinate system, but Three.js (R3F) is Z-up,
            // so rotating -90° around X brings the model the right way up
            group.rotation.set(-Math.PI / 2, 0, 0);

            // Recalculate all world transforms NOW, before we measure
            // Without this, the bounding box would reflect the old
            // (un-rotated) pose and our centring maths would be wrong
            group.updateMatrixWorld(true);

            // Measure the group's axis-aligned bounding box in world space
            _box.setFromObject(group);
            _box.getCenter(_centre);

            // Apply this offset when placing the group so that:
            // - The model's XZ footprint is centred at the plate's origin
            // - The bottom of the model sits exactly on y = 0 (the plate surface)
            return {
                id: config.id,
                group,
                offset: new Vector3(-_centre.x, -_box.min.y, -_centre.z),
            };
        });
    }, [plateConfigs, objectMap, orangeMaterial]);

    // STEP 7: Lay all plates out in a row, centred at the scene origin
    // Each plate slot is PLATE_SIZE wide with PLATE_GAP between them
    // We subtract half the total row width so the whole arrangement
    // is centred, making it easy for the camera to frame everything
    const totalWidth = useMemo(
        () =>
            plateGroups.length * PLATE_SIZE +
            (plateGroups.length - 1) * PLATE_GAP,
        [plateGroups]
    );

    // Fire onReady once plateGroups are computed (geometry is ready to render)
    useEffect(() => {
        if (plateGroups.length > 0) onReady();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plateGroups]); // intentionally omit onReady

    return (
        <group>
            {plateGroups.map(({ id, group, offset }, i) => {
                // Calculate the X position for this plate's slot
                const offsetX =
                    i * (PLATE_SIZE + PLATE_GAP) - // move right for each plate
                    totalWidth / 2 + // shift left to centre the row
                    PLATE_SIZE / 2; // align to slot centre not left edge

                return (
                    <group key={id} position={[offsetX, 0, 0]}>
                        <BuildPlate />
                        <primitive object={group} position={offset} />
                    </group>
                );
            })}
        </group>
    );
}
