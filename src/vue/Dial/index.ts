import Vue from "vue";
import { Component } from "vue-property-decorator";

@Component({
  template: require("./index.html"),
  components: {}
})
export default class Dial extends Vue {
  menu: boolean = false;

  constructor() {
    super();
  }
  mounted() {
    this.resize();
  }

  width: number = 0;
  height: number = 0;
  size: number = 0;

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.size = Math.ceil(Math.min(this.width / 6, this.height / 12)) * 0.95;
  }

  resetd: boolean = false;

  reset() {
    let storage = window.localStorage;
    storage.clear();
    window.location.reload();
  }

  tap(key: string) {
    switch (key) {
      case "playground":
      case "director":
        window.location.search = "mode=" + key;
        break;
      case "code":
        window.location.href = "https://gitee.com/huazhechen/cuber";
        break;
      case "reset":
        this.resetd = true;
        break;
      default:
        break;
    }
    this.$emit("input", false);
  }
}
