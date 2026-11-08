###############################################################
# metaframes: one Fresh app on Cloudflare, one directory per frame
###############################################################
set shell := ["bash", "-c"]
set dotenv-load := true
set export := true

PORT := env_var_or_default("PORT", "5173")
CF_WORKER := env_var_or_default("CF_WORKER", "metaframes")
wrangler := "./node_modules/.bin/wrangler"

# minimal formatting, bold is very useful

bold := '\033[1m'
normal := '\033[0m'
green := "\\e[32m"
yellow := "\\e[33m"
blue := "\\e[34m"
magenta := "\\e[35m"
grey := "\\e[90m"

@_help:
    just --list --unsorted
    echo -e ""
    echo -e "    Gallery 🔗            {{ green }}https://localhost:{{ PORT }}/{{ normal }}"
    echo -e "    Frame by path 🔗      {{ green }}https://localhost:{{ PORT }}/<frame>{{ normal }}"
    echo -e "    Frame by subdomain 🔗 {{ green }}https://<frame>.localhost:{{ PORT }}/{{ normal }}"
    echo -e "    Per frame 🔗          {{ grey }}/<frame>/metaframe.json   /<frame>/README.md{{ normal }}"
    echo -e ""
    echo -e "    Production URL 🔗     {{ green }}https://mtfm.io/<frame>{{ normal }} and {{ green }}https://<frame>.mtfm.io/{{ normal }}"
    echo -e "    Github  URL 🔗        {{ green }}https://github.com/metapages/metaframes{{ normal }}"
    echo -e "    Deploy Console URL 🔗 {{ green }}https://dash.cloudflare.com/?to=/:account/workers/services/view/{{ CF_WORKER }}{{ normal }}"
    echo -e ""

# Install jsr + npm dependencies (deno.json nodeModulesDir: manual)
@install:
    deno install --allow-scripts

# Run the dev server: every frame on a path and on a *.localhost subdomain
@dev: install _mkcert
    deno task dev

# Format, lint, type-check and unit-test
# Depends on install: `deno check` resolves imports against node_modules
# (nodeModulesDir: manual), and `just deploy` runs check before build — so on a
# fresh clone, CI included, this is the first recipe that needs the deps.
@check: install
    deno fmt --check .
    deno lint .
    deno check .
    deno test -A lib/

# Production build into ./_fresh
@build: install
    deno task build

# Serve the production build on Deno (static files work here, unlike workerd)
@start: build
    deno task start

# Serve the production build in the real Cloudflare runtime (workerd)
@preview: build _ensure_wrangler
    {{ wrangler }} dev

# Preview in workerd as a specific frame subdomain, e.g. `just preview-host markdown.mtfm.io`.
# `wrangler dev` pins the simulated hostname to the first entry in wrangler.jsonc
# `routes`, so a Host header alone cannot exercise subdomain routing locally.
@preview-host HOST: build _ensure_wrangler
    {{ wrangler }} dev --host {{ HOST }}

# Build and deploy to Cloudflare Workers
@deploy: check build _ensure_wrangler
    {{ wrangler }} deploy
    echo -e "  🚀 {{ green }}https://mtfm.io/{{ normal }}"

# Tail production logs
@logs: _ensure_wrangler
    {{ wrangler }} tail {{ CF_WORKER }}

# Scaffold a new frame directory under ./frames/
@new FRAME:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -d "frames/{{ FRAME }}" ]; then echo "frames/{{ FRAME }} already exists"; exit 1; fi
    mkdir -p "frames/{{ FRAME }}/(_islands)"
    sed "s/__NAME__/{{ FRAME }}/g" templates/frame.ts.tmpl > "frames/{{ FRAME }}/frame.ts"
    sed "s/__NAME__/{{ FRAME }}/g" templates/config.ts.tmpl > "frames/{{ FRAME }}/config.ts"
    sed "s/__NAME__/{{ FRAME }}/g" templates/index.tsx.tmpl > "frames/{{ FRAME }}/index.tsx"
    sed "s/__NAME__/{{ FRAME }}/g" templates/island.tsx.tmpl > "frames/{{ FRAME }}/(_islands)/Main.tsx"
    sed "s/__NAME__/{{ FRAME }}/g" templates/README.md.tmpl > "frames/{{ FRAME }}/README.md"
    deno fmt -q "frames/{{ FRAME }}"
    echo -e "  ✅ {{ green }}frames/{{ FRAME }}{{ normal }} — restart 'just dev' to pick it up"

# DEV: TLS certs for localhost and *.localhost. An https parent page cannot
# embed an http iframe, so TLS is required to test a frame as it is really used.
# https://blog.filippo.io/mkcert-valid-https-certificates-for-localhost/
# DEV: TLS certs for localhost and every frame's *.localhost origin.
#
# Each subdomain is named explicitly. A `*.localhost` wildcard looks tidier but
# Chrome rejects it with ERR_CERT_COMMON_NAME_INVALID: a wildcard is not valid
# directly under a single-label top-level domain. The cert is regenerated when
# a new frame adds a hostname it does not yet cover.
_mkcert:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! command -v mkcert &> /dev/null; then echo -e "💥 {{ bold }}mkcert{{ normal }} is not installed: https://github.com/FiloSottile/mkcert"; exit 1; fi
    HOSTS=$(deno run --allow-read scripts/frame-hosts.ts)
    if [ -f .certs/localhost.pem ]; then
        SANS=$(openssl x509 -in .certs/localhost.pem -noout -ext subjectAltName 2>/dev/null || echo "")
        MISSING=""
        for h in $HOSTS; do
            case "$SANS" in *"DNS:$h"*) ;; *) MISSING="$MISSING $h" ;; esac
        done
        if [ -z "$MISSING" ]; then exit 0; fi
        echo -e "  🔐 {{ yellow }}certificate is missing:$MISSING — regenerating{{ normal }}"
    fi
    mkdir -p .certs
    mkcert -install
    mkcert -cert-file .certs/localhost.pem -key-file .certs/localhost-key.pem localhost $HOSTS 127.0.0.1 ::1
    echo -e "  🔐 {{ green }}.certs/localhost.pem{{ normal }} covers localhost $HOSTS"

@_ensure_wrangler:
    if [ ! -f "{{ wrangler }}" ]; then deno install --allow-scripts npm:wrangler; fi

# Delete generated files
@clean:
    rm -rf _fresh .wrangler

# Delete generated files, dependencies and dev certs
@clean-all: clean
    rm -rf node_modules .certs
