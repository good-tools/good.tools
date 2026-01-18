project('trigasm', 'cpp', 
  default_options: ['cpp_std=c++17'],
  version: '0.1.0'
)

# VCGlib paths (header-only library)
vcglib_inc = include_directories('../vcglib', '../vcglib/eigenlib')

# Emscripten link arguments
link_args = [
  '-lembind',
  '-s', 'MODULARIZE=1',
  '-s', 'EXPORT_NAME="loadTrigasm"',
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
  'trigasm.cpp',
  'bindings.cpp'
])

# Build the WASM executable
executable('trigasm', sources,
  include_directories: vcglib_inc,
  link_args: link_args,
  install: true
)
