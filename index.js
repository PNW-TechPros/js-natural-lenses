import Lens from './src/lens.js';

export default function makeLens(...keys) {
  return new Lens(...keys);
}
export { at_maybe, cloneImpl as clone, isLensClass as isLens } from './src/constants/index.js';
export { eachFound, maybeDo } from './src/utils.js';
export { default as Factory } from './src/lens_factory.js';
export { default as fuse} from './fuse.js';
export { default as JsContainerFactory, DEFAULT_FACTORY as jsContainers } from './src/js_container_factory.js';
export { default as nfocal } from './nfocal.js';
export { polyfillImmutable } from './src/immutable_support.js';
export { default as Step } from './src/custom_step.js';
