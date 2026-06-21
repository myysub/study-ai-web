// 여러 파일에서 공통으로 사용하는 타입들을 모아둔 파일

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type Point = {
  x: number;
  y: number;
};

export type DrawTool = "pen" | "highlighter" | "eraser";

export type PenType = "ballpoint" | "fountain" | "pencil";