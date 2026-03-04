import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
    AmbientLight,
    Box3,
    Color,
    DirectionalLight,
    HemisphereLight,
    Material,
    Mesh,
    MeshStandardMaterial,
    Object3D,
    PCFSoftShadowMap,
    PerspectiveCamera,
    Scene,
    Vector3,
    WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

async function loadSTL(url: string, material: Material): Promise<Object3D> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geometry = new STLLoader().parse(await res.arrayBuffer());
    geometry.computeVertexNormals();
    return new Mesh(geometry, material);
}

function loadThreeMF(url: string, material: Material): Promise<Object3D> {
    return new Promise((resolve, reject) =>
        new ThreeMFLoader().load(
            url,
            (group) => {
                group.traverse((child) => {
                    if ((child as Mesh).isMesh)
                        (child as Mesh).material = material;
                });
                resolve(group);
            },
            undefined,
            reject
        )
    );
}

type LoadFn = (url: string, material: Material) => Promise<Object3D>;

const LOADERS: Record<string, LoadFn> = {
    stl: loadSTL,
    "3mf": loadThreeMF,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Centers the object at the origin and positions the camera to frame it. */
function fitCamera(
    object: Object3D,
    camera: PerspectiveCamera,
    controls: OrbitControls
): void {
    const box = new Box3().setFromObject(object);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    object.position.sub(center);
    camera.near = maxDim * 0.01;
    camera.far = maxDim * 100;
    camera.position.set(0, 0, maxDim * 2);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
}

function buildScene(): Scene {
    const scene = new Scene();
    scene.background = new Color(0x121218);

    // Ambient — just enough to lift the darkest shadows, not kill them
    const ambient = new AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    // Hemisphere — soft sky/ground gradient, keeps undersides readable
    const hemi = new HemisphereLight(0xddeeff, 0x443322, 0.8);
    hemi.position.set(0, 200, 0);
    scene.add(hemi);

    // Main key light — primary source of shadows and highlights
    const key = new DirectionalLight(0xffffff, 4.0);
    key.position.set(200, 300, 200);
    key.castShadow = true;
    key.shadow.mapSize.width = 4096;
    key.shadow.mapSize.height = 4096;
    key.shadow.radius = 2;
    key.shadow.bias = -0.0005;
    scene.add(key);

    // Secondary fill — opposite side, weaker so shadows are still visible
    const fill = new DirectionalLight(0xffffff, 1.2);
    fill.position.set(-200, 100, -100);
    fill.castShadow = false;
    scene.add(fill);

    // Rim light — back-top for edge definition
    const rim = new DirectionalLight(0xffffff, 1.5);
    rim.position.set(0, 200, -250);
    rim.castShadow = false;
    scene.add(rim);

    // Soft bottom bounce — prevents pitch-black undersides
    const bottom = new DirectionalLight(0xffffff, 0.5);
    bottom.position.set(0, -200, 0);
    bottom.castShadow = false;
    scene.add(bottom);

    return scene;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Status = "loading" | "ready" | "error";

const EXT = "3mf" as const; // swap to "stl" when needed

export default function ModelViewer() {
    const mountRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<Status>("loading");
    const [searchParams] = useSearchParams();
    const modelId = searchParams.get("modelId");

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount || !modelId) return;

        // --- Renderer ---
        const renderer = new WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PCFSoftShadowMap;
        mount.appendChild(renderer.domElement);

        const setSize = () => {
            const w = mount.offsetWidth || window.innerWidth;
            const h = mount.offsetHeight || window.innerHeight;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };

        // --- Camera + Controls ---
        const camera = new PerspectiveCamera(45, 1, 0.1, 10000);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // --- Scene ---
        const scene = buildScene();

        // --- Demand-driven render (no idle GPU burn) ---
        let rafId: number;
        const render = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                controls.update();
                renderer.render(scene, camera);
            });
        };

        setSize();
        controls.addEventListener("change", render);
        window.addEventListener("resize", () => {
            setSize();
            render();
        });

        // --- Load model ---
        const loader = LOADERS[EXT];
        if (!loader) {
            setStatus("error");
            return;
        }

        const material = new MeshStandardMaterial({
            color: 0x21867d,
            roughness: 0.75,
            metalness: 0.0,
        });

        loader(`/models/${modelId}.${EXT}`, material)
            .then((object) => {
                fitCamera(object, camera, controls);
                scene.add(object);
                setStatus("ready");
                render();
            })
            .catch(() => setStatus("error"));

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener("resize", render);
            controls.removeEventListener("change", render);
            controls.dispose();
            material.dispose();
            renderer.dispose();
            if (mount.contains(renderer.domElement))
                mount.removeChild(renderer.domElement);
        };
    }, [modelId]);

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                position: "relative",
                background: "#1a1a2e",
            }}
        >
            {status === "loading" && <Overlay>Loading…</Overlay>}
            {status === "error" && (
                <Overlay color="#ff6b6b">Model not found: {modelId}</Overlay>
            )}
            <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}

function Overlay({
    children,
    color = "#ffffff",
}: {
    children: React.ReactNode;
    color?: string;
}) {
    return (
        <div
            style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color,
                fontSize: 18,
                zIndex: 10,
                pointerEvents: "none",
            }}
        >
            {children}
        </div>
    );
}
