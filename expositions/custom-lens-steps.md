One way to get [Lenses]{@link Lens} to construct non-POD containers is to specify a [lens.Step]{@link Step} object as a step (i.e. key) when constructing a Lens.  Construction of a [lens.Step]{@link Step} requires three Functions:

1. A function to retrieve the Maybe value on the "down" side of the step: it receives the container and must return `{}` if the value is not present or `{just: value}` if the value is present (as described in [*The Maybe Monad*]{@tutorial maybe-monad}).
2. A function to create and return a clone of the container (first argument) with a specified change (second argument) given as a {@link Maybe}, either:
    * `{just: newValue}` indicating a `newValue` to give this slot in the clone, or
    * `{}` indicating that the slot should not be present in the clone.
3. A function to construct the container in an empty state (no arguments given)

While passing `null` for one or more of these won't cause an error immediately, it will cause errors if the Lens is used for for certain operations:

|`lens.Step` Constructor Argument | Missing Function | Failing Operations |
| --------: | :-------- | :------------------------------------------ |
| first | `get_maybe` | Retrieving or transforming any value, which also prevents any additional steps in the Lens |
| second | `updatedClone` | Setting any item (even in a container that doesn't exist) |
| third | `construct` | Setting an item in a container that doesn't exist in the input; `xformInClone` with `addMissing` and `xformInClone_maybe` if the container is missing from the subject |
