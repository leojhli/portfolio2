from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
atlas=Image.new('RGBA',(1024,2048),(0,0,0,0))
font='C:/Windows/Fonts/msyhbd.ttc'
small=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',28)
entries=[('雨巷','RAIN DISTRICT','#96ecda'),('修理所','REPAIR / 021','#efbd7a'),('留声档案','SIGNAL ARCHIVE','#8ce0d2'),('夜茶','TEA AFTER HOURS','#ffc5a0'),('末班车','LAST TRAM / 00:40','#92c6d5'),('慢行','SLOW / LOCAL ACCESS','#bacdc7'),('巷口','LANE 07','#eeac85'),('收音机','RADIO REPAIR','#9adecc')]
for i,(han,eng,color) in enumerate(entries):
    x=(i%2)*512;y=(i//2)*512
    draw=ImageDraw.Draw(atlas)
    draw.rounded_rectangle((x+4,y+4,x+508,y+508),radius=3,fill='#102125',outline='#4b6261',width=5)
    size=150 if len(han)<=2 else 105
    f=ImageFont.truetype(font,size)
    bbox=draw.textbbox((0,0),han,font=f)
    draw.text((x+256-(bbox[2]-bbox[0])/2,y+210-(bbox[3]-bbox[1])/2-bbox[1]),han,font=f,fill=color)
    bbox=draw.textbbox((0,0),eng,font=small)
    draw.text((x+256-(bbox[2]-bbox[0])/2,y+350),eng,font=small,fill=color)
    draw.line((x+44,y+410,x+468,y+410),fill=color,width=2)
    draw.text((x+44,y+440),'SH / 31.23 N',font=small,fill='#78918e')
atlas.save('public/models/neon-district/signs/atlas.png',optimize=True)
print('sign atlas written')
