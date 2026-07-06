import base64
import io
from PIL import Image, ImageDraw, ImageOps

with open('src/main/tray.ts', 'r') as f:
    content = f.read()

import re
match = re.search(r"const ICON_NORMAL =\n\s+'([^']+)'", content)
normal_b64 = match.group(1)

img_bytes = base64.b64decode(normal_b64)
base_img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
width, height = base_img.size

# We need to invert the RGB channels of base_img for dark mode, keeping alpha intact
r, g, b, a = base_img.split()
r = ImageOps.invert(r)
g = ImageOps.invert(g)
b = ImageOps.invert(b)
inverted_base = Image.merge('RGBA', (r, g, b, a))

def draw_indicator(img_to_draw, color, radius):
    img = img_to_draw.copy()
    draw = ImageDraw.Draw(img)
    cx, cy = width - radius - 2, radius + 2
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=color)
    out = io.BytesIO()
    img.save(out, format="PNG")
    return base64.b64encode(out.getvalue()).decode('utf-8')

light_b64 = draw_indicator(base_img, (255, 59, 48, 255), 6) # iOS Red
dark_b64 = draw_indicator(inverted_base, (255, 105, 97, 255), 6)  # Light Red for dark mode

with open('src/main/tray.ts', 'w') as f:
    content = re.sub(r"const ICON_UPD_LIGHT =\n\s+'[^']+'", f"const ICON_UPD_LIGHT =\n  '{light_b64}'", content)
    content = re.sub(r"const ICON_UPD_DARK =\n\s+'[^']+'", f"const ICON_UPD_DARK =\n  '{dark_b64}'", content)
    f.write(content)

print("Icons updated successfully.")
