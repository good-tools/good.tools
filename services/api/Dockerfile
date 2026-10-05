# good.tools API. Build from this directory:
#   docker build -t good-tools-api services/api

FROM --platform=$BUILDPLATFORM golang:1.26 AS build
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && mkdir /out/data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
COPY --from=build --chown=nonroot:nonroot /out/data /data
USER nonroot
ENV PORT=8080 DATA_DIR=/data
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["/api"]
