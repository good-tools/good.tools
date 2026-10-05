project('meshrepair', 'cpp', 
  default_options: ['cpp_std=c++17'],
  version: '0.1.0'
)

# VCGlib is header-only; `wasmpatch apply` prepares it in build/src/vcglib
vcglib_inc = include_directories('../build/src/vcglib', '../build/src/vcglib/eigenlib')

# Emscripten link arguments
link_args = [
  '-lembind',
  '-s', 'MODULARIZE=1',
  # an ES module (export default), matching the package's "type": "module"
  '-s', 'EXPORT_ES6=1',
  '-s', 'EXPORT_NAME="loadMeshRepair"',
  '-s', 'INITIAL_MEMORY=64MB',
  '-s', 'ALLOW_MEMORY_GROWTH=1',
  '-s', 'EXPORTED_RUNTIME_METHODS=FS',
  '-s', 'EXPORTED_FUNCTIONS=_malloc,_free',
  '-s', 'NO_EXIT_RUNTIME=1',
  '-O3',
  '--no-entry'
]

# Source files
sources = files([
  'meshrepair.cpp',
  'bindings.cpp'
])

# Build the WASM executable
executable('meshrepair', sources,
  include_directories: vcglib_inc,
  link_args: link_args,
  install: true
)
