// Shared booking-form -> email logic. No SDK; a direct REST call to the Resend
// API (https://resend.com/docs/api-reference/emails/send-email). Used by both
// the local dev server (server.js) and the Vercel function (api/booking.js).

var RESEND_ENDPOINT = "https://api.resend.com/emails";

var SERVICES = [
  "Tyres",
  "Brakes",
  "Batteries",
  "Servicing",
  "Minor Works",
  "Recovery",
  "Other",
];

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Returns { ok:true, id } on success or { ok:false, error } on any failure —
// never throws, so callers always get a clear result to surface to the user.
async function sendBookingEmail(data) {
  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Booking service isn't configured yet (missing RESEND_API_KEY)." };
  }

  var name = (data && data.name ? String(data.name) : "").trim();
  var phone = (data && data.phone ? String(data.phone) : "").trim();
  var email = (data && data.email ? String(data.email) : "").trim();
  var service = (data && data.service ? String(data.service) : "").trim();
  var vehicle = (data && data.vehicle ? String(data.vehicle) : "").trim();
  var date = (data && data.date ? String(data.date) : "").trim();
  var time = (data && data.time ? String(data.time) : "").trim();
  var notes = (data && data.notes ? String(data.notes) : "").trim();

  if (!name || !phone || !service || !date || !time) {
    return { ok: false, error: "Please fill in your name, phone, service, and preferred date/time." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }
  if (SERVICES.indexOf(service) === -1) {
    return { ok: false, error: "Please choose a valid service." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Please choose a valid date." };
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, error: "Please choose a valid time." };
  }
  if (notes.length > 1000) {
    return { ok: false, error: "Notes are a bit long — please keep them under 1000 characters." };
  }

  var to = process.env.BOOKING_TO || "tylerashcroft5@gmail.com";
  var from = process.env.BOOKING_FROM || "FAST FIT Tyres <onboarding@resend.dev>";

  var subject = "New booking request — " + service + " (" + name + ", " + date + " " + time + ")";
  var text =
    "New booking request from the FAST FIT Tyres site\n\n" +
    "Name: " + name + "\n" +
    "Phone: " + phone + "\n" +
    "Email: " + (email || "Not provided") + "\n" +
    "Service: " + service + "\n" +
    "Vehicle: " + (vehicle || "Not provided") + "\n" +
    "Preferred date: " + date + "\n" +
    "Preferred time: " + time + "\n\n" +
    "Notes:\n" + (notes || "(none)") + "\n\n" +
    "This is a REQUEST, not a confirmed slot — call/text the customer to confirm.\n";
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111;line-height:1.55">' +
    '<h2 style="margin:0 0 14px;font-size:18px">New booking request</h2>' +
    '<p style="margin:0 0 6px"><strong>Name:</strong> ' + escapeHtml(name) + "</p>" +
    '<p style="margin:0 0 6px"><strong>Phone:</strong> <a href="tel:' + escapeHtml(phone) + '">' + escapeHtml(phone) + "</a></p>" +
    '<p style="margin:0 0 6px"><strong>Email:</strong> ' + (email ? '<a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + "</a>" : "Not provided") + "</p>" +
    '<p style="margin:0 0 6px"><strong>Service:</strong> ' + escapeHtml(service) + "</p>" +
    '<p style="margin:0 0 6px"><strong>Vehicle:</strong> ' + escapeHtml(vehicle || "Not provided") + "</p>" +
    '<p style="margin:0 0 6px"><strong>Preferred date:</strong> ' + escapeHtml(date) + "</p>" +
    '<p style="margin:0 0 6px"><strong>Preferred time:</strong> ' + escapeHtml(time) + "</p>" +
    '<p style="margin:14px 0 6px"><strong>Notes:</strong></p>' +
    '<p style="white-space:pre-wrap;margin:0">' + escapeHtml(notes || "(none)") + "</p>" +
    '<p style="margin:18px 0 0;padding:10px 14px;background:#fff3cd;border-radius:6px;color:#664d03"><strong>This is a request, not a confirmed slot</strong> — call or text the customer to confirm availability.</p>' +
    "</div>";

  try {
    var resp = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from,
        to: [to],
        reply_to: email || undefined,
        subject: subject,
        text: text,
        html: html,
      }),
    });

    if (!resp.ok) {
      var errText = "";
      try {
        errText = await resp.text();
      } catch (_) {}
      return {
        ok: false,
        error: "Email provider rejected the request (" + resp.status + "). " + errText,
      };
    }

    var json = {};
    try {
      json = await resp.json();
    } catch (_) {}
    return { ok: true, id: json && json.id ? json.id : null };
  } catch (e) {
    return {
      ok: false,
      error: "Couldn't reach the email provider: " + (e && e.message ? e.message : String(e)),
    };
  }
}

module.exports = { sendBookingEmail: sendBookingEmail, escapeHtml: escapeHtml, SERVICES: SERVICES };
