import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { filePath, fileContent } = await req.json();
    if (!filePath || !fileContent) {
      return new Response(JSON.stringify({ error: "filePath and fileContent are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a code analysis assistant. You analyze source files and return structured JSON summaries. Return ONLY valid JSON, no markdown, no backticks.",
          },
          {
            role: "user",
            content: `Analyze this file from a GitHub repository and return ONLY a JSON object.

File path: ${filePath}
File content:
${fileContent.slice(0, 3000)}

Return this exact JSON structure:
{
  "purpose": "One sentence describing what this file does",
  "explanation": "2-3 sentences explaining the implementation",
  "dependencies": ["list", "of", "key", "imports"],
  "type": "component|utility|config|api|model|service|test|other",
  "complexity": "low|medium|high"
}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "file_analysis",
              description: "Return structured analysis of a source code file",
              parameters: {
                type: "object",
                properties: {
                  purpose: { type: "string", description: "One sentence describing what this file does" },
                  explanation: { type: "string", description: "2-3 sentences explaining the implementation" },
                  dependencies: { type: "array", items: { type: "string" }, description: "Key imports/dependencies" },
                  type: { type: "string", enum: ["component", "utility", "config", "api", "model", "service", "test", "other"] },
                  complexity: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["purpose", "explanation", "dependencies", "type", "complexity"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "file_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    
    // Extract from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let summary;
    if (toolCall?.function?.arguments) {
      summary = typeof toolCall.function.arguments === "string" 
        ? JSON.parse(toolCall.function.arguments) 
        : toolCall.function.arguments;
    } else {
      // Fallback: try parsing content directly
      const content = data.choices?.[0]?.message?.content || "";
      summary = JSON.parse(content);
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-file error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
