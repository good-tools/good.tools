FROM emscripten/emsdk:3.1.50

# Install build dependencies
RUN apt-get update && apt-get install -y \
    ninja-build \
    python3-pip \
    curl \
    xz-utils \
    && pip3 install meson \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
