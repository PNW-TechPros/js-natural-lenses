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

/**
 * @extends Error
 * @hideconstructor
 * @classdesc
 * This error is thrown to indicate a property access on a datum plan lens
 */
class UndefinedPropertyError extends Error {
  constructor(missingProperty, lensKeys, lensProps) {
    console.log({ lensKeys });
    const lensDesc = lensKeys.length > 0 ? `Lens with keys ${keyArrayDesc(lensKeys)}` : 'trivial Lens';
    lensProps = [...lensProps].sort();
    super(`No such property '${missingProperty}' on ${lensDesc} among properties ${lensProps.map(JSON.stringify).join(', ')}`);
    this.lensKeys = lensKeys;
    this.missingProperty = missingProperty;
  }
}
export { UndefinedPropertyError };

function keyArrayDesc(keys) {
  const content = keys.map(key => {
    try {
      return JSON.stringify(key);
    } catch (e) {
      return '' + key;
    }
  });
  return `[${content}]`;
}
