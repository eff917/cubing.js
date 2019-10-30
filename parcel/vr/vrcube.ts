import { DoubleSide, Euler, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from "three";
import { Sequence } from "../../src/alg";
import { Twisty } from "../../src/twisty";
import { Cube3D } from "../../src/twisty/3d/cube3D";
import { TAU } from "../../src/twisty/3d/twisty3D";
import { Status } from "./vr-input";

let initialHeight = parseFloat(new URL(location.href).searchParams.get("height") || "1");
if (isNaN(initialHeight)) {
  initialHeight = 1;
}

let initialScale = parseFloat(new URL(location.href).searchParams.get("scale") || "1");
if (isNaN(initialScale)) {
  initialScale = 1;
}

// From `cube3D.ts`
class AxisInfo {
  public stickerMaterial: THREE.MeshBasicMaterial;
  constructor(public side: string, public vector: Vector3, public fromZ: THREE.Euler, public color: number) {
    // TODO: Make sticker material single-sided when cubie base is rendered?
    color = 0xffffff; // override
    this.stickerMaterial = new MeshBasicMaterial({ color, side: DoubleSide });
    this.stickerMaterial.transparent = true;
    this.stickerMaterial.opacity = 0.4;
  }
}
const axesInfo: AxisInfo[] = [
  new AxisInfo("U", new Vector3(0, 1, 0), new Euler(-TAU / 4, 0, 0), 0xffffff),
  new AxisInfo("L", new Vector3(-1, 0, 0), new Euler(0, -TAU / 4, 0), 0xff8800),
  new AxisInfo("F", new Vector3(0, 0, 1), new Euler(0, 0, 0), 0x00ff00),
  new AxisInfo("R", new Vector3(1, 0, 0), new Euler(0, TAU / 4, 0), 0xff0000),
  new AxisInfo("B", new Vector3(0, 0, -1), new Euler(0, TAU / 2, 0), 0x0000ff),
  new AxisInfo("D", new Vector3(0, -1, 0), new Euler(TAU / 4, 0, 0), 0xffff00),
];

export class VRCube {
  public group: Group = new Group();
  private twisty: Twisty;
  private cachedCube3D: Cube3D;
  private controlPlanes: Mesh[] = [];
  constructor() {
    this.twisty = new Twisty(document.createElement("twisty"), { alg: new Sequence([]) });
    this.cachedCube3D = this.twisty.experimentalGetPlayer().cube3DView.experimentalGetCube3D();
    this.cachedCube3D.experimentalUpdateOptions({ showFoundation: false, showHintStickers: false });
    this.group.add(this.cachedCube3D.experimentalGetCube());

    for (const axis of axesInfo) {
      const controlPlane = new Mesh(new PlaneGeometry(1, 1), axis.stickerMaterial);
      controlPlane.userData.axis = axis;
      controlPlane.position.copy(controlPlane.userData.axis.vector);
      controlPlane.position.multiplyScalar(0.501);
      controlPlane.setRotationFromEuler(controlPlane.userData.axis.fromZ);

      controlPlane.userData.side = axis.side;
      controlPlane.userData.status = [Status.Untargeted, Status.Untargeted];

      this.controlPlanes.push(controlPlane);
      this.group.add(controlPlane);
    }

    this.group.position.copy(new Vector3(0, initialHeight, 0));
    this.group.scale.setScalar(initialScale);
  }

}
