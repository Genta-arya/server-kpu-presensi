// notification.controller.js
let adminClients = [];

export const sendSSEntNotification = (data) => {
  adminClients.forEach((client) => {
    // Pastikan response masih terbuka sebelum menulis
    if (!client.res.writableEnded) {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  });
};

export const notificationStream = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const clientId = Date.now();
  adminClients.push({ id: clientId, res });

  req.on("close", () => {
    adminClients = adminClients.filter((c) => c.id !== clientId);
  });
};