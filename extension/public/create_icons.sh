#!/bin/bash
# Icon creator script
# Usage: ./create_icons.sh <source_image.png>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <source_image.png>"
    echo "Example: $0 ~/Downloads/avatar.png"
    exit 1
fi

SOURCE="$1"

if [ ! -f "$SOURCE" ]; then
    echo "Error: Source image '$SOURCE' not found"
    exit 1
fi

echo "Creating icons from: $SOURCE"

# Backup existing icons
for size in 16 48 128; do
    if [ -f "icon-${size}.png" ]; then
        cp "icon-${size}.png" "icon-${size}-backup.png"
        echo "  Backed up icon-${size}.png"
    fi
done

# Create new icons with nearest-neighbor (point) filter to preserve pixel art
for size in 16 48 128; do
    magick "$SOURCE" -resize ${size}x${size} -filter point "icon-${size}.png"
    echo "  Created icon-${size}.png (${size}x${size})"
done

echo "✓ Icons created successfully!"
echo ""
echo "Next steps:"
echo "1. Reload the extension"
echo "2. Icons will appear in Chrome toolbar and extension manager"
