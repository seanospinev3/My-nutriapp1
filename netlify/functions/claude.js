exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    // Check API key exists
    if (!apiKey) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          content: [{
            type: "text",
            text: "Error: GEMINI_API_KEY not set in Netlify environment variables. Please add it in Site configuration → Environment variables."
          }]
        }),
      };
    }

    const body = JSON.parse(event.body);
    const userMessage = body.messages?.[0]?.content;

    // Build Gemini parts — handle both text-only and image+text
    const parts = [];

    if (Array.isArray(userMessage)) {
      for (const item of userMessage) {
        if (item.type === "image") {
          parts.push({
            inline_data: {
              mime_type: item.source.media_type,
              data: item.source.data,
            },
          });
        } else if (item.type === "text") {
          parts.push({ text: item.text });
        }
      }
    } else if (typeof userMessage === "string") {
      parts.push({ text: userMessage });
    }

    // Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.3,
          },
        }),
      }
    );

    const geminiData = await geminiRes.json();

    // Check for Gemini API errors
    if (geminiData.error) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          content: [{
            type: "text",
            text: `Gemini API Error: ${geminiData.error.message || "Unknown error"}. Please check your API key in Netlify environment variables.`
          }]
        }),
      };
    }

    // Extract text safely from Gemini response
    const text =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      geminiData?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") ||
      "Gemini returned an empty response. Please try again.";

    // Return in format the app expects
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        content: [{ type: "text", text }],
      }),
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        content: [{
          type: "text",
          text: `Server error: ${err.message}. Please try again.`
        }]
      }),
    };
  }
};
