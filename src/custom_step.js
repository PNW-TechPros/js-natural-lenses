class CustomStep {
  /**
   * @constructs Step
   * @classdesc A step within a {@link Lens} with fully customizable behavior
   * @param {Step~Get_Maybe} get_maybe
   *    Returns a {@link Maybe} value for the slot within the container it is
   *    passed.
   * @param {Step~UpdatedClone} updatedClone
   *    Takes the current container and a {@link Maybe} of this step's slot
   *    value, returning a minimally modified clone of the container such that
   *    *get_maybe* will return the *value_maybe* passed to this function.
   * @param {Step~Construct} construct
   *    Instantiate an empty container of the type this step navigates.
   *
   * @description
   * If standard logic for accessing data deeper in the conceptual structure
   * is not adequate, an instance of this class may be passed as a step in a
   * Lens, which will allow the Lens to have custom behavior.
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
 * @param {*} container
 * @returns {Maybe.<*>} A Maybe monad value for the represented slot within *container*
 *
 * @description
 * Gets the value of this slot within the passed *container*, returning `{}` if
 * the slot does not exist.
 */
 
 /**
  * @callback Step~UpdatedClone
  * @param {*} container
  * @param {Maybe.<*>} value_maybe
  * @param {*} [value_maybe.just]  The value to assign into the target slot in the clone
  * @returns The minimally modified clone of *container*
  */

/**
 * @callback Step~Construct
 * @returns The empty container type corresponding to this step
 */
