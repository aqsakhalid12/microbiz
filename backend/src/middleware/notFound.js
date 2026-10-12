// backend/src/middleware/notFound.js
// Mounted last among routes: any request that matched no route ends up here.
// Unknown /api/* routes get a clean JSON 404 instead of an HTML page.
function notFound(req, res) {
  res.status(404).json({ success: false, message: "Route not found" });
}

module.exports = notFound;
