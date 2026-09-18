from PIL import Image

src = r"frontend\public\brand\logo.png"
img = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if a < 10:
            continue
        # Renkli marka ikonu (cyan/mavi/mor) korunur
        saturation_hint = max(r, g, b) - min(r, g, b)
        if saturation_hint > 35 and (b > 120 or g > 150 or r > 80):
            continue
        # Koyu / gri yazıyı beyaza çevir
        luminance = 0.299 * r + 0.587 * g + 0.114 * b
        if luminance < 200:
            pixels[x, y] = (255, 255, 255, a)

out = r"frontend\public\brand\logo-white.png"
img.save(out, "PNG")
print("saved", out, img.size)
