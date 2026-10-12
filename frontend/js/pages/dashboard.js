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
  { id: "total-sales", label: "Total Sales", icon: "bi-cash-coin", accent: "sales" },
  { id: "total-expenses", label: "Total Expenses", icon: "bi-wallet", accent: "expenses" },
  { id: "estimated-profit", label: "Estimated Profit", icon: "bi-graph-up-arrow", accent: "profit" },
  { id: "total-orders", label: "Total Orders", icon: "bi-cart", accent: "orders" },
  { id: "pending-orders", label: "Pending Orders", icon: "bi-clock-history", accent: "pending" },
  { id: "low-stock", label: "Low-Stock Items", icon: "bi-exclamation-triangle", accent: "low-stock" },
];

/**
 * Render the six stat cards into the #stat-cards container.
 * Values are placeholder "—" until Phase 10 provides real data.
 */
function renderStatCards() {
  const container = document.getElementById("stat-cards");
  if (!container) return;
  container.innerHTML = STAT_CARDS.map((card) => `
    <div class="stat-card-wrapper" data-accent="${card.accent}">
      <div class="card stat-card h-100">
        <div class="card-body">
          <div class="stat-card-top d-flex justify-content-between align-items-start">
            <p class="stat-label mb-0">${escapeHtml(card.label)}</p>
            <div class="stat-icon-box d-flex align-items-center justify-content-center">
              <i class="bi ${card.icon} stat-icon"></i>
            </div>
          </div>
          <div class="stat-value-wrapper">
            <p class="stat-value mb-0">—</p>
          </div>
          <p class="stat-caption mb-0">Not available yet</p>
        </div>
      </div>
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
    title: "Sales overview (chart)",
    text: "Charts will appear here once you have completed orders.",
  });

  renderEmptyState(document.getElementById("low-stock-empty"), {
    icon: "bi-exclamation-triangle",
    title: "Low-stock alerts",
    text: "Low-stock alerts will appear here once you have products below their threshold.",
  });

  renderEmptyState(document.getElementById("recent-orders-empty"), {
    icon: "bi-truck",
    title: "No orders yet",
    text: "Orders will appear here once you start receiving them.",
  });

  // Fetch user data for the greeting.
  try {
    const data = await api.get("/api/auth/me");
    const user = data.user || {};
    const firstName = user.full_name.split(" ")[0] || "";
    document.getElementById("greeting").textContent =
      firstName ? `Welcome back, ${firstName}` : "Welcome back";
    document.getElementById("greeting-sub").textContent =
      `${user.business_name || ""} · ${user.currency_code || ""}`.trim()
        .replace(/^ ·$/, "");
  } catch {
    // Non-2xx responses are handled by the api client (redirects to /login on 401).
    // For other errors we leave the greeting as "Welcome back" with "Loading…"
  }
}

init();
