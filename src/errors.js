/**
 * @extends Error
 * @hideconstructor
 * @classdesc
 * This error is thrown to indicate an attempt to use a multifocal lens to
 * create an impossible altered clone, where some data within the clone would
 * be a superposition of multiple values.
 */
class StereoscopyError extends Error {}
export { StereoscopyError };
