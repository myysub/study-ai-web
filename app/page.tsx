"use client";

import { useState } from "react";

import ChatPanel from "../components/ChatPanel";
import PdfPanel from "../components/PdfPanel";
import { useResizablePanels } from "../hooks/useResizablePanels";

/**
 * 메인 페이지 컴포넌트
 *
 * 이 파일의 역할:
 * 1. PDF 패널과 AI 채팅 패널을 화면에 배치
 * 2. 왼쪽/오른쪽 위치 바꾸기
 * 3. 가운데 세로 막대를 이용한 크기 조절
 */
export default function Home() {
  /**
   * isReversed가 false이면:
   * 왼쪽 = PDF
   * 오른쪽 = AI
   *
   * isReversed가 true이면:
   * 왼쪽 = AI
   * 오른쪽 = PDF
   */
  const [isReversed, setIsReversed] = useState(false);

  /**
   * 가운데 막대를 드래그해서
   * 왼쪽/오른쪽 패널 크기를 조절하는 훅
   */
  const {
    containerRef,
    leftWidth,
    rightWidth,
    isDragging,
    startDragging,
  } = useResizablePanels();

  /**
   * CSS order를 이용해서 위치만 바꿈.
   */
  const pdfPanelOrder = isReversed ? 3 : 1;
  const chatPanelOrder = isReversed ? 1 : 3;

  /**
   * 왼쪽/오른쪽 박스 크기는 그대로 유지하고,
   * 안에 들어가는 내용만 서로 바뀌게 함.
   */
  const pdfPanelWidth = isReversed ? rightWidth : leftWidth;
  const chatPanelWidth = isReversed ? leftWidth : rightWidth;

  /**
   * 손가락으로 잡기 쉽게 실제 터치 영역은 18px로 키움.
   * 대신 가운데 보이는 선은 8px로 유지함.
   */
  const dividerHitAreaWidth = 18;
  const panelWidthOffset = dividerHitAreaWidth / 2;

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
        WebkitUserSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* 왼쪽/오른쪽 패널 위치 전환 버튼 */}
      <button
        onClick={() => setIsReversed((prev) => !prev)}
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          zIndex: 20,
          width: "36px",
          height: "36px",
          padding: 0,
          backgroundColor: "#e0e0e0",
          border: "1px solid #242424",
          borderRadius: "8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="/icons/swap_horizontal.svg"
          alt="창 바꾸기"
          style={{
            width: "22px",
            height: "22px",
            display: "block",
            objectFit: "contain",
          }}
        />
      </button>

      {/* PDF 패널 영역 */}
      <div
        style={{
          order: pdfPanelOrder,
          width: `calc(${pdfPanelWidth}% - ${panelWidthOffset}px)`,
          height: "100%",
          minWidth: 0,
        }}
      >
        <PdfPanel />
      </div>

      {/* 가운데 크기 조절 막대 */}
      <div
        onPointerDown={startDragging}
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={25}
        aria-valuemax={75}
        aria-valuenow={Math.round(leftWidth)}
        style={{
          order: 2,
          width: `${dividerHitAreaWidth}px`,
          minWidth: `${dividerHitAreaWidth}px`,
          height: "100%",
          cursor: "col-resize",
          zIndex: 10,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          backgroundColor: "transparent",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "100%",
            backgroundColor: isDragging ? "#6b7280" : "#d1d5db",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* AI 채팅 패널 영역 */}
      <div
        style={{
          order: chatPanelOrder,
          width: `calc(${chatPanelWidth}% - ${panelWidthOffset}px)`,
          height: "100%",
          minWidth: 0,
        }}
      >
        <ChatPanel />
      </div>
    </main>
  );
}
