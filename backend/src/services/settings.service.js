// backend/src/services/settings.service.js
// Business logic for business settings.
const settingsRepository = require("../repositories/settings.repository");
const AppError = require("../utils/AppError");

async function getSettings(userId) {
  let settings = await settingsRepository.findByUserId(userId);
  if (!settings) {
    // Create default row if missing
    settings = await settingsRepository.create(userId, {
      business_name: "My Business",
      email: null,
      phone: null,
      address: null,
      currency_code: "USD",
      default_low_stock_threshold: 5,
    });
  }
  return settings;
}

async function updateSettings(userId, data) {
  const settings = await settingsRepository.upsert(userId, data);
  if (!settings) {
    throw new AppError("Settings not found", 404);
  }
  return settings;
}

module.exports = {
  getSettings,
  updateSettings,
};