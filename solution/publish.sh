#!/bin/bash
set -euo pipefail

mkdir -p /app/publisher
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SOURCE_DIR=""
for candidate in \
    "$SCRIPT_DIR/publisher" \
    "/solution/publisher" \
    "/app/solution/publisher" \
    "$(pwd)/solution/publisher"; do
    if [ -d "$candidate" ] && [ -f "$candidate/release-publisher.mjs" ]; then
        SOURCE_DIR="$candidate"
        break
    fi
done

if [ -n "$SOURCE_DIR" ]; then
    cp -r "$SOURCE_DIR"/* /app/publisher/
    chmod +x /app/publisher/release-publisher.mjs
else
    # Fallback to single file search
    SOURCE=""
    for candidate in \
        "$SCRIPT_DIR/publisher/release-publisher.mjs" \
        "$SCRIPT_DIR/release-publisher.mjs" \
        "/solution/publisher/release-publisher.mjs" \
        "/solution/release-publisher.mjs" \
        "/app/solution/publisher/release-publisher.mjs" \
        "/app/solution/release-publisher.mjs" \
        "$(pwd)/solution/publisher/release-publisher.mjs" \
        "$(pwd)/solution/release-publisher.mjs"; do
        if [ -f "$candidate" ]; then
            SOURCE="$candidate"
            break
        fi
    done

    if [ -z "$SOURCE" ]; then
        FOUND=$(find / -name "release-publisher.mjs" 2>/dev/null | grep -v "^/app/publisher" | head -n 1 || true)
        if [ -n "$FOUND" ] && [ -f "$FOUND" ]; then
            SOURCE="$FOUND"
        fi
    fi

    if [ -n "$SOURCE" ]; then
        cp "$SOURCE" /app/publisher/release-publisher.mjs
        chmod +x /app/publisher/release-publisher.mjs
    else
        echo "Error: release-publisher.mjs could not be found." >&2
        exit 1
    fi
fi
