'use strict';

let colors = ['#facc15', '#22d3ee', '#2563eb'];
const jobs  = new Map();
let maxParallel = 2;

const colorList       = document.getElementById('colorList');
const addColorBtn     = document.getElementById('addColorBtn');
const gradientStrip   = document.getElementById('gradientStrip');
const durationRange   = document.getElementById('duration');
const durationHint    = document.getElementById('durationHint');
const speedRange      = document.getElementById('speed');
const speedHint       = document.getElementById('speedHint');
const intensityRange  = document.getElementById('intensity');
const intensityHint   = document.getElementById('intensityHint');
const fpsSelect       = document.getElementById('fps');
const frameCount      = document.getElementById('frameCount');
const bgColorInput    = document.getElementById('bgColor');
const bgColorText     = document.getElementById('bgColorText');
const bgColorPreview  = document.getElementById('bgColorPreview');
const generateForm    = document.getElementById('generateForm');
const generateBtn     = document.getElementById('generateBtn');
const jobsGrid        = document.getElementById('jobsGrid');
const jobsCount       = document.getElementById('jobsCount');
const cleanupBtn      = document.getElementById('cleanupBtn');
const statusDot       = document.getElementById('statusDot');
const jobsStatusBar   = document.getElementById('jobsStatusBar');
const jsbRendering    = document.getElementById('jsbRendering');
const jsbQueued       = document.getElementById('jsbQueued');
const heroCanvas      = document.getElementById('heroCanvas');
const effectGrid      = document.getElementById('effectGrid');
const effectDesc      = document.getElementById('effectDesc');
const footerYear      = document.getElementById('footerYear');
const durationNum            = document.getElementById('durationNum');
const countdownEnabled       = document.getElementById('countdownEnabled');
const countdownSettings      = document.getElementById('countdownSettings');
const countdownModePills     = document.getElementById('countdownModePills');
const countdownModeDesc      = document.getElementById('countdownModeDesc');
const countdownDurationRow   = document.getElementById('countdownDurationRow');
const countdownDuration      = document.getElementById('countdownDuration');
const countdownDurationNum   = document.getElementById('countdownDurationNum');
const countdownDurationHint  = document.getElementById('countdownDurationHint');
const countdownColorInput    = document.getElementById('countdownColor');
const countdownColorText     = document.getElementById('countdownColorText');
const countdownColorPreview  = document.getElementById('countdownColorPreview');
const genStatus              = document.getElementById('genStatus');

footerYear.textContent = new Date().getFullYear();

const socket = io();

socket.on('connect', () => {
  statusDot.className = 'status-dot';
});
socket.on('disconnect', () => {
  statusDot.className = 'status-dot offline';
});
socket.on('settings:init', s => { if (s?.maxParallel) maxParallel = s.maxParallel; });
socket.on('jobs:init', list => {
  jobs.clear();
  list.forEach(j => jobs.set(j.id, j));
  renderJobsGrid();
});
socket.on('job:update', job => {
  jobs.set(job.id, job);
  renderJobsGrid();
});
socket.on('job:deleted', id => {
  jobs.delete(id);
  renderJobsGrid();
});

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  const f = c.length === 3 ? c.split('').map(x => x+x).join('') : c;
  return { r: parseInt(f.slice(0,2),16), g: parseInt(f.slice(2,4),16), b: parseInt(f.slice(4,6),16) };
}
function rgba(hex, a) {
  const {r,g,b} = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`;
}
function lerpColor(h1, h2, t) {
  const a=hexToRgb(h1),b=hexToRgb(h2);
  return `rgb(${Math.round(a.r+(b.r-a.r)*t)},${Math.round(a.g+(b.g-a.g)*t)},${Math.round(a.b+(b.b-a.b)*t)})`;
}
function colorAt(cols, t) {
  const n = cols.length;
  const fi = Math.max(0,Math.min(1,t))*(n-1);
  const lo = Math.min(Math.floor(fi),n-2);
  return lerpColor(cols[lo], cols[lo+1], fi-lo);
}

function fxMesh(ctx, t, w, h, cols, intensity=1) {
  const n=cols.length, cx=w/2, cy=h/2, ox=w*0.4, oy=h*0.4;
  const R=Math.min(w,h)*0.72;
  ctx.save(); ctx.globalCompositeOperation='screen';
  cols.forEach((c,i)=>{
    const ph=(i/n)*Math.PI*2;
    const bx=cx+Math.cos(ph+t*(0.26+i*0.08))*ox;
    const by=cy+Math.sin(ph+t*(0.21+i*0.10))*oy;
    const g=ctx.createRadialGradient(bx,by,0,bx,by,R);
    g.addColorStop(0,rgba(c,0.9*intensity));
    g.addColorStop(0.30,rgba(c,0.42*intensity));
    g.addColorStop(0.65,rgba(c,0.10*intensity));
    g.addColorStop(1,rgba(c,0));
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  });
  ctx.restore();
}

function fxAurora(ctx, t, w, h, cols, intensity=1) {
  const n=cols.length;
  ctx.save(); ctx.globalCompositeOperation='screen';
  const cpc=3;
  for(let ci=0;ci<n;ci++){
    for(let c=0;c<cpc;c++){
      const phase=ci*2.09+c*1.13;
      const speed=0.14+c*0.07;
      const horizon=h*(0.3+ci*(0.4/Math.max(n-1,1)));
      const curtH=h*(0.32+0.12*Math.sin(phase));
      const alpha=(0.7-c*0.18)*intensity;
      ctx.beginPath(); ctx.moveTo(-5,h+5);
      const steps=48;
      for(let xi=0;xi<=steps;xi++){
        const x=(xi/steps)*(w+10)-5;
        const nx=xi/steps;
        const y=horizon
          +Math.sin(nx*Math.PI*2.8+t*speed+phase)*curtH*0.28
          +Math.sin(nx*Math.PI*6.1+t*speed*1.6)*curtH*0.10
          +Math.sin(nx*Math.PI*1.4+t*speed*0.5+phase)*curtH*0.18;
        ctx.lineTo(x,y);
      }
      ctx.lineTo(w+5,h+5); ctx.closePath();
      const g=ctx.createLinearGradient(0,horizon-curtH*1.5,0,horizon+curtH*0.6);
      g.addColorStop(0,rgba(cols[ci],0));
      g.addColorStop(0.35,rgba(cols[ci],alpha*0.55));
      g.addColorStop(0.62,rgba(cols[ci],alpha));
      g.addColorStop(0.82,rgba(cols[ci],alpha*0.38));
      g.addColorStop(1,rgba(cols[ci],0.03));
      ctx.fillStyle=g; ctx.fill();
    }
  }
  ctx.restore();
}

function fxVortex(ctx, t, w, h, cols, intensity=1) {
  const cx=w/2, cy=h/2;
  const maxR=Math.sqrt(cx*cx+cy*cy)*1.1;
  const slices=180, rot=t*0.35;

  for(let s=0;s<slices;s++){
    const a1=(s/slices)*Math.PI*2+rot;
    const a2=((s+1)/slices)*Math.PI*2+rot;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,maxR,a1,a2); ctx.closePath();
    ctx.fillStyle=colorAt(cols,(s/slices)%1); ctx.fill();
  }

  ctx.save(); ctx.globalCompositeOperation='screen';
  const numArms=Math.min(cols.length,3);
  for(let arm=0;arm<numArms;arm++){
    const armAngle=(arm/numArms)*Math.PI*2+t*0.35;
    ctx.beginPath();
    for(let i=0;i<=200;i++){
      const r=(i/200)*maxR;
      const theta=armAngle-(r/maxR)*Math.PI*3.5;
      const x=cx+Math.cos(theta)*r, y=cy+Math.sin(theta)*r;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.strokeStyle=rgba(cols[arm%cols.length],0.42*intensity);
    ctx.lineWidth=maxR*0.16; ctx.lineCap='round'; ctx.stroke();
  }
  ctx.restore();

  const cg=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR);
  cg.addColorStop(0,'rgba(0,0,0,0.93)'); cg.addColorStop(0.16,'rgba(0,0,0,0.28)');
  cg.addColorStop(0.52,'rgba(0,0,0,0)'); cg.addColorStop(0.88,'rgba(0,0,0,0.10)');
  cg.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.save(); ctx.globalCompositeOperation='multiply';
  ctx.fillStyle=cg; ctx.fillRect(0,0,w,h); ctx.restore();

  const gw=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(w,h)*0.055*5);
  gw.addColorStop(0,`rgba(255,255,255,${Math.min(1,0.88*intensity)})`);
  gw.addColorStop(0.15,rgba(cols[0],0.65*intensity));
  gw.addColorStop(1,rgba(cols[0],0));
  ctx.save(); ctx.globalCompositeOperation='screen';
  ctx.fillStyle=gw; ctx.fillRect(0,0,w,h); ctx.restore();
}

function fxWave(ctx, t, w, h, cols, intensity=1) {
  const n=cols.length; const numLines=80;
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(let li=0;li<numLines;li++){
    const ny=li/numLines;
    const baseY=ny*h;
    const lc=colorAt(cols,ny);
    const la=(0.12+0.22*Math.pow(Math.sin(ny*Math.PI),0.7))*intensity;
    ctx.beginPath();
    let firstWave = true;
    for(let x=-3;x<=w+3;x+=3){
      const nx=x/w;
      const y=baseY
        +Math.sin(nx*Math.PI*3.1+t*1.1+ny*Math.PI*3)*h*0.045
        +Math.sin(nx*Math.PI*7.3-t*0.75+ny*Math.PI*6)*h*0.018
        +Math.sin(nx*Math.PI*1.7+t*0.45+ny*Math.PI*1.5)*h*0.025;
      if(firstWave){ ctx.moveTo(x,y); firstWave=false; } else ctx.lineTo(x,y);
    }
    const rgb=lc.match(/\d+/g);
    ctx.strokeStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${la})`;
    ctx.lineWidth=1.8+1.2*Math.sin(ny*Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

function fxPlasma(ctx, t, w, h, cols, intensity=1) {
  const imgData=ctx.createImageData(w,h);
  const data=imgData.data;
  const rgb=cols.map(hexToRgb); const n=rgb.length;
  for(let py=0;py<h;py++){
    for(let px=0;px<w;px++){
      const nx=px/w,ny=py/h;
      const v=(Math.sin(nx*8+t)+Math.sin(ny*8+t*1.3)+Math.sin((nx+ny)*5+t*0.8)+Math.sin(Math.sqrt((nx-0.5)**2+(ny-0.5)**2)*12+t*1.1))/4;
      const ct=(v+1)/2;
      const fi=ct*(n-1); const lo=Math.min(Math.floor(fi),n-2); const frac=fi-lo;
      const c1=rgb[lo],c2=rgb[lo+1];
      const idx=(py*w+px)*4;
      data[idx]=Math.min(255,(c1.r+(c2.r-c1.r)*frac)*intensity);
      data[idx+1]=Math.min(255,(c1.g+(c2.g-c1.g)*frac)*intensity);
      data[idx+2]=Math.min(255,(c1.b+(c2.b-c1.b)*frac)*intensity);
      data[idx+3]=255;
    }
  }
  ctx.putImageData(imgData,0,0);
}

function fxNebula(ctx, t, w, h, cols, intensity=1) {
  const n=cols.length;
  ctx.save(); ctx.globalCompositeOperation='screen';

  for(let ci=0;ci<n;ci++){
    const ph=ci*2.094;
    const bx=w*(0.2+0.6*(0.5+0.5*Math.sin(ph+t*0.028)));
    const by=h*(0.2+0.6*(0.5+0.5*Math.cos(ph*0.71+t*0.022)));
    const r=Math.max(w,h)*(0.42+0.08*Math.sin(ph+t*0.035));
    const g=ctx.createRadialGradient(bx,by,0,bx,by,r);
    g.addColorStop(0,rgba(cols[ci],0.20*intensity));
    g.addColorStop(0.5,rgba(cols[ci],0.07*intensity));
    g.addColorStop(1,rgba(cols[ci],0));
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  }

  const numMed=n*3;
  for(let mc=0;mc<numMed;mc++){
    const ci=mc%n; const ph=mc*1.618+ci*0.5;
    const bx=w*(0.08+0.84*(0.5+0.5*Math.sin(ph+t*(0.052+mc*0.004))));
    const by=h*(0.08+0.84*(0.5+0.5*Math.cos(ph*1.31+t*(0.042+mc*0.003))));
    const r=Math.min(w,h)*(0.10+0.07*Math.sin(ph*2+t*0.065));
    const g=ctx.createRadialGradient(bx,by,0,bx,by,r);
    g.addColorStop(0,rgba(cols[ci],0.50*intensity));
    g.addColorStop(0.55,rgba(cols[ci],0.15*intensity));
    g.addColorStop(1,rgba(cols[ci],0));
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  }
  ctx.restore();

  ctx.save(); ctx.globalCompositeOperation='screen';
  const numStars=160, goldenAngle=Math.PI*(3-Math.sqrt(5));
  for(let si=0;si<numStars;si++){
    const sr=Math.sqrt((si+0.5)/numStars)*Math.min(w,h)*0.52;
    const theta=si*goldenAngle;
    const sx=w*0.5+Math.cos(theta)*sr, sy=h*0.5+Math.sin(theta)*sr;
    const ci=si%n;
    const twinkle=0.3+0.7*Math.abs(Math.sin(si*2.718+t*(1.4+(si%4)*0.28)));
    const alpha=twinkle*(si%3===0?0.92:0.52)*intensity;
    const starR=si%5===0?2.2:(si%3===0?1.4:0.85);
    ctx.beginPath(); ctx.arc(sx,sy,starR,0,Math.PI*2);
    ctx.fillStyle=rgba(cols[ci],alpha); ctx.fill();
    if(si%4===0){
      const gr=starR*5.5;
      const glow=ctx.createRadialGradient(sx,sy,0,sx,sy,gr);
      glow.addColorStop(0,rgba(cols[ci],alpha*0.55));
      glow.addColorStop(1,rgba(cols[ci],0));
      ctx.fillStyle=glow; ctx.fillRect(sx-gr,sy-gr,gr*2,gr*2);
    }
  }
  ctx.restore();
}

function fxPulse(ctx, t, w, h, cols, intensity=1) {
  const cx=w/2,cy=h/2;
  const maxR=Math.sqrt(cx*cx+cy*cy)*1.15;
  const n=cols.length; const numR=12; const speed=0.35;
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(let ri=0;ri<numR;ri++){
    const phase=ri/numR;
    const animR=((phase+t*speed)%1)*maxR;
    const life=1-animR/maxR;
    const ci=Math.floor(phase*n)%n;
    const rW=maxR/numR*0.65;
    const g=ctx.createRadialGradient(cx,cy,Math.max(0,animR-rW),cx,cy,animR+rW);
    g.addColorStop(0,rgba(cols[ci],0));
    g.addColorStop(0.5,rgba(cols[ci],life*0.85*intensity));
    g.addColorStop(1,rgba(cols[ci],0));
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  }
  const c0=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR*0.12);
  c0.addColorStop(0,rgba(cols[0],0.75*intensity));
  c0.addColorStop(1,rgba(cols[0],0));
  ctx.fillStyle=c0; ctx.fillRect(0,0,w,h);
  ctx.restore();
}

function fxLava(ctx, t, w, h, cols, intensity=1) {
  const n=cols.length, numBlobs=Math.max(6,n*3);

  const bg=ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,rgba(cols[0],0.08*intensity));
  bg.addColorStop(0.5,rgba(cols[Math.floor(n/2)]??cols[0],0.04*intensity));
  bg.addColorStop(1,rgba(cols[n-1],0.11*intensity));
  ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);

  for(let bi=0;bi<numBlobs;bi++){
    const ci=bi%n;
    const ph1=bi*1.618033, ph2=bi*2.718281, ph3=bi*3.141592;
    const bx=w*(0.15+0.70*(0.5+0.5*Math.sin(ph1+t*(0.09+(bi%5)*0.014))));
    const rawY=Math.sin(ph2+t*(0.07+(bi%7)*0.011));
    const by=h*(0.06+0.88*(0.5+0.48*rawY));
    const baseR=Math.min(w,h)*(0.10+0.06*Math.sin(ph3+t*0.12));
    const rx=baseR*(0.80+0.28*Math.sin(ph1*2+t*0.18));
    const ry=baseR*(1.05+0.48*Math.sin(ph2*1.7+t*0.14));
    ctx.save(); ctx.translate(bx,by); ctx.scale(1,ry/rx);
    ctx.beginPath(); ctx.arc(0,0,rx*1.25,0,Math.PI*2);
    const g=ctx.createRadialGradient(0,0,0,0,0,rx*1.25);
    g.addColorStop(0,rgba(cols[ci],Math.min(1,1.0*intensity)));
    g.addColorStop(0.55,rgba(cols[ci],Math.min(1,0.90*intensity)));
    g.addColorStop(0.85,rgba(cols[ci],Math.min(1,0.40*intensity)));
    g.addColorStop(1,rgba(cols[ci],0));
    ctx.fillStyle=g; ctx.fill();

    const hs=ctx.createRadialGradient(0,-rx*0.18,0,0,0,rx*0.55);
    hs.addColorStop(0,`rgba(255,255,255,${0.22*intensity})`);
    hs.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=hs; ctx.fill();
    ctx.restore();
  }

  const heat=ctx.createLinearGradient(0,h*0.65,0,h);
  heat.addColorStop(0,rgba(cols[0],0));
  heat.addColorStop(1,rgba(cols[0],0.28*intensity));
  ctx.save(); ctx.globalCompositeOperation='screen';
  ctx.fillStyle=heat; ctx.fillRect(0,h*0.65,w,h*0.35); ctx.restore();
}

function fxPrism(ctx, t, w, h, cols, intensity=1) {
  const cx=w/2, cy=h/2;
  const maxR=Math.sqrt(cx*cx+cy*cy)*1.2;
  const n=cols.length, numRays=n*3+2;
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(let ri=0;ri<numRays;ri++){
    const ci=ri%n;
    const baseAngle=(ri/numRays)*Math.PI*2+t*(0.10+(ri%3)*0.035);
    const halfW=(Math.PI/numRays)*(0.28+0.22*Math.abs(Math.sin(ri*1.618+t*0.20)));
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,maxR,baseAngle-halfW,baseAngle+halfW); ctx.closePath();
    const endX=cx+Math.cos(baseAngle)*maxR, endY=cy+Math.sin(baseAngle)*maxR;
    const g=ctx.createLinearGradient(cx,cy,endX,endY);
    g.addColorStop(0,rgba(cols[ci],0.88*intensity));
    g.addColorStop(0.22,rgba(cols[ci],0.55*intensity));
    g.addColorStop(0.60,rgba(cols[ci],0.18*intensity));
    g.addColorStop(1,rgba(cols[ci],0));
    ctx.fillStyle=g; ctx.fill();
  }
  const lens=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(w,h)*0.055*4.5);
  lens.addColorStop(0,`rgba(255,255,255,${Math.min(1,intensity)})`);
  lens.addColorStop(0.12,rgba(cols[0],0.75*intensity));
  lens.addColorStop(0.45,rgba(cols[0],0.18*intensity));
  lens.addColorStop(1,rgba(cols[0],0));
  ctx.fillStyle=lens; ctx.fillRect(0,0,w,h);
  ctx.restore();
}

function fxParticles(ctx, t, w, h, cols, intensity=1) {
  const n=cols.length, numP=65;
  ctx.save(); ctx.globalCompositeOperation='screen';
  for(let pi=0;pi<numP;pi++){
    const ci=pi%n, seed=pi*1.61803;
    const fx=1+(pi%5)*0.38+Math.floor(pi/5)*0.14;
    const fy=1+(pi%7)*0.29+Math.floor(pi/7)*0.11;
    const px=w*0.5+w*0.43*Math.sin(fx*t*0.37+seed);
    const py=h*0.5+h*0.42*Math.sin(fy*t*0.34+seed*1.618);
    const size=Math.min(w,h)*(0.005+0.004*(pi%4));
    const twinkle=0.38+0.62*Math.abs(Math.sin(seed+t*(1.4+pi%3)));
    const alpha=twinkle*intensity;
    const gr=size*5.5;
    const glow=ctx.createRadialGradient(px,py,0,px,py,gr);
    glow.addColorStop(0,rgba(cols[ci],alpha*0.72));
    glow.addColorStop(0.4,rgba(cols[ci],alpha*0.22));
    glow.addColorStop(1,rgba(cols[ci],0));
    ctx.fillStyle=glow; ctx.fillRect(px-gr,py-gr,gr*2,gr*2);
    ctx.beginPath(); ctx.arc(px,py,size,0,Math.PI*2);
    ctx.fillStyle=rgba(cols[ci],Math.min(1,alpha*1.85)); ctx.fill();
  }
  ctx.restore();
}

function fxGalaxy(ctx, t, w, h, cols, intensity=1) {
  const cx=w/2, cy=h/2, maxR=Math.min(w,h)*0.47;
  const n=cols.length, rot=t*0.07;
  ctx.save(); ctx.globalCompositeOperation='screen';

  const dust=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR*1.2);
  dust.addColorStop(0,rgba(cols[0],0.12*intensity));
  dust.addColorStop(0.5,rgba(cols[0],0.05*intensity));
  dust.addColorStop(1,rgba(cols[0],0));
  ctx.fillStyle=dust; ctx.fillRect(0,0,w,h);

  for(let arm=0;arm<2;arm++){
    const armOffset=(arm/2)*Math.PI*2;
    for(let si=0;si<220;si++){
      const frac=si/220, r=maxR*Math.pow(frac,0.62);
      const theta=armOffset+frac*Math.PI*4.2+rot;
      const scatter=maxR*0.045*Math.sqrt(frac)*Math.sin(si*47.3+arm*23.7);
      const pa=theta+Math.PI/2;
      const sx=cx+Math.cos(theta)*r+Math.cos(pa)*scatter;
      const sy=cy+Math.sin(theta)*r+Math.sin(pa)*scatter;
      const ci=Math.min(Math.floor(frac*(n-1)),n-1);
      const brightness=(1-frac*0.42)*intensity;
      const starR=si%4===0?1.8:0.75;
      ctx.beginPath(); ctx.arc(sx,sy,starR,0,Math.PI*2);
      ctx.fillStyle=rgba(cols[ci],brightness*0.90); ctx.fill();
    }
  }

  const goldenAngle=Math.PI*(3-Math.sqrt(5));
  for(let si=0;si<100;si++){
    const sr=maxR*(0.48+0.52*Math.sqrt(si/100));
    const theta=si*goldenAngle+rot*0.22;
    const sx=cx+Math.cos(theta)*sr, sy=cy+Math.sin(theta)*sr;
    ctx.beginPath(); ctx.arc(sx,sy,0.65,0,Math.PI*2);
    ctx.fillStyle=rgba(cols[si%n],0.26*intensity); ctx.fill();
  }

  const cg=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR*0.42);
  cg.addColorStop(0,`rgba(255,255,220,${Math.min(1,0.88*intensity)})`);
  cg.addColorStop(0.12,rgba(cols[0],0.72*intensity));
  cg.addColorStop(0.45,rgba(cols[0],0.18*intensity));
  cg.addColorStop(1,rgba(cols[0],0));
  ctx.fillStyle=cg; ctx.fillRect(0,0,w,h);
  ctx.restore();
}

function fxGlitch(ctx, t, w, h, cols, intensity=1) {
  const n=cols.length, rgb=cols.map(hexToRgb);
  const imgData=ctx.createImageData(w,h), d=imgData.data;
  const frameIdx=Math.floor(t*12);
  const glitchStr=0.5+0.5*Math.abs(Math.sin(t*1.7));
  const maxShift=Math.round(w*0.04*glitchStr);
  for(let py=0;py<h;py++){
    const lineKey=((py*1664525+frameIdx*1013904223)>>>0)%100;
    const thr=Math.round(14*glitchStr);
    const isG=lineKey<thr;
    const ls=isG?Math.round((lineKey/thr-0.5)*maxShift*2):0;
    for(let px=0;px<w;px++){
      const nx=px/w, ny=py/h;
      const v=(Math.sin(nx*7+t*0.9)+Math.sin(ny*5+t*1.1)+Math.sin((nx+ny)*4.5+t*0.7))/3;
      const ct=(v+1)/2, fi=ct*(n-1), lo=Math.min(Math.floor(fi),n-2), frac=fi-lo;
      const rPx=Math.max(0,Math.min(w-1,px-ls-Math.round(maxShift*0.45)));
      const bPx=Math.max(0,Math.min(w-1,px+ls+Math.round(maxShift*0.45)));
      const rnx=rPx/w, bnx=bPx/w;
      const rv=(Math.sin(rnx*7+t*0.9)+Math.sin(ny*5+t*1.1)+Math.sin((rnx+ny)*4.5+t*0.7))/3;
      const rct=(rv+1)/2, rfi=rct*(n-1), rlo=Math.min(Math.floor(rfi),n-2), rfrac=rfi-rlo;
      const bv=(Math.sin(bnx*7+t*0.9)+Math.sin(ny*5+t*1.1)+Math.sin((bnx+ny)*4.5+t*0.7))/3;
      const bct=(bv+1)/2, bfi=bct*(n-1), blo=Math.min(Math.floor(bfi),n-2), bfrac=bfi-blo;
      const idx=(py*w+px)*4;
      const rC1=rgb[rlo],rC2=rgb[Math.min(rlo+1,n-1)];
      const gC1=rgb[lo], gC2=rgb[Math.min(lo+1,n-1)];
      const bC1=rgb[blo],bC2=rgb[Math.min(blo+1,n-1)];
      d[idx]=Math.min(255,(rC1.r+(rC2.r-rC1.r)*rfrac)*intensity);
      d[idx+1]=Math.min(255,(gC1.g+(gC2.g-gC1.g)*frac)*intensity);
      d[idx+2]=Math.min(255,(bC1.b+(bC2.b-bC1.b)*bfrac)*intensity);
      d[idx+3]=255;
      if(py%3===0){ d[idx]*=0.5; d[idx+1]*=0.5; d[idx+2]*=0.5; }
    }
  }
  ctx.putImageData(imgData,0,0);
  ctx.save(); ctx.globalCompositeOperation='screen';
  const numBlocks=2+Math.floor(Math.abs(Math.sin(t*2.1))*4);
  for(let bi=0;bi<numBlocks;bi++){
    const bh=h*(0.008+0.014*((bi*7919+frameIdx*3)%10)/10);
    const by=h*((bi*6271+frameIdx*17)%100)/100;
    const boff=w*(Math.sin(bi*2.718+t*6.3)*0.04);
    ctx.fillStyle=rgba(cols[bi%n],0.14*intensity);
    ctx.fillRect(boff,by,w,bh);
  }
  ctx.restore();
}

const FX = {
  mesh: fxMesh, aurora: fxAurora, vortex: fxVortex, wave: fxWave,
  plasma: fxPlasma, nebula: fxNebula, pulse: fxPulse, lava: fxLava,
  prism: fxPrism, particles: fxParticles, galaxy: fxGalaxy, glitch: fxGlitch,
};

const EFFECT_DESCS = {
  mesh:      'Floating color orbs on Lissajous paths',
  aurora:    'Northern lights curtain waves',
  vortex:    'Spinning color wheel with spiral arms',
  wave:      'Dense neon flowing lines',
  plasma:    'Classic demo-scene plasma field',
  nebula:    'Deep space star field & cloud masses',
  pulse:     'Concentric ripple rings from centre',
  lava:      'Opaque lava-lamp blobs rising & falling',
  prism:     'Rotating light rays from a bright lens',
  particles: 'Glowing orbs on Lissajous paths',
  galaxy:    'Spiral galaxy with arm structure',
  glitch:    'RGB channel split + scanline glitch',
};

let previewT = 0;
let lastRAF  = null;

function startPreviews() {
  if (lastRAF) cancelAnimationFrame(lastRAF);
  let prev = performance.now();

  function loop(now) {
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    previewT += dt;

    const currentEffect = document.querySelector('input[name="effect"]:checked')?.value ?? 'mesh';
    const intensity = parseFloat(intensityRange.value);

    document.querySelectorAll('.effect-canvas').forEach(canvas => {
      const effect = canvas.dataset.effect;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0,0,w,h);

      const isHeavy = (effect === 'plasma' || effect === 'glitch');
      if (isHeavy && effect !== currentEffect) {

        const g = ctx.createLinearGradient(0,0,w,h);
        colors.forEach((c,i) => g.addColorStop(i/Math.max(colors.length-1,1),c));
        ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      } else {
        if (FX[effect]) FX[effect](ctx, previewT * 0.8, w, h, colors, intensity);
      }
    });

    renderHeroCanvas();

    lastRAF = requestAnimationFrame(loop);
  }
  lastRAF = requestAnimationFrame(loop);
}

function renderHeroCanvas() {
  const effect = document.querySelector('input[name="effect"]:checked')?.value ?? 'mesh';
  const w = heroCanvas.width, h = heroCanvas.height;
  if (w === 0 || h === 0) return;
  const ctx = heroCanvas.getContext('2d');
  const intensity = parseFloat(intensityRange.value);
  const bgColor = bgColorInput.value || '#000000';

  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0,0,w,h);

  if (effect !== 'plasma' && effect !== 'glitch' && FX[effect]) {
    FX[effect](ctx, previewT * 0.5, w, h, colors, intensity * 0.7);
  } else {
    const g = ctx.createLinearGradient(0,0,w,h);
    colors.forEach((c,i) => g.addColorStop(i/Math.max(colors.length-1,1),rgba(c,0.15)));
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  }
}

function resizeHeroCanvas() {
  const s = heroCanvas.parentElement;
  heroCanvas.width  = s.offsetWidth;
  heroCanvas.height = s.offsetHeight;
}

window.addEventListener('resize', resizeHeroCanvas);
resizeHeroCanvas();

function renderColors() {
  colorList.innerHTML = '';
  colors.forEach((hex, i) => {
    const item = document.createElement('div');
    item.className = 'color-item';

    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = hex;

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = hex;
    picker.addEventListener('input', e => {
      colors[i] = e.target.value;
      swatch.style.background = e.target.value;
      hexSpan.textContent = e.target.value.toUpperCase();
      updateGradientStrip();
    });
    swatch.appendChild(picker);

    const hexSpan = document.createElement('span');
    hexSpan.className = 'color-hex';
    hexSpan.textContent = hex.toUpperCase();

    const indexSpan = document.createElement('span');
    indexSpan.className = 'color-idx';
    indexSpan.textContent = `Stop ${i + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'color-remove';
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove';
    removeBtn.disabled = colors.length <= 2;
    removeBtn.addEventListener('click', () => {
      if (colors.length > 2) { colors.splice(i,1); renderColors(); updateGradientStrip(); }
    });

    item.appendChild(swatch);
    item.appendChild(hexSpan);
    item.appendChild(indexSpan);
    item.appendChild(removeBtn);
    colorList.appendChild(item);
  });
  updateGradientStrip();
}

function updateGradientStrip() {
  const stops = colors.map((c,i) => `${c} ${(i/(colors.length-1)*100).toFixed(1)}%`).join(',');
  gradientStrip.style.background = `linear-gradient(90deg,${stops})`;
}

addColorBtn.addEventListener('click', () => {
  if (colors.length >= 8) return;
  colors.push('#ffffff');
  renderColors();
});

document.getElementById('presetList').querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => {
    colors = JSON.parse(btn.dataset.colors);
    renderColors();
  });
});

countdownEnabled.addEventListener('change', () => {
  countdownSettings.style.display = countdownEnabled.checked ? 'flex' : 'none';
});

countdownModePills.addEventListener('click', e => {
  const pill = e.target.closest('.cmode-pill');
  if (!pill) return;
  countdownModePills.querySelectorAll('.cmode-pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  const mode = pill.dataset.mode;
  if (mode === 'full') {
    countdownDurationRow.style.display = 'none';
    countdownModeDesc.textContent = 'Counts down from the video start to the very end';
  } else {
    countdownDurationRow.style.display = '';
    countdownModeDesc.textContent = 'Overlay appears only in the final seconds of the video';
  }
});

function onCountdownDurationChange(src) {
  let val = parseInt(src.value, 10);
  if (isNaN(val)) val = 60;
  const maxVal = parseInt(durationRange.value, 10);
  val = Math.max(1, Math.min(maxVal, val));
  countdownDuration.value    = val;
  countdownDurationNum.value = val;
  countdownDurationHint.textContent = fmtSecs(val);
}
countdownDuration.addEventListener('input',     () => onCountdownDurationChange(countdownDuration));
countdownDurationNum.addEventListener('change',  () => onCountdownDurationChange(countdownDurationNum));
countdownDurationNum.addEventListener('input',   () => onCountdownDurationChange(countdownDurationNum));

countdownColorPreview.addEventListener('click', () => countdownColorInput.click());
countdownColorInput.addEventListener('input', () => {
  const v = countdownColorInput.value;
  countdownColorPreview.style.background = v;
  countdownColorText.value = v.toUpperCase();
});
countdownColorText.addEventListener('input', () => {
  const v = countdownColorText.value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) {
    countdownColorInput.value = v;
    countdownColorPreview.style.background = v;
  }
});

bgColorPreview.addEventListener('click', () => bgColorInput.click());

bgColorInput.addEventListener('input', () => {
  const v = bgColorInput.value;
  bgColorPreview.style.background = v;
  bgColorText.value = v;
});

bgColorText.addEventListener('input', () => {
  const v = bgColorText.value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) {
    bgColorInput.value = v;
    bgColorPreview.style.background = v;
  }
});

function fmtSecs(s) {
  if (s < 60)  return `${s} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60), ss = s % 60;
    return ss ? `${m}m ${ss}s` : `${m} min`;
  }
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h} h`;
}

function updateFrameInfo() {
  const dur = parseInt(durationRange.value, 10);
  const fps = parseInt(fpsSelect.value, 10);
  durationHint.textContent = fmtSecs(dur);
  frameCount.textContent = (dur * fps).toLocaleString();
}

speedRange.addEventListener('input', () => {
  speedHint.textContent = `${parseFloat(speedRange.value).toFixed(2)}×`;
});
intensityRange.addEventListener('input', () => {
  intensityHint.textContent = `${parseFloat(intensityRange.value).toFixed(2)}×`;
});
function onDurationChange(src) {
  let val = parseInt(src.value, 10);
  if (isNaN(val)) val = 10;
  val = Math.max(3, Math.min(3600, val));
  durationRange.value = val;
  durationNum.value   = val;
  updateFrameInfo();

  countdownDuration.max    = val;
  countdownDurationNum.max = val;
  if (parseInt(countdownDuration.value, 10) > val) {
    countdownDuration.value    = val;
    countdownDurationNum.value = val;
    countdownDurationHint.textContent = fmtSecs(val);
  }
}
durationRange.addEventListener('input',  () => onDurationChange(durationRange));
durationNum.addEventListener('change',   () => onDurationChange(durationNum));
durationNum.addEventListener('input',    () => onDurationChange(durationNum));
fpsSelect.addEventListener('change', updateFrameInfo);

effectGrid.addEventListener('change', e => {
  if (e.target.name === 'effect') {
    effectDesc.textContent = EFFECT_DESCS[e.target.value] ?? '';
  }
});

generateForm.addEventListener('submit', async e => {
  e.preventDefault();

  const effect = document.querySelector('input[name="effect"]:checked')?.value ?? 'mesh';
  const payload = {
    name:       document.getElementById('name').value.trim() || 'fluid-bg',
    colors,
    effect,
    resolution: document.getElementById('resolution').value,
    fps:        parseInt(fpsSelect.value, 10),
    duration:   parseInt(durationRange.value, 10),
    quality:    document.getElementById('quality').value,
    speed:      parseFloat(speedRange.value),
    intensity:  parseFloat(intensityRange.value),
    bgColor:    bgColorInput.value,
    vignette:   document.getElementById('vignette').checked,
    countdown: countdownEnabled.checked ? {
      enabled:  true,
      duration: parseInt(countdownDuration.value, 10),
      position: countdownModePills.querySelector('.cmode-pill.active')?.dataset.mode ?? 'end',
      label:    document.getElementById('countdownLabelText').value.trim(),
      style:    document.getElementById('countdownStyle').value,
      color:    countdownColorInput.value,
    } : undefined,
  };

  generateBtn.disabled = true;
  generateBtn.querySelector('.btn-label').textContent = 'Queued…';

  try {
    const res  = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? 'Unknown error');
    jobs.set(json.data.id, json.data);
    renderJobsGrid();
  } catch (err) {
    alert('Failed to start: ' + err.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.querySelector('.btn-label').textContent = 'Generate Video';
  }
});

function formatSecs(s) {
  const sec = Math.round(s);
  return sec < 60 ? `${sec}s` : `${Math.floor(sec/60)}m ${sec%60}s`;
}

function renderJobsGrid() {
  const all       = [...jobs.values()].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  const rendering = all.filter(j => j.status === 'processing');
  const queued    = all.filter(j => j.status === 'pending');

  jobsCount.textContent = `${all.length} video${all.length!==1?'s':''}`;

  if (rendering.length > 0 || queued.length > 0) {
    jobsStatusBar.style.display = 'flex';
    jsbRendering.style.display = rendering.length > 0 ? '' : 'none';
    jsbQueued.style.display    = queued.length    > 0 ? '' : 'none';
    jsbRendering.textContent = `● ${rendering.length} rendering`;
    jsbQueued.textContent    = `⏳ ${queued.length} queued`;
  } else {
    jobsStatusBar.style.display = 'none';
  }

  if (rendering.length > 0 || queued.length > 0) {
    const slotsFull = rendering.length >= maxParallel;
    let html = `<span class="gst-slots${slotsFull ? ' full' : ''}">`
      + `↻ ${rendering.length}/${maxParallel} rendering</span>`;
    if (queued.length > 0) {
      html += `<span class="gst-sep">·</span><span class="gst-queue">+${queued.length} queued</span>`;
    }
    genStatus.innerHTML = html;
    genStatus.style.display = 'flex';
  } else {
    genStatus.style.display = 'none';
  }

  jobsGrid.querySelectorAll('.job-card').forEach(card => {
    if (!jobs.has(card.dataset.id)) card.remove();
  });

  all.forEach(job => {
    let card = jobsGrid.querySelector(`[data-id="${job.id}"]`);
    if (!card) {
      card = document.createElement('div');
      card.className = 'job-card';
      card.dataset.id = job.id;
      jobsGrid.insertBefore(card, jobsGrid.firstChild);
    }
    card.className = `job-card${job.status==='processing'?' is-processing':''}${job.status==='failed'?' is-failed':''}`;
    card.innerHTML = jobCardHTML(job);
    card.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
      if (!confirm(`Delete "${job.config.name}"?`)) return;
      await fetch(`/api/jobs/${job.id}`, { method:'DELETE' });
      jobs.delete(job.id);
      card.remove();
      renderJobsGrid();
    });
  });

  const existingEmpty = jobsGrid.querySelector('.jobs-empty');
  if (all.length === 0 && !existingEmpty) {
    jobsGrid.innerHTML = `
      <div class="jobs-empty">
        <div class="empty-icon">▶</div>
        <p>No videos yet — configure and hit <strong>Generate</strong>.</p>
      </div>`;
  } else if (all.length > 0 && existingEmpty) {
    existingEmpty.remove();
  }
}

function jobCardHTML(job) {
  const pct = Math.round(job.progress * 100);
  const cfg = job.config;

  let queuePos = 0;
  if (job.status === 'pending') {
    const pendingSorted = [...jobs.values()]
      .filter(j => j.status === 'pending')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    queuePos = pendingSorted.findIndex(j => j.id === job.id) + 1;
  }

  const statusLabel = {
    pending:    queuePos > 0 ? `Queue #${queuePos}` : 'Queued',
    processing: 'Rendering',
    completed:  'Done',
    failed:     'Failed',
  }[job.status];

  const dots = cfg.colors.map(c=>`<span class="job-color-dot" style="background:${c}" title="${c}"></span>`).join('');
  const durStr = cfg.duration >= 60
    ? (cfg.duration % 60 ? `${Math.floor(cfg.duration/60)}m${cfg.duration%60}s` : `${cfg.duration/60}m`)
    : `${cfg.duration}s`;
  const tags = [cfg.resolution, `${cfg.fps}fps`, durStr, cfg.effect]
    .map(t=>`<span class="job-tag">${t}</span>`).join('');

  const prog = (job.status==='processing'||job.status==='pending')
    ? `<div class="job-prog"><div class="job-prog-fill" style="width:${pct}%"></div></div>` : '';

  const actions = job.status==='completed'
    ? `<a class="btn-dl" href="/api/download/${job.id}" download>↓ Download</a>
       <button class="btn-del" data-action="delete" title="Delete">🗑</button>`
    : job.status==='failed'
    ? `<button class="btn-del" style="flex:1;width:auto;padding:0 12px" data-action="delete">Remove</button>`
    : '';

  const err = job.error ? `<div class="job-error">${esc(job.error)}</div>` : '';

  return `
    <div class="job-card-top">
      <span class="job-name" title="${esc(cfg.name)}">${esc(cfg.name)}</span>
      <span class="job-status ${job.status}"><span class="status-dot-sm"></span>${statusLabel}</span>
    </div>
    <div class="job-meta">${tags}<span class="job-colors">${dots}</span></div>
    ${prog}${err}
    ${actions ? `<div class="job-actions">${actions}</div>` : ''}`;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

cleanupBtn.addEventListener('click', async () => {
  if (!confirm('Remove completed/failed videos older than 5 minutes?')) return;
  const res  = await fetch('/api/cleanup', { method:'DELETE' });
  const json = await res.json();
  const { removed, skipped } = json.data ?? {};
  if (skipped > 0) {
    alert(`Removed ${removed} video${removed !== 1 ? 's' : ''}. ${skipped} video${skipped !== 1 ? 's are' : ' is'} less than 5 minutes old and were kept.`);
  }
  const r = await fetch('/api/jobs');
  const d = await r.json();
  jobs.clear();
  d.data.forEach(j => jobs.set(j.id, j));
  renderJobsGrid();
});

document.querySelectorAll('.cnav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.cnav-link').forEach(l=>l.classList.remove('active'));
    link.classList.add('active');
    const target = document.querySelector(link.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
  });
});

renderColors();
updateFrameInfo();
startPreviews();
renderJobsGrid();
