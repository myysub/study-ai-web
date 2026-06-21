"use client";

import dynamic from "next/dynamic";
import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

/**
 * react-pdf는 브라우저 전용 기능을 사용함.
 * Next.js 서버 실행 중 DOMMatrix 오류를 피하기 위해
 * dynamic import와 ssr:false를 사용함.
 */
const PdfDocument = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false },
);

const PdfPage = dynamic(() => import("react-pdf").then((mod) => mod.Page), {
  ssr: false,
});

/**
 * 필기 좌표 타입
 */
type Point = {
  x: number;
  y: number;
};

/**
 * 필기 도구 타입
 */
type DrawTool = "pen" | "highlighter" | "eraser";

/**
 * 펜 종류 타입
 */
type PenType = "ballpoint" | "fountain" | "pencil";

/**
 * PDF 뷰어 + 필기 패널
 *
 * 담당 기능:
 * 1. PDF 업로드
 * 2. PDF 페이지 출력
 * 3. 페이지 이동
 * 4. PDF 위 필기
 * 5. 펜 / 형광펜 / 지우개 UI
 */
export default function PdfPanel() {
  /**
   * 업로드된 PDF 파일
   */
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  /**
   * PDF 전체 페이지 수
   */
  const [numPages, setNumPages] = useState(0);

  /**
   * 현재 보고 있는 페이지 번호
   */
  const [pageNumber, setPageNumber] = useState(1);

  /**
   * PDF 페이지 화면 표시 너비
   */
  const [pdfPageWidth, setPdfPageWidth] = useState(700);

  /**
   * 현재 선택된 도구
   */
  const [drawTool, setDrawTool] = useState<DrawTool>("pen");

  /**
   * 펜 색상
   */
  const [penColor, setPenColor] = useState("#111827");

  /**
   * 형광펜 색상
   */
  const [highlighterColor, setHighlighterColor] = useState("#fff176");

  /**
   * 펜 종류
   */
  const [penType, setPenType] = useState<PenType>("ballpoint");

  /**
   * 펜 또는 형광펜 굵기
   */
  const [penWidth, setPenWidth] = useState(3);

  /**
   * 지우개 크기
   */
  const [eraserWidth, setEraserWidth] = useState(20);

  /**
   * 페이지별 필기 저장
   *
   * 현재는 브라우저 메모리에만 저장됨.
   * 새로고침하면 사라짐.
   */
  const [pageDrawings, setPageDrawings] = useState<Record<number, string>>({});

  /**
   * pageDrawings의 최신 값을 즉시 참조하기 위한 ref.
   *
   * PDF를 손가락으로 확대/축소하면 react-pdf가 다시 렌더링되고,
   * 그 과정에서 필기 canvas가 다시 그려짐.
   * 이때 저장된 필기를 바로 복원하기 위해 state와 ref를 같이 사용함.
   */
  const pageDrawingsRef = useRef<Record<number, string>>({});

  /**
   * 손가락 확대/축소 범위
   */
  const MIN_PDF_WIDTH = 250;
  const MAX_PDF_WIDTH = 1800;

  /**
   * iPad / Apple Pencil / 손가락 이벤트 확인용 화면 로그
   *
   * console.log는 브라우저 개발자도구에서만 보이기 때문에,
   * 아이패드에서도 바로 확인할 수 있도록 화면에도 띄움.
   */
  const [pointerLog, setPointerLog] = useState(
    "PDF 위를 펜 / 손가락 / 마우스로 눌러보세요.",
  );

  /**
   * pointermove 로그가 너무 많이 찍히지 않도록 시간 제한을 둠.
   */
  const lastPointerLogTimeRef = useRef(0);

  /**
   * PDF 표시 영역 ref
   * PDF 영역의 실제 너비를 계산할 때 사용함.
   */
  const pdfBoxRef = useRef<HTMLDivElement | null>(null);

  /**
   * PDF 페이지와 필기 canvas를 감싸는 영역 ref
   */
  const pageWrapperRef = useRef<HTMLDivElement | null>(null);

  /**
   * 실제 필기가 그려지는 투명 canvas ref
   */
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * 현재 필기 중인지 저장
   */
  const isDrawingRef = useRef(false);

  /**
   * 이전 필기 좌표 저장
   */
  const lastPointRef = useRef<Point | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  /**
   * 손가락으로 PDF를 직접 드래그/스크롤하기 위한 상태
   *
   * canvas의 touchAction을 none으로 두면 브라우저 기본 스크롤은 막힘.
   * 대신 touch 입력일 때 직접 pdfBoxRef의 scroll 위치를 바꿔서
   * 손가락 드래그가 PDF 스크롤처럼 동작하게 함.
   */
  const touchScrollRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  /**
   * 손가락 포인터들을 저장함.
   * 손가락 1개는 PDF 드래그/스크롤, 손가락 2개는 PDF 확대/축소로 처리함.
   */
  const touchPointersRef = useRef<Map<number, Point>>(new Map());

  /**
   * 두 손가락 확대/축소 상태 저장
   */
  const pinchZoomRef = useRef<{
    startDistance: number;
    startWidth: number;
    centerContentX: number;
    centerContentY: number;
    centerBoxX: number;
    centerBoxY: number;
  } | null>(null);

  /**
   * requestAnimationFrame 중복 실행 방지용 ref
   */
  const zoomScrollFrameRef = useRef<number | null>(null);

  /**
   * 작은 버튼 공통 UI 스타일
   *
   * 이 값을 바꾸면 지우기, 이전/다음 버튼 크기가 같이 바뀜.
   */
  const smallButtonStyle: CSSProperties = {
    padding: "4px 8px",
    borderRadius: "5px",
    border: "1px solid #d1d5db",
    backgroundColor: "white",
    cursor: "pointer",
    fontSize: "12px",
    height: "28px",
    lineHeight: "1",
  };

  /**
   * 작은 선택창 공통 UI 스타일
   *
   * 펜 / 형광펜 / 지우개 선택창에 사용함.
   */
  const smallSelectStyle: CSSProperties = {
    padding: "4px 6px",
    borderRadius: "5px",
    border: "1px solid #d1d5db",
    fontSize: "12px",
    height: "28px",
  };

  /**
   * 라벨 공통 UI 스타일
   *
   * 펜 색, 굵기, 지우개 크기 같은 UI에 사용함.
   */
  const smallLabelStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    height: "28px",
  };

  /**
   * 필기 도구 바 전체 UI 스타일
   */
  const toolBarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "0",
    flexWrap: "nowrap",
    whiteSpace: "nowrap",
  };

  /**
   * react-pdf worker 설정
   */
  useEffect(() => {
    import("react-pdf").then(({ pdfjs }) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    });
  }, []);

  /**
   * 숫자를 최소/최대 범위 안으로 제한함.
   */
  const clamp = (value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
  };

  /**
   * PDF 파일 업로드 처리
   */
  const handlePdfUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);

    setPdfFile(file);
    setPdfUrl(url);
    setPageNumber(1);
    setNumPages(0);
    pageDrawingsRef.current = {};
    setPageDrawings({});

    event.target.value = "";
  };
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);
  /**
   * 현재 페이지의 필기를 이미지로 저장
   */
  const saveCurrentDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL("image/png");

    const nextDrawings = {
      ...pageDrawingsRef.current,
      [pageNumber]: imageData,
    };

    pageDrawingsRef.current = nextDrawings;
    setPageDrawings(nextDrawings);
  };

  /**
   * PDF canvas와 필기 canvas의 크기를 맞춤.
   * 두 canvas 크기가 같아야 필기 위치가 PDF 위치와 맞음.
   */
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

    const savedDrawing = pageDrawingsRef.current[pageNumber];

    if (savedDrawing) {
      const image = new Image();

      image.onload = () => {
        context.drawImage(
          image,
          0,
          0,
          drawingCanvas.width,
          drawingCanvas.height,
        );
      };

      image.src = savedDrawing;
    }
  };

  /**
   * 마우스, 펜, 손가락 좌표를 canvas 내부 좌표로 변환
   *
   * event.clientX, event.clientY는 브라우저 화면 기준 좌표임.
   * 그런데 canvas에 그리려면 canvas 내부 기준 좌표가 필요함.
   */
  const getCanvasPoint = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): Point | null => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  /**
   * 현재 선택한 도구에 맞게 canvas 그리기 설정을 바꿈
   *
   * 펜:
   * 일반 선을 그림
   *
   * 형광펜:
   * 투명도가 있는 굵은 선을 그림
   *
   * 지우개:
   * 이미 그린 선을 투명하게 지움
   */
  const setupDrawingContext = (context: CanvasRenderingContext2D) => {
    const dpr = window.devicePixelRatio || 1;

    /**
     * 이전 도구 설정이 남아있지 않도록 기본값으로 초기화
     */
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.shadowBlur = 0;
    context.setLineDash([]);
    context.lineCap = "round";
    context.lineJoin = "round";

    /**
     * 지우개 설정
     *
     * destination-out은 기존 그림을 지우는 모드임.
     */
    if (drawTool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "rgba(0, 0, 0, 1)";
      context.fillStyle = "rgba(0, 0, 0, 1)";
      context.lineWidth = eraserWidth * dpr;
      return eraserWidth * dpr;
    }

    /**
     * 형광펜 설정
     *
     * globalAlpha를 낮춰서 PDF 내용이 비쳐 보이게 함.
     */
    if (drawTool === "highlighter") {
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 0.35;
      context.strokeStyle = highlighterColor;
      context.fillStyle = highlighterColor;
      context.lineWidth = penWidth * 5 * dpr;
      return penWidth * 5 * dpr;
    }

    /**
     * 일반 펜 공통 색상 설정
     */
    context.strokeStyle = penColor;
    context.fillStyle = penColor;

    /**
     * 볼펜 설정
     */
    if (penType === "ballpoint") {
      context.globalAlpha = 1;
      context.lineWidth = penWidth * dpr;
      return penWidth * dpr;
    }

    /**
     * 만년필 설정
     */
    if (penType === "fountain") {
      context.globalAlpha = 0.95;
      context.lineWidth = penWidth * 1.4 * dpr;
      return penWidth * 1.4 * dpr;
    }

    /**
     * 연필 설정
     */
    context.globalAlpha = 0.6;
    context.lineWidth = penWidth * 0.9 * dpr;
    context.shadowBlur = 0.8 * dpr;
    context.shadowColor = penColor;

    return penWidth * 0.9 * dpr;
  };

  /**
   * 점 하나를 찍는 함수
   *
   * 마우스나 펜으로 한 번만 콕 찍어도
   * 점이 보이게 하기 위해 필요함.
   */
  const drawDot = (point: Point) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const lineWidth = setupDrawingContext(context);

    context.beginPath();
    context.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2);
    context.fill();

    /**
     * 다음 그리기에 영향이 없도록 기본 상태로 복구
     */
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  };

  /**
   * 두 좌표 사이에 선을 그리는 함수
   *
   * 이전 좌표와 현재 좌표를 계속 이어서
   * 자연스러운 필기 선을 만듦.
   */
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

    /**
     * 다음 그리기에 영향이 없도록 기본 상태로 복구
     */
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  };

  /**
   * PDF 스크롤 잠금/해제
   *
   * 펜으로 필기하는 순간에는 PDF 스크롤 컨테이너와 wrapper의
   * 기본 제스처를 확실히 잠가야 iPad에서 필기가 스크롤로 바뀌지 않음.
   */
  const setPdfGestureLock = (locked: boolean) => {
    const pdfBox = pdfBoxRef.current;
    const pageWrapper = pageWrapperRef.current;
    const canvas = drawingCanvasRef.current;

    if (pdfBox) {
      pdfBox.style.touchAction = locked ? "none" : "pan-x pan-y";
      pdfBox.style.overscrollBehavior = locked ? "contain" : "auto";
    }

    if (pageWrapper) {
      pageWrapper.style.touchAction = locked ? "none" : "pan-x pan-y";
    }

    if (canvas) {
      canvas.style.touchAction = "none";
    }
  };

  /**
   * 일부 iPad/Safari 환경에서는 애플펜슬이 pen이 아니라 touch처럼 들어올 수 있음.
   * 이때 손가락은 width/height가 크게 잡히고, 펜촉은 작게 잡히는 경우가 많아서
   * 작은 touch 입력은 스타일러스 후보로 보고 필기 처리함.
   */
  const isProbablyStylusTouch = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    return (
      event.pointerType === "touch" &&
      event.pressure > 0 &&
      event.width <= 6 &&
      event.height <= 6
    );
  };

  /**
   * 입력 필터
   *
   * pen: 애플펜슬, 스타일러스 입력이므로 필기 처리함.
   * mouse: PC 테스트용 마우스 입력이므로 필기 처리함.
   * 작은 touch: 일부 브라우저에서 펜이 touch로 잡히는 경우를 보정함.
   * 일반 touch: 손가락, 손바닥 입력이므로 필기하지 않고 PDF 드래그로 처리함.
   */
  const isDrawingPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    return (
      event.pointerType === "pen" ||
      event.pointerType === "mouse" ||
      isProbablyStylusTouch(event)
    );
  };

  /**
   * 손가락으로 PDF를 드래그하기 시작함.
   *
   * canvas의 touchAction을 none으로 설정해 펜 스크롤 오작동을 막았기 때문에,
   * 손가락 스크롤은 브라우저 기본 동작에 맡기지 않고 직접 구현함.
   */
  const startTouchScrollFromPoint = (pointerId: number, point: Point) => {
    const pdfBox = pdfBoxRef.current;

    if (!pdfBox) return;

    touchScrollRef.current = {
      pointerId,
      startX: point.x,
      startY: point.y,
      scrollLeft: pdfBox.scrollLeft,
      scrollTop: pdfBox.scrollTop,
    };
  };

  const startTouchScroll = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;

    startTouchScrollFromPoint(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (!canvas) return;

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // 일부 브라우저에서 capture가 실패해도 스크롤은 계속 시도함.
    }
  };

  /**
   * 손가락 이동량만큼 PDF 영역을 직접 스크롤함.
   */
  const moveTouchScroll = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const touchScroll = touchScrollRef.current;
    const pdfBox = pdfBoxRef.current;

    if (!touchScroll || !pdfBox) return;
    if (touchScroll.pointerId !== event.pointerId) return;

    event.preventDefault();

    const dx = event.clientX - touchScroll.startX;
    const dy = event.clientY - touchScroll.startY;

    pdfBox.scrollLeft = touchScroll.scrollLeft - dx;
    pdfBox.scrollTop = touchScroll.scrollTop - dy;
  };

  /**
   * 손가락 PDF 드래그를 끝냄.
   */
  const endTouchScroll = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const touchScroll = touchScrollRef.current;
    const canvas = drawingCanvasRef.current;

    if (!touchScroll || touchScroll.pointerId !== event.pointerId) return;

    event.preventDefault();

    if (canvas) {
      try {
        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
      } catch {
        // release 실패는 무시해도 됨.
      }
    }

    touchScrollRef.current = null;
  };

  /**
   * 손가락 포인터 목록에 현재 손가락 위치를 저장함.
   */
  const updateTouchPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    touchPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  };

  /**
   * 두 점 사이 거리를 구함.
   */
  const getDistance = (a: Point, b: Point) => {
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  /**
   * 두 손가락 중심점을 구함.
   */
  const getCenterPoint = (a: Point, b: Point): Point => {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  };

  /**
   * 손가락 2개로 PDF 확대/축소를 시작함.
   */
  const startPinchZoom = () => {
    const pdfBox = pdfBoxRef.current;
    const points = Array.from(touchPointersRef.current.values());

    if (!pdfBox || points.length < 2) return;

    /**
     * 확대/축소 직전에 현재 필기를 저장해 둠.
     * 그래야 PDF 크기가 바뀌며 canvas가 다시 맞춰질 때 필기가 사라지지 않음.
     */
    saveCurrentDrawing();

    const [firstPoint, secondPoint] = points;
    const startDistance = getDistance(firstPoint, secondPoint);
    const center = getCenterPoint(firstPoint, secondPoint);
    const boxRect = pdfBox.getBoundingClientRect();

    pinchZoomRef.current = {
      startDistance,
      startWidth: pdfPageWidth,
      centerContentX: pdfBox.scrollLeft + center.x - boxRect.left,
      centerContentY: pdfBox.scrollTop + center.y - boxRect.top,
      centerBoxX: center.x - boxRect.left,
      centerBoxY: center.y - boxRect.top,
    };

    /**
     * 두 손가락 확대/축소 중에는 한 손가락 스크롤 상태를 끊음.
     */
    touchScrollRef.current = null;
  };

  /**
   * 두 손가락 간격 변화에 맞춰 PDF 페이지 너비를 바꿈.
   */
  const movePinchZoom = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pdfBox = pdfBoxRef.current;
    const pinchZoom = pinchZoomRef.current;
    const points = Array.from(touchPointersRef.current.values());

    if (!pdfBox || !pinchZoom || points.length < 2) return;

    event.preventDefault();
    event.stopPropagation();

    const [firstPoint, secondPoint] = points;
    const currentDistance = getDistance(firstPoint, secondPoint);

    if (pinchZoom.startDistance <= 0) return;

    const scale = currentDistance / pinchZoom.startDistance;
    const nextWidth = clamp(
      Math.round(pinchZoom.startWidth * scale),
      MIN_PDF_WIDTH,
      MAX_PDF_WIDTH,
    );

    const appliedScale = nextWidth / pinchZoom.startWidth;

    setPdfPageWidth(nextWidth);

    /**
     * 확대/축소 중심이 손가락 중간 지점 근처에 남도록 스크롤 위치를 보정함.
     */
    if (zoomScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomScrollFrameRef.current);
    }

    zoomScrollFrameRef.current = window.requestAnimationFrame(() => {
      pdfBox.scrollLeft =
        pinchZoom.centerContentX * appliedScale - pinchZoom.centerBoxX;
      pdfBox.scrollTop =
        pinchZoom.centerContentY * appliedScale - pinchZoom.centerBoxY;
      zoomScrollFrameRef.current = null;
    });
  };

  /**
   * 손가락이 줄어들었을 때 확대/축소 상태를 정리함.
   */
  const finishOrRestartPinchZoom = () => {
    if (!pinchZoomRef.current) return;

    if (touchPointersRef.current.size >= 2) {
      startPinchZoom();
      return;
    }

    pinchZoomRef.current = null;

    const remainingTouch = Array.from(touchPointersRef.current.entries())[0];

    if (remainingTouch) {
      const [pointerId, point] = remainingTouch;
      startTouchScrollFromPoint(pointerId, point);
    }
  };

  /**
   * pointer 이벤트 값을 화면과 콘솔에 같이 출력함.
   *
   * 확인할 것:
   * 1. 애플펜슬이 pointerType: "pen"으로 들어오는지
   * 2. 손가락이 pointerType: "touch"로 들어오는지
   * 3. 필기 중 스크롤될 때 pointerType / pressure / width / height가 바뀌는지
   */
  const writePointerLog = (
    event: ReactPointerEvent<HTMLCanvasElement>,
    phase: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    force = false,
  ) => {
    const now = Date.now();

    /**
     * pointermove는 너무 자주 발생하므로 150ms마다 한 번만 표시함.
     */
    if (!force && phase === "pointermove" && now - lastPointerLogTimeRef.current < 150) {
      return;
    }

    lastPointerLogTimeRef.current = now;

    const log = {
      phase,
      pointerType: event.pointerType,
      pointerId: event.pointerId,
      width: event.width,
      height: event.height,
      pressure: event.pressure,
      buttons: event.buttons,
      button: event.button,
      isPrimary: event.isPrimary,
      activePointerId: activePointerIdRef.current,
      isDrawing: isDrawingRef.current,
      touchCount: touchPointersRef.current.size,
      isPinching: pinchZoomRef.current !== null,
      pdfPageWidth,
    };

    console.log("PDF pointer log", log);
    setPointerLog(JSON.stringify(log, null, 2));
  };

  /**
   * 필기 시작
   *
   * 펜 또는 마우스는 필기를 시작함.
   * 손가락은 필기하지 않고 PDF 드래그/스크롤로 처리함.
   *
   * 중요:
   * touch 분기보다 isDrawingPointer를 먼저 검사해야 함.
   * 그래야 애플펜슬이 touch로 들어오는 iPad 환경에서도 스크롤이 아니라 필기가 됨.
   */
  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    writePointerLog(event, "pointerdown", true);

    const canDraw = isDrawingPointer(event);

    if (canDraw) {
      /**
       * 마우스는 왼쪽 버튼만 필기 처리함.
       */
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      /**
       * 이미 필기 중이면 다른 입력은 무시함.
       */
      if (activePointerIdRef.current !== null) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      /**
       * 펜 필기가 시작되면 스크롤 제스처를 강제로 잠금.
       */
      setPdfGestureLock(true);
      touchScrollRef.current = null;

      const point = getCanvasPoint(event);
      if (!point) return;

      const canvas = drawingCanvasRef.current;
      if (!canvas) return;

      /**
       * pointer capture로 현재 펜/마우스 입력만 끝까지 추적함.
       * 중간에 손바닥 터치가 들어와도 pointerId가 다르면 무시됨.
       */
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // 일부 브라우저에서 capture가 실패해도 필기는 계속 가능하게 둠.
      }

      activePointerIdRef.current = event.pointerId;
      isDrawingRef.current = true;
      lastPointRef.current = point;

      drawDot(point);
      return;
    }

    /**
     * 일반 손가락/손바닥 입력
     *
     * 펜으로 필기 중이면 손바닥 터치는 완전히 무시함.
     * 필기 중이 아니면 손가락 드래그로 PDF 스크롤을 직접 처리함.
     */
    if (event.pointerType === "touch") {
      if (activePointerIdRef.current !== null || isDrawingRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      updateTouchPointer(event);

      const canvas = drawingCanvasRef.current;
      if (canvas) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // capture 실패는 무시해도 됨.
        }
      }

      if (touchPointersRef.current.size >= 2) {
        startPinchZoom();
        return;
      }

      startTouchScroll(event);
      return;
    }
  };

  /**
   * 필기 중
   *
   * 필기를 시작한 펜/마우스 pointerId와 같은 입력만 선으로 이어 그림.
   * 손가락은 필기 중이 아닐 때만 PDF 스크롤로 처리함.
   */
  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    writePointerLog(event, "pointermove");

    /**
     * 현재 필기를 시작한 입력이면 pointerType이 touch처럼 들어와도
     * 스크롤이 아니라 필기로 계속 처리함.
     */
    if (activePointerIdRef.current === event.pointerId && isDrawingRef.current) {
      event.preventDefault();
      event.stopPropagation();

      const currentPoint = getCanvasPoint(event);
      const lastPoint = lastPointRef.current;

      if (!currentPoint || !lastPoint) return;

      drawLine(lastPoint, currentPoint);
      lastPointRef.current = currentPoint;
      return;
    }

    if (event.pointerType === "touch") {
      /**
       * 펜으로 필기 중인 상태에서 들어오는 손바닥 move는 스크롤시키지 않음.
       */
      if (activePointerIdRef.current !== null || isDrawingRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      updateTouchPointer(event);

      if (pinchZoomRef.current || touchPointersRef.current.size >= 2) {
        if (!pinchZoomRef.current) {
          startPinchZoom();
        }

        movePinchZoom(event);
        return;
      }

      moveTouchScroll(event);
      return;
    }
  };

  /**
   * 필기 종료 또는 손가락 드래그 종료
   */
  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    writePointerLog(
      event,
      event.type === "pointercancel" ? "pointercancel" : "pointerup",
      true,
    );

    if (activePointerIdRef.current === event.pointerId && isDrawingRef.current) {
      event.preventDefault();
      event.stopPropagation();

      const canvas = drawingCanvasRef.current;

      if (canvas) {
        try {
          if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
          }
        } catch {
          // release 실패는 무시해도 됨.
        }
      }

      isDrawingRef.current = false;
      lastPointRef.current = null;
      activePointerIdRef.current = null;
      setPdfGestureLock(false);

      saveCurrentDrawing();
      return;
    }

    if (event.pointerType === "touch") {
      /**
       * 손바닥 / 손가락의 pointerup, pointercancel은 현재 필기를 끝내면 안 됨.
       */
      if (activePointerIdRef.current !== null || isDrawingRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (touchScrollRef.current?.pointerId === event.pointerId) {
        endTouchScroll(event);
      }

      touchPointersRef.current.delete(event.pointerId);

      const canvas = drawingCanvasRef.current;

      if (canvas) {
        try {
          if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
          }
        } catch {
          // release 실패는 무시해도 됨.
        }
      }

      finishOrRestartPinchZoom();
      return;
    }
  };

  /**
   * 현재 페이지의 필기만 지우기
   */
  const clearCurrentPageDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    const nextDrawings = { ...pageDrawingsRef.current };
    delete nextDrawings[pageNumber];

    pageDrawingsRef.current = nextDrawings;
    setPageDrawings(nextDrawings);
  };

  /**
   * 모든 페이지의 필기 지우기
   */
  const clearAllDrawings = () => {
    const canvas = drawingCanvasRef.current;

    if (canvas) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }

    pageDrawingsRef.current = {};
    setPageDrawings({});
  };

  /**
   * PDF 패널 크기에 맞게 PDF 페이지 너비 자동 조절
   *
   * 가운데 막대로 패널 크기를 바꾸면
   * PDF 페이지 너비도 같이 조절됨.
   */
  useEffect(() => {
    const pdfBox = pdfBoxRef.current;
    if (!pdfBox) return;

    const updatePdfWidth = () => {
      const boxWidth = pdfBox.clientWidth;
      const calculatedWidth = boxWidth - 40;

      /**
       * PDF가 너무 작거나 커지지 않도록 제한
       */
      if (calculatedWidth < 250) {
        setPdfPageWidth(250);
      } else if (calculatedWidth > 900) {
        setPdfPageWidth(900);
      } else {
        setPdfPageWidth(calculatedWidth);
      }
    };

    updatePdfWidth();

    /**
     * ResizeObserver:
     * PDF 박스 크기가 바뀌는지 감시하는 기능
     */
    const resizeObserver = new ResizeObserver(() => {
      updatePdfWidth();
    });

    resizeObserver.observe(pdfBox);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  /**
   * 페이지 이동, PDF 크기 변화, 필기 데이터 변화가 있을 때
   * 필기 canvas를 다시 PDF canvas와 맞춤.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      syncDrawingCanvas();
    }, 100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pageNumber, pdfPageWidth, pageDrawings]);

  /**
   * iPad/Safari 보정
   *
   * React 이벤트만으로는 일부 브라우저에서 펜 이동 중 스크롤 제스처가
   * 먼저 잡히는 경우가 있어서 native listener를 passive:false로 추가함.
   * 필기 중일 때만 기본 touch/gesture 동작을 막고, 평소 손가락 드래그는
   * 위의 pointer 핸들러에서 직접 스크롤 처리함.
   */
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const preventWhileDrawing = (event: TouchEvent) => {
      if (
        activePointerIdRef.current !== null ||
        isDrawingRef.current ||
        pinchZoomRef.current !== null
      ) {
        event.preventDefault();
      }
    };

    const preventGestureWhileDrawing = (event: Event) => {
      if (
        activePointerIdRef.current !== null ||
        isDrawingRef.current ||
        pinchZoomRef.current !== null
      ) {
        event.preventDefault();
      }
    };

    const isNativeProbablyStylusTouch = (event: PointerEvent) => {
      return (
        event.pointerType === "touch" &&
        event.pressure > 0 &&
        event.width <= 6 &&
        event.height <= 6
      );
    };

    const isNativeDrawingPointer = (event: PointerEvent) => {
      return (
        event.pointerType === "pen" ||
        event.pointerType === "mouse" ||
        isNativeProbablyStylusTouch(event)
      );
    };

    const preventPointerOnCanvas = (event: PointerEvent) => {
      if (isNativeDrawingPointer(event)) {
        event.preventDefault();
      }
    };

    const preventActivePointerOnDocument = (event: PointerEvent) => {
      if (
        activePointerIdRef.current !== null ||
        isDrawingRef.current ||
        pinchZoomRef.current !== null
      ) {
        event.preventDefault();
      }
    };

    const options: AddEventListenerOptions = { passive: false };

    canvas.addEventListener("touchstart", preventWhileDrawing, options);
    canvas.addEventListener("touchmove", preventWhileDrawing, options);
    canvas.addEventListener("pointerdown", preventPointerOnCanvas, options);
    canvas.addEventListener("pointermove", preventPointerOnCanvas, options);

    document.addEventListener("touchmove", preventWhileDrawing, options);
    document.addEventListener("pointermove", preventActivePointerOnDocument, options);

    /**
     * Safari 전용 gesture 이벤트 방어.
     */
    document.addEventListener("gesturestart", preventGestureWhileDrawing, options);
    document.addEventListener("gesturechange", preventGestureWhileDrawing, options);

    return () => {
      canvas.removeEventListener("touchstart", preventWhileDrawing);
      canvas.removeEventListener("touchmove", preventWhileDrawing);
      canvas.removeEventListener("pointerdown", preventPointerOnCanvas);
      canvas.removeEventListener("pointermove", preventPointerOnCanvas);

      document.removeEventListener("touchmove", preventWhileDrawing);
      document.removeEventListener("pointermove", preventActivePointerOnDocument);
      document.removeEventListener("gesturestart", preventGestureWhileDrawing);
      document.removeEventListener("gesturechange", preventGestureWhileDrawing);
    };
  }, [pdfUrl, pageNumber]);

  return (
    <section
      style={{
        height: "100%",
        backgroundColor: "white",
        padding: "10px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* 상단 영역: 제목 + PDF 파일 선택 */}
      <div
        style={{
          /**
           * 제목과 파일 선택 input을 가로로 배치
           */
          display: "flex",

          /**
           * 세로 가운데 정렬
           */
          alignItems: "center",

          /**
           * 제목은 왼쪽, 파일 선택은 오른쪽에 배치
           */
          justifyContent: "space-between",

          /**
           * 아래 필기 도구 바와의 간격
           */
          marginBottom: "10px",

          /**
           * 상단의 '왼쪽 오른쪽 바꾸기' 버튼과 겹치지 않게 여백 추가
           */
          paddingTop: "28px",

          /**
           * 제목과 파일 선택 사이 간격
           */
          gap: "8px",

          /**
           * 화면이 좁아지면 줄바꿈 허용
           */
          flexWrap: "wrap",
        }}
      >
        {/* PDF 패널 제목 */}
        <h1
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            margin: 0,
          }}
        ></h1>

        {/* PDF 파일 선택 input */}
        {/* 상단 한 줄 툴바 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            paddingTop: "8px",
            marginBottom: "8px",
            width: "100%",
            overflowX: "auto",
            whiteSpace: "nowrap",
          }}
        >
          {/* 왼쪽 필기 도구 묶음 */}
          <div style={toolBarStyle}>
            {/* 펜 / 형광펜 / 지우개 선택창 */}
            <select
              value={drawTool}
              onChange={(event) => setDrawTool(event.target.value as DrawTool)}
              style={smallSelectStyle}
            >
              <option value="pen">펜</option>
              <option value="highlighter">형광펜</option>
              <option value="eraser">지우개</option>
            </select>

            {/* 펜 선택 시 펜 종류와 펜 색상 표시 */}
            {drawTool === "pen" && (
              <>
                <select
                  value={penType}
                  onChange={(event) =>
                    setPenType(event.target.value as PenType)
                  }
                  style={smallSelectStyle}
                >
                  <option value="ballpoint">볼펜</option>
                  <option value="fountain">만년필</option>
                  <option value="pencil">연필</option>
                </select>

                <label style={smallLabelStyle}>
                  펜 색
                  <input
                    type="color"
                    value={penColor}
                    onChange={(event) => setPenColor(event.target.value)}
                    style={{
                      width: "28px",
                      height: "22px",
                      padding: 0,
                      border: "none",
                    }}
                  />
                </label>
              </>
            )}

            {/* 형광펜 선택 시 형광펜 색상 표시 */}
            {drawTool === "highlighter" && (
              <label style={smallLabelStyle}>
                형광펜 색
                <input
                  type="color"
                  value={highlighterColor}
                  onChange={(event) => setHighlighterColor(event.target.value)}
                  style={{
                    width: "28px",
                    height: "22px",
                    padding: 0,
                    border: "none",
                  }}
                />
              </label>
            )}

            {/* 펜 또는 형광펜 굵기 조절 */}
            {drawTool !== "eraser" && (
              <label style={smallLabelStyle}>
                굵기
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={penWidth}
                  onChange={(event) => setPenWidth(Number(event.target.value))}
                  style={{
                    width: "120px",
                  }}
                />
                {penWidth}
              </label>
            )}

            {/* 지우개 크기 조절 */}
            {drawTool === "eraser" && (
              <label style={smallLabelStyle}>
                지우개
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={eraserWidth}
                  onChange={(event) =>
                    setEraserWidth(Number(event.target.value))
                  }
                  style={{
                    width: "120px",
                  }}
                />
                {eraserWidth}
              </label>
            )}

            <button onClick={clearCurrentPageDrawing} style={smallButtonStyle}>
              현재 페이지 지우기
            </button>

            <button onClick={clearAllDrawings} style={smallButtonStyle}>
              전체 필기 지우기
            </button>
          </div>

          {/* 오른쪽 파일 선택 묶음 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <label
              title="PDF 파일 선택"
              style={{
                width: "36px",
                height: "36px",
                border: "1px solid #676767",
                borderRadius: "8px",
                backgroundColor: "#ebebeb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "22px",
                userSelect: "none",
              }}
            >
              <img
                src="/icons/pdf_upload_icon.svg"
                alt="PDF 파일 선택"
                style={{ width: "25px", height: "25px", objectFit: "contain" }}
              />
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                style={{
                  display: "none",
                }}
              />
            </label>

            <span
              style={{
                fontSize: "13px",
                color: "#374151",
                maxWidth: "220px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {pdfFile ? pdfFile.name : "선택된 파일 없음"}
            </span>
          </div>
        </div>
      </div>

      {/* PDF가 실제로 표시되는 큰 영역 */}
      <div
        ref={pdfBoxRef}
        style={{
          /**
           * PDF 표시 영역 높이
           *
           * 값이 커지면 PDF 박스가 더 길어짐.
           */
          flex: 1,
          minHeight: 0,

          /**
           * PDF 업로드 전에도 영역이 보이도록 점선 테두리 사용
           */
          border: "2px dashed #9ca3af",

          /**
           * PDF 박스 모서리 둥글게
           */
          borderRadius: "10px",

          /**
           * PDF가 박스보다 크면 스크롤 생성
           */
          overflow: "auto",

          /**
           * 내부 정렬을 위해 flex 사용
           */
          display: "flex",

          /**
           * PDF가 없으면 안내 문구를 가운데 배치
           * PDF가 있으면 위쪽부터 배치
           */
          alignItems: pdfUrl ? "flex-start" : "center",

          /**
           * 가로 가운데 정렬
           */
          justifyContent: "center",

          /**
           * 안내 문구 색상
           */
          color: "#6b7280",

          /**
           * 안내 문구 글자 크기
           */
          fontSize: "16px",

          /**
           * PDF가 있을 때만 내부 여백 적용
           */
          padding: pdfUrl ? "10px" : "0",

          boxSizing: "border-box",

          /**
           * pointer 로그 화면을 PDF 박스 위에 absolute로 띄우기 위해 필요함.
           */
          position: "relative",

          /**
           * 기본적으로 손가락 스크롤은 허용하되, 펜 필기 중에는 JS에서 none으로 잠금.
           */
          touchAction: "pan-x pan-y",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {/* 아이패드에서도 바로 볼 수 있는 pointer 이벤트 디버그 로그 */}
        <pre
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            zIndex: 9999,
            maxWidth: "280px",
            maxHeight: "180px",
            overflow: "auto",
            margin: 0,
            padding: "8px",
            borderRadius: "8px",
            backgroundColor: "rgba(0, 0, 0, 0.78)",
            color: "white",
            fontSize: "11px",
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {pointerLog}
        </pre>

        {pdfUrl ? (
          <div
            style={{
              width: "100%",

              /**
               * 페이지 이동 바와 PDF 페이지를 세로로 배치
               */
              display: "flex",
              flexDirection: "column",

              /**
               * PDF 페이지를 가운데 정렬
               */
              alignItems: "center",

              /**
               * 페이지 이동 바와 PDF 사이 간격
               */
              gap: "10px",
            }}
          >
            {/* 페이지 이동 바 */}
            <div
              style={{
                /**
                 * PDF를 스크롤해도 페이지 이동 바가 위에 붙어 있게 함
                 */
                position: "sticky",
                top: "0",
                zIndex: 5,

                /**
                 * 이전 버튼, 페이지 번호, 다음 버튼을 가로 배치
                 */
                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                gap: "8px",
                padding: "6px",
                backgroundColor: "white",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
              }}
            >
              {/* 이전 페이지 버튼 */}
              <button
                onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
                disabled={pageNumber <= 1}
                style={{
                  ...smallButtonStyle,

                  /**
                   * 첫 페이지에서는 버튼을 비활성화 색상으로 표시
                   */
                  backgroundColor: pageNumber <= 1 ? "#e5e7eb" : "white",
                  cursor: pageNumber <= 1 ? "not-allowed" : "pointer",
                }}
              >
                이전
              </button>

              {/* 현재 페이지 / 전체 페이지 표시 */}
              <span
                style={{
                  color: "#111827",
                  fontSize: "12px",
                  minWidth: "54px",
                  textAlign: "center",
                }}
              >
                {pageNumber} / {numPages || "?"}
              </span>

              <span
                style={{
                  color: "#4b5563",
                  fontSize: "12px",
                  minWidth: "72px",
                  textAlign: "center",
                }}
              >
                확대 {Math.round((pdfPageWidth / 700) * 100)}%
              </span>

              {/* 다음 페이지 버튼 */}
              <button
                onClick={() =>
                  setPageNumber((prev) => Math.min(prev + 1, numPages))
                }
                disabled={numPages === 0 || pageNumber >= numPages}
                style={{
                  ...smallButtonStyle,

                  /**
                   * 마지막 페이지에서는 버튼을 비활성화 색상으로 표시
                   */
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

            {/* PDF 페이지와 필기 canvas를 겹쳐 놓는 영역 */}
            <div
              ref={pageWrapperRef}
              style={{
                /**
                 * 필기 canvas를 PDF 위에 absolute로 올리기 위해 필요
                 */
                position: "relative",

                /**
                 * PDF 페이지 크기만큼만 영역 차지
                 */
                display: "inline-block",

                /**
                 * canvas가 target일 때 브라우저 기본 스크롤 개입을 줄임.
                 */
                touchAction: "none",
              }}
            >
              {/* PDF 문서 렌더링 */}
              <PdfDocument
                file={pdfUrl}
                key={pdfUrl}
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
                {/* 현재 페이지 렌더링 */}
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

              {/* PDF 위에 올라가는 투명 필기 canvas */}
              <canvas
                ref={drawingCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={(event) => event.preventDefault()}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  zIndex: 4,
                  pointerEvents: "auto",
                  /**
                   * 중요:
                   * pan-x / pan-y를 허용하면 아이패드에서 펜 입력 중에도
                   * 브라우저가 스크롤 제스처로 가져가 필기가 끊길 수 있음.
                   * 그래서 기본 제스처는 막고, 손가락 드래그는 JS로 직접 스크롤함.
                   */
                  touchAction: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                  overscrollBehavior: "contain",
                  cursor: drawTool === "eraser" ? "grab" : "crosshair",
                }}
              />
            </div>
          </div>
        ) : (
          /**
           * PDF가 아직 선택되지 않았을 때 안내 문구
           */
          <p>PDF 파일을 선택하세요</p>
        )}
      </div>
    </section>
  );
}
