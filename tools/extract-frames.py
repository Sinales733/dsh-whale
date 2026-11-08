"""Extract the built-in running-whale APNG into unique 28x28 alpha PNG frames (data URIs) for src/orig-frames.js.
The plugin replays them itself so the original animation can join the rotation with a controlled start."""
import base64, io, sys
from PIL import Image, ImageChops

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src)
uniq, seq, keys = [], [], []
for k in range(im.n_frames):
    im.seek(k)
    a = im.convert('RGBA')
    for j, u in enumerate(keys):
        if ImageChops.difference(u, a).getbbox() is None:
            seq.append(j)
            break
    else:
        keys.append(a.copy())
        buf = io.BytesIO()
        Image.merge('LA', (Image.new('L', a.size, 0), a.split()[-1])).save(buf, 'PNG', optimize=True)
        uniq.append('data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode())
        seq.append(len(uniq) - 1)
js = '// Generated from the DSH running-whale@2x.png (60 × 50 ms). Do not edit.\n'
js += 'const ORIG_FRAMES = ' + repr(uniq).replace("'", '"') + ';\n'
js += 'const ORIG_SEQ = ' + str(seq) + ';\n'
js += 'const ORIG_FRAME_MS = 50;\n'
open(out, 'w', encoding='utf8').write(js)
print(len(uniq), 'unique frames,', len(js) // 1024, 'KB')
