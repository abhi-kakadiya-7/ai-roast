// pages/api/roast.js
import * as cheerio from "cheerio";
import axios from "axios";

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { url, upgrade } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIPv4(host))
  ) {
    return res.status(400).json({ error: "Blocked for security reasons" });
  }

  let html;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "AI-Roast-Bot/1.0" },
    });
    if (!resp.ok) {
      const funErrors = [
        "Seems like this website ghosted us. No roast today! 👻",
        "The site didn’t pick up our call… must be socially awkward. 📵",
        "We knocked, but nobody answered. Maybe it’s hiding from roasts. 🕵️",
        "That site pulled the classic Irish goodbye — gone without a trace. 🚪💨",
        "It’s giving us the cold shoulder. Must’ve heard about our savage burns. ❄️🔥",
        "This website is playing hard to get… no roast for now. 💅",
        "We tried to fetch it, but the site rage-quit on us. 🎮💥",
        "Looks like the site went stealth mode. Can’t roast what we can’t see. 🕶️",
        "The server just left us on read… savage. 📩❌",
        "This site flinched before the roast even began. 🐔🔥",
        "We poked it with a stick, but nothing happened. 🚶‍♂️🌾",
      ];
      const msg = funErrors[Math.floor(Math.random() * funErrors.length)];

      return res.status(400).json({
        error: msg,
      });
    }
    html = await resp.text();
  } catch (e) {
    return res.status(400).json({ error: "Error fetching site: " + e.message });
  }

  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const meta = $('meta[name="description"]').attr("content")?.trim() || "";
  const h1 = $("h1").first().text().trim();
  let bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);

  const basicPrompt = `
You are a funny and witty web design critic. Roast this website in a humorous way.

Instructions:
- Make the roast short (around 100–180 words).
- Include 2–4 playful jokes or one-liners about the design, content, or vibe.
- Then give 3 helpful but friendly tips for improvement.

Return only JSON in this format:
{
  "roast": "text string",
  "advice": ["tip 1", "tip 2", "tip 3"]
}

Website:
URL: ${url}
Title: ${title}
Meta: ${meta}
H1: ${h1}
Text excerpt: ${bodyText}
`;

  const upgradedPrompt = `
You are RoastBot, a brutally honest but helpful web design and UX consultant with a sharp sense of humor. Your job is to roast the following website AND provide genuinely useful feedback.

🔍 Objectives:
- Write a humorous roast (around 250–350 words) that critiques the design, content, structure, or vibe of the website.
- Be witty and cheeky, but not cruel or offensive.
- Include **exactly 4 punchy jokes or one-liners** as bullet points — these should be clever jabs that point to specific flaws (like bad UI, outdated styles, weird text, etc).
- Follow that with **4 clear and professional improvement tips** in plain English — these should be concise, actionable suggestions that even a non-technical person can understand and apply.

🎯 Format your response as valid JSON ONLY:
{
  "roast": "Write a long, witty roast paragraph here...",
  "jokes": ["Witty one-liner #1", "Witty one-liner #2", "Witty one-liner #3", "Witty one-liner #4"],
  "advice": ["Improvement tip #1", "Improvement tip #2", "Improvement tip #3", "Improvement tip #4"]
}

📦 Website Info:
URL: ${url}
Title: ${title}
Meta: ${meta}
H1: ${h1}
Excerpt: ${bodyText}
`;

  const prompt = upgrade ? upgradedPrompt : basicPrompt;
  const maxTokens = upgrade ? 1000 : 512;
  const temperature = upgrade ? 0.9 : 0.7;

  const callGroq = async (model) => {
    const groqRes = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_completion_tokens: maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return groqRes.data.choices[0].message.content;
  };

  try {
    let content;
    try {
      content = await callGroq("llama-3.3-70b-versatile");
    } catch (err) {
      if (err.response?.status === 429) {
        console.warn("Rate limit hit, retrying with groq/compound-mini");
        content = await callGroq("groq/compound-mini");
      } else {
        throw err;
      }
    }

    let parsedJson = null;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        parsedJson = JSON.parse(match[0]);

        try {
          const clientPromise = require("../../lib/mongodb").default;

          const client = await clientPromise;
          const db = client.db("airoast");
          await db.collection("roasts").insertOne({
            url,
            roast: parsedJson?.roast || content,
            advice: parsedJson?.advice || [],
            jokes: parsedJson?.jokes || [],
            upgrade: !!upgrade,
            createdAt: new Date(),
          });
        } catch (e) {
          console.error("DB insert failed:", e);
        }
      } else {
        throw new Error("No JSON object found");
      }
    } catch (e) {
      return res.status(200).json({
        roast: content,
        warning: "AI response was not valid JSON, returned raw text instead.",
      });
    }

    return res.status(200).json({
      roast: parsedJson.roast,
      advice: parsedJson.advice,
      jokes: parsedJson?.jokes,
    });
  } catch (err) {
    console.error("Groq API error:", err.response?.data || err.message);
    return res.status(500).json({
      error:
        "Groq API call failed: " +
        (err.response?.data?.error?.message || err.message),
    });
  }
}
