import { forEach, isArray, isFunction, isObject } from 'underscore';
import { UndefinedPropertyError } from './errors.js';
import { smartLog } from './logger.js';

export function makeExports({fuse, isLens, lens}) {
  const WEAK_LENS_METHODS = (function() {
    const result = {},
      getHas = lens('has').$`bound`,
      getIterator = lens(Symbol.iterator).$`bound`;
    let namesPreviouslyGiven = [];
    function addVersionEntry(version, names) {
      if (!names) {
        result[version] = namesPreviouslyGiven;
        return;
      }
      const nameSet = new Set([...namesPreviouslyGiven, ...names]);
      result[version] = namesPreviouslyGiven = {
        has: getHas(nameSet),
        [Symbol.iterator]: getIterator(nameSet),
      };
    }
    
    addVersionEntry('2.1', ['extractor', 'extractor_maybe']);
    addVersionEntry('2.0');
    
    return Object.freeze(result);
  }());
  const NO_WEAK_LENS_METHODS = {has: () => false};

  const value = '$', others = '((others))', raw = '((raw))';
  const guardedGroups = new Set(
    (process.env.DATUM_PLAN_GUARDS || '').split(',')
  );

  const lengthProp = lens('length');
  
  const GuardedLensHandlers = {};

  const NAMED_VALUES = Object.assign(
    (spec) => ({[others]: spec}),
    {[others]: value}
  );
  
  class PlanBuilder {
    constructor(keys = [], options = {}) {
      this.keys = keys;
      this.parent = null;
      this.options = {...options};
      this.weakLensMethods = WEAK_LENS_METHODS[options.methodsVersion || ''] || NO_WEAK_LENS_METHODS;
    }
    
    get proxyGuarded() {
      return this.options.planGroup && guardedGroups.has(this.options.planGroup);
    }
    
    get podInput() {
      return this.options.podInput;
    }
    
    buildPlan(rawPlan) {
      if (isArray(rawPlan)) {
        const result = this.makeLens(...this.keys);
        if (rawPlan.length > 1) {
          smartLog({
            level: 'error',
            trace: true,
            message: "Ambiguous Array item plan",
            msgId: 'f4b7c6e3ec76',
            keys: this.keys,
            specs: rawPlan,
          });
          throw new Error(`Multiple plans for Array items at ${keyDesc(this.keys)}`);
        } else if (rawPlan.length) {
          result.$item = new PlanBuilder([], this.options).buildPlan(rawPlan[0]);
          Object.assign(result, this.indexableMixin(result.$item));
        }
        return result;
      } else if (rawPlan.constructor === Object || rawPlan === NAMED_VALUES) {
        const result = this.makeLens(...this.keys);
        const theseKeys = this.keys;
        try {
          if (others in rawPlan) {
            result.$entryValue = new PlanBuilder([], this.options).buildPlan(rawPlan[others]);
            Object.assign(result, this.entriesMixin(result.$entryValue, Object.keys(rawPlan)));
          }
          const conflictedChildren = {}, addedChildren = new Set();
          for (let key of Object.keys(rawPlan)) {
            if (/\(\([a-z]+\)\)/.test(key)) continue;
            this.keys = theseKeys.concat([key]);
            try {
              this.parent = result;
              const childPlan = this.buildPlan(rawPlan[key]);
              if (key in result) {
                if (this.weakLensMethods.has(key)) {
                  conflictedChildren[key] = result[key];
                  result[key] = childPlan;
                  addedChildren.add(key);
                } else {
                  conflictedChildren[key] = childPlan;
                }
              } else {
                result[key] = childPlan;
                addedChildren.add(key);
              }
            } finally {
              this.parent = null;
            }
          }
          for (let key of (raw in rawPlan) ? Object.keys(rawPlan[raw]) : []) {
            this.keys = theseKeys.concat([key]);
            try {
              this.parent = result;
              const childPlan = this.buildPlan(rawPlan[raw][key]);
              if (key in result && !addedChildren.has(key)) {
                if (this.weakLensMethods.has(key)) {
                  conflictedChildren[key] = result[key];
                  result[key] = childPlan;
                } else {
                  conflictedChildren[key] = childPlan;
                }
              } else {
                result[key] = childPlan;
              }
            } finally {
              this.parent = null;
            }
          }
          forEach(conflictedChildren, (lensTree, key) => {
            let planKey = key;
            while (planKey in result) {
              planKey = '_' + planKey;
            }
            result[planKey] = lensTree;
          });
        } finally {
          this.keys = theseKeys;
        }
        return result;
      } else if (rawPlan === value || this.podInput) {
        return this.makeLens(...this.keys);
      } else {
        smartLog({
          level: 'error',
          trace: true,
          message: "Invalid item plan",
          msgId: 'c6055933b28b',
          keys: this.keys,
          spec: rawPlan,
        });
        throw new Error(`Invalid item in plan at ${keyDesc(this.keys)}`)
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
          const itemLens = this.thence(index);
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
         * @param  {...*} manipulator  See description
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
            smartLog({
              level: 'error',
              trace: true,
              message: ".mapInside() requires one or two manipulators",
              msgId: 'c33c71ab7a04',
              manipulators,
            });
            throw new Error(`.mapInside() requires one or two manipulators, ${manipulators.length} given`);
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
          const itemLens = this.thence(key);
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
         * @param  {...*} manipulator  See description
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
         * @param  {...*} manipulator  See description
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
    
    makeLens(...keys) {
      let resultLens = lens(...keys);
      if (this.proxyGuarded) {
        resultLens = new Proxy(resultLens, GuardedLensHandlers);
      }
      return resultLens;
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
   * @property RAW  Allows specifying otherwise special property names; its value
   *                should be an object whose properties will spec lenses in the
   *                Object where *RAW* appears
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
   * @callback DatumPlan_Tweak
   * @since 2.1.0
   * @param {Object|Array} plan  The plan to be modified
   * @returns {Object|Array} Altered clone of *plan*
   */
  
  /**
   * @class DatumPlan_TweakBuilder
   * @since 2.1.0
   * @hideconstructor
   * @classdesc
   * The methods present on this value assist in composing common tweaks for
   * building a good spec from a sample POD value.
   */
  
  /**
   * @function DatumPlan_TweakBuilder#VALUE
   * @since 2.1.0
   * @summary Compose a tweak making a specified slot into a terminal value in the datum plan
   * @param {...*} key  A name or index to use in successive subscripting (i.e. square bracket) operations
   * @returns {DatumPlan_Tweak}  A "tweak" function producing a cloned plan with the specified change
   *
   * @description
   * Like using [datumPlan.value]{@link module:natural-lenses/datum-plan} in a
   * standard plan, this tweak-composer specifies a point at some depth in the
   * datum plan terminating the generation of deeper (i.e. more tightly focused)
   * [Lenses]{@link Lens}.
   *
   * As with the other built-in tweak composers, the tweak function returned
   * from this function has a `plan()` method, which creates the same tweak
   * except substitutes the value spec passed to `plan()` at the point
   * specified in the spec by all the *keys* instead of just substituting
   * `datumPlan.value`.
   *
   * This particular method, with adjustments to *keys* and the value passed
   * to `plan()`, can reproduce the effects of all the other methods.
   */
  
  /**
   * @function DatumPlan_TweakBuilder#ITEMS
   * @since 2.1.0
   * @summary Compose a tweak making a specified slot in the spec an Array
   * @param {...*} key  A name or index to use in successive subscripting (i.e. square bracket) operations
   * @returns {DatumPlan_Tweak}  A "tweak" function producing a cloned plan with the specified change
   *
   * @description
   * This tweak-composer can be used to specify a slot within the original spec
   * as being an Array.  This is often needed because the input POD data for the
   * spec contains two or more elements in the slot indicated by the passed *keys*,
   * which is not acceptable for datum plan generation.  Calling this function
   * returns a tweak to set that slot to `[]`.
   *
   * As with the other built-in tweak composers, the tweak function returned
   * from this function has a `plan()` method, which creates the same tweak
   * except substitutes the item plan spec passed to `plan()` as the single
   * element in the Array injected into the clone of the input spec, allowing
   * the generated {@link Lens} to pass the item plan to its {@link IndexableMixin}
   * methods.
   */
  
  /**
   * @function DatumPlan_TweakBuilder#NAMED_ENTRIES
   * @since 2.1.0
   * @summary Compose a tweak making a specified slot in the spec a dictionary-like collection
   * @param {...*} key  A name or index to use in successive subscripting (i.e. square bracket) operations
   * @returns {DatumPlan_Tweak}  A "tweak" function producing a cloned plan with the specified change
   *
   * @description
   * `datumPlan.fromPOD()` has no way of determining that an Object in the spec
   * is an example of *dictionary-like* behavior, but this method can be used
   * to alter an initial POD spec to indicate the slot specified by *keys* is
   * to be treated as a dictionary.
   *
   * As with the other built-in tweak composers, the tweak function returned
   * from this function has a `plan()` method, which creates the same tweak
   * except substitutes the entry value spec passed to `plan()` as the entry
   * value spec at the point specified in the spec by all the *keys* instead of
   * just substituting `datumPlan.value`.
   */
  
  /**
   * @function DatumPlan_TweakBuilder#NAMED_ENTRIES_ALSO
   * @since 2.1.0
   * @summary Compose a tweak marking the specified slot as supporting non-explicit keys
   * @param {...*} key  A name or index to use in successive subscripting (i.e. square bracket) operations
   * @returns {DatumPlan_Tweak}  A "tweak" function producing a cloned plan with the specified change
   *
   * @description
   * `datumPlan.fromPOD()` has no way of determining that an Object in the spec
   * is an example of *dictionary-like* behavior, but this method can be used
   * to alter an initial POD spec to indicate the slot specified by *keys* is
   * expected to contain keys in addition to the ones in the spec.
   *
   * As with the other built-in tweak composers, the tweak function returned
   * from this function has a `plan()` method, which creates the same tweak
   * except substitutes the entry value spec passed to `plan()` as the entry
   * value spec for all incidental keys at the point in the spec specified by
   * all the *keys* instead of just substituting `datumPlan.value`.
   */
  
  /**
   * @typedef DatumPlan_TweaksDsl
   * @since 2.1.0
   * @mixes DatumPlan_Dsl
   * @property {DatumPlan_TweakBuilder} access
   * @property {Function} lens  The default export of {@link module:natural-lenses}
   */
  
  /**
   * @callback DatumPlan_TweaksBuilderCallback
   * @since 2.1.0
   * @param {DatumPlan_TweaksDsl} DSL  Helpful values and Functions for altering POD into a datum plan specification
   * @returns {Array.<DatumPlan_Tweak>}
   */
  
  GuardedLensHandlers.get = function (target, prop, receiver) {
    if (prop in target) {
      return target[prop];
    }
    
    // Return the exploding monkey
    const error = (function() {
      try {
        throw new UndefinedPropertyError(prop, target.keys, Object.keys(target));
      } catch (e) {
        return e;
      }
    }());
    return new Proxy({}, {
      get() { throw error; },
    });
  };
  
  function makeDatumPlanDSL() {
    return {
      VALUE: value,
      RAW: raw,
      NAMED_VALUES,
    }
  }
  
  /**
   * @module natural-lenses/datum-plan
   * @summary Construct a structure of [Lenses]{@link Lens} for accessing a structure by example
   *
   * @param {Array|Object|string|DatumPlan_DslCallback} spec  An object specifying the datum plan to be generated, or a {@link DatumPlan_DslCallback} to return such an object
   * @param {Object} [opts]
   * @param {string} [opts.planGroup]  String name to associate with all lenses in this plan; should not contain any commas
   * @param {string} [opts.methodsVersion]  The *major.minor* version of the {@link Lens} methods to use; this avoids changes to deconfliction of declared datum plan properties with later-introduced Lens method names
   * @returns {Lens} A Lens with {@link Lens} properties which may, in turn, have {@link Lens} properties; mixin methods may be added to some of these lenses
   *
   * @property {string} others  Used as a key in an Object to indicate dictionary-like behavior
   * @property {string} raw     Used as a key in an Object to provide additional properties for the host object, none of which are treated specially
   * @property {string} value   Used as a "tip" indicator for where generation of nested [Lenses]{@link Lens} ends
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
   * To allow specification of *any* property in an Object of a datum plan spec,
   * the special key *raw* can be used to provide an additional Object whose
   * own-properties are just like the properties for the Object containing the
   * *raw* key, except none of the keys of this secondary object are treated
   * as special -- not *raw*, nor *others*, nor any other key matching the
   * "special key" pattern (double parentheses containing only lowercase
   * letters).
   *
   * The resulting datum plan will be structured vaguely like *spec* and
   * constructed to access a value of similar shape to *spec*.
   *
   * If *options.planGroup* is given, the constructed datum plan can be instrumented
   * with JavaScript proxies to detect and report cases where undefined properties
   * of lenses within the datum plan are accessed.  This is done by including
   * the *options.planGroup* value within the comma-separated value in the
   * `DATUM_PLAN_GUARDS` environment variable.
   *
   * @see DatumPlan_Dsl
   * @see {@tutorial datum-plans} tutorial
   */
  function makeDatumPlan(rawPlan, { planGroup, methodsVersion } = {}) {
    if (isFunction(rawPlan)) {
      rawPlan = rawPlan.call(undefined, makeDatumPlanDSL());
    }
    return new PlanBuilder([], { planGroup, methodsVersion }).buildPlan(rawPlan);
  }
  Object.assign(makeDatumPlan, {
    fromPOD,
    others,
    raw,
    value,
    WEAK_LENS_METHODS,
  });
  Object.defineProperties(makeDatumPlan, {
    guardedGroups: {value: guardedGroups},
  });
  
  /**
   * @function module:natural-lenses/datum-plan#fromPOD
   * @since 2.1.0
   * @summary Generate a datum plan from Plain Ol' Data (POD)
   * @param {Array|Object|string} spec  An object specifying the datum plan to be generated
   * @param {Object} [opts]
   * @param {Array.<DatumPlan_Tweak>|DatumPlan_TweaksBuilderCallback} [opts.tweaks=[]]  Modifications to apply to *spec* before generating datum plan
   * @param {string} [opts.planGroup]  String name to associate with all lenses in this plan; should not contain any commas
   * @returns {Lens} A Lens with {@link Lens} properties which may, in turn, have {@link Lens} properties; mixin methods may be added to some of these lenses
   * @see module:natural-lenses/datum-plan
   *
   * @description
   * If a intial state POD value is available, this function simplifies generating
   * a datum plan to access the value.  One example application would be in a
   * Redux store, where the initial state could be passed to this function and the
   * resulting datum plan used to create selectors and reducers.
   *
   * Several aspects of the abstract structure of the target value as it
   * evolves over time cannot be inferred from *spec* and some information in
   * *spec* may be ambiguous in terms of generating a datum plan.  These difficulties
   * can be addressed by passing an Array (or a DSL-consuming Function returning
   * an Array) in *opts.tweaks*.  Idiomatic usage is to pass a
   * {@link DatumPlan_TweaksBuilderCallback}, which can use the basic datum plan
   * DSL values (from {@link DatumPlan_Dsl}) plus `lens` and `access` to build
   * functions that make altered clones of *spec* which resolve these lacunae
   * and ambiguities.
   */
  function fromPOD(rawPlan, { tweaks = [], planGroup } = {}) {
    if (isFunction(tweaks)) {
      tweaks = tweaks.call(undefined, {
        ...makeDatumPlanDSL(),
        lens,
        access: {
          VALUE(...keys) {
            const base = plan => lens(...keys).setInClone(plan, value);
            base.plan = valuePlan => plan => lens(...keys).setInClone(plan, valuePlan);
            return base;
          },
          
          ITEMS(...keys) {
            const base = plan => lens(...keys).setInClone(plan, []);
            base.plan = itemPlan => plan => lens(...keys).setInClone(plan, [itemPlan]);
            return base;
          },
          
          NAMED_ENTRIES(...keys) {
            const base = plan => lens(...keys).setInClone(plan, {[others]: value});
            base.plan = itemPlan => plan => lens(...keys).setInClone(plan, {[others]: itemPlan});
            return base;
          },
          
          NAMED_ENTRIES_ALSO(...keys) {
            const base = plan => lens(...keys, others).setInClone(plan, value);
            base.plan = itemPlan => plan => lens(...keys, others).setInClone(plan, itemPlan);
            return base;
          },
        },
      });
    }
    for (const tweak of tweaks) {
      rawPlan = tweak.call(undefined, rawPlan);
    }
    return new PlanBuilder([], { planGroup, podInput: true }).buildPlan(rawPlan);
  }
  
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
    smartLog({
      level: 'error',
      trace: true,
      message: `.${fnName}() requires one or two manipulators`,
      msgId: '76bbc754b22d',
      manipulators,
    });
    throw new Error(`.${fnName}() requires one or two manipulators, ${manipulators.length} given`);
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

function keyDesc(keys) {
  const items = keys.map(k => {
    switch (typeof k) {
      case 'string':
      case 'number':
        return JSON.stringify(k);
      case 'object':
        return `[object ${k.constructor.name}]`;
    }
    return '' + k;
  });
  return `[${items.join(', ')}]`;
}
