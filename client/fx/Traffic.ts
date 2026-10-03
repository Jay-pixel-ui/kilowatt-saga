import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CONFIG } from "../../shared/config.js";
import { streetCenters, citySpan, mulberry32 } from "../entities/City.js";

/**
 * Street traffic v2: actual cars.
 * Each car = body + cabin + 4 wheels (one merged vertex-colored geometry,
 * instanced per paint color) + emissive headlight/taillight strips
 * (two more instanced meshes). ~120 cars ≈ 6 draw calls total.
 */
interface Car {
  axis: "x" | "z";
  lane: number;
  dir: 1 | -1;
  speed: number;
  offset: number;
  variant: number;
  slot: number; // index within its variant's InstancedMesh
}

const PAINTS = [0x2b2f3a, 0x7a1f2b, 0xb9a23a, 0xd8d8de]; // graphite, red, taxi, white

export class Traffic {
  private bodies: THREE.InstancedMesh[] = [];
  private headlights: THREE.InstancedMesh;
  private taillights: THREE.InstancedMesh;
  private cars: Car[] = [];
  private dummy = new THREE.Object3D();
  private span: number;

  constructor(scene: THREE.Scene) {
    const rand = mulberry32(CONFIG.CITY.SEED + 555);
    const lanes = streetCenters();
    this.span = citySpan();
    const n = CONFIG.TRAFFIC.CARS;
    const perVariant = Math.ceil(n / PAINTS.length);

    // One merged car geometry per paint color.
    const carMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.5
    });
    for (const paint of PAINTS) {
      const mesh = new THREE.InstancedMesh(buildCarGeometry(paint), carMat, perVariant);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0; // grows as cars are assigned
      scene.add(mesh);
      this.bodies.push(mesh);
    }

    // Light strips (emissive — these feed the bloom pass at night).
    const strip = new THREE.BoxGeometry(1.1, 0.12, 0.06);
    this.headlights = new THREE.InstancedMesh(
      strip,
      new THREE.MeshBasicMaterial({ color: 0xfff2cf }),
      n
    );
    this.taillights = new THREE.InstancedMesh(
      strip,
      new THREE.MeshBasicMaterial({ color: 0xff3333 }),
      n
    );
    this.headlights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.taillights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.headlights, this.taillights);

    const slots = new Array(PAINTS.length).fill(0);
    for (let i = 0; i < n; i++) {
      const variant = Math.floor(rand() * PAINTS.length);
      const dir: 1 | -1 = rand() < 0.5 ? 1 : -1;
      this.cars.push({
        axis: rand() < 0.5 ? "x" : "z",
        lane: lanes[Math.floor(rand() * lanes.length)] + dir * 3.5,
        dir,
        speed:
          CONFIG.TRAFFIC.SPEED_MIN +
          rand() * (CONFIG.TRAFFIC.SPEED_MAX - CONFIG.TRAFFIC.SPEED_MIN),
        offset: rand() * this.span,
        variant,
        slot: slots[variant]++
      });
      this.bodies[variant].count = slots[variant];
    }
  }

  update(_dt: number, t: number): void {
    const half = this.span / 2;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      const travel =
        ((((c.offset + t * c.speed * c.dir) % this.span) + this.span) % this.span) - half;

      // Yaw: face the direction of travel.
      let x: number, z: number, yaw: number;
      if (c.axis === "x") {
        x = travel;
        z = c.lane;
        yaw = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = c.lane;
        z = travel;
        yaw = c.dir > 0 ? 0 : Math.PI;
      }

      this.dummy.position.set(x, 0, z);
      this.dummy.rotation.set(0, yaw, 0);
      this.dummy.updateMatrix();
      this.bodies[c.variant].setMatrixAt(c.slot, this.dummy.matrix);

      // Lights: front strip at +local-z, rear at -local-z.
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      this.dummy.position.set(x + fx * 1.82, 0.55, z + fz * 1.82);
      this.dummy.updateMatrix();
      this.headlights.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.set(x - fx * 1.82, 0.6, z - fz * 1.82);
      this.dummy.updateMatrix();
      this.taillights.setMatrixAt(i, this.dummy.matrix);
    }
    for (const b of this.bodies) b.instanceMatrix.needsUpdate = true;
    this.headlights.instanceMatrix.needsUpdate = true;
    this.taillights.instanceMatrix.needsUpdate = true;
  }
}

/** Body + cabin + 4 wheels merged into one vertex-colored geometry. */
function buildCarGeometry(paint: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const colored = (geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry => {
    const c = new THREE.Color(color);
    const count = geo.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  };

  // Body shell.
  const body = colored(new THREE.BoxGeometry(1.7, 0.5, 3.6), paint);
  body.translate(0, 0.58, 0);
  parts.push(body);

  // Cabin (dark glass).
  const cabin = colored(new THREE.BoxGeometry(1.5, 0.42, 1.7), 0x10131c);
  cabin.translate(0, 1.02, -0.25);
  parts.push(cabin);

  // Wheels.
  for (const [wx, wz] of [
    [-0.8, 1.15],
    [0.8, 1.15],
    [-0.8, -1.15],
    [0.8, -1.15]
  ] as const) {
    const wheel = colored(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10), 0x0a0a0e);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(wx, 0.32, wz);
    parts.push(wheel);
  }

  return mergeGeometries(parts);
}
