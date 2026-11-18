"""
scripts/qr/check-branded-qr.py — checks that the Ledger Chat QR design (lib/chat/brandedQr.ts)
still scans: the same geometry (dots of radius 0.42, rounded eyes, a logo disc of 24 % of the
width, quiet zone 3), encoded at error correction H, decoded with OpenCV's WeChat (ZXing-based)
detector at 1x, 0.4x and 0.22x with a slight blur, on random profile links.

    python3 scripts/qr/check-branded-qr.py      # needs opencv-contrib-python and rsvg-convert
"""
import cv2, numpy as np, subprocess, math, random, string, os, tempfile
TMP = tempfile.mkdtemp(prefix='hl-qr-')
LOGO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'worldmap.png')
wc=cv2.wechat_qrcode_WeChatQRCode()
def enc(text):
    p=cv2.QRCodeEncoder.Params(); p.correction_level=cv2.QRCODE_ENCODER_CORRECT_LEVEL_H
    img=cv2.QRCodeEncoder.create(p).encode(text); return (img[2:-2,2:-2]<128).astype(int)
def svg(m, frac, dot=0.42, Q=3):
    N=m.shape[0]
    def fin(r,c): return (r<7 and c<7) or (r<7 and c>=N-7) or (r>=N-7 and c<7)
    L=int(math.ceil(N*frac)); L+=(L%2)!=(N%2); cx=cy=N/2; R=L/2+0.55; S=N+2*Q
    o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S*16}" height="{S*16}"><rect width="{S}" height="{S}" fill="#fff"/><g transform="translate({Q},{Q})" fill="#15171C">']
    for r in range(N):
        for c in range(N):
            if m[r,c] and not fin(r,c) and math.hypot(c+0.5-cx,r+0.5-cy)>=R: o.append(f'<circle cx="{c+0.5}" cy="{r+0.5}" r="{dot}"/>')
    for x,y in [(0,0),(N-7,0),(0,N-7)]:
        o.append(f'<path fill-rule="evenodd" d="M{x+2.4} {y}H{x+4.6}A2.4 2.4 0 0 1 {x+7} {y+2.4}V{y+4.6}A2.4 2.4 0 0 1 {x+4.6} {y+7}H{x+2.4}A2.4 2.4 0 0 1 {x} {y+4.6}V{y+2.4}A2.4 2.4 0 0 1 {x+2.4} {y}ZM{x+2.6} {y+1}H{x+4.4}A1.6 1.6 0 0 1 {x+6} {y+2.6}V{y+4.4}A1.6 1.6 0 0 1 {x+4.4} {y+6}H{x+2.6}A1.6 1.6 0 0 1 {x+1} {y+4.4}V{y+2.6}A1.6 1.6 0 0 1 {x+2.6} {y+1}Z"/><rect x="{x+2}" y="{y+2}" width="3" height="3" rx="1.05"/>')
    o.append(f'<circle cx="{cx}" cy="{cy}" r="{L/2}" fill="#fff" stroke="#E4E7EC" stroke-width="0.15"/><image href="{LOGO}" x="{cx-L*0.45}" y="{cy-L*0.45}" width="{L*0.9}" height="{L*0.9}"/></g></svg>')
    return ''.join(o)
def test(text, frac):
    open(os.path.join(TMP,'t.svg'),'w').write(svg(enc(text),frac)); subprocess.run(['rsvg-convert',os.path.join(TMP,'t.svg'),'-o',os.path.join(TMP,'t.png')],check=True)
    im=cv2.imread(os.path.join(TMP,'t.png')); r=[]
    for sc in [1,0.4,0.22]:
        s=cv2.resize(im,None,fx=sc,fy=sc,interpolation=cv2.INTER_AREA); r.append(int(text in wc.detectAndDecode(cv2.GaussianBlur(s,(3,3),0.8))[0]))
    return r
if __name__=='__main__':
    random.seed(1)
    toks=[''.join(random.choice(string.ascii_letters+string.digits+'_-') for _ in range(22)) for _ in range(12)]
    for frac in [0.24]:
        res=[test(f'https://ledgerchat.org/u#{t}',frac) for t in toks]
        print(frac, sum(sum(x) for x in res), '/', 3*len(res))
