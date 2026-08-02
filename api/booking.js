// Vercel serverless function for production (POST /api/booking).
// Local dev is handled by server.js, which reuses the same _send logic.
var send = require("./_send");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  var body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch (_) {
      body = {};
    }
  }

  var result = await send.sendBookingEmail(body || {});
  res.statusCode = result.ok ? 200 : 400;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(result));
};
