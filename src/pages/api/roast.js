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
      return res
        .status(400)
        .json({ error: `Failed to fetch URL, status ${resp.status}` });
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
You are a world-class, funny, brutally honest web design and UX critic. Your job is to roast a website in a humorous yet insightful way, and give professional advice.

Instructions:
- Write a fun, edgy roast (200–300 words) mocking the site’s design, content, vibe, or user experience.
- Include 3–5 specific, witty one-liners or jokes.
- Follow it up with 3–5 serious tips that would help the owner improve the site (in plain, actionable English).
- Keep tone cheeky but not mean.

Return only this JSON format:
{
  "roast": "long, witty roast",
  "jokes": ["one-liner 1", "one-liner 2", ...],
  "advice": ["tip 1", "tip 2", ...]
}

Here’s the website:
URL: ${url}
Title: ${title}
Meta: ${meta}
H1: ${h1}
Excerpt: ${bodyText}
`;

  const prompt = upgrade ? upgradedPrompt : basicPrompt;
  const maxTokens = upgrade ? 1000 : 512;
  const temperature = upgrade ? 0.9 : 0.7;

  try {
    const groqRes = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
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

    const content = groqRes.data.choices[0].message.content;
    // optionally log content for debugging
    // console.log("Groq content:", content);

    let parsedJson = null;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        parsedJson = JSON.parse(match[0]);
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
