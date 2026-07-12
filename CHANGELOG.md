# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.1.5](/seepine/openapi-generator/compare/v0.1.4...v0.1.5) (2026-07-12)


### 🐛 Bug Fixes

* **vite:** run generation non-blocking and catch errors to avoid breaking build ([c0cc72f](/seepine/openapi-generator/commit/c0cc72f9e4aac16f74436efa715d144371ff7f26))

## [0.1.4](/seepine/openapi-generator/compare/v0.1.3...v0.1.4) (2026-07-08)


### 🎉 Features

* **vite:** add runOnBuild option to skip generation during vite build ([cd28bb4](/seepine/openapi-generator/commit/cd28bb42137be4967774d4a1172687f628a688ff))


### ♻️ Refactors

* **parser:** drop ref type and inline extractRefName ([8d72122](/seepine/openapi-generator/commit/8d72122fb73ef7bbc6ac2b7fbc6c63c40dee938e))

## [0.1.3](/seepine/openapi-generator/compare/v0.1.2...v0.1.3) (2026-06-29)


### 🎉 Features

* **parser:** map binary format string schema to Blob type ([f83cfe6](/seepine/openapi-generator/commit/f83cfe66931e1941777c3906bf8132d809e1936f))

## [0.1.2](/seepine/openapi-generator/compare/v0.1.1...v0.1.2) (2026-06-29)


### 🐛 Bug Fixes

* **vite:** normalise path separators in watchChange equality check ([606ac3f](/seepine/openapi-generator/commit/606ac3f361330fb926b647e8309156176cbe1d6b))
* **writer:** use default import for dprint-node ([4a1e72d](/seepine/openapi-generator/commit/4a1e72d24e7fdbfab583e87b1a66a52fbb342f60))

## [0.1.1](/seepine/openapi-generator/compare/v0.1.0...v0.1.1) (2026-06-29)


### 🎉 Features

* **writer:** integrate prettier for automatic code formatting ([416b90a](/seepine/openapi-generator/commit/416b90a49461e806b734a3fe0531a6b5c5306238))


### ♻️ Refactors

* **generator:** bucket untagged operations under "default" namespace ([46ac327](/seepine/openapi-generator/commit/46ac3272f2ace00b2847b36da313778986a06e8b))
* simplify code, dedupe helpers and fix stale dprint comments ([23dbd56](/seepine/openapi-generator/commit/23dbd56afa060238acc5cf8bb440cebe8b61e01c))
* **writer:** replace prettier with dprint for artifact formatting ([6bba2fb](/seepine/openapi-generator/commit/6bba2fbc9fdcf091b645c4ea15a412bac1efc6c4))

## 0.1.0 (2026-06-28)


### 🎉 Features

* first commit ([efb8bb6](/seepine/openapi-generator/commit/efb8bb6f8d652e9e4157530ab272a739611d8d9d))
