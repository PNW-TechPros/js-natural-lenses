
class CustomStep {
  /**
   * @summary Defines a custom step in a Lens
   * @constructs Step
   * @param {Step~Get_Maybe} get_maybe
   * @param {Step~UpdatedClone} updatedClone
   * @param {Step~Construct} construct
   *
   * @description
   * If standard logic for accessing data deeper in the conceptual structure
   * is not adequate, an instance of this class may be passed as a step in a
   * Lens, which will allow the Lens to have custom behavior.
   *
   * To construct this object, pass three Functions:
   * 
   * 1. A Function that returns a Maybe value for the slot within the container
   *    it is passed ({@link Step~Get_Maybe}).
   * 2. A Function taking the current value of the container and applying a `set`
   *    or `spliceOut` operation, returning a modified clone ({@link Step~UpdatedClone}).
   * 3. A Function to construct a pristine instance of the container this step
   *    navigates ({@link Step~Construct}).
   *
   * Passing `null` for any of these functions will limit the functionality of
   * the lens: skipping either `construct` or `updatedClone` will prevent the lens
   * from constructing a missing container, skipping `updatedClone` will
   * additionally prevent the lens from modifying an existing container, and
   * skipping `get_maybe` will prevent retrieving or transforming values in
   * a subject.
   */
  constructor(get_maybe, updatedClone, construct) {
    Object.assign(this, {construct, updatedClone, get_maybe});
  }
}
export default CustomStep;

/**
 * @callback Step~Get_Maybe
 * @param container
 * @returns {{just: *}} A Maybe monad value for the represented slot within *container*
 *
 * @description
 * Gets the value of this slot within the passed *container*, returning `{}` if
 * the slot does not exist.
 */
 
 /**
  * @callback Step~UpdatedClone
  * @param container
  * @param {Object} opDesc
  * @param {Array} [opDesc.set]  An Array with two elements: a key/index and a value
  * @param [opDesc.spliceOut]  A key or index to splice out or delete from *container*
  * @returns The minimally modified clone of *container*
  */

/**
 * @callback Step~Construct
 * @returns The empty container type corresponding to this step
 */
