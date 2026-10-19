// backend/src/controllers/settings.controller.js
// HTTP handlers for /api/settings/* endpoints.
const settingsService = require("../services/settings.service");
const { validateGetSettings, validateUpdateSettings } = require("../validators/settings.validator");

async function getSettings(req, res) {
  validateGetSettings(req.query, req.body);
  const settings = await settingsService.getSettings(req.user.id);
  res.json({ success: true, data: settings });
}

async function updateSettings(req, res) {
  const data = validateUpdateSettings(req.body);
  const settings = await settingsService.updateSettings(req.user.id, data);
  res.json({ success: true, data: settings });
}

module.exports = {
  getSettings,
  updateSettings,
};