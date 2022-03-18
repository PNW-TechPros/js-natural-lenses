# JavaScript-Native Lenses

* Safely retrieve values from deep in JSON data or complex JavaScript data structures
* Produce an altered clone of JSON or other data, reusing every unchanged branch of the subject tree
* Build views into complex data, like SQL's `CREATE VIEW` but with JavaScript data
* Declaratively code the expected structures of communicated or persisted JSON data

While retrieving or setting a property of an `Object` in JavaScript is trivially easy to code, when the data structure is more complex than a single `Object` or single `Array`, the code gets trickier: each level of retrieval has to check that the container it is accessing actually exists in the subject data and, when setting, has to ensure that a container exists at each level on the way down to the slot to be set.  Further complications arise when treating the data as immutable: each container to be "changed" must be cloned and the appropriate change made in the fresh clone returned.

Lenses address these problems by codifying the concept of "slots" within a data structure as objects separate from the data structure, but knowing how to operate upon it.  They have a strong theoretical background and there are many ways to modify, combine, and use them.  Additionally, [*datum plans*]{@tutorial datum-plans} offer a concise and intuitive way to build sets of useful lenses that maximize consistent access to structured data.

Thorough [Documentation](https://PNW-TechPros.github.io/js-natural-lenses) is available.
