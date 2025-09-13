import { useState, useEffect } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [roast, setRoast] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [jokes, setJokes] = useState(null);
  const [error, setError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    // Fetch analytics
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setStats)
      .catch((e) => console.error("Dashboard fetch failed", e));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setRoast(null);
    setAdvice(null);
    setLoading(true);
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, upgrade: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      setRoast(data.roast || data.roastRaw || "No roast returned.");
      setAdvice(data.advice || []);
      setJokes(data?.jokes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function shareOnTwitter() {
    const text = roast
      ? roast.slice(0, 240) + (roast.length > 240 ? "…" : "")
      : "I got roasted!";
    const tweet = `I just got roasted by AI: "${text}"\n\n\nTry it: ${window.location.origin}`;
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      tweet
    )}`;

    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "share_twitter",
        url,
      }),
    }).catch((err) => console.error("Analytics error:", err));

    window.open(intent, "_blank");
  }

  async function handleRazorpayPayment() {
    const res = await fetch("/api/payment", { method: "POST" });
    const order = await res.json();

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: "AI Roast Audit",
      description: "Get the full Pro Roast report",
      order_id: order.id,
      handler: async function (response) {
        setPdfLoading(true);

        try {
          const roastRes = await fetch("/api/roast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, upgrade: true }),
          });

          const roastData = await roastRes.json();

          const pdfRes = await fetch("/api/generate-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roast: roastData.roast,
              jokes: roastData.jokes,
              advice: roastData.advice,
              url,
            }),
          });

          const blob = await pdfRes.blob();
          const pdfUrl = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = pdfUrl;
          a.download = "pro-roast-report.md";
          document.body.appendChild(a);
          a.click();
          a.remove();

          alert("✅ PDF downloaded successfully!");
        } catch (error) {
          alert("❌ Something went wrong generating the report.");
          console.error(err);
        } finally {
          setPdfLoading(false);
        }
      },
      prefill: {
        name: "Roastee",
        email: "user@example.com", // optional: capture user's email
      },
      theme: {
        color: "#F37254",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "4rem auto",
        fontFamily: "system-ui, sans-serif",
        padding: "0 1rem",
      }}
    >
      <h1 style={{ fontSize: 32 }}>🔥 AI Roast My Website</h1>
      <p>
        Paste your site URL. The AI will roast it and give 3 friendly fixes.
      </p>
      <p style={{ marginTop: 20 }}>
        Want to see what it looks like?{" "}
        <a href="/examples">See roast examples</a>
      </p>

      {stats && (
        <div
          style={{
            marginTop: 30,
            display: "flex",
            justifyContent: "space-around",
            background: "#eef2ff",
            borderRadius: 12,
            padding: "2rem 1rem",
            textAlign: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "2.5rem",
                fontWeight: "bold",
                color: "#1e3a8a",
              }}
            >
              {stats.roasts}
            </div>
            <div style={{ fontSize: "0.9rem", color: "#374151" }}>
              Total Roasts
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "2.5rem",
                fontWeight: "bold",
                color: "#047857",
              }}
            >
              {stats.payments}
            </div>
            <div style={{ fontSize: "0.9rem", color: "#374151" }}>
              Pro Reports Sold
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "2.5rem",
                fontWeight: "bold",
                color: "#b91c1c",
              }}
            >
              {stats.shares}
            </div>
            <div style={{ fontSize: "0.9rem", color: "#374151" }}>
              Twitter Shares
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-site.example"
          style={{ width: "100%", padding: "0.75rem", fontSize: 16 }}
        />
        <div style={{ marginTop: 10 }}>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "0.6rem 1rem", fontSize: 16, cursor: "pointer" }}
          >
            {loading ? "Roasting..." : "Roast me 🔥"}
          </button>
        </div>
      </form>

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

      {roast && (
        <section
          style={{
            marginTop: 24,
            background: "#f7f7f8",
            padding: 18,
            borderRadius: 8,
          }}
        >
          <h3>Roast</h3>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{roast}</div>

          {jokes && jokes.length > 0 && (
            <>
              <h4 style={{ marginTop: 12 }}>Some Jokes:</h4>
              <ol>
                {jokes.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            </>
          )}

          {advice && advice.length > 0 && (
            <>
              <h4 style={{ marginTop: 12 }}>Friendly fixes</h4>
              <ol>
                {advice.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            </>
          )}

          <div style={{ marginTop: 12 }}>
            <button
              onClick={shareOnTwitter}
              style={{ marginRight: 8, padding: 6, cursor: "pointer" }}
            >
              Share on Twitter
            </button>
            <button
              onClick={handleRazorpayPayment}
              style={{ padding: 6, cursor: "pointer" }}
            >
              🔒 Get Full Pro Roast Report ($0.55 / ₹49)
            </button>
          </div>
        </section>
      )}
      {pdfLoading && (
        <div style={{ marginTop: 16, fontStyle: "italic" }}>
          🧠 Generating your Pro Roast Report... please wait...
        </div>
      )}
    </main>
  );
}
