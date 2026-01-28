
import { GoogleGenAI, Type } from "@google/genai";

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<{ text: string, segments: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio,
            },
          },
          {
            text: "Eres un transcriptor profesional. Transcribe el audio en ESPAÑOL. Divide la transcripción en segmentos lógicos con marcas de tiempo (inicio y fin en segundos). Devuelve un objeto JSON con el texto completo y una lista de segmentos.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  startTime: { type: Type.NUMBER, description: "Tiempo de inicio en segundos" },
                  endTime: { type: Type.NUMBER, description: "Tiempo de fin en segundos" },
                  text: { type: Type.STRING, description: "Texto del fragmento" }
                },
                required: ["startTime", "endTime", "text"]
              }
            }
          },
          required: ["text", "segments"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return {
      text: result.text,
      segments: result.segments
    };
  } catch (error) {
    console.error("Error en la transcripción estructurada:", error);
    throw error;
  }
};
