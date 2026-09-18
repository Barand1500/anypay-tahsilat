from PIL import Image

src = r"frontend\public\brand\logo.webp"
img = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if r >= 245 and g >= 245 and b >= 245:
            pixels[x, y] = (r, g, b, 0)
        elif r >= 228 and g >= 228 and b >= 228:
            whiteness = (r + g + b) / 3.0
            alpha = int(max(0, min(255, (255 - whiteness) * 10)))
            pixels[x, y] = (r, g, b, alpha)

out = r"frontend\public\brand\logo.png"
img.save(out, "PNG")
print("saved", out, img.size)
