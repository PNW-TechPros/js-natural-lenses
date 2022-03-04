import { isArray, isFunction, isObject } from 'underscore';
import Lens from './lens.js';
import { isLensClass as isLens } from '../src-cjs/constants.js';

export function makeExports({fuse, isLens, lens}) {
  const value = '$', others = '((others))';

  const lengthProp = lens('length');

  class PlanBuilder {
    constructor(keys = []) {
      this.keys = keys;
      this.parent = null;
    }
    
    buildPlan(rawPlan) {
      if (isArray(rawPlan)) {
        const result = lens(...this.keys);
        if (rawPlan.length > 1) {
          throw new Error("Multiple plans for Array items");
        } else if (rawPlan.length) {
          result.$item = new PlanBuilder().buildPlan(rawPlan[0]);
          Object.assign(result, this.indexableMixin(result.$item));
        }
        return result;
      } else if (rawPlan.constructor === Object) {
        const result = this.keys.length ? lens(...this.keys) : lens();
        const theseKeys = this.keys;
        try {
          for (let key of Object.keys(rawPlan)) {
            if (key === others) continue;
            this.keys = theseKeys.concat([key]);
            try {
              this.parent = result;
              result[key] = this.buildPlan(rawPlan[key]);
            } finally {
              this.parent = null;
            }
          }
        } finally {
          this.keys = theseKeys;
        }
        if (others in rawPlan) {
          result.$entryValue = new PlanBuilder().buildPlan(rawPlan[others]);
          Object.assign(result, this.entriesMixin(result.$entryValue, Object.keys(rawPlan)));
        }
        return result;
      } else if (rawPlan === value) {
        return lens(...this.keys);
      } else {
        throw new Error("Invalid item in plan");
      }
    }
    
    /**
     * @mixin
     * @name IndexableMixin
     */
    indexableMixin(itemPlan) {
      return {
        /**
         * @function
         * @name IndexableMixin~length
         * @summary Get the length of the targeted Array (or Array-like)
         * @param subject The input structured data
         * @return {number}  The length of the targeted Array, or `undefined`
         */
        length: function (subject) {
          return lengthProp.get(this.get(subject));
        },
        
        /**
         * @function
         * @name IndexableMixin~at
         * @summary Build a lens through a specific index
         * @param  {number}          index       Index into the Array targeted by this lens on which to focus
         * @param  {Function | Lens} [pickLens]  A lens to a slot within the selected item or a Function returning such a lens given the item plan
         * @return {Lens}                        A lens (or at least some optic) to the item or a slot within the item
         *
         * @description
         * There are several ways to call this method, with different argument
         * patterns:
         * 1. `datumLens.at(index)`
         * 2. `datumLens.at(index, itemSlotPicker)`
         * 3. `datumLens.at(index, itemSlotLens)`
         *
         * Pattern 1 creates a lens to the *index*-th item of the indexable
         * object targeted by this lens.
         *
         * Pattern 2 creates an optic (a lens where possible) targeting a slot
         * within the *index*-th item of the indexable targeted by this lens,
         * where the slot within the item is selected by the result of
         * `itemSlotPicker`.  `itemSlotPicker` is called with the item datum plan
         * for the target of this lens if one is specified within the datum plan.
         *
         * Pattern 3 is similar to pattern 2, just directly passing a lens (or
         * lens-like object) rather than a function that returns one.
         */
        at: function (index, pickLens) {
          // pickLens is given itemPlan to return a lens to fuse with the lens for the item at index
          const itemLens = lens(...this.keys, index);
          if (pickLens && pickLens[isLens]) {
            return fuse(itemLens, pickLens);
          } else if (typeof pickLens === 'function') {
            return fuse(itemLens, pickLens.call(undefined, itemPlan));
          } else {
            return itemLens;
          }
        },
        
        /**
         * @function
         * @template T
         * @name IndexableMixin~mapInside
         * @summary Clone the subject with the target of this lens altered by mapping items
         * @param  {T} subject       The input structured data
         * @param  {...*} manipulators  See description
         * @return {T}           A minimally changed clone of subject with the transformed value in this slot
         *
         * @description
         * There are several ways to call this method, with different types of
         * manipulators:
         * 1. `datumLens.mapInside(subject, itemXform)`
         * 2. `datumLens.mapInside(subject, itemSlotPicker, itemSlotXform)`
         * 3. `datumLens.mapInside(subject, itemSlotLens, itemSlotXform)`
         *
         * Pattern 1 applies a transformation function (`itemXform`) to each item
         * of the iterable selected by this lens as the clone of *subject* is
         * made.
         *
         * Pattern 2 is for applying a change *within* each item of the iterable
         * targeted by this lens as a clone is made, selecting the slot within
         * each item by returning a lens from `itemSlotPicker`.  `itemSlotPicker`
         * is called with the item datum plan for the targeted iterable if one
         * exists in the datum plan.
         *
         * Pattern 3 is similar to pattern 2, just directly passing a lens (or
         * something that knows how to `xformInClone`) rather than a
         * function that returns one.
         *
         * The `itemXform` function in pattern 1 is called with the item value,
         * its index within the iterable and, if specified, the item datum plan
         * for each item of the target iterable of this lens.
         *
         * The `itemSlotXform` function in patterns 2 and 3 is called with the
         * slot value and the index of the current item within the target iterable
         * of this lens.
         */
        mapInside: function (subject, ...manipulators) {
          if (manipulators.length === 2) {
            const [getLens, itemSlotXform] = manipulators;
            const itemLens = getLens.xformInClone ? getLens : getLens.call(undefined, itemPlan);
            
            return this.xformIterableInClone(subject, items => {
              const mapped = Array.from(
                items,
                (item, index) => itemLens.xformInClone(
                  item,
                  slotValue => itemSlotXform.call(undefined, slotValue, index)
                )
              );
              if (
                items instanceof Array && items.length === mapped.length &&
                itemsStrictEqual(items, mapped)
              ) {
                return items;
              }
              return mapped;
            });
          } else if (manipulators.length === 1) {
            const [itemXform] = manipulators, itemPlan = this.$item;
            return this.xformIterableInClone(subject, items => {
              const mapped = Array.from(items,
                (item, index) => itemXform.call(undefined, item, index, itemPlan));
              if (
                items instanceof Array && items.length === mapped.length &&
                itemsStrictEqual(items, mapped)
              ) {
                return items;
              }
              return mapped;
            });
          } else {
            throw `.mapInside() requires one or two manipulators, ${manipulators.length} given`;
          }
        },
        
        /**
         * @function
         * @template T
         * @name IndexableMixin~flatMapInside
         * @summary Clone the subject with the target of this lens altered by flatMapping items
         * @param {T}        subject                The input structured data
         * @param {Function} subItemsForItem        Callback providing the iterable of items (possibly empty) to replace each item
         * @param {Object} [options]
         * @param [options.orThrow]  {@link OptionalThrow}
         * @param {Function} [options.reduce]       Callback to reduce the sequence of accumulated items
         * @return {T}  A minimally changed clone of subject with the transformed value in this slot
         *
         * @description
         * This method allows the creation of a clone of *subject* where the
         * target of this lens has been replaced with an iterable composed of
         * zero or more values for each item in the equivalent slot in *subject*.
         *
         * When *subItemsForItem* is called, it is provided an item from the
         * target of this lens, the index of the item within the target iterable
         * of this lens and, if available, the datum plan for that item.  The
         * Function passed for *subItemsForItem* MUST return an iterable of values
         * to be substituted in place of the item it received in the returned
         * clone.
         *
         * If *reduce* is supplied, it is applied to an iterable chaining all the
         * result items returned by all calls to *subItemsForItem*.  The value
         * returned by *reduce* must be iterable.
         */
        flatMapInside: function (subject, subItemsForItem, {reduce, orThrow} = {}) {
          const itemPlan = this.$item;
          return this.xformIterableInClone(subject, items => {
            let result = [];
            let index = 0;
            for (let item of items) {
              result.push(...subItemsForItem.call(undefined, item, index, itemPlan));
              ++index;
            }
            if (reduce) {
              if (
                isArray(result) && result.length === 0 &&
                items !== this.get(subject)
              ) {
                result.injected = true;
              }
              if ('noniterableValue' in items) {
                result.noniterableValue = items.noniterableValue;
              }
              result = reduce.call(undefined, result);
            }
            if (
              items instanceof Array && isObject(result) &&
              items.length === result.length && itemsStrictEqual(items, result)
            ) {
              return items;
            }
            return result;
          }, {orThrow});
        },
      };
    }
    
    /**
     * @mixin
     * @name EntriesMixin
     */
    entriesMixin(valuePlan, explicitKeys) {
      explicitKeys = new Set(explicitKeys);
      
      return {
        /**
         * @function
         * @name EntriesMixin~at
         * @summary Build a lens through a specific key
         * @param {string}          key         Key (i.e. property name) of the targeted Object on which to focus
         * @param {Function | Lens} [pickLens]  A lens to a slot within the selected value or a Function returning such a lens given the value plan
         * @return                              A lens (or at least some optic) to the value or a slot within the value
         *
         * @description
         * There are several ways to call this method, with different argument
         * patterns:
         * 1. `datumLens.at(key)`
         * 2. `datumLens.ad(key, propvalSlotPicker)`
         * 3. `datumLens.ad(key, porpvalSlotLens)`
         *
         * Pattern 1 creates a lens to the *key* property value of the Object
         * targeted by this lens.
         *
         * Pattern 2 creates an optic (a lens where possible) targeting a slot
         * within the *key* property of the Object targeted by this lens, where
         * the slot within the item is selected by the result of
         * `propvalSlotPicker`.  `propvalSlotPicker` is called with the "other
         * property" datum plan for the target of this lens if one is specified
         * within the datum plan.
         *
         * Pattern 3 is similar to pattern 2, just directly passing a lens (or
         * lens-like object) rather than a function that returns one.
         */
        at: function (key, pickLens) {
          const itemLens = lens(...this.keys, key);
          if (pickLens && pickLens[isLens]) {
            return fuse(itemLens, pickLens);
          } else if (typeof pickLens === 'function') {
            return fuse(itemLens, pickLens.call(undefined, valuePlan));
          } else {
            return itemLens;
          }
        },
        
        /**
         * @function
         * @name EntriesMixin~mapInside
         * @summary Clone the subject with the target of this lens altered by mapping property values
         * @param  subject       The input structured data
         * @param  {...*} manipulators  See description
         * @return               A minimally changed clone of the subject with the transformed value in this slot
         *
         * @description
         * There are several ways to call this method, with different types of
         * manipulators:
         * 1. `datumLens.mapInside(subject, propvalXform)`
         * 2. `datumLens.mapInside(subject, propvalSlotPicker, propvalSlotXform)`
         * 3. `datumLens.mapInside(subject, propvalSlotLens, propvalSlotXform)`
         *
         * All of these patterns iterate only over the *non-explicit*
         * own-properties of the Object targeted within *subject* by this lens.
         * Explicit properties are those whose names are given within the datum
         * plan in the position corresponding to this lens.
         *
         * Pattern 1 applies a transformation function (`propvalXform`) to each
         * own-property of the Object selected by this lens not explicitly
         * specified in the datum plan as the clone of *subject* is made.
         *
         * Pattern 2 is for applying a change *within* each non-explicit
         * own-property value of the Object targeted by this lens as a clone is
         * made, selecting the slot within each item by returning a lens from
         * `propvalSlotPicker`.  `propvalSlotPicker` is called with the "other
         * property" datum plan for the targeted Object if one exists in the datum
         * plan.
         *
         * Pattern 3 is similar to pattern 2, just directly passing a lens (or
         * something that knows how to `xformInClone`) rather than a function
         * that returns one.
         *
         * The `propvalXform` function in pattern 1 is called with the property
         * value, the property name and, if specified, the "other property" datum
         * plan for the target Object of this lens.
         *
         * The `propvalSlotXform` function in patterns 2 and 3 is called with the
         * slot value within the property value and the name of the property
         * within the Object target of this lens.
         */
        mapInside: function (subject, ...manipulators) {
          const valueModifier = entryValueModifier({
            manipulators, valuePlan, fnName: 'mapInside'
          });
          
          return this.xformInClone(subject, entryValueXform({
            valueModifier,
            explicitKeys,
          }));
        },
        
        /**
         * @function
         * @name EntriesMixin~mapAllInside
         * @summary Clone the subject with the target of this lens altered by mapping property values
         * @param  subject       The input structured data
         * @param  {...*} manipulators  See description
         * @return               A minimally changed clone of the subject with the transformed value in this slot
         *
         * @description
         * There are several ways to call this method, with different types of
         * manipulators:
         * 1. `datumLens.mapAllInside(subject, propvalXform)`
         * 2. `datumLens.mapAllInside(subject, propvalSlotPicker, propvalSlotXform)`
         * 3. `datumLens.mapAllInside(subject, propvalSlotLens, propvalSlotXform)`
         *
         * All of these patterns iterate only over all own-properties of the
         * Object targeted within *subject* by this lens.
         *
         * Pattern 1 applies a transformation function (`propvalXform`) to each
         * own-property of the Object selected by this lens.
         *
         * Pattern 2 is for applying a change *within* each own-property value
         * of the Object targeted by this lens as a clone is made, selecting the
         * slot within each item by returning a lens from `propvalSlotPicker`.
         * `propvalSlotPicker` is called with the "other property" datum plan
         * for the targeted Object if one exists in the datum plan.
         *
         * Pattern 3 is similar to pattern 2, just directly passing a lens (or
         * something that knows how to `xformInClone`) rather than a function
         * that returns one.
         *
         * The `propvalXform` function in pattern 1 is called with the property
         * value, the property name and, if specified, the "other property" datum
         * plan for the target Object of this lens.  The "other property" datum
         * plan is passed in *even for explicitly specified properties of the
         * target object that might have conflicting datum plans*.
         *
         * The `propvalSlotXform` function in patterns 2 and 3 is called with the
         * slot value within the property value and the name of the property
         * within the Object target of this lens.
         */
        mapAllInside: function (subject, ...manipulators) {
          const valueModifier = entryValueModifier({
            manipulators, valuePlan, fnName: 'mapAllInside'
          });
          
          return this.xformInClone(subject, entryValueXform({
            valueModifier,
          }));
        },
      };
    }
  }

  
  /**
   * @typedef DatumPlan_Dsl
   * @property VALUE   Indicator of a "tip" of the {@link Lens} branch to construct;
   *                   equivalent to *value* exported by this module
   * @property NAMED_VALUES  May be used as an Object spec to indicate a dictionary-type
   *                         object in the structure or called with the datum plan spec of
   *                         the entries to indicate a dictionary-type having entries with
   *                         specified structure; either kind of use may be mixed into an
   *                         Object spec with other explicit own-properties via spread
   *                         syntax
   */
  
  /**
   * @callback DatumPlan_DslCallback
   * @param {DatumPlan_Dsl} DSL  Helpful values and Functions for creating a datum plan specification
   * @returns A datum plan specification
   *
   * @description
   * A callback Function of this kind can be passed to
   * [datumPlan]{@link module:natural-lenses/datum-plan} in order to use
   * active JavaScript in defining the datum plan specification or for use of
   * the named values and Functions passed in the *DSL* parameter.
   */
  
  /**
   * @module natural-lenses/datum-plan
   * @summary Construct a structure of [Lenses]{@link Lens} for accessing a structure by example
   *
   * @param {Array|Object|string|DatumPlan_DslCallback} spec  An object specifying the datum plan to be generated, or a {@link DatumPlan_DslCallback} to return such an object
   * @returns {Lens} A Lens with {@link Lens} properties which may, in turn, have {@link Lens} properties; mixin methods may be added to some of these lenses
   *
   * @property {string} value   Used as a "tip" indicator for where generation of nested [Lenses]{@link Lens} ends
   * @property {string} others  Used as a key in an Object to indicate dictionary-like behavior
   *
   * @description
   * This module is (when `require`d) or exports as default (when `import`ed) a
   * Function accepting a datum plan specification and returning a structure
   * with the same names composed of [Lenses]{@link Lens}.  The plan
   * specification can be provided either directly as a plan or as a
   * [Function]{@link module:natural-lenses/datum-plan~DslCallback} that
   * receives as its first argument a DSL object providing relevantly named
   * values.
   *
   * The terminal *value* indicates where descent into *spec* terminates.
   * Otherwise, specification descent continues, though differently through
   * Arrays and other Objects.
   *
   * Descent through an Array expects either 0 or 1 elements in the Array:
   * if one entry is given, it is the "item spec" for items in the Array; if
   * no element is given, the Array has no "item spec."  The item spec — if one
   * is given — is passed to certain {@link IndexableMixin} methods attached
   * to the {@link Lens} that retrieves the equivalent slot in a subject.
   *
   * Descent through an Object produces [Lenses]{@link Lens} for each own-property
   * of the spec Object, attaching them to the {@link Lens} which would retrieve
   * the instant Object spec.  Spec Objects can have a special own-property with
   * the key given by *others*, which specifies A) that this Object behaves at
   * in a dictionary-like manner for any non-explicit properties, and B) the
   * datum plan spec for each non-explicit entry's value (if something other than
   * *value* is provided).
   *
   * The resulting datum plan will be structured vaguely like *spec* and
   * constructed to access a value of similar shape to *spec*.
   *
   * @see module:natural-lenses/datum-plan~DslCallback
   * @see the [README](./index.html)
   */
  function makeDatumPlan(rawPlan) {
    if (isFunction(rawPlan)) {
      rawPlan = rawPlan.call(undefined, {
        VALUE: value,
        NAMED_VALUES: Object.assign(
          (spec) => ({[others]: spec}),
          {[others]: value}
        ),
      });
    }
    return new PlanBuilder().buildPlan(rawPlan);
  }
  Object.assign(makeDatumPlan, {
    value,
    others,
  });
  
  return makeDatumPlan;
}

function itemsStrictEqual(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function entryValueModifier({ manipulators, valuePlan, fnName }) {
  if (manipulators.length === 2) {
    const [getLens, valueSlotXform] = manipulators;
    const valueLens = getLens.xformInClone ? getLens : getLens.call(undefined, valuePlan);
    return (result, key) => valueLens.xformInClone(
      result[key],
      slotValue => valueSlotXform.call(undefined, slotValue, key)
    );
  } else if (manipulators.length === 1) {
    const [valueXform] = manipulators;
    return (result, key) => (
      valueXform.call(undefined, result[key], key, valuePlan)
    );
  } else {
    throw `.${fnName}() requires one or two manipulators, ${manipulators.length} given`;
  }
}

function entryValueXform({ valueModifier, explicitKeys }) {
  return (container) => {
    const result = {...container};
    let sameValues = true;
    for (const key of Object.keys(container)) {
      if (explicitKeys && explicitKeys.has(key)) continue;
      const origValue = result[key];
      result[key] = valueModifier(result, key);
      sameValues = sameValues && result[key] === origValue;
    }
    return sameValues ? container : result;
  };
}