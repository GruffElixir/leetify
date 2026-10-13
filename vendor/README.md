# Bundled C++ toolchain

The build copies unmodified clang.wasm, lld.wasm and sysroot.tar from browsercc 0.1.1. npm's lockfile pins the package and verifies its published SHA-512 integrity. The application bundles browsercc's Emscripten glue and filesystem helpers through esbuild; it does not download executable code at runtime. The optional precompiled header is not shipped.

Upstream: https://github.com/BertalanD/browsercc
Compiler: LLVM/Clang/LLD 20.1.2, upstream LLVM revision 58df0ef89dd64126512e4ee27b4ac3fd8ddf6247.
Sysroot: WASI SDK 25 (wasi-libc wasi-sdk-25; LLVM libc++/libc++abi/compiler-rt).
Our standard-header convenience shim replaces the limited bundled bits/stdc++.h inside the compiler's virtual filesystem. It contains standard include directives and does not copy GNU libstdc++ code.

Full license texts and attribution notices in licenses/ are included in THIRD_PARTY_NOTICES.md. LLVM and WASI license texts are from their corresponding release tags. Emscripten's dual MIT/NCSA license is included for its generated runtime and emmalloc. browsercc does not record its exact Emscripten build version (its Dockerfile selects latest), so binaries are pinned by the npm artifact rather than claiming a reproducible LLVM rebuild.

WASI libc's third-party notices cover cloudlibc, musl, musl-fts, dlmalloc (CC0), and emmalloc. Their notices are retained alongside the WASI license bundle. Emscripten.txt is the unchanged dual license text from Emscripten 4.0.6. No upstream binary changes are made.

License and attribution text is retained, with trailing whitespace normalized for repository checks.
