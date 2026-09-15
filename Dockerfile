FROM ghcr.io/gohugoio/hugo:v0.166.0 AS build

WORKDIR /src
COPY . .
USER root
ARG ENVIRONMENT=development
RUN rm -rf public && hugo --gc --minify --environment "${ENVIRONMENT}"

FROM nginx:1.31-alpine

RUN mkdir -p /etc/nginx/overrides.d

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/public /usr/share/nginx/html

EXPOSE 80
