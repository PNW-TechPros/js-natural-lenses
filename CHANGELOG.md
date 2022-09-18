# Changelog

## 2.3.1

* Removed dependencies on `@babel/runtime` and `underscore`

---
## 2.3.0

* Removed `debugger` statements
* Upgraded dependencies (for development)
* Added `methodsVersion` option for datum plan construction
* Added string template tag function for lens construction
* Improved documentation
* Made datum plan code loadable directly from supporting browsers
* Mixed `BinderMixin` into `Factory`

---
## 2.2.0

* Added customized logging (`lens.setLogger()`, `lens.setLogger.forBlock()`, and `lens.asyncLogging()`)
* Added `Optic#extractor` and `Optic#extractor_maybe`

---
## 2.1.0

* Added `fromPOD` generation of datum plans.

---
## 2.0.1

* Fixed use of datum plan DSL's `NAME_VALUES` without a call

---
## 2.0.0

* Made `Lens`, `AbstractNFocal`, and `OpticArray` subclasses of `Optic`
* Added `Lens#thence`
* Added `bindNow` argument to `Lens#bound`
* Added `Optic#binding`
* Added custom steps with `Step`
* Added support for `immutable`
* Added `Lens` factories, for container customization
* Added support for `setInClone` to multifocal optics, with the possibility of a `StereoscopyError`
* Added datum plan generation
* Automated most of publication process
* Added unit tests with high coverage
* **BREAKING** Fixed ordering of optics in `fuse` when using non-`Lens`es
