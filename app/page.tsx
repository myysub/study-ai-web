"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";

const PdfDocument = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);

const PdfPage = dynamic(
  () => import("react-pdf").then((mod) => mod.Page),
  { ssr: false }
);

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Point = {
  x: number;
  y: number;
};

type DrawTool = "pen" | "highlighter" | "eraser";
type PenType = "ballpoint" | "fountain" | "pencil";

export default function Home() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isReversed, setIsReversed] = useState(false);

  const [leftPanelWidth, setLeftPanelWidth] = useState(60);
  const [isDragging, setIsDragging] = useState(false);

  const [pdfPageWidth, setPdfPageWidth] = useState(700);

  const [isPenMode, setIsPenMode] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("pen");

  const [penColor, setPenColor] = useState("#111827");
  const [highlighterColor, setHighlighterColor] = useState("#fff176");
  const [penType, setPenType] = useState<PenType>("ballpoint");

  const [penWidth, setPenWidth] = useState(3);
  const [eraserWidth, setEraserWidth] = useState(20);

  const [pageDrawings, setPageDrawings] = useState<Record<number, string>>({});

  const containerRef = useRef<HTMLElement | null>(null);
  const pdfBoxRef = useRef<HTMLDivElement | null>(null);
  const pageWrapperRef = useRef<HTMLDivElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);

  useEffect(() => {
    import("react-pdf").then(({ pdfjs }) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    });
  }, []);

  const handlePdfUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setPdfFile(file);
    setPageNumber(1);
    setNumPages(0);
    setPageDrawings({});
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

  const saveCurrentDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL("image/png");

    setPageDrawings((prev) => ({
      ...prev,
      [pageNumber]: imageData,
    }));
  };

  const syncDrawingCanvas = () => {
    const drawingCanvas = drawingCanvasRef.current;
    const pageWrapper = pageWrapperRef.current;

    if (!drawingCanvas || !pageWrapper) return;

    const pdfCanvas = pageWrapper.querySelector("canvas");
    if (!pdfCanvas) return;

    const rect = pdfCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    drawingCanvas.style.width = `${rect.width}px`;
    drawingCanvas.style.height = `${rect.height}px`;

    drawingCanvas.width = Math.floor(rect.width * dpr);
    drawingCanvas.height = Math.floor(rect.height * dpr);

    const context = drawingCanvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

    const savedDrawing = pageDrawings[pageNumber];

    if (savedDrawing) {
      const image = new Image();

      image.onload = () => {
        context.drawImage(
          image,
          0,
          0,
          drawingCanvas.width,
          drawingCanvas.height
        );
      };

      image.src = savedDrawing;
    }
  };

  const getCanvasPoint = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ): Point | null => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const setupDrawingContext = (context: CanvasRenderingContext2D) => {
    const dpr = window.devicePixelRatio || 1;

    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.shadowBlur = 0;
    context.setLineDash([]);

    context.lineCap = "round";
    context.lineJoin = "round";

    if (drawTool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "rgba(0, 0, 0, 1)";
      context.fillStyle = "rgba(0, 0, 0, 1)";
      context.lineWidth = eraserWidth * dpr;
      return eraserWidth * dpr;
    }

    if (drawTool === "highlighter") {
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 0.35;
      context.strokeStyle = highlighterColor;
      context.fillStyle = highlighterColor;
      context.lineWidth = penWidth * 5 * dpr;
      return penWidth * 5 * dpr;
    }

    context.strokeStyle = penColor;
    context.fillStyle = penColor;

    if (penType === "ballpoint") {
      context.globalAlpha = 1;
      context.lineWidth = penWidth * dpr;
      return penWidth * dpr;
    }

    if (penType === "fountain") {
      context.globalAlpha = 0.95;
      context.lineWidth = penWidth * 1.4 * dpr;
      return penWidth * 1.4 * dpr;
    }

    context.globalAlpha = 0.6;
    context.lineWidth = penWidth * 0.9 * dpr;
    context.shadowBlur = 0.8 * dpr;
    context.shadowColor = penColor;

    return penWidth * 0.9 * dpr;
  };

  const drawDot = (point: Point) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const lineWidth = setupDrawingContext(context);

    context.beginPath();
    context.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  };

  const drawLine = (from: Point, to: Point) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    setupDrawingContext(context);

    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();

    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isPenMode) return;

    event.preventDefault();

    const point = getCanvasPoint(event);
    if (!point) return;

    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(event.pointerId);

    isDrawingRef.current = true;
    lastPointRef.current = point;

    drawDot(point);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isPenMode) return;
    if (!isDrawingRef.current) return;

    event.preventDefault();

    const currentPoint = getCanvasPoint(event);
    const lastPoint = lastPointRef.current;

    if (!currentPoint || !lastPoint) return;

    drawLine(lastPoint, currentPoint);
    lastPointRef.current = currentPoint;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isPenMode) return;

    event.preventDefault();

    isDrawingRef.current = false;
    lastPointRef.current = null;

    saveCurrentDrawing();
  };

  const clearCurrentPageDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    setPageDrawings((prev) => {
      const next = { ...prev };
      delete next[pageNumber];
      return next;
    });
  };

  const clearAllDrawings = () => {
    const canvas = drawingCanvasRef.current;

    if (canvas) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }

    setPageDrawings({});
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();

      let newLeftWidth = ((event.clientX - rect.left) / rect.width) * 100;

      if (newLeftWidth < 25) newLeftWidth = 25;
      if (newLeftWidth > 75) newLeftWidth = 75;

      setLeftPanelWidth(newLeftWidth);
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
  }, [isDragging]);

  useEffect(() => {
    const pdfBox = pdfBoxRef.current;
    if (!pdfBox) return;

    const updatePdfWidth = () => {
      const boxWidth = pdfBox.clientWidth;
      const calculatedWidth = boxWidth - 40;

      if (calculatedWidth < 250) {
        setPdfPageWidth(250);
      } else if (calculatedWidth > 900) {
        setPdfPageWidth(900);
      } else {
        setPdfPageWidth(calculatedWidth);
      }
    };

    updatePdfWidth();

    const resizeObserver = new ResizeObserver(() => {
      updatePdfWidth();
    });

    resizeObserver.observe(pdfBox);

    return () => {
      resizeObserver.disconnect();
    };
  }, [leftPanelWidth, isReversed]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      syncDrawingCanvas();
    }, 100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pageNumber, pdfPageWidth, leftPanelWidth, isReversed, pageDrawings]);

  const leftWidth = leftPanelWidth;
  const rightWidth = 100 - leftPanelWidth;

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
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>
          PDF 뷰어
        </h1>

        <input type="file" accept="application/pdf" onChange={handlePdfUpload} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setIsPenMode((prev) => !prev)}
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            backgroundColor: isPenMode ? "#111827" : "white",
            color: isPenMode ? "white" : "#111827",
            cursor: "pointer",
          }}
        >
          {isPenMode ? "필기 끄기" : "필기 켜기"}
        </button>

        <select
          value={drawTool}
          onChange={(event) => setDrawTool(event.target.value as DrawTool)}
          style={{
            padding: "8px 10px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
          }}
        >
          <option value="pen">펜</option>
          <option value="highlighter">형광펜</option>
          <option value="eraser">지우개</option>
        </select>

        {drawTool === "pen" && (
          <>
            <select
              value={penType}
              onChange={(event) => setPenType(event.target.value as PenType)}
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
              }}
            >
              <option value="ballpoint">볼펜</option>
              <option value="fountain">만년필</option>
              <option value="pencil">연필</option>
            </select>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "14px",
              }}
            >
              펜 색
              <input
                type="color"
                value={penColor}
                onChange={(event) => setPenColor(event.target.value)}
              />
            </label>
          </>
        )}

        {drawTool === "highlighter" && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "14px",
            }}
          >
            형광펜 색
            <input
              type="color"
              value={highlighterColor}
              onChange={(event) => setHighlighterColor(event.target.value)}
            />
          </label>
        )}

        {drawTool !== "eraser" && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "14px",
            }}
          >
            굵기
            <input
              type="range"
              min="1"
              max="10"
              value={penWidth}
              onChange={(event) => setPenWidth(Number(event.target.value))}
            />
            {penWidth}
          </label>
        )}

        {drawTool === "eraser" && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "14px",
            }}
          >
            지우개 크기
            <input
              type="range"
              min="5"
              max="60"
              value={eraserWidth}
              onChange={(event) => setEraserWidth(Number(event.target.value))}
            />
            {eraserWidth}
          </label>
        )}

        <button
          onClick={clearCurrentPageDrawing}
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            backgroundColor: "white",
            cursor: "pointer",
          }}
        >
          현재 페이지 지우기
        </button>

        <button
          onClick={clearAllDrawings}
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            backgroundColor: "white",
            cursor: "pointer",
          }}
        >
          전체 필기 지우기
        </button>
      </div>

      <div
        ref={pdfBoxRef}
        style={{
          height: "76%",
          border: "2px dashed #9ca3af",
          borderRadius: "12px",
          overflow: "auto",
          display: "flex",
          alignItems: pdfFile ? "flex-start" : "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: "18px",
          padding: pdfFile ? "12px" : "0",
          boxSizing: "border-box",
        }}
      >
        {pdfFile ? (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                position: "sticky",
                top: "0",
                zIndex: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                padding: "8px",
                backgroundColor: "white",
                border: "1px solid #d1d5db",
                borderRadius: "10px",
              }}
            >
              <button
                onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
                disabled={pageNumber <= 1}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  backgroundColor: pageNumber <= 1 ? "#e5e7eb" : "white",
                  cursor: pageNumber <= 1 ? "not-allowed" : "pointer",
                }}
              >
                이전
              </button>

              <span
                style={{
                  fontSize: "15px",
                  color: "#111827",
                  minWidth: "80px",
                  textAlign: "center",
                }}
              >
                {pageNumber} / {numPages || "?"}
              </span>

              <button
                onClick={() =>
                  setPageNumber((prev) => Math.min(prev + 1, numPages))
                }
                disabled={numPages === 0 || pageNumber >= numPages}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  backgroundColor:
                    numPages === 0 || pageNumber >= numPages
                      ? "#e5e7eb"
                      : "white",
                  cursor:
                    numPages === 0 || pageNumber >= numPages
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                다음
              </button>
            </div>

            <div
              ref={pageWrapperRef}
              style={{
                position: "relative",
                display: "inline-block",
              }}
            >
              <PdfDocument
                file={pdfFile}
                onLoadSuccess={({ numPages }) => {
                  setNumPages(numPages);
                  setPageNumber(1);
                }}
                onLoadError={(error) => {
                  console.error("PDF load error:", error);
                }}
                loading={<p>PDF 불러오는 중...</p>}
                error={<p>PDF를 불러오지 못했습니다.</p>}
              >
                <PdfPage
                  pageNumber={pageNumber}
                  width={pdfPageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onRenderSuccess={() => {
                    window.setTimeout(() => {
                      syncDrawingCanvas();
                    }, 0);
                  }}
                />
              </PdfDocument>

              <canvas
                ref={drawingCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  zIndex: 4,
                  pointerEvents: isPenMode ? "auto" : "none",
                  touchAction: isPenMode ? "none" : "auto",
                  cursor:
                    drawTool === "eraser"
                      ? "grab"
                      : isPenMode
                        ? "crosshair"
                        : "default",
                }}
              />
            </div>
          </div>
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