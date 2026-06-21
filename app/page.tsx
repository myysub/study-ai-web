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
 *
 * 실제 기능은 다른 파일에서 담당함.
 *
 * PDF 기능:
 * components/PdfPanel.tsx
 *
 * AI 채팅 기능:
 * components/ChatPanel.tsx
 *
 * 크기 조절 기능:
 * hooks/useResizablePanels.ts
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
   *
   * 중요한 점:
   * 컴포넌트를 새로 만들거나 삭제하는 게 아니라
   * 순서만 바꾸는 방식이라 상태가 유지됨.
   *
   * 예:
   * PDF 업로드 상태
   * 필기 상태
   * 채팅 기록
   */
  const pdfPanelOrder = isReversed ? 3 : 1;
  const chatPanelOrder = isReversed ? 1 : 3;

  /**
   * 왼쪽/오른쪽 박스 크기는 그대로 유지하고,
   * 안에 들어가는 내용만 서로 바뀌게 함.
   *
   * 예:
   * 왼쪽 70%, 오른쪽 30%인 상태에서 위치 바꾸기 클릭
   * → 여전히 왼쪽 70%, 오른쪽 30%
   * → 내용만 PDF ↔ AI로 바뀜
   */
  const pdfPanelWidth = isReversed ? rightWidth : leftWidth;
  const chatPanelWidth = isReversed ? leftWidth : rightWidth;

  return (
    <main
      ref={containerRef}
      style={{
        /**
         * PDF 패널, 가운데 막대, AI 패널을
         * 가로 방향으로 나란히 배치
         */
        display: "flex",

        /**
         * 브라우저 화면 높이를 꽉 채움
         */
        height: "100vh",

        /**
         * 전체 배경색
         */
        backgroundColor: "#f3f4f6",

        /**
         * 기본 글자색
         */
        color: "#111827",

        /**
         * 기본 폰트
         */
        fontFamily: "Arial, sans-serif",

        /**
         * 상단 가운데 버튼을 absolute로 배치하기 위해 필요
         */
        position: "relative",

        /**
         * 가운데 막대 드래그 중에는
         * 글자가 선택되지 않게 막음
         */
        userSelect: isDragging ? "none" : "auto",
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
          /**
           * PDF 패널의 화면상 순서
           */
          order: pdfPanelOrder,

          /**
           * 현재 크기 조절 상태에 맞춘 너비
           *
           * -4px를 하는 이유:
           * 가운데 막대 8px을 양쪽 패널이 반씩 나눠 갖는 느낌으로 맞추기 위함
           */
          width: `calc(${pdfPanelWidth}% - 4px)`,

          /**
           * 부모 main 높이를 꽉 채움
           */
          height: "100%",
        }}
      >
        <PdfPanel />
      </div>

      {/* 가운데 크기 조절 막대 */}
      <div
        onMouseDown={startDragging}
        style={{
          /**
           * 항상 PDF와 AI 사이에 위치
           */
          order: 2,

          /**
           * 막대 너비
           * 너무 얇으면 드래그하기 어려움
           */
          width: "8px",

          /**
           * 화면 전체 높이
           */
          height: "100%",

          /**
           * 드래그 중이면 진한 색으로 표시
           */
          backgroundColor: isDragging ? "#6b7280" : "#d1d5db",

          /**
           * 마우스를 올리면 좌우 크기 조절 커서 표시
           */
          cursor: "col-resize",

          /**
           * 패널보다 위에 있어야 드래그 가능
           */
          zIndex: 10,
        }}
      />

      {/* AI 채팅 패널 영역 */}
      <div
        style={{
          /**
           * AI 패널의 화면상 순서
           */
          order: chatPanelOrder,

          /**
           * 현재 크기 조절 상태에 맞춘 너비
           */
          width: `calc(${chatPanelWidth}% - 4px)`,

          /**
           * 부모 main 높이를 꽉 채움
           */
          height: "100%",
        }}
      >
        <ChatPanel />
      </div>
    </main>
  );
}