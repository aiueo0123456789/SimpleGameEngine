import { GameObject } from "../objects/GameObject.js";

export class Component {
  constructor(gameObject) {
    /** @type {GameObject} */
    this.gameObject = gameObject;
  }

  autoGetSet() {
    //宣言済みの内部変数全体を対象とする
    Object.keys(this).forEach(function (prop) {
      //内部変数の先頭から"_"を切取って外部アクセス用変数名を定義する
      let realprop = prop.replace(/^_+/, "");
      //先頭文字のみが"_"である場合、読込専用なのでgetterのみ定義する
      if (prop.length > 1 && prop[0] === "_" && prop[1] !== "_") {
        Object.defineProperty(this, realprop, {
          get: function () {
            return this[prop];
          },
        });
        //先頭から"_"が連続している場合、getterとsetterを定義する
      } else if (prop.length > 2 && prop[0] === "_" && prop[1] === "_") {
        Object.defineProperty(this, realprop, {
          get: function () {
            return this[prop];
          },
          set: function (val) {
            this[prop] = val;
          },
        });
      }
    }, this);
  }
}
