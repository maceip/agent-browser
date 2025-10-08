from PIL import Image
import sys

# The image data will be provided via stdin
input_path = sys.argv[1]
img = Image.open(input_path)

# Resize to required sizes using NEAREST to preserve pixel art
for size in [16, 48, 128]:
    resized = img.resize((size, size), Image.Resampling.NEAREST)
    resized.save(f'icon-{size}.png', 'PNG')
    print(f'Created icon-{size}.png')
