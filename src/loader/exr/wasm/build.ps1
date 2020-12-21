$lib = Get-ChildItem install/lib/*.a

emcc wrap_openexr.cpp $lib --bind -o wrap_openexr.js -s MODULARIZE -s ALLOW_MEMORY_GROWTH=1 -s DISABLE_EXCEPTION_CATCHING=0 # -s TOTAL_MEMORY=1073741824