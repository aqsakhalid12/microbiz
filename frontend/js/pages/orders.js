// frontend/js/pages/orders.js
import { api } from "/js/api/client.js";
import { showToast } from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";
import { initOrdersList, reloadOrders } from "/js/orders/orders-list.js";
import { initOrderForm, openOrderForm } from "/js/orders/orders-form.js";

initSidebar();

initOrderForm({ onSaved: reloadOrders });

const newOrderBtn = document.getElementById("new-order-btn");
if (newOrderBtn) {
  newOrderBtn.addEventListener("click", () => openOrderForm());
}

initOrdersList({
  onView: (order) => showToast("info", "Coming next"),
  onEdit: (order) => openOrderForm(order.id),
});

void api;
