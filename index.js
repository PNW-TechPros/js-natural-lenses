import Lens from './src/lens';

export default function makeLens(...keys) {
  return new Lens(...keys);
}
export { at_maybe, cloneImpl as clone, isLensClass as isLens } from './src/constants';
export { eachFound, maybeDo } from './src/utils';
export { default as Factory } from './src/lens_factory';
export { default as fuse} from './fuse';
export { default as JsContainerFactory, DEFAULT_FACTORY as jsContainers } from './src/js_container_factory';
export { default as nfocal } from './nfocal';
export { default as polyfillImmutable } from './src/immutable_support';
export { default as Step } from './src/custom_step';
