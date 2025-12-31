addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const CONFIG = { 
  KV_TTL: 3600,        
  TOKEN_TTL: 600       
}

async function checkRateLimit(ip) {
  const limitKey = `limit:${ip}`;
  const current = await MOVE_CAR_STATUS.get(limitKey);
  const count = current ? parseInt(current) : 0;
  if (count >= 5) return false; 
  await MOVE_CAR_STATUS.put(limitKey, (count + 1).toString(), { expirationTtl: 3600 });
  return true;
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const userAgent = request.headers.get("user-agent") || "";
  const ip = request.headers.get("cf-connecting-ip");

  // 1. 基础安全过滤 (反爬)
  const botPattern = /bot|spider|crawler|python|go-http-client|axios|curl/i;
  if (!userAgent || userAgent.length < 20 || botPattern.test(userAgent)) {
    return new Response("Forbidden", { status: 403 });
  }

  const SEC_PATH = typeof SECRET_PATH !== 'undefined' ? SECRET_PATH : 'notify';

  // 2. 路由分发
  if (path === `/api/${SEC_PATH}` && method === 'POST') {
    // 接口校验
    if (request.headers.get("X-Requested-With") !== "XMLHttpRequest") return new Response("Invalid Request", { status: 403 });
    if (!(await checkRateLimit(ip))) return new Response("Too many requests", { status: 429 });
    return handleNotify(request, url);
  }

  if (path === '/owner-confirm') {
    const token = url.searchParams.get('t');
    const validToken = await MOVE_CAR_STATUS.get('current_nonce');
    if (!token || token !== validToken) return new Response("凭证失效或已过期", { status: 403 });
    return renderOwnerPage();
  }

  if (path === '/api/owner-confirm' && method === 'POST') {
    const token = url.searchParams.get('t');
    const validToken = await MOVE_CAR_STATUS.get('current_nonce');
    if (!token || token !== validToken) return new Response("Forbidden", { status: 403 });
    return handleOwnerConfirmAction(request);
  }

  if (path === '/api/get-location') return handleGetLocation();
  if (path === '/api/check-status') return handleCheckStatus();

  return renderMainPage(url.origin, SEC_PATH);
} // <--- 这里之前漏掉了闭合括号

// --- 核心逻辑 ---

async function handleNotify(request, url) {
  try {
    const body = await request.json();
    const nonce = Math.random().toString(36).substring(2, 15);
    await MOVE_CAR_STATUS.put('current_nonce', nonce, { expirationTtl: CONFIG.TOKEN_TTL });

    const confirmUrl = encodeURIComponent(`${url.origin}/owner-confirm?t=${nonce}`);
    let notifyBody = '🚗 挪车请求';
    if (body.message) notifyBody += `\\n💬 留言: ${body.message}`;

    if (body.location && body.location.lat) {
      const urls = generateMapUrls(body.location.lat, body.location.lng);
      notifyBody += '\\n📍 已附带位置信息，点击跳转确认';
      await MOVE_CAR_STATUS.put('requester_location', JSON.stringify({ ...urls }), { expirationTtl: CONFIG.KV_TTL });
    }

    await MOVE_CAR_STATUS.put('notify_status', 'waiting', { expirationTtl: 600 });
    
    if (body.delayed) {
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

    const barkApiUrl = `${BARK_URL}/${encodeURIComponent('挪车提醒')}/${encodeURIComponent(notifyBody)}?group=MoveCar&level=critical&sound=minuet&url=${confirmUrl}`;
    await fetch(barkApiUrl); 

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false }), { status: 500 });
  }
}

// 坐标转换算法 (WGS-84 转 GCJ-02)
function wgs84ToGcj02(lat, lng) {
  const a = 6378245.0; const ee = 0.00669342162296594323;
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return { lat, lng };
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radLat); magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}
function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  return ret;
}
function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  return ret;
}
function generateMapUrls(lat, lng) {
  const gcj = wgs84ToGcj02(lat, lng);
  return { amapUrl: `https://uri.amap.com/marker?position=${gcj.lng},${gcj.lat}&name=位置`, appleUrl: `https://maps.apple.com/?ll=${gcj.lat},${gcj.lng}&q=位置` };
}

async function handleGetLocation() {
  const data = await MOVE_CAR_STATUS.get('requester_location');
  return new Response(data || JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } });
}

async function handleCheckStatus() {
  const status = await MOVE_CAR_STATUS.get('notify_status');
  const ownerLocation = await MOVE_CAR_STATUS.get('owner_location');
  return new Response(JSON.stringify({ status: status || 'waiting', ownerLocation: ownerLocation ? JSON.parse(ownerLocation) : null }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleOwnerConfirmAction(request) {
  const body = await request.json();
  if (body.location) {
    const urls = generateMapUrls(body.location.lat, body.location.lng);
    await MOVE_CAR_STATUS.put('owner_location', JSON.stringify({ ...urls, timestamp: Date.now() }), { expirationTtl: CONFIG.KV_TTL });
  }
  await MOVE_CAR_STATUS.put('notify_status', 'confirmed', { expirationTtl: 600 });
  return new Response(JSON.stringify({ success: true }));
}

// --- UI 部分 ---

function renderMainPage(origin, secPath) {
  const phone = typeof PHONE_NUMBER !== 'undefined' ? PHONE_NUMBER : '';
  return new Response(`
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>通知车主挪车</title>
    <style>
      :root { --sat: env(safe-area-inset-top, 0px); --sab: env(safe-area-inset-bottom, 0px); --primary: #0093E9; --secondary: #80D0C7; }
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
      body { font-family: -apple-system, sans-serif; background: linear-gradient(160deg, var(--primary) 0%, var(--secondary) 100%); min-height: 100vh; padding: 20px; padding-top: calc(20px + var(--sat)); display: flex; justify-content: center; }
      .container { width: 100%; max-width: 500px; display: flex; flex-direction: column; gap: 16px; }
      .card { background: rgba(255, 255, 255, 0.95); border-radius: 24px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
      .header { text-align: center; }
      .icon-wrap { width: 80px; height: 80px; background: linear-gradient(135deg, var(--primary), var(--secondary)); border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 40px; color: white; box-shadow: 0 8px 20px rgba(0,147,233,0.3); }
      .input-card textarea { width: 100%; min-height: 100px; border: none; outline: none; font-size: 16px; resize: none; background: transparent; }
      .tags { display: flex; gap: 8px; margin-top: 12px; overflow-x: auto; padding-bottom: 5px; scrollbar-width: none; }
      .tag { background: #f1f5f9; color: #475569; padding: 8px 12px; border-radius: 12px; font-size: 13px; white-space: nowrap; cursor: pointer; border: 1px solid #e2e8f0; }
      .loc-card { display: flex; align-items: center; gap: 12px; cursor: pointer; }
      .loc-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
      .loc-icon.loading { background: #fff3cd; animation: pulse 1.5s infinite; }
      .loc-icon.success { background: #d4edda; }
      .btn-main { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; border: none; padding: 18px; border-radius: 18px; font-size: 18px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 20px rgba(0,147,233,0.3); width: 100%; }
      .btn-main:disabled { filter: grayscale(1); cursor: not-allowed; opacity: 0.7; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    </style>
  </head>
  <body>
    <div id="locationTipModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:999;">
      <div style="background:white;padding:32px;border-radius:24px;max-width:320px;text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">📍</div>
        <h2 style="margin-bottom:8px;">位置信息说明</h2>
        <p style="font-size:14px;color:#666;margin-bottom:24px;">分享位置让车主确认您在车旁<br>不分享将延迟30秒发送通知</p>
        <button onclick="document.getElementById('locationTipModal').style.display='none';requestLocation()" style="width:100%;padding:14px;background:var(--primary);color:white;border:none;border-radius:12px;font-weight:600;">我知道了</button>
      </div>
    </div>
    <div class="container" id="mainView">
      <div class="card header"><div class="icon-wrap">🚗</div><h1>呼叫车主挪车</h1><p>Notify Car Owner</p></div>
      <div class="card input-card">
        <textarea id="msgInput" placeholder="留言给车主..."></textarea>
        <div style="display:none;"><input type="text" id="hp" tabindex="-1"></div>
        <div class="tags">
          <span class="tag" onclick="document.getElementById('msgInput').value='挡住路了'">🚧 挡路</span>
          <span class="tag" onclick="document.getElementById('msgInput').value='联系不上您'">📞 没接</span>
          <span class="tag" onclick="document.getElementById('msgInput').value='急需出门'">🙏 加急</span>
        </div>
      </div>
      <div class="card loc-card" onclick="requestLocation()">
        <div id="locIcon" class="loc-icon loading">📍</div>
        <div class="loc-content"><div style="font-weight:600;">我的位置</div><div id="locStatus" style="font-size:13px;color:#666;">正在定位...</div></div>
      </div>
      <button id="notifyBtn" class="btn-main" onclick="sendNotify()">🔔 一键通知车主</button>
    </div>
    <div class="container" id="successView" style="display:none">
      <div class="card" style="text-align:center;"><div class="icon-wrap" style="background:#f0fdf4;color:#22c55e;">✅</div><h2>通知已发出</h2><p id="statusTxt" style="margin-top:8px;">等待车主回应...</p></div>
      <a href="tel:${phone}" class="btn-main" style="text-align:center;text-decoration:none;background:#ef4444;">📞 直接打电话</a>
    </div>
    <script>
      let userLocation = null;
      let loadTime = Date.now();
      function requestLocation() {
        navigator.geolocation.getCurrentPosition(p => {
          userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
          document.getElementById('locIcon').className = 'loc-icon success';
          document.getElementById('locStatus').innerText = '已获取位置 ✓';
        }, () => { document.getElementById('locStatus').innerText = '定位未开启'; }, { timeout: 10000 });
      }
      async function sendNotify() {
        if (Date.now() - loadTime < 2000 || document.getElementById('hp').value) return;
        const btn = document.getElementById('notifyBtn');
        btn.disabled = true; btn.innerText = "🚀 发送中...";
        const res = await fetch("/api/${secPath}", {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ message: document.getElementById('msgInput').value, location: userLocation, delayed: !userLocation })
        });
        if (res.ok) {
          document.getElementById('mainView').style.display = 'none';
          document.getElementById('successView').style.display = 'block';
          setInterval(async () => {
             const sRes = await fetch('/api/check-status');
             const data = await sRes.json();
             if (data.status === 'confirmed') document.getElementById('statusTxt').innerHTML = "<b style='color:#22c55e'>🎉 车主已确认，正在赶来！</b>";
          }, 3000);
        } else { btn.disabled = false; btn.innerText = "🔔 重试发送"; }
      }
    </script>
  </body></html>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

function renderOwnerPage() {
  return new Response(`
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>确认挪车</title>
    <style>
      :root { --primary: #0093E9; --secondary: #80D0C7; }
      body { font-family: -apple-system, sans-serif; background: #f8fafc; display: flex; justify-content: center; padding: 20px; }
      .container { width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 16px; }
      .card { background: white; border-radius: 24px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
      .icon-wrap { width: 70px; height: 70px; background: linear-gradient(135deg, var(--primary), var(--secondary)); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 36px; }
      .map-links { display: flex; gap: 10px; margin-top: 12px; }
      .map-btn { flex: 1; padding: 12px; border-radius: 12px; text-decoration: none; text-align: center; font-weight: 600; color: white; font-size: 14px; }
      .amap { background: #1890ff; } .apple { background: #1d1d1f; }
      .btn-main { width: 100%; background: #22c55e; color: white; border: none; padding: 18px; border-radius: 16px; font-size: 18px; font-weight: 700; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card" style="text-align:center;"><div class="icon-wrap">👋</div><h1>收到挪车请求</h1><p style="color:#666;">对方正在车旁等待</p></div>
      <div id="locCard" class="card" style="display:none;">
        <h3 style="margin-bottom:10px;">📍 对方位置</h3>
        <div class="map-links">
          <a id="amap" href="#" class="map-btn amap" target="_blank">🗺️ 高德地图</a>
          <a id="apple" href="#" class="map-btn apple" target="_blank">🍎 Apple Maps</a>
        </div>
      </div>
      <button id="confirmBtn" class="btn-main" onclick="confirm()">🚀 我已知晓，正在前往</button>
      <div id="done" class="card" style="display:none;text-align:center;background:#f0fdf4;"><p style="color:#166534;font-weight:600;">✅ 已通知对方！</p></div>
    </div>
    <script>
      window.onload = async () => {
        const res = await fetch('/api/get-location');
        if (res.ok) {
          const data = await res.json();
          if (data.amapUrl) {
            document.getElementById('locCard').style.display = 'block';
            document.getElementById('amap').href = data.amapUrl;
            document.getElementById('apple').href = data.appleUrl;
          }
        }
      };
      async function confirm() {
        const t = new URLSearchParams(window.location.search).get('t');
        navigator.geolocation.getCurrentPosition(async p => {
          await fetch('/api/owner-confirm?t=' + t, { method: 'POST', body: JSON.stringify({ location: { lat: p.coords.latitude, lng: p.coords.longitude } }) });
          showDone();
        }, async () => {
          await fetch('/api/owner-confirm?t=' + t, { method: 'POST', body: JSON.stringify({ location: null }) });
          showDone();
        });
      }
      function showDone() {
        document.getElementById('confirmBtn').style.display = 'none';
        document.getElementById('done').style.display = 'block';
      }
    </script>
  </body></html>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}
