// frontend/pages/dashboard.js
import { api } from "/js/api/client.js";
import { renderEmptyState, escapeHtml } from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";

// Initialize the app shell (sidebar/topbar) first.
initSidebar();

// Stat card definitions — each card gets a data-accent class for its accent color.
// Colors: sales=green, expenses=red/orange, profit=indigo, orders=blue,
//         pending=amber, low-stock=rose
const STAT_CARDS = [
  { id: "total-sales", label: "Total sales", caption: "This month", icon: "bi-cash-coin" },
  { id: "total-expenses", label: "Total expenses", caption: "This month", icon: "bi-wallet" },
  { id: "estimated-profit", label: "Estimated profit", caption: "This month", icon: "bi-graph-up-arrow" },
  { id: "total-orders", label: "Total orders", caption: "All time", icon: "bi-cart" },
  { id: "pending-orders", label: "Pending orders", caption: "Needs attention", icon: "bi-clock-history", warn: true },
  { id: "low-stock", label: "Low-stock items", caption: "Needs attention", icon: "bi-exclamation-triangle", danger: true },
];

function renderStatCards() {
  const container = document.getElementById("stat-cards");
  if (!container) return;
  container.innerHTML = STAT_CARDS.map((card) => `
    <div class="stat-cell">
      <div class="stat-label-row"><i class="bi ${card.icon}"></i><span>${escapeHtml(card.label)}</span></div>
      <p class="stat-value ${card.danger ? "danger" : card.warn ? "warn" : ""}" id="${card.id}">—</p>
      <div class="stat-caption">${escapeHtml(card.caption)}</div>
    </div>
  `).join("");
}

/**
 * Initialize the dashboard: render stat cards and placeholder panels,
 * then fetch the user profile for the greeting.
 */
async function init() {
  renderStatCards();

  renderEmptyState(document.getElementById("sales-chart-empty"), {
    icon: "bi-bar-chart-line",
    title: "",
    text: "Charts will appear here once you have completed orders.",
  });

  renderEmptyState(document.getElementById("low-stock-empty"), {
    icon: "bi-exclamation-triangle",
    title: "",
    text: "Low-stock alerts will appear here once you have products below their threshold.",
  });

  // Fetch user data for the greeting.
  try {
    const data = await api.get("/api/auth/me");
    const user = data.user || {};
const firstName = user.full_name ? user.full_name.split(" ")[0] : "";
const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
document.getElementById("greeting-sub").textContent =
  `${user.business_name || "Your business"} — ${dateStr}`;
  } catch {
    // Non-2xx responses are handled by the api client (redirects to /login on 401).
    // For other errors we leave the greeting as "Welcome back" with "Loading…"
  }
}

init();
