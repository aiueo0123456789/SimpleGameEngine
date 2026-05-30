import { GPU } from "../../utils/webGPU.js";

class SkyboxTextures {
  constructor() {
    this.left = null;
    this.right = null;
    this.up = null;
    this.down = null;
    this.front = null;
    this.back = null;
  }
}

class GPUDataManager {
  constructor() {
    this.texture = null;
    this.textureView = null;
  }

  update(/** @type {Skybox} */ skybox) {
    this.texture = GPU.imagesToskyboxTexture2D(
      skybox.textures.left,
      skybox.textures.right,
      skybox.textures.up,
      skybox.textures.down,
      skybox.textures.front,
      skybox.textures.back,
    );
    this.textureView = this.texture.createView({
      dimension: "cube",
    });
  }
}

export class Skybox {
  constructor() {
    /** @type {Boolean} */
    this.use = true;
    this.textures = new SkyboxTextures();

    this.gpu = new GPUDataManager();
  }

  setUse(use) {
    this.use = use;
  }

  async setImages(left, right, up, down, front, back) {
    this.textures.left = await GPU.imagePathToImage(left);
    this.textures.right = await GPU.imagePathToImage(right);
    this.textures.up = await GPU.imagePathToImage(up);
    this.textures.down = await GPU.imagePathToImage(down);
    this.textures.front = await GPU.imagePathToImage(front);
    this.textures.back = await GPU.imagePathToImage(back);
    this.update();
  }

  update() {
    this.gpu.update(this);
  }
}
