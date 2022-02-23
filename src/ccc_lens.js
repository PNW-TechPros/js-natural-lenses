import Lens from './lens.js';

export default class CCCLens extends Lens {
  constructor(...keys) {
    super(...keys);
    this._containerFactory = null;
  }
  
  _constructFor(depth) {
    return this._containerFactory.construct(this.keys.slice(0, depth + 1));
  }
}
