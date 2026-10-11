const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "orders.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
}

app.get("/api/orders", (req, res) => {
  res.json(readOrders());
});

app.post("/api/orders", (req, res) => {
  const { table, items, total } = req.body;

  if (!table || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid order" });
  }

  const orders = readOrders();
  const order = {
    id: Date.now().toString(),
    table,
    items,
    total,
    status: "New",
    createdAt: new Date().toISOString()
  };

  orders.unshift(order);
  saveOrders(orders);
  io.emit("newOrder", order);

  res.status(201).json(order);
});

app.patch("/api/orders/:id", (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  const allowed = ["New", "Preparing", "Ready", "Completed"];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  order.status = req.body.status;
  saveOrders(orders);
  io.emit("orderUpdated", order);

  res.json(order);
});

io.on("connection", socket => {
  socket.emit("orders", readOrders());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`MeatHub server running on port ${PORT}`);
});
