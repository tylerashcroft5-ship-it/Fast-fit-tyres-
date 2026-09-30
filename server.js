// Local dev server: serves the static site AND handles POST /api/booking so the
// booking form can send real email via Resend during development. Zero deps —
// just Node built-ins + global fetch (Node 18+). Run with:
//   node --env-file=.env server.js
var http = require("http");
var fs = require("fs");
var path = require("path");
var send = require("./api/_send");

var ROOT = __dirname;
var PORT = process.env.PORT || 8778;

var MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function serveFile(req, res, filePath, stat) {
  var ext = path.extname(filePath).toLowerCase();
  var type = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size });
  fs.createReadStream(filePath).pipe(res);
}

var server = http.createServer(function (req, res) {
  var urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  // ---- API ----
  if (urlPath === "/api/booking") {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });
    var data = "";
    req.on("data", function (c) {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on("end", async function () {
      var payload = {};
      try {
        payload = JSON.parse(data || "{}");
      } catch (_) {}
      var result = await send.sendBookingEmail(payload);
      json(res, result.ok ? 200 : 400, result);
    });
    return;
  }

  // ---- static ----
  if (urlPath === "/") urlPath = "/index.html";
  var filePath = path.join(ROOT, urlPath);
  if (filePath.indexOf(ROOT) !== 0) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    serveFile(req, res, filePath, stat);
  });
});

server.listen(PORT, function () {
  console.log("FAST FIT Tyres dev server running on http://localhost:" + PORT);
  if (!process.env.RESEND_API_KEY) {
    console.log("[warn] RESEND_API_KEY not set — /api/booking will return a config error until it is.");
  }
});
