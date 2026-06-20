import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = body.question;

    if (!question) {
      return Response.json(
        { error: "질문이 없습니다." },
        { status: 400 }
      );
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: question,
    });

    return Response.json({
      answer: response.text,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Gemini 답변을 가져오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}