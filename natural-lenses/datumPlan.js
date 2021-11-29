const lens = require('../lens.js');
const {isArray, isObject} = require('underscore');
// const value = Symbol('lens.DatumPlan.value');
// const others = Symbol('lens.DatumPlan.others');
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
      const result = this.keys.length ? lens(...this.keys) : {};
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
        // TODO: Mixin dictionary entry iteration methods
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
  
  indexableMixin(itemPlan) {
    return {
      /**
       * @summary Get the length of the targeted Array (or Array-like)
       * @param subject The input structured data
       * @return        The length of the targeted Array, or `undefined`
       */
      length: function (subject) {
        return lengthProp.get(this.get(subject));
      },
      
      /**
       * @summary Build a lens through a specific index
       * @param  {number}          index       Index into the Array targeted by this lens on which to focus
       * @param  {Function | Lens} [pickLens]  A lens to a slot within the selected item or a Function returning such a lens given the item plan
       * @return                               A lens (or at least some optic) to the item or a slot within the item
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
       * within the *index*-th item of the indexable target by this lens, where
       * the slot within the item is selected by the result of `itemSlotPicker`.
       * `itemSlotPicker` is called with the item datum plan for the target
       * of this lens.
       *
       * Pattern 3 is similar to pattern 2, just directly passing a lens (or
       * lens-like object) rather than a function that returns one.
       */
      at: function (index, pickLens) {
        // pickLens is given itemPlan to return a lens to fuse with the lens for the item at index
        const itemLens = lens(...this.keys, index);
        if (pickLens && pickLens[lens.isLens]) {
          return lens.fuse(itemLens, pickLens);
        } else if (typeof pickLens === 'function') {
          return lens.fuse(itemLens, pickLens.call(undefined, itemPlan));
        } else {
          return itemLens;
        }
      },
      
      /**
       * @summary Clone the subject with the target of this lens altered by mapping items
       * @param  subject       The input structured data
       * @param  manipulators  See description
       * @return               A minimally changed clone of subject with the transformed value in this slot
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
       * is called with the item datum plan for the targeted iterable.
       *
       * Pattern 3 is similar to pattern 2, just directly passing a lens (or
       * something that knows how to `xformInClone`) rather than a
       * function that returns one.
       *
       * The `itemXform` function in pattern 1 is called with the item value
       * and index for each item of the target iterable of this lens.
       *
       * The `itemSlotXform` function in patterns 2 and 3 is called with the
       * slot value and the index of the current item within the target iterable
       * of this lens.
       */
      mapInside: function (subject, ...manipulators) {
        if (manipulators.length === 2) {
          const [getLens, itemSlotXform] = manipulators;
          const itemLens = getLens.xformInClone ? getLens : getLens.call(undefined, itemPlan);
          
          return this.xformIterableInClone(subject, items =>
            Array.from(
              items,
              (item, index) => itemLens.xformInClone(
                item,
                slotValue => itemSlotXform.call(undefined, slotValue, index)
              )
            )
          );
        } else if (manipulators.length === 1) {
          const [itemXform] = manipulators;
          return this.xformIterableInClone(subject, items =>
            Array.from(items, itemXform)
          );
        } else {
          throw `.mapInside() requires one or two manipulators, ${manipulators.length} given`;
        }
      },
      
      /**
       * @summary Clone the subject with the target of this lens altered by flatMapping items
       * @param            subject          The input structured data
       * @param {Function} subItemsForItem  Callback providing the iterable of items (possibly empty) to replace each item
       * @param {Function} [reduce]         Callback to reduce the sequence of accumulated items
       * @return                            A minimally changed clone of subject with the transformed value in this slot
       *
       * @description
       * This method allows the creation of a clone of *subject* where the
       * target of this lens has been replaced with an iterable composed of
       * zero or more values for each item in the equivalent slot in *subject*.
       *
       * If *reduce* is supplied, it is applied to concatenated results of all
       * calls to *subItemsForItem*.  There is no requirement the resulting
       * value is iterable.
       */
      flatMapInside: function (subject, subItemsForItem, reduce) {
        return this.xformIterableInClone(subject, items => {
          const result = [];
          for (let item of items) {
            result.push(...subItemsForItem.call(undefined, item, itemPlan));
          }
          return reduce ? reduce.call(undefined, result) : result;
        });
      },
    };
  }
  
  entriesMixin(valuePlan, explicitKeys) {
    explicitKeys = new Set(explicitKeys);
    
    return {
      /**
       * @summary Build a lens through a specific key
       * @param {string}          key         Key (i.e. property name) of the targeted Object on which to focus
       * @param {Function | Lens} [pickLens]  A lens to a slot within the selected value or a Function returning such a lens given the value plan
       * @return                              A lens (or at least some optic) to the value or a slot within the value
       */
      at: function (key, pickLens) {
        const itemLens = lens(...this.keys, key);
        if (pickLens && pickLens[lens.isLens]) {
          return lens.fuse(itemLens, pickLens);
        } else if (typeof pickLens === 'function') {
          return lens.fuse(itemLens, pickLens.call(undefined, valuePlan));
        } else {
          return itemLens;
        }
      },
      
      mapInside: function (subject, ...manipulators) {
        let valueModifier = null;
        if (manipulators.length === 2) {
          const [getLens, valueSlotXform] = manipulators;
          const valueLens = getLens.xformInClone ? getLens : getLens.call(undefined, valuePlan);
          valueModifier = (result, key) => valueLens.xformInClone(
            result[key],
            slotValue => valueSlotXform.call(undefined, slotValue, key)
          );
        } else if (manipulators.length === 1) {
          const [valueXform] = manipulators;
          valueModifier = (result, key) => (
            valueXform.call(undefined, result[key], key)
          );
        } else {
          throw `.mapInside() requires one or two manipulators, ${manipulators.length} given`;
        }
        
        return this.xformInClone(subject, container => {
          const result = {...container};
          for (let key of Object.keys(container)) {
            if (explicitKeys.has(key)) continue;
            result[key] = valueModifier(result, key);
          }
          return result;
        });
      },
    };
  }
}

function makeDatumPlan(rawPlan) {
  return new PlanBuilder().buildPlan(rawPlan);
}
Object.assign(makeDatumPlan, {
  value,
  others,
});

module.exports = makeDatumPlan;
