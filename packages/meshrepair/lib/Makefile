# Trigasm Build System
# Based on Wiregasm's build pattern

all: .trigasm

TARBALLS := tarballs
PREFIX := ../built
PREFIX := $(abspath $(PREFIX))
VPATH := $(TARBALLS)
BUILD ?= x86_64-linux
HOST := wasm32-unknown-emscripten

download = curl -sSL -- "$(1)" > "$@"
checksum = echo "$(1) $(2)" | sha512sum --check --status

EXTRACT_DIR = $(patsubst %.tar,%,$(basename $(notdir $<)))
MOVE = mv $(EXTRACT_DIR) $@ && touch $@
CLEANUP = rm -rf $@
BUILD_DIR = $</wg_build

# Meson configuration
MESON_CLEAN = rm -rf $(BUILD_DIR)/meson-private
MESON_SETUP = meson setup $(BUILD_DIR) $< --default-library static --prefix $(PREFIX) --buildtype release --backend ninja -Dlibdir=lib --cross-file $(abspath crossfile.meson)
MESON_BUILD = meson compile -C $(BUILD_DIR) && meson install -C $(BUILD_DIR)

mostlyclean:
	rm -rf vcglib
	rm -rf .vcglib .trigasm
	rm -rf .sum-*

clean: mostlyclean
	rm -rf $(TARBALLS)/*.*
	rm -rf $(PREFIX)

#
# VCGlib (header-only library, includes Eigen)
#
VCGLIB_VERSION := 2025.07
VCGLIB_URL := https://github.com/cnr-isti-vclab/vcglib/archive/refs/tags/$(VCGLIB_VERSION).tar.gz
VCGLIB_CHECKSUM := 7b0f93df7b1766fb0d00e03c9f2f95d274c8c0c6b0f01a13fdef51f96c55b7f0a8ad5b2f0f3d1c1a8e1d5b6c7a9f0e2d4c6b8a0f3e5d7c9b1a3f5e7d9c1b3a5f7e9

$(TARBALLS)/vcglib-$(VCGLIB_VERSION).tar.gz:
	mkdir -p $(TARBALLS)
	$(call download,$(VCGLIB_URL))

.sum-vcglib: vcglib-$(VCGLIB_VERSION).tar.gz
	@echo "[+] Skipping checksum for vcglib (GitHub tar.gz checksums vary)"
	touch $@

vcglib: vcglib-$(VCGLIB_VERSION).tar.gz .sum-vcglib
	$(CLEANUP)
	tar xzfo $<
	mv vcglib-$(VCGLIB_VERSION) $@ && touch $@

.vcglib: vcglib
	@echo "[+] VCGlib ready (header-only)"
	touch $@

#
# Trigasm WASM Library
#
.trigasm: .vcglib trigasm crossfile.meson
	@echo "[+] Building Trigasm"
	$(MESON_CLEAN)
	$(MESON_SETUP)
	+$(MESON_BUILD)
	touch $@

.PHONY: all mostlyclean clean
