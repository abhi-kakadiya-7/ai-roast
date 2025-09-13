import clientPromise from "../lib/mongodb";

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db("airoast");

    const roasts = await db.collection("roasts").countDocuments();
    const payments = await db
      .collection("payments")
      .countDocuments({ status: "created" });
    const shares = await db
      .collection("events")
      .countDocuments({ event_type: "share_twitter" });

    res.json({ roasts, payments, shares });
  } catch (e) {
    console.error("Dashboard error:", e);
    res.status(500).json({ error: "Failed to load stats" });
  }
}
