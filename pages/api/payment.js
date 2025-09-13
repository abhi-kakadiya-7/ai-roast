// pages/api/payment.js
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method allowed" });
  }

  const amount = 49 * 100; // ₹199 in paisa

  try {
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "roast_" + Date.now(),
      payment_capture: 1,
    });

    const clientPromise = require("../../lib/mongodb").default;
    const client = await clientPromise;
    const db = client.db("airoast");
    await db.collection("payments").insertOne({
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: "created",
      createdAt: new Date(),
    });

    res.status(200).json(order);
  } catch (err) {
    console.error("Razorpay error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
}
