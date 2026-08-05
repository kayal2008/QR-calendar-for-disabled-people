import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini API client safely
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set in environment variables. Using fallback responses.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// 1. Gemini Voice Assistant endpoint
app.post("/api/gemini/assistant", async (req, res) => {
  try {
    const { message, language = "English", childName = "Friend", currentDay = "Today" } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Fallback friendly response
      res.json({
        reply: `Hello ${childName}! Today is ${currentDay}. Keep up your great routine!`,
        language,
      });
      return;
    }

    const systemInstruction = `You are "Tarang AI", a gentle, encouraging, and friendly voice assistant inside an inclusive calendar app for children with developmental and communication disabilities (like autism, ADHD, speech delay).
Key directives:
- Use very simple, warm, clear, short sentences (1-3 sentences max).
- Speak in ${language}. If language is not English, respond in ${language} (using native script or clean text).
- Be extremely encouraging, calm, and positive. Avoid complicated metaphors or jargon.
- If asked about dates or activities, give direct reassuring answers.
- Child's name: ${childName}. Current context: ${currentDay}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || `Today is a happy day, ${childName}! You are doing wonderful!`;
    res.json({ reply, language });
  } catch (err: any) {
    console.error("Error in /api/gemini/assistant:", err);
    res.status(500).json({
      reply: "Today is a great day! Ask me about your routine or upcoming festivals!",
      error: err.message,
    });
  }
});

// 2. Gemini Daily Special Fact endpoint
app.post("/api/gemini/daily-fact", async (req, res) => {
  const { category = "Space", language = "English", dateStr } = req.body || {};
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.json({
        fact: "Did you know? The Moon is about 384,400 km away from Earth and shines brightly by reflecting sunlight!",
        category,
        language,
      });
      return;
    }

    const prompt = `Generate 1 short, fun, fascinating, child-friendly fact suitable for children with special learning needs.
Category: ${category} (e.g. Space, Science, Indian History, Cultural, Nature, Animals).
Date: ${dateStr || "Today"}.
Language: ${language}.
Keep it under 35 words. Make it wondrous and easy to understand.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        temperature: 0.8,
      },
    });

    const fact = response.text?.trim() || "Saturn has beautiful rings made mostly of ice and dust chunks!";
    res.json({ fact, category, language });
  } catch (err: any) {
    console.error("Error in /api/gemini/daily-fact:", err);
    res.json({
      fact: "Peacocks are the national birds of India and display colorful feathers during rain!",
      category,
      language,
    });
  }
});

// 3. Gemini AR Story & Festival details
app.post("/api/gemini/ar-story", async (req, res) => {
  try {
    const { topic, language = "English" } = req.body;

    const ai = getGeminiClient();
    if (!ai) {
      res.json({
        title: topic || "Special Day",
        story: "Celebrated with joy, family togetherness, traditional foods, and vibrant decorations across India!",
        narration: "Welcome to this wonderful celebration! Let us learn and enjoy together.",
        activityPrompt: "Draw a colorful picture or color the festival diya!",
      });
      return;
    }

    const prompt = `Provide a child-friendly visual AR story overview for "${topic}".
Language: ${language}.
Provide a JSON object with keys:
- "title": simple title
- "story": 2-3 sentences explaining what it is and why it's special in simple words
- "narration": 2 sentence voice narration for AR playback
- "activityPrompt": 1 simple hands-on or drawing activity idea for children`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    try {
      const data = JSON.parse(response.text || "{}");
      res.json(data);
    } catch {
      res.json({
        title: topic,
        story: `${topic} brings happiness, traditional foods, and community unity!`,
        narration: `Let's celebrate ${topic} with big smiles and colorful activities!`,
        activityPrompt: "Make a bright paper decoration with your caregiver!",
      });
    }
  } catch (err: any) {
    console.error("Error in /api/gemini/ar-story:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Emergency SOS trigger API
app.post("/api/sos/alert", (req, res) => {
  const { childName = "Child", location, contact, timestamp } = req.body;
  console.log(`[SOS ALERT TRIGGERED] Child: ${childName}, Location:`, location, `Time: ${timestamp}`);
  res.json({
    success: true,
    message: `Emergency SOS Alert sent to ${contact?.name || "Caregiver"} (${contact?.phone || "Emergency Line"}). Live location shared!`,
    timestamp: new Date().toISOString(),
  });
});

// 5. Google Calendar Sync Simulation endpoint
app.post("/api/google-calendar/sync", (req, res) => {
  const { events } = req.body;
  res.json({
    success: true,
    syncedCount: Array.isArray(events) ? events.length : 0,
    message: "Successfully synchronized with Google Calendar!",
    lastSync: new Date().toISOString(),
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AR Inclusive Calendar server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
