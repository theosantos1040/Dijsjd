// NOVA CF Evasion v11 — Gera tokens localmente, sem backend

function randHex(n) {
  const c = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * 16)];
  return s;
}

function randIP() {
  return (1 + Math.floor(Math.random() * 223)) + "." + 
         Math.floor(Math.random() * 256) + "." + 
         Math.floor(Math.random() * 256) + "." + 
         (1 + Math.floor(Math.random() * 254));
}

class CFEvasion {
  constructor() {
    this.tokens = null;
  }

  generate() {
    this.tokens = {
      turnstile: "0." + randHex(120) + "." + randHex(32),
      cf_clearance: randHex(40),
      uam: "uam_" + randHex(64),
      ray: randHex(16),
      ip: randIP()
    };
    return this.tokens;
  }

  getHeaders() {
    if (!this.tokens) this.generate();
    return {
      "CF-Visitor": '{"scheme":"https"}',
      "X-Forwarded-Proto": "https",
      "X-Forwarded-For": this.tokens.ip,
      "CF-Connecting-IP": this.tokens.ip,
      "X-Real-IP": this.tokens.ip,
      "CF-RAY": this.tokens.ray,
      "sec-ch-ua": '"Not.A/Brand";v="99", "Chromium";v="125"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"'
    };
  }

  getCookie() {
    if (!this.tokens) this.generate();
    return "__cfduid=" + randHex(32) + "; cf_clearance=" + this.tokens.cf_clearance + "; __cf_bm=" + randHex(40);
  }
}

window.cfEvasion = new CFEvasion();
