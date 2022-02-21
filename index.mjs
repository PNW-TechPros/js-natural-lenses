import Lens from './esm/lens.js';

export default function makeLens(...keys) {
  return new Lens(...keys);
}
export { at_maybe, cloneImpl as clone, isLensClass as isLens } from './src-cjs/constants.js';
export { eachFound, maybeDo } from './esm/utils.js';
export { default as Factory } from './esm/lens_factory.js';
export { default as fuse} from './fuse.mjs';
export { default as JsContainerFactory, DEFAULT_FACTORY as jsContainers } from './esm/js_container_factory.js';
export { default as nfocal } from './nfocal.mjs';
export { polyfillImmutable } from './esm/immutable_support.js';
export { default as Step } from './esm/custom_step.js';
