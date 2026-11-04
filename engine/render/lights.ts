// one light rig copied into the shelf scene and the close-up scene so a book looks the same in both

import * as THREE from "three/webgpu";
import { CASE, interiorTop, type CaseBounds } from "../../domain/shelf";

// balanced so a lambert face pointing at you shows its own colours at about 0.9x
const LIGHT = {
  hemi: 1.7,
  key: 1.55,
  fill: 0.75,
  keyColor: 0xfff0dc,
  fillColor: 0xfff2e0,
  sky: 0xfff4e6,
  ground: 0x3a2a1e,
  keyPos: new THREE.Vector3(70, 170, 460), // high lamp front right
  fillPos: new THREE.Vector3(-60, 80, 400),
};

export class LightRig {
  private key: THREE.DirectionalLight;
  private heroKey: THREE.DirectionalLight;
  private heroFill: THREE.DirectionalLight;
  private heroHemi: THREE.HemisphereLight;

  constructor(
    shelfScene: THREE.Scene,
    heroScene: THREE.Scene,
    bounds: CaseBounds,
  ) {
    const key = new THREE.DirectionalLight(LIGHT.keyColor, LIGHT.key);
    key.position.copy(LIGHT.keyPos);
    key.target.position.set(0, interiorTop / 2, -CASE.depth / 2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.near = 300;
    sc.far = 640;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.04;
    key.shadow.radius = 3;
    this.key = key;
    this.aim(bounds);
    const fill = new THREE.DirectionalLight(LIGHT.fillColor, LIGHT.fill);
    fill.position.copy(LIGHT.fillPos);
    shelfScene.add(
      new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.hemi),
      key,
      key.target,
      fill,
    );

    // directional lights only care about direction so the hero copy needs no target
    this.heroHemi = new THREE.HemisphereLight(
      LIGHT.sky,
      LIGHT.ground,
      LIGHT.hemi,
    );
    this.heroKey = new THREE.DirectionalLight(LIGHT.keyColor, LIGHT.key);
    this.heroKey.position.copy(this.keyDirection());
    this.heroFill = new THREE.DirectionalLight(LIGHT.fillColor, LIGHT.fill);
    this.heroFill.position.copy(LIGHT.fillPos);
    heroScene.add(this.heroHemi, this.heroKey, this.heroFill);
  }

  // keeps the lamp's direction and fits the shadow camera tight around the case
  aim(B: CaseBounds) {
    const key = this.key;
    const center = new THREE.Vector3(
      (B.left + B.right) / 2,
      (B.top + B.bot) / 2,
      -CASE.depth / 2,
    );
    const dir = LIGHT.keyPos
      .clone()
      .sub(new THREE.Vector3(0, interiorTop / 2, -CASE.depth / 2));
    key.target.position.copy(center);
    key.position.copy(center).add(dir);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    const hw = (B.right - B.left) / 2 + 24;
    const hh = (B.top - B.bot) / 2 + 30;
    sc.left = -hw;
    sc.right = hw;
    sc.top = hh;
    sc.bottom = -hh;
    sc.updateProjectionMatrix();
    // a larger case gets a larger map so shadow texels stay the same size
    const size = Math.max(hw, hh) > 160 ? 4096 : 2048;
    if (key.shadow.mapSize.x !== size) {
      key.shadow.mapSize.set(size, size);
      key.shadow.map?.dispose();
      (key.shadow as unknown as { map: unknown }).map = null;
    }
    key.shadow.needsUpdate = true;
  }

  // turns the hero rig with the cover, blended by lw, so the cover in hand gets the light a face-out cover gets
  aimHero(bookQuat: THREE.Quaternion, lw: number) {
    const coverN = new THREE.Vector3(1, 0, 0).applyQuaternion(bookQuat);
    const full = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      coverN,
    );
    const r = new THREE.Quaternion().slerp(full, lw);
    this.heroKey.position.copy(this.keyDirection()).applyQuaternion(r);
    this.heroFill.position.copy(LIGHT.fillPos).applyQuaternion(r);
    this.heroHemi.position.set(0, 1, 0).applyQuaternion(r);
  }

  private keyDirection() {
    return this.key.position.clone().sub(this.key.target.position);
  }
}
