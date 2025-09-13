// pages/examples.js
import { roastExamples } from "../data/examples";

export default function ExamplesPage() {
  return (
    <main
      style={{
        maxWidth: 800,
        margin: "2rem auto",
        padding: "0 1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>🔥 Roast Examples</h1>
      <p>
        Check out how RoastBot breaks down websites from top brands with jokes
        and real advice.
      </p>

      {roastExamples.map((site, i) => (
        <section
          key={i}
          style={{
            margin: "2rem 0",
            paddingBottom: "1rem",
            borderBottom: "1px solid #ccc",
          }}
        >
          <h2 style={{ marginBottom: 0 }}>{site.title}</h2>
          <p style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
            {site.url}
          </p>

          <h3 style={{ marginTop: 12 }}>Roast</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{site.roast}</p>

          <h4 style={{ marginTop: 12 }}>🤣 Jokes</h4>
          <ul>
            {site.jokes.map((joke, j) => (
              <li key={j}>{joke}</li>
            ))}
          </ul>

          <h4 style={{ marginTop: 12 }}>🛠 Tips</h4>
          <ol>
            {site.advice.map((tip, t) => (
              <li key={t}>{tip}</li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
