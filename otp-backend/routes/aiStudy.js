import { Router } from "express";

const router = Router();

const SYSTEM_PROMPT = `You are an expert academic study assistant for students. Your role is to help with study-related questions across subjects like Computer Science (OS, DBMS, CN, programming), mathematics, and other academic topics.

Guidelines:
- Provide clear, accurate, and detailed explanations
- Use examples and analogies where helpful
- Structure answers with headings, bullet points, or numbered lists when appropriate
- Explain concepts from fundamentals when relevant
- Be concise but thorough—prioritize clarity
- If a question is unclear or outside academic scope, politely ask for clarification or suggest rephrasing
- Never make up facts; if unsure, say so
- Format responses in plain text; avoid markdown code blocks for short snippets`;

function buildOpenAIMessages(question, history = []) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  (history || []).forEach((m) => {
    if (m.role && m.content) messages.push({ role: m.role, content: m.content });
  });
  messages.push({ role: "user", content: question });
  return messages;
}

function buildGeminiContents(question, history = []) {
  const parts = [{ text: SYSTEM_PROMPT + "\n\n---\n\n" }];
  (history || []).forEach((m) => {
    if (m.role && m.content) {
      parts.push({ text: (m.role === "user" ? "User: " : "Assistant: ") + m.content + "\n\n" });
    }
  });
  parts.push({ text: "User: " + question + "\n\nAssistant: " });
  return [{ role: "user", parts }];
}

// POST /api/ai/study
router.post("/study", async (req, res) => {
  try {
    const { question, messages: history } = req.body || {};
    const q = typeof question === "string" ? question.trim() : "";
    if (!q) {
      return res.status(400).json({ message: "Question is required." });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (openaiKey) {
      const url = "https://api.openai.com/v1/chat/completions";
      const body = {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: buildOpenAIMessages(q, history),
        max_tokens: 2048,
        temperature: 0.6,
      };
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.error) {
        console.error("OpenAI API error:", data.error);
        return res.status(502).json({
          message: "AI service error: " + (data.error.message || "Unknown error"),
        });
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return res.status(502).json({ message: "No response from AI." });
      }
      return res.json({ answer: content });
    }

    if (geminiKey) {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const contents = buildGeminiContents(q, history);
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: contents[0].parts.map((p) => p.text).join("") }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.6,
          },
        }),
      });
      const data = await r.json();
      if (data.error) {
        console.error("Gemini API error:", data.error);
        return res.status(502).json({
          message: "AI service error: " + (data.error.message || "Unknown error"),
        });
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return res.status(502).json({ message: "No response from AI." });
      }
      return res.json({ answer: text });
    }

    return res.status(503).json({
      message:
        "AI Study Assistant is not configured. Ask your administrator to set OPENAI_API_KEY or GEMINI_API_KEY in the server environment.",
    });
  } catch (err) {
    console.error("AI study route error:", err);
    res.status(500).json({
      message: "Failed to get AI response.",
      error: err.message,
    });
  }
});

export default router;
