
/**
 * @summary Defines a custom step in a Lens
 *
 * @description
 * If standard logic for accessing data deeper in the conceptual structure
 * is not adequate, an instance of this class may be passed as a step in a
 * Lens, which will allow the Lens to have custom behavior.
 *
 * To construct this object, pass three Functions:
 * 
 * 1. A Function that returns a Maybe value for the slot within the container
 *    it is passed.
 * 2. A Function taking the current value of the container and applying a `set`
 *    or `spliceOut` operation, returning a modified clone
 * 3. A Function to construct a pristine instance of the container this step
 *    navigates
 *
 * Passing `null` for any of these functions will limit the functionality of
 * the lens: skipping either `construct` or `updatedClone` will prevent the lens
 * from constructing a missing container, skipping `updatedClone` will
 * additionally prevent the lens from modifying an existing container, and
 * skipping `get_maybe` will prevent retrieving or transforming values in
 * a subject.
 */
export default class CustomStep {
  constructor(get_maybe, updatedClone, construct) {
    Object.assign(this, {construct, updatedClone, get_maybe});
  }
}
