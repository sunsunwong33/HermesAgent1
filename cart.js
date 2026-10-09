/* ============================================================
   SunSun JP — shared shopping-cart logic
   Loads on any page containing #cartFab (restaurant.html,
   restaurant-menu.html). Menu items carry data-id / data-name /
   data-en / data-price attributes. Orders are sent to the
   restaurant's WhatsApp via a wa.me deep link (no backend,
   no payment — pay at the restaurant).
   ============================================================ */
(function () {
  "use strict";

  var WA_NUMBER = "85298765432";
  var CART_KEY = "sunsunjp.cart.v1";

  // Only initialise when this page actually has the cart UI.
  var fab = document.getElementById("cartFab");
  if (!fab) return;

  var overlay = document.getElementById("cartOverlay");
  var drawer = document.getElementById("cartDrawer");
  var body = document.getElementById("cartBody");
  var fabCount = document.getElementById("fabCount");
  var fabTotal = document.getElementById("fabTotal");
  var totalEl = document.getElementById("cartTotal");
  var checkoutBtn = document.getElementById("checkoutBtn");
  var clearBtn = document.getElementById("clearCart");
  var toast = document.getElementById("toast");
  var nameInput = document.getElementById("custName");
  var noteInput = document.getElementById("custNote");

  /* ---------- state ---------- */

  var cart = {}; // { id: { name, en, price, qty } }

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
      if (raw && typeof raw === "object") cart = raw;
    } catch (e) { cart = {}; }
  }

  function save() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function count() {
    var n = 0;
    for (var k in cart) n += cart[k].qty;
    return n;
  }

  function subtotal() {
    var s = 0;
    for (var k in cart) s += cart[k].price * cart[k].qty;
    return s;
  }

  /* ---------- render ---------- */

  function renderButtons() {
    var items = document.querySelectorAll(".menu-item[data-id]");
    items.forEach(function (item) {
      var id = item.getAttribute("data-id");
      var cell = item.querySelector(".cart-cell");
      var line = cart[id];
      var inCart = !!line && line.qty > 0;

      // Replace add-button / stepper
      var old = cell.querySelector(".add-btn, .qty-stepper");
      if (old) old.remove();

      if (inCart) {
        var stepper = document.createElement("div");
        stepper.className = "qty-stepper";
        stepper.innerHTML =
          '<button type="button" data-dec aria-label="減少數量">−</button>' +
          '<span class="qty"></span>' +
          '<button type="button" data-inc aria-label="增加數量">+</button>';
        stepper.querySelector(".qty").textContent = line.qty;
        cell.appendChild(stepper);
        stepper.querySelector("[data-dec]").addEventListener("click", function () {
          changeQty(id, -1);
        });
        stepper.querySelector("[data-inc]").addEventListener("click", function () {
          changeQty(id, 1);
        });
      } else {
        var add = document.createElement("span");
        add.className = "add-btn";
        add.setAttribute("role", "button");
        add.setAttribute("tabindex", "0");
        add.innerHTML = '<svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg> 加入購物車';
        add.addEventListener("click", function () { addToCart(id); });
        add.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            addToCart(id);
          }
        });
        cell.appendChild(add);
      }
    });

    // Floating button
    var n = count();
    fabCount.textContent = String(n);
    fabCount.style.display = n > 0 ? "" : "none";
    var sub = subtotal();
    fabTotal.textContent = n > 0 ? "HK$ " + sub : "";
    fab.style.display = "";

    // Drawer contents
    if (n === 0) {
      body.innerHTML =
        '<div class="cart-empty">' +
        '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 10.6a1 1 0 0 0 .98.8h7.4a1 1 0 0 0 .98-.78L18.5 7H6.2"/><circle cx="9.5" cy="17.5" r="1.2"/><circle cx="16.5" cy="17.5" r="1.2"/></svg>' +
        "<p>購物車仍為空。<br />由上方菜單加入您想點的菜式。</p></div>";
    } else {
      var html = "";
      for (var id in cart) {
        var it = cart[id];
        if (!it.qty) continue;
        html +=
          '<div class="cart-line" data-line="' + id + '">' +
          '<span class="l-name">' + esc(it.name) + "</span>" +
          '<span class="l-price">HK$ ' + (it.price * it.qty) + "</span>" +
          '<div class="l-controls">' +
          '<span class="unit">HK$ ' + it.price + " 每份</span>" +
          '<div class="qty-stepper">' +
          '<button type="button" data-dec aria-label="減少數量">−</button>' +
          '<span class="qty">' + it.qty + "</span>" +
          '<button type="button" data-inc aria-label="增加數量">+</button>' +
          "</div></div></div>";
      }
      body.innerHTML = html;
      body.querySelectorAll("[data-inc]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.closest(".cart-line").getAttribute("data-line");
          changeQty(id, 1);
        });
      });
      body.querySelectorAll("[data-dec]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.closest(".cart-line").getAttribute("data-line");
          changeQty(id, -1);
        });
      });
    }

    totalEl.textContent = "HK$ " + sub;
    checkoutBtn.disabled = n === 0;
  }

  /* ---------- actions ---------- */

  function addToCart(id) {
    var item = document.querySelector('.menu-item[data-id="' + id + '"]');
    if (!item) return;
    var name = item.getAttribute("data-name");
    var en = item.getAttribute("data-en") || "";
    var price = parseInt(item.getAttribute("data-price"), 10) || 0;
    var entry = cart[id] || { name: name, en: en, price: price, qty: 0 };
    entry.qty += 1;
    cart[id] = entry;
    save();
    renderButtons();
    showToast("已加入購物車 — <strong>" + esc(name) + "</strong>");
  }

  function changeQty(id, delta) {
    var entry = cart[id];
    if (!entry) return;
    entry.qty += delta;
    if (entry.qty <= 0) delete cart[id];
    save();
    renderButtons();
  }

  function clearAll() {
    cart = {};
    save();
    renderButtons();
  }

  /* ---------- drawer open / close ---------- */

  function openCart() {
    drawer.classList.add("open");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    if (nameInput) nameInput.focus();
  }

  function closeCart() {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  fab.addEventListener("click", openCart);
  overlay.addEventListener("click", closeCart);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer.classList.contains("open")) closeCart();
  });
  clearBtn.addEventListener("click", clearAll);

  /* ---------- checkout via WhatsApp ---------- */

  checkoutBtn.addEventListener("click", function () {
    var name = (nameInput && nameInput.value || "").trim();
    if (!name) {
      showToast("請先填寫您的稱呼");
      if (nameInput) nameInput.focus();
      return;
    }
    var svc = "堂食";
    if (document.getElementById("svcTake") && document.getElementById("svcTake").checked) {
      svc = "外賣自取";
    }
    var note = (noteInput && noteInput.value || "").trim();

    var lines = [];
    lines.push("【SunSun JP 線上點餐】");
    lines.push("");
    lines.push("服務方式：" + svc);
    lines.push("稱呼：" + name);
    lines.push("");
    for (var id in cart) {
      var it = cart[id];
      if (!it.qty) continue;
      lines.push(
        "• " + it.name + (it.en ? "（" + it.en + "）" : "") +
        " ×" + it.qty + " — HK$ " + (it.price * it.qty)
      );
    }
    lines.push("");
    lines.push("合計：HK$ " + subtotal());
    if (note) {
      lines.push("備註：" + note);
    }
    lines.push("");
    lines.push("（訂單經 WhatsApp 送出，付款於店內完成。請餐廳確認後回覆。）");

    var msg = encodeURIComponent(lines.join("\n"));
    window.open("https://wa.me/" + WA_NUMBER + "?text=" + msg, "_blank", "noopener");
  });

  /* ---------- helpers ---------- */

  var toastTimer = null;
  function showToast(html) {
    if (!toast) return;
    toast.innerHTML = html;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 2200);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  load();
  renderButtons();
})();
