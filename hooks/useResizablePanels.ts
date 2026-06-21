"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * 왼쪽/오른쪽 패널 크기 조절을 담당하는 커스텀 훅
 *
 * 수정 핵심:
 * 기존 mouse 이벤트(onMouseDown, mousemove, mouseup)만 사용하면
 * iPad / 터치 화면에서 손가락 드래그가 안정적으로 동작하지 않을 수 있음.
 *
 * 그래서 마우스, 손가락, 펜을 모두 처리할 수 있는
 * Pointer Event(pointerdown, pointermove, pointerup) 방식으로 변경함.
 */
export function useResizablePanels() {
  /**
   * 전체 화면 영역을 가리키는 ref
   * app/page.tsx의 main 태그에 연결됨.
   */
  const containerRef = useRef<HTMLElement | null>(null);

  /**
   * 현재 크기 조절을 시작한 포인터 id
   * 손가락 여러 개가 화면에 올라와도 처음 잡은 손가락만 처리하기 위해 사용함.
   */
  const activePointerIdRef = useRef<number | null>(null);

  /**
   * 왼쪽 패널의 너비 비율
   * 기본값 60: 왼쪽 60%, 오른쪽 40%
   */
  const [leftPanelWidth, setLeftPanelWidth] = useState(60);

  /**
   * 현재 가운데 막대를 드래그 중인지 여부
   */
  const [isDragging, setIsDragging] = useState(false);

  /**
   * 패널이 너무 작아지거나 커지지 않도록 제한함.
   */
  const clamp = (value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
  };

  /**
   * clientX 좌표를 기준으로 왼쪽 패널 너비를 계산함.
   */
  const updatePanelWidth = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;

    const nextLeftWidth = ((clientX - rect.left) / rect.width) * 100;

    setLeftPanelWidth(clamp(nextLeftWidth, 25, 75));
  }, []);

  /**
   * 드래그 종료 처리
   */
  const stopDragging = useCallback(() => {
    activePointerIdRef.current = null;
    setIsDragging(false);
  }, []);

  /**
   * 드래그 중에는 window 전체에서 pointer 이동을 감지함.
   *
   * 이유:
   * 사용자가 가운데 막대를 잡고 움직이다가
   * 손가락이나 마우스가 막대 밖으로 나가도 계속 크기 조절이 되게 하기 위함.
   */
  useEffect(() => {
    if (!isDragging) return;

    const previousBodyCursor = document.body.style.cursor;
    const previousBodyUserSelect = document.body.style.userSelect;
    const previousBodyTouchAction = document.body.style.touchAction;
    const previousDocumentTouchAction = document.documentElement.style.touchAction;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.body.style.touchAction = "none";
    document.documentElement.style.touchAction = "none";

    const handlePointerMove = (event: PointerEvent) => {
      if (
        activePointerIdRef.current !== null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      event.preventDefault();
      updatePanelWidth(event.clientX);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (
        activePointerIdRef.current !== null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      event.preventDefault();
      stopDragging();
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerEnd, {
      passive: false,
    });
    window.addEventListener("pointercancel", handlePointerEnd, {
      passive: false,
    });
    window.addEventListener("blur", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("blur", stopDragging);

      document.body.style.cursor = previousBodyCursor;
      document.body.style.userSelect = previousBodyUserSelect;
      document.body.style.touchAction = previousBodyTouchAction;
      document.documentElement.style.touchAction = previousDocumentTouchAction;
    };
  }, [isDragging, stopDragging, updatePanelWidth]);

  /**
   * 가운데 막대를 누르는 순간 실행됨.
   *
   * onPointerDown에 연결해서 마우스, 손가락, 펜 입력을 모두 받음.
   */
  const startDragging = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      activePointerIdRef.current = event.pointerId;
      setIsDragging(true);
      updatePanelWidth(event.clientX);

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // 일부 브라우저에서 setPointerCapture가 실패해도
        // window pointermove로 계속 처리할 수 있으므로 무시함.
      }
    },
    [updatePanelWidth],
  );

  return {
    /** 전체 화면 main 태그에 연결할 ref */
    containerRef,

    /** 왼쪽 패널 너비 비율 */
    leftWidth: leftPanelWidth,

    /** 오른쪽 패널 너비 비율 */
    rightWidth: 100 - leftPanelWidth,

    /** 현재 드래그 중인지 여부 */
    isDragging,

    /** 드래그 시작 함수 */
    startDragging,
  };
}
