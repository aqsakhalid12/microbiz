// frontend/js/pages/orders.js
import { api } from "/js/api/client.js";
import { showToast, initModalFocus } from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";
import { initOrdersList, reloadOrders } from "/js/orders/orders-list.js";
import { initOrderForm, openOrderForm } from "/js/orders/orders-form.js";
import { initOrderView, openOrderView } from "/js/orders/orders-view.js";

initSidebar();

// Restore focus to the control that opened a modal when it is closed
initModalFocus();

initOrderForm({ onSaved: reloadOrders });
initOrderView({ onChanged: reloadOrders });

const newOrderBtn = document.getElementById("new-order-btn");
if (newOrderBtn) {
  newOrderBtn.addEventListener("click", () => openOrderForm());
}

initOrdersList({
  onView: (order) => openOrderView(order.id),
  onEdit: (order) => openOrderForm(order.id),
});

void api;
