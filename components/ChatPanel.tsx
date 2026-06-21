"use client";

import { KeyboardEvent, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPanel() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSend = async () => {
    if (question.trim() === "") return;

    const userMessage: Message = {
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);

    const currentQuestion = question;
    setQuestion("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: currentQuestion,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer || "답변을 가져오지 못했습니다.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: "오류가 발생했습니다. API 연결을 확인하세요.",
      };

      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSend();
    }
  };

  return (
    <section
      style={{
        height: "100%",
        backgroundColor: "#f9fafb",
        padding: "20px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* AI 패널 제목 */}
      <h1
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          marginBottom: "16px",
          paddingTop: "30px",
        }}
      >
        AI 설명
      </h1>

      {/* 채팅 기록 영역 */}
      <div
        style={{
          flex: 1,
          backgroundColor: "white",
          border: "1px solid #d1d5db",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
          overflowY: "auto",
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            질문을 입력하면 대화가 여기에 표시됩니다.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              style={{
                marginBottom: "12px",
                padding: "12px",
                borderRadius: "10px",
                backgroundColor:
                  message.role === "user" ? "#e5e7eb" : "#fef3c7",
              }}
            >
              <strong>{message.role === "user" ? "나" : "AI"}</strong>

              <p
                style={{
                  marginTop: "6px",
                  lineHeight: "1.5",
                }}
              >
                {message.content}
              </p>
            </div>
          ))
        )}
      </div>

      {/* 질문 입력창 + 전송 버튼 */}
      <div
        style={{
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleEnter}
          placeholder="질문을 입력하세요"
          style={{
            flex: 1,
            padding: "12px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            fontSize: "16px",
          }}
        />

        <button
          onClick={handleSend}
          style={{
            padding: "12px 20px",
            backgroundColor: "#E6E6E6FF",
            color: "black",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          전송
        </button>
      </div>
    </section>
  );
}