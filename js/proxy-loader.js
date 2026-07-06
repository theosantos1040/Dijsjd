// NOVA Proxy Loader v11 — Carrega proxies diretamente das APIs no browser
// Sem backend, 100% cliente, via fetch CORS

const PROXY_APIS = {
  proxyscrape: "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text",
  geonode: "https://proxylist.geonode.com/api/proxy-list?limit=500&sort_by=responseTime&sort_type=asc",
  proxifly: "https://api.proxifly.dev/get-proxy"
};

function isValidProxy(str) {
  if (!str || typeof str !== "string") return false;
  try {
    const url = new URL(str.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && url.port && url.port !== "0";
  } catch {
    return false;
  }
}

class ProxyLoader {
  constructor() {
    this.proxies = [];
    this.fingerprints = {};
  }

  async loadAll() {
    const results = { proxyscrape: [], geonode: [], proxifly: [], errors: [] };
    
    // ProxyScrape
    try {
      const c = new AbortController();
      setTimeout(function() { c.abort(); }, 10000);
      const r = await fetch(PROXY_APIS.proxyscrape, { signal: c.signal, mode: "cors" });
      const text = await r.text();
      results.proxyscrape = text.split("\n")
        .map(function(l) { return l.trim(); })
        .filter(function(l) { return l && l.includes("://"); })
        .filter(isValidProxy);
      this.fingerprints.proxyscrape = { status: "ONLINE", count: results.proxyscrape.length, format: "protocol://ip:port" };
    } catch (e) {
      results.errors.push("proxyscrape: " + e.message);
      this.fingerprints.proxyscrape = { status: "OFFLINE", error: e.message };
    }
    
    // GeoNode
    try {
      const c = new AbortController();
      setTimeout(function() { c.abort(); }, 10000);
      const r = await fetch(PROXY_APIS.geonode, { signal: c.signal, mode: "cors" });
      const d = await r.json();
      if (d.data && Array.isArray(d.data)) {
        for (let i = 0; i < d.data.length; i++) {
          const p = d.data[i];
          const proto = Array.isArray(p.protocols) ? p.protocols[0] : "http";
          if (p.ip && p.port) {
            const url = proto + "://" + p.ip + ":" + p.port;
            if (isValidProxy(url)) results.geonode.push(url);
          }
        }
      }
      this.fingerprints.geonode = { status: "ONLINE", count: results.geonode.length, format: "JSON {data:[{ip,port,protocols}]}" };
    } catch (e) {
      results.errors.push("geonode: " + e.message);
      this.fingerprints.geonode = { status: "OFFLINE", error: e.message };
    }
    
    // Proxifly
    try {
      const c = new AbortController();
      setTimeout(function() { c.abort(); }, 10000);
      const r = await fetch(PROXY_APIS.proxifly, { signal: c.signal, mode: "cors" });
      const d = await r.json();
      const entries = Array.isArray(d) ? d : [d];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (e && typeof e === "object") {
          const ip = e.ip || (e.proxy ? e.proxy.split(":")[0] : "");
          const port = e.port || (e.proxy ? e.proxy.split(":")[1] : "");
          const proto = e.protocol || "http";
          if (ip && port) {
            const url = proto + "://" + ip + ":" + port;
            if (isValidProxy(url)) results.proxifly.push(url);
          }
        }
      }
      this.fingerprints.proxifly = { status: "ONLINE", count: results.proxifly.length, format: "JSON {ip,port,protocol}" };
    } catch (e) {
      results.errors.push("proxifly: " + e.message);
      this.fingerprints.proxifly = { status: "OFFLINE", error: e.message };
    }
    
    this.proxies = [...new Set([...results.proxyscrape, ...results.geonode, ...results.proxifly])];
    return {
      total: this.proxies.length,
      proxies: this.proxies,
      sources: {
        proxyscrape: results.proxyscrape.length,
        geonode: results.geonode.length,
        proxifly: results.proxifly.length
      },
      errors: results.errors
    };
  }

  getRandomProxy() {
    if (this.proxies.length === 0) return null;
    return this.proxies[Math.floor(Math.random() * this.proxies.length)];
  }
}

window.proxyLoader = new ProxyLoader();
