import { FACE } from "./define";
import Cubelet from "./cubelet";
import CubeGroup, { GroupTable } from "./group";
import { TouchAction } from "../common/toucher";
import * as THREE from "three";
import World from "./world";
import tweener from "./tweener";

export class Holder {
  public vector: THREE.Vector3;
  public index: number;
  public plane: THREE.Plane;
  constructor() {
    this.vector = new THREE.Vector3();
  }
}

export default class Controller {
  public dragging = false;
  public rotating = false;
  public angle = 0;
  public taps: Function[];
  public ray = new THREE.Ray();
  public down = new THREE.Vector2(0, 0);
  public move = new THREE.Vector2(0, 0);
  public matrix = new THREE.Matrix4();
  public holder = new Holder();
  public vector = new THREE.Vector3();
  public group: CubeGroup | undefined;
  public planes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), (-Cubelet.SIZE * 3) / 2),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), (-Cubelet.SIZE * 3) / 2),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), (-Cubelet.SIZE * 3) / 2),
  ];
  public _lock = false;
  get lock(): boolean {
    return this._lock;
  }
  set lock(value) {
    this.handleUp();
    this._lock = value;
  }

  public _disable = false;
  get disable(): boolean {
    return this._disable;
  }
  set disable(value) {
    this.handleUp();
    this._disable = value;
  }

  world: World;
  sensitivity = 1;
  constructor(world: World) {
    this.world = world;
    this.taps = [];
    this.loop();
  }

  loop(): void {
    requestAnimationFrame(this.loop.bind(this));
    this.update();
  }

  update(): void {
    if (this.rotating && this.group) {
      if (this.group.angle != this.angle) {
        const delta = (this.angle - this.group.angle) / 2;
        this.group.angle += delta;
        this.world.dirty = true;
      }
    }
  }

  match(): CubeGroup | undefined {
    let g: CubeGroup | undefined;
    if (this.holder.index === -1) {
      for (const ax of ["x", "y", "z"]) {
        g = this.world.cube.groups.get(ax);
        if (g?.axis.dot(this.holder.plane.normal) === 0) {
          return g;
        }
      }
    } else {
      const plane = this.holder.plane.normal;
      const finger = this.holder.vector;
      const index = this.holder.index;
      const order = this.world.cube.order;
      for (const axis of ["x", "y", "z"]) {
        const vector = GroupTable.AXIS_VECTOR[axis];
        if (vector.dot(plane) === 0 && vector.dot(finger) === 0) {
          let layer = 0;
          switch (axis) {
            case "x":
              layer = index % order;
              break;
            case "y":
              layer = Math.floor((index % (order * order)) / order);
              break;
            case "z":
              layer = Math.floor(index / (order * order));
              break;
          }
          layer = layer + 1;
          return this.world.cube.groups.get(GroupTable.FORMAT(axis, layer, layer));
        }
      }
    }
    return undefined;
  }

  intersect(point: THREE.Vector2, plane: THREE.Plane): THREE.Vector3 {
    const x = (point.x / this.world.width) * 2 - 1;
    const y = -(point.y / this.world.height) * 2 + 1;
    this.ray.origin.setFromMatrixPosition(this.world.camera.matrixWorld);
    this.ray.direction.set(x, y, 0.5).unproject(this.world.camera).sub(this.ray.origin).normalize();
    this.ray.applyMatrix4(this.matrix.identity().getInverse(this.world.scene.matrix));
    const result = new THREE.Vector3(Infinity, Infinity, Infinity);
    this.ray.intersectPlane(plane, result);
    return result;
  }

  handleDown(): void {
    if (this.disable) {
      return;
    }
    if (this.dragging || this.rotating) {
      this.handleUp();
    }
    this.dragging = true;
    this.holder.index = -1;
    tweener.speedup();
    let distance = 0;
    this.planes.forEach((plane) => {
      const point = this.intersect(this.down, plane);
      if (point !== null) {
        let x = point.x / Cubelet.SIZE / 3;
        let y = point.y / Cubelet.SIZE / 3;
        let z = point.z / Cubelet.SIZE / 3;
        if (Math.abs(x) <= 0.5 && Math.abs(y) <= 0.5 && Math.abs(z) <= 0.5) {
          const d =
            Math.pow(point.x - this.ray.origin.x, 2) +
            Math.pow(point.y - this.ray.origin.y, 2) +
            Math.pow(point.z - this.ray.origin.z, 2);
          if (distance == 0 || d < distance) {
            this.holder.plane = plane;
            const order = this.world.cube.order;
            x = Math.ceil((x + 0.5) * order) - 1;
            y = Math.ceil((y + 0.5) * order) - 1;
            z = Math.ceil((z + 0.5) * order) - 1;
            this.holder.index = z * order * order + y * order + x;
            distance = d;
            return;
          }
        }
      }
      return;
    }, this);
  }

  handleMove(): void {
    if (this.disable) {
      return;
    }
    if (this.dragging) {
      const dx = this.move.x - this.down.x;
      const dy = this.move.y - this.down.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.min(this.world.width, this.world.height) / d > 128) {
        return;
      }
      tweener.finish();
      if (this.world.cube.lock) {
        this.dragging = false;
        this.rotating = false;
        return;
      }
      this.dragging = false;
      this.rotating = true;
      if (this.holder.index === -1) {
        if (dx * dx > dy * dy) {
          this.group = this.world.cube.groups.get("y");
        } else {
          const vector = new THREE.Vector3((Cubelet.SIZE * 3) / 2, 0, (Cubelet.SIZE * 3) / 2);
          vector.applyMatrix4(this.world.scene.matrix).project(this.world.camera);
          const half = this.world.width / 2;
          const x = Math.round(vector.x * half + half);
          if (this.down.x < x) {
            this.group = this.world.cube.groups.get("x");
          } else {
            this.group = this.world.cube.groups.get("z");
          }
        }
      } else {
        const start = this.intersect(this.down, this.holder.plane);
        const end = this.intersect(this.move, this.holder.plane);
        this.vector.subVectors(end, start);
        let x = this.vector.x;
        let y = this.vector.y;
        let z = this.vector.z;
        const max = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
        x = Math.abs(x) === max ? x : 0;
        y = Math.abs(y) === max ? y : 0;
        z = Math.abs(z) === max ? z : 0;
        this.vector.set(x, y, z);
        this.holder.vector.copy(this.vector.multiply(this.vector).normalize());

        this.group = this.match();
        this.vector.crossVectors(this.holder.vector, this.holder.plane.normal);
        this.holder.vector.multiplyScalar(this.vector.x + this.vector.y + this.vector.z);
      }
      this.group?.hold();
    }
    if (this.rotating && this.group) {
      if (this.holder.index === -1) {
        const dx = this.move.x - this.down.x;
        const dy = this.move.y - this.down.y;
        if (this.group === this.world.cube.groups.get("y")) {
          this.angle = (((dx / Cubelet.SIZE) * Math.PI) / 6) * this.sensitivity;
        } else if (this.group === this.world.cube.groups.get("x")) {
          this.angle = (((dy / Cubelet.SIZE) * Math.PI) / 6) * this.sensitivity;
        } else if (this.group === this.world.cube.groups.get("z")) {
          this.angle = (((-dy / Cubelet.SIZE) * Math.PI) / 6) * this.sensitivity;
        }
      } else {
        const start = this.intersect(this.down, this.holder.plane);
        const end = this.intersect(this.move, this.holder.plane);
        this.vector.subVectors(end, start).multiply(this.holder.vector);
        this.angle =
          ((((-(this.vector.x + this.vector.y + this.vector.z) *
            (this.group.axis.x + this.group.axis.y + this.group.axis.z)) /
            Cubelet.SIZE) *
            Math.PI) /
            6) *
          this.sensitivity;
      }
    }
  }

  handleUp(): void {
    if (this.dragging) {
      let face = null;
      switch (this.holder.plane) {
        case this.planes[0]:
          face = FACE.R;
          break;
        case this.planes[1]:
          face = FACE.U;
          break;
        case this.planes[2]:
          face = FACE.F;
          break;
      }
      for (const tap of this.taps) {
        tap(this.holder.index, face);
      }
    }
    if (this.rotating) {
      if (this.group && this.group !== null) {
        if (!this.lock) {
          if (Math.abs(this.angle) < Math.PI / 4) {
            const tick = new Date().getTime();
            const speed = Math.abs(this.angle) / (tick - this.tick) * 1000;
            if (speed > 0.2) {
              this.angle = this.angle == 0 ? 0 : ((this.angle / Math.abs(this.angle)) * Math.PI) / 2;
            }
          }
          this.group.twist(this.angle);
        } else {
          this.group.twist(0);
        }
      }
    }
    this.holder.index = -1;
    this.dragging = false;
    this.rotating = false;
    this.world.dirty = true;
  }

  tick: number = new Date().getTime();
  hover = -1;
  touch = (action: TouchAction): boolean => {
    switch (action.type) {
      case "touchstart":
      case "mousedown":
        this.down.x = action.x;
        this.down.y = action.y;
        this.tick = new Date().getTime();
        this.handleDown();
        break;
      case "mousemove":
      case "touchmove":
        this.move.x = action.x;
        this.move.y = action.y;
        this.handleMove();
        break;
      case "touchend":
      case "touchcancel":
      case "mouseup":
      case "mouseout":
        this.handleUp();
        break;
      default:
        return false;
    }
    return true;
  };
}
