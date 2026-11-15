import math, os, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
R='/home/claude/app.lrvdlinden.112heli'
src=Image.open('/home/claude/icons/ec135_big.png'); alpha=src.split()[3]
heli=alpha.crop(alpha.getbbox())  # white silhouette mask
NAVY=(18,23,38); BLUE=(76,107,255); WHITE=(255,255,255); RED=(225,29,72)
F="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def font(s): return ImageFont.truetype(F,s)
def radar_layer(W,H,cx,cy,r,ring=BLUE,sweep=True,bg=None,alpha_ring=120,lw=8):
    im=Image.new("RGBA",(W,H),(bg+(255,)) if bg else (0,0,0,0)); ov=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(ov)
    if sweep:
        d.pieslice([cx-r,cy-r,cx+r,cy+r],-90,-30,fill=ring+(95,))
        a=math.radians(-30); d.line([cx,cy,cx+r*math.cos(a),cy+r*math.sin(a)],fill=ring+(255,),width=max(2,int(lw*1.25)))
    for f in (1,290/420,160/420):
        rr=r*f; d.ellipse([cx-rr,cy-rr,cx+rr,cy+rr],outline=ring+(alpha_ring,),width=lw)
    return Image.alpha_composite(im,ov)
def put(im,width,center,color=WHITE):
    h=heli.resize((width,int(heli.height*width/heli.width)),Image.LANCZOS)
    l=Image.new("RGBA",h.size,color+(255,)); l.putalpha(h)
    im.alpha_composite(l,(int(center[0]-h.width/2),int(center[1]-h.height/2)))
def text(im,s,size,center,color=WHITE):
    d=ImageDraw.Draw(im); f=font(size); bb=d.textbbox((0,0),s,font=f)
    d.text((center[0]-(bb[2]-bb[0])/2-bb[0],center[1]-(bb[3]-bb[1])/2-bb[1]),s,font=f,fill=color)
def badge(im,cx,cy,scale=1.0,color=RED,tcolor=WHITE):
    w,h=300*scale,120*scale
    ImageDraw.Draw(im).rounded_rectangle([cx-w/2,cy-h/2,cx+w/2,cy+h/2],radius=h/2,fill=color); text(im,"112",int(95*scale),(cx,cy),tcolor)
BLUE_IN=(76,107,255); BLUE_OUT=(39,71,232); NAVY2=(30,41,82)
def radial(W,H,c_in,c_out,r=None):
    import numpy as np
    r=r or max(W,H)*0.7; y,x=np.mgrid[0:H,0:W]; t=np.clip(np.hypot(x-W/2,y-H/2)/r,0,1)[...,None]
    arr=(np.array(c_in)*(1-t)+np.array(c_out)*t).astype('uint8'); a=np.full((H,W,1),255,'uint8')
    return Image.fromarray(np.concatenate([arr,a],2),'RGBA')
def rings(W,H,cx,cy,r,color=WHITE,a1=70,a2=40,lw=10):
    o=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(o)
    for f in (1,310/440,180/440):
        rr=r*f; d.ellipse([cx-rr,cy-rr,cx+rr,cy+rr],outline=color+(a1,),width=lw)
    d.line([cx,cy-r,cx,cy+r],fill=color+(a2,),width=max(2,int(lw*0.6))); d.line([cx-r,cy,cx+r,cy],fill=color+(a2,),width=max(2,int(lw*0.6)))
    return o
def shadowed(im,width,center,color=WHITE):
    h=heli.resize((width,int(heli.height*width/heli.width)),Image.LANCZOS)
    b=max(2,width//40); pad=b*4
    m=Image.new("L",(h.width+2*pad,h.height+2*pad),0); m.paste(h.point(lambda v:int(v*0.45)),(pad,pad)); m=m.filter(ImageFilter.GaussianBlur(b))
    sh=Image.new("RGBA",m.size,(0,0,0,255)); sh.putalpha(m)
    x,y=int(center[0]-h.width/2-pad),int(center[1]-h.height/2+width*0.03-pad)
    layer=Image.new("RGBA",im.size,(0,0,0,0)); layer.paste(sh,(x,y)); im.alpha_composite(layer)
    put(im,width,center,color)
def blip(im,cx,cy,r):
    g=Image.new("RGBA",im.size,(0,0,0,0)); ImageDraw.Draw(g).ellipse([cx-r*1.4,cy-r*1.4,cx+r*1.4,cy+r*1.4],fill=RED+(255,))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(r*0.5))); ImageDraw.Draw(im).ellipse([cx-r,cy-r,cx+r,cy+r],fill=RED)
def icon(dark=False):
    im=radial(1024,1024,NAVY2,NAVY) if dark else radial(1024,1024,BLUE_IN,BLUE_OUT,720)
    im.alpha_composite(rings(1024,1024,512,512,440,BLUE_IN if dark else WHITE,150 if dark else 70,90 if dark else 40))
    shadowed(im,720,(512,500)); blip(im,780,270,28); return im
light=icon(); dark=icon(True)
# tinted: grayscale on black (iOS tints it)
tinted=Image.new("RGBA",(1024,1024),(0,0,0,255)); tinted.alpha_composite(rings(1024,1024,512,512,440,WHITE,110,60)); put(tinted,720,(512,500)); ImageDraw.Draw(tinted).ellipse([752,242,808,298],fill=(200,200,200)); tinted=tinted.convert("L").convert("RGB")
A=f'{R}/Heli112/Assets.xcassets'; ai=f'{A}/AppIcon.appiconset'; os.makedirs(ai,exist_ok=True)
light.convert("RGB").save(f'{ai}/AppIcon.png'); dark.convert("RGB").save(f'{ai}/AppIcon-dark.png'); tinted.save(f'{ai}/AppIcon-tinted.png')
images=[{"filename":"AppIcon.png","idiom":"universal","platform":"ios","size":"1024x1024"},
 {"appearances":[{"appearance":"luminosity","value":"dark"}],"filename":"AppIcon-dark.png","idiom":"universal","platform":"ios","size":"1024x1024"},
 {"appearances":[{"appearance":"luminosity","value":"tinted"}],"filename":"AppIcon-tinted.png","idiom":"universal","platform":"ios","size":"1024x1024"}]
# macOS: rounded body 824 on 1024 canvas
mac=Image.new("RGBA",(1024,1024),(0,0,0,0)); body=light.resize((824,824),Image.LANCZOS)
m=Image.new("L",(824,824),0); ImageDraw.Draw(m).rounded_rectangle([0,0,823,823],radius=185,fill=255); body.putalpha(m); mac.alpha_composite(body,(100,100))
for s in (16,32,128,256,512):
    for sc in (1,2):
        px=s*sc; fn=f"mac_{s}@{sc}x.png"; mac.resize((px,px),Image.LANCZOS).save(f'{ai}/{fn}')
        images.append({"filename":fn,"idiom":"mac","scale":f"{sc}x","size":f"{s}x{s}"})
json.dump({"images":images,"info":{"author":"xcode","version":1}},open(f'{ai}/Contents.json','w'),indent=2)
# AppIconDisplay (footer)
for target in ('Heli112','Heli112TV'):
    d=f'{R}/{target}/Assets.xcassets/AppIconDisplay.imageset'; os.makedirs(d,exist_ok=True)
    light.convert("RGB").resize((512,512),Image.LANCZOS).save(f'{d}/AppIconDisplay.png')
    json.dump({"images":[{"filename":"AppIconDisplay.png","idiom":"universal"}],"info":{"author":"xcode","version":1}},open(f'{d}/Contents.json','w'),indent=2)
# White heli for splash/widgets (template)
d=f'{R}/Shared/SharedAssets.xcassets/HeliWhite.imageset'; os.makedirs(d,exist_ok=True)
h=heli.resize((900,int(heli.height*900/heli.width)),Image.LANCZOS); l=Image.new("RGBA",h.size,WHITE+(255,)); l.putalpha(h); l.save(f'{d}/HeliWhite.png')
json.dump({"images":[{"filename":"HeliWhite.png","idiom":"universal"}],"info":{"author":"xcode","version":1},"properties":{"template-rendering-intent":"template"}},open(f'{d}/Contents.json','w'),indent=2)
# tvOS brand assets
TVB='/home/claude/lrvdlinden/p2000-apeldoorn/P2000ApeldoornTV/Assets.xcassets/App Icon & Top Shelf Image.brandassets'
tb=f'{R}/Heli112TV/Assets.xcassets/App Icon & Top Shelf Image.brandassets'
import shutil

def tv_layers(W,H):
    back=radial(W,H,BLUE_IN,BLUE_OUT,int(W*0.7))
    mid=rings(W,H,W//2,H//2,int(H*0.46),WHITE,70,40,max(2,H//110))
    front=Image.new("RGBA",(W,H),(0,0,0,0)); shadowed(front,int(W*0.56),(W//2,int(H*0.5))); blip(front,int(W/2+H*0.30),int(H*0.2),max(4,H//36))
    return back.convert("RGB"),mid,front
for (folder,files) in [("App Icon.imagestack",[("1x",400,240),("2x",800,480)]),("App Icon - App Store.imagestack",[("store",1280,768)])]:
    for tag,W,H in files:
        b,mi,f=tv_layers(W,H)
        suffix = "store" if tag=="store" else tag
        b.save(f'{tb}/{folder}/Back.imagestacklayer/Content.imageset/back-{suffix}.png')
        mi.save(f'{tb}/{folder}/Middle.imagestacklayer/Content.imageset/middle-{suffix}.png')
        f.save(f'{tb}/{folder}/Front.imagestacklayer/Content.imageset/front-{suffix}.png')
def shelf(W,H):
    im=radial(W,H,BLUE_IN,BLUE_OUT,int(W*0.75)); im.alpha_composite(rings(W,H,int(W*0.72),H//2,int(H*0.62),WHITE,60,35,max(3,H//120)))
    shadowed(im,int(H*1.3),(int(W*0.72),int(H*0.5))); blip(im,int(W*0.72+H*0.38),int(H*0.2),max(6,H//40)); text(im,"112Heli",int(H*0.16),(int(W*0.27),int(H*0.44)))
    text(im,"Hulpdiensten live in de lucht",int(H*0.055),(int(W*0.27),int(H*0.6)),(225,232,255)); return im.convert("RGB")
for W,H,fn,folder in [(1920,720,'shelf-1x.png','Top Shelf Image.imageset'),(3840,1440,'shelf-2x.png','Top Shelf Image.imageset'),(2320,720,'wide-1x.png','Top Shelf Image Wide.imageset'),(4640,1440,'wide-2x.png','Top Shelf Image Wide.imageset')]:
    shelf(W,H).save(f'{tb}/{folder}/{fn}')
light.convert("RGB").save('/home/claude/icons/112heli_icon_1024.png')
# website icons
W=f'{R}/website/web'; L=light.convert("RGB")
L.resize((512,512),Image.LANCZOS).save(f'{W}/assets/img/app-icon.png'); L.resize((192,192),Image.LANCZOS).save(f'{W}/assets/img/icon-192.png')
L.resize((180,180),Image.LANCZOS).save(f'{W}/apple-touch-icon.png'); L.resize((32,32),Image.LANCZOS).save(f'{W}/favicon.png')
L.resize((48,48),Image.LANCZOS).save(f'{W}/favicon.ico',sizes=[(16,16),(32,32),(48,48)])
print("ok")
