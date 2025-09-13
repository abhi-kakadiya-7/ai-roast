import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Only POST allowed");

  const { event_type, url } = req.body || {};
  try {
    const clientPromise = require("../../lib/mongodb").default;
    const client = await clientPromise;
    const db = client.db("airoast");

    await db.collection("events").insertOne({
      event_type,
      url,
      user_agent: req.headers["user-agent"] || "",
      ip_hash: crypto
        .createHash("sha256")
        .update(req.socket.remoteAddress || "")
        .digest("hex"),
      createdAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Event logging error:", err);
    res.status(500).json({ error: "DB insert failed" });
  }
}
