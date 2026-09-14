#!/bin/bash
set -euo pipefail

# Ensure target publisher directory exists
mkdir -p /app/publisher

DEPLOY_BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PUBLISHER_SOURCE_DIR=""
for candidate_dir in \
    "$DEPLOY_BASE_DIR/publisher" \
    "/solution/publisher" \
    "/app/solution/publisher" \
    "$(pwd)/solution/publisher"; do
    if [ -d "$candidate_dir" ] && [ -f "$candidate_dir/release-publisher.mjs" ]; then
        PUBLISHER_SOURCE_DIR="$candidate_dir"
        break
    fi
done

if [ -n "$PUBLISHER_SOURCE_DIR" ]; then
    cp -r "$PUBLISHER_SOURCE_DIR"/* /app/publisher/
    chmod +x /app/publisher/release-publisher.mjs
else
    # Single file fallback search
    TARGET_ENTRYPOINT=""
    for candidate_file in \
        "$DEPLOY_BASE_DIR/publisher/release-publisher.mjs" \
        "$DEPLOY_BASE_DIR/release-publisher.mjs" \
        "/solution/publisher/release-publisher.mjs" \
        "/solution/release-publisher.mjs" \
        "/app/solution/publisher/release-publisher.mjs" \
        "/app/solution/release-publisher.mjs" \
        "$(pwd)/solution/publisher/release-publisher.mjs" \
        "$(pwd)/solution/release-publisher.mjs"; do
        if [ -f "$candidate_file" ]; then
            TARGET_ENTRYPOINT="$candidate_file"
            break
        fi
    done

    if [ -z "$TARGET_ENTRYPOINT" ]; then
        DISCOVERED=$(find / -name "release-publisher.mjs" 2>/dev/null | grep -v "^/app/publisher" | head -n 1 || true)
        if [ -n "$DISCOVERED" ] && [ -f "$DISCOVERED" ]; then
            TARGET_ENTRYPOINT="$DISCOVERED"
        fi
    fi

    if [ -n "$TARGET_ENTRYPOINT" ]; then
        cp "$TARGET_ENTRYPOINT" /app/publisher/release-publisher.mjs
        chmod +x /app/publisher/release-publisher.mjs
    else
        echo "Error: Unable to locate release-publisher.mjs source." >&2
        exit 1
    fi
fi

