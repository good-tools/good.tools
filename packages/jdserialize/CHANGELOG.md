# Changelog

## [2.0.0](https://github.com/good-tools/good.tools/compare/jdserialize-v1.0.0...jdserialize-v2.0.0) (2026-10-05)


### ⚠ BREAKING CHANGES

* **jdserialize:** the package declares an `exports` map and ships dist/index.{js,cjs}; deep imports such as `@goodtools/jdserialize/dist/main.js` no longer resolve. The public API is unchanged.

### Features

* **jdserialize:** ship as part of the good.tools monorepo ([eceee69](https://github.com/good-tools/good.tools/commit/eceee6977188e92af9ceccffe2f791aa47321d3d))
* modernize jdserialize and protobuf-decoder packaging ([f072a03](https://github.com/good-tools/good.tools/commit/f072a03a0070e927c8c7747c59053451dfe6900e))


### Bug Fixes

* **jdserialize:** handle TC_RESET between top-level objects ([eceee69](https://github.com/good-tools/good.tools/commit/eceee6977188e92af9ceccffe2f791aa47321d3d))
* **jdserialize:** keep stream keys such as "__proto__" as own properties when normalizing ([eceee69](https://github.com/good-tools/good.tools/commit/eceee6977188e92af9ceccffe2f791aa47321d3d))
* **jdserialize:** print null and non-string class annotations instead of throwing ([eceee69](https://github.com/good-tools/good.tools/commit/eceee6977188e92af9ceccffe2f791aa47321d3d))
* **jdserialize:** read byte, short and int field values as signed ([eceee69](https://github.com/good-tools/good.tools/commit/eceee6977188e92af9ceccffe2f791aa47321d3d))
