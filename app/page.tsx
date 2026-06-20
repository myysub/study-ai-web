"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isReversed, setIsReversed] = useState(false);

  const [pdfWidth, setPdfWidth] = useState(60);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLElement | null>(null);

  const handlePdfUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    setPdfUrl(fileUrl);
  };

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

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      let leftPercent = ((event.clientX - rect.left) / rect.width) * 100;

      if (leftPercent < 25) leftPercent = 25;
      if (leftPercent > 75) leftPercent = 75;

      if (isReversed) {
        setPdfWidth(100 - leftPercent);
      } else {
        setPdfWidth(leftPercent);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isReversed]);

  const leftWidth = isReversed ? 100 - pdfWidth : pdfWidth;
  const rightWidth = 100 - leftWidth;

  const PdfPanel = (
    <section
      style={{
        height: "100%",
        backgroundColor: "white",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          paddingTop: "30px",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>PDF 뷰어</h1>

        <input type="file" accept="application/pdf" onChange={handlePdfUpload} />
      </div>

      <div
        style={{
          height: "85%",
          border: "2px dashed #9ca3af",
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: "18px",
        }}
      >
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            title="PDF viewer"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        ) : (
          <p>PDF 파일을 선택하세요</p>
        )}
      </div>
    </section>
  );

  const ChatPanel = (
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
              <p style={{ marginTop: "6px", lineHeight: "1.5" }}>
                {message.content}
              </p>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
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
            backgroundColor: "black",
            color: "white",
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

  return (
    <main
      ref={containerRef}
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: "#f3f4f6",
        color: "#111827",
        fontFamily: "Arial, sans-serif",
        position: "relative",
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      <button
        onClick={() => setIsReversed((prev) => !prev)}
        style={{
          position: "absolute",
          top: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          padding: "8px 14px",
          backgroundColor: "#111827",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        왼쪽 오른쪽 바꾸기
      </button>

      <div
        style={{
          width: `calc(${leftWidth}% - 4px)`,
          height: "100%",
        }}
      >
        {isReversed ? ChatPanel : PdfPanel}
      </div>

      <div
        onMouseDown={() => setIsDragging(true)}
        style={{
          width: "8px",
          height: "100%",
          backgroundColor: isDragging ? "#6b7280" : "#d1d5db",
          cursor: "col-resize",
          zIndex: 10,
        }}
      />

      <div
        style={{
          width: `calc(${rightWidth}% - 4px)`,
          height: "100%",
        }}
      >
        {isReversed ? PdfPanel : ChatPanel}
      </div>
    </main>
  );
}