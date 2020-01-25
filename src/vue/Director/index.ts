import Vue from "vue";
import { Component, Provide, Watch } from "vue-property-decorator";
import Cuber from "../../cuber/cuber";
import Keyboard from "../Keyboard";
import Option from "../../common/option";
import Tune from "../Tune";
import { COLORS, FACE } from "../../common/define";
import Cubelet from "../../cuber/cubelet";
import * as THREE from "three";
import { Encoder } from "../../common/encoder";

@Component({
  template: require("./index.html"),
  components: {
    keyboard: Keyboard,
    tune: Tune
  }
})
export default class Director extends Vue {
  @Provide("cuber")
  cuber: Cuber;

  @Provide("option")
  option: Option;

  tune: boolean = false;
  width: number = 0;
  height: number = 0;
  size: number = 0;
  playing: boolean = false;
  renderer: THREE.WebGLRenderer;
  encoder: Encoder;
  strips: number[] = new Array(6 * 9).fill(0);

  constructor() {
    super();
    let canvas = document.createElement("canvas");
    this.cuber = new Cuber(canvas);
    this.option = new Option(this.cuber);
    this.cuber.cube.twister.callbacks.push(() => {
      this.triger();
    });
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(512, 512, true);
    this.encoder = new Encoder(this.renderer.domElement);
    let strips = window.localStorage.getItem("director.strips");
    if (strips != null) {
      this.strips = JSON.parse(strips);
      this.strips.forEach((value, identity) => {
        if (value > 0) {
          let face = Math.floor(identity / 9);
          let index = this.cuber.cube.groups[FACE[face]].indices[identity % 9];
          let cubelet = this.cuber.cube.initials[index];
          cubelet.stick(face, COLORS.GRAY);
        }
      });
    }
  }

  triger() {
    if (this.cuber.cube.twister.length == 0) {
      if (this.playing) {
        this.init();
      } else if (this.recording) {
        this.finish();
      }
    }
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.size = 43;
    this.cuber.width = this.width;
    this.cuber.height = this.height - this.size * 4;
    this.cuber.resize();
    let cuber = this.$refs.cuber;
    if (cuber instanceof HTMLElement) {
      cuber.style.width = this.width + "px";
      cuber.style.height = this.height - this.size * 4 + "px";
    }
  }

  mounted() {
    if (this.$refs.cuber instanceof Element) {
      let cuber = this.$refs.cuber;
      cuber.appendChild(this.cuber.canvas);
      this.$nextTick(this.resize);
    }
    this.cuber.controller.taps.push(this.tap);
    this.init();
    this.loop();
  }

  init() {
    this.cuber.controller.disable = false;
    this.playing = false;
    this.cuber.cube.twister.finish();
    this.cuber.cube.twister.twist("#");
    this.cuber.cube.twister.twist(this.scene, false, 1, true);
  }

  scene: string = window.localStorage.getItem("director.scene") || "";
  @Watch("scene")
  onSceneChange() {
    window.localStorage.setItem("director.scene", this.scene);
    this.init();
  }

  action: string = window.localStorage.getItem("director.action") || "";
  @Watch("action")
  onActionChange() {
    window.localStorage.setItem("director.action", this.action);
  }

  play() {
    this.init();
    this.cuber.controller.disable = true;
    this.playing = true;
    this.cuber.cube.twister.twist("-" + this.action + "--", false, 1);
  }

  toggle() {
    if (this.playing) {
      this.init();
    } else {
      this.playing = true;
      this.play();
    }
  }

  recording: boolean = false;
  loop() {
    requestAnimationFrame(this.loop.bind(this));
    if (this.recording) {
      this.record();
    } else {
      this.cuber.render();
    }
  }

  record() {
    this.renderer.clear();
    this.renderer.render(this.cuber.scene, this.cuber.camera);
    this.encoder.add();
  }

  finish() {
    this.recording = false;
    this.cuber.controller.disable = false;
    this.cuber.resize();
    let data = this.encoder.finish();
    let blob = new Blob([new Uint8Array(data)], { type: "image/png" });
    let link = document.createElement("a");
    let click = document.createEvent("MouseEvents");
    click.initEvent("click", false, false);
    link.download = "cuber.png";
    link.href = URL.createObjectURL(blob);
    link.dispatchEvent(click);
  }

  film() {
    this.init();
    this.recording = true;
    this.cuber.controller.disable = true;
    this.cuber.camera.aspect = 1;
    this.cuber.camera.updateProjectionMatrix();
    this.renderer.setClearColor(COLORS.BACKGROUND);
    this.renderer.clear();
    this.renderer.render(this.cuber.scene, this.cuber.camera);
    this.encoder.start();
    this.encoder.add();
    this.cuber.cube.twister.twist("-" + this.action + "-", false, 1);
  }

  snap() {
    this.cuber.camera.aspect = 1;
    this.cuber.camera.updateProjectionMatrix();
    this.renderer.setClearColor(0, 0);
    this.renderer.clear();
    this.renderer.render(this.cuber.scene, this.cuber.camera);
    this.cuber.resize();
    let content = this.renderer.domElement.toDataURL("image/png");
    let parts = content.split(";base64,");
    let type = parts[0].split(":")[1];
    let raw = window.atob(parts[1]);
    let length = raw.length;
    let data = new Uint8Array(length);
    for (let i = 0; i < length; ++i) {
      data[i] = raw.charCodeAt(i);
    }
    let blob = new Blob([data], { type: type });
    let link = document.createElement("a");
    let evt = document.createEvent("MouseEvents");
    evt.initEvent("click", false, false);
    link.download = "cuber.png";
    link.href = URL.createObjectURL(blob);
    link.dispatchEvent(evt);
  }

  tap(index: number, face: number) {
    if (index < 0) {
      return;
    }
    this.cuber.cube.cubelets[index];
    let cubelet: Cubelet = this.cuber.cube.cubelets[index];
    face = cubelet.getColor(face);
    index = this.cuber.cube.groups[FACE[face]].indices.indexOf(cubelet.initial);
    let identity = face * 9 + index;
    this.strips[identity] = this.strips[identity] ^ 1;
    cubelet.stick(face, this.strips[identity] != 0 ? COLORS.GRAY : "");
    window.localStorage.setItem("director.strips", JSON.stringify(this.strips));
  }
}