# Changelog

## [2.0.0](https://github.com/good-tools/good.tools/compare/protobuf-decoder-v1.0.0...protobuf-decoder-v2.0.0) (2026-10-05)


### ⚠ BREAKING CHANGES

* **protobuf-decoder:** the package declares an `exports` map and ships dist/index.{js,cjs}; deep imports such as `@goodtools/protobuf-decoder/dist/main.js` no longer resolve. The public API is unchanged.

### Features

* modernize jdserialize and protobuf-decoder packaging ([f072a03](https://github.com/good-tools/good.tools/commit/f072a03a0070e927c8c7747c59053451dfe6900e))
* **protobuf-decoder:** ship as part of the good.tools monorepo ([8e9be05](https://github.com/good-tools/good.tools/commit/8e9be05bb203e68f02d4bf08c8abb3362903351c))


### Bug Fixes

* **protobuf-decoder:** decode field numbers of tags at or above 2^31 correctly ([8e9be05](https://github.com/good-tools/good.tools/commit/8e9be05bb203e68f02d4bf08c8abb3362903351c))
* **protobuf-decoder:** decode fixed64 as unsigned and add sfixed64 ([8e9be05](https://github.com/good-tools/good.tools/commit/8e9be05bb203e68f02d4bf08c8abb3362903351c))
