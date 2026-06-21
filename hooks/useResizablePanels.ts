"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 왼쪽/오른쪽 패널 크기 조절을 담당하는 커스텀 훅
 *
 * 이 파일의 역할:
 * 1. 가운데 세로 막대를 드래그 중인지 관리
 * 2. 마우스 위치를 기준으로 왼쪽 패널 너비 계산
 * 3. 왼쪽 패널과 오른쪽 패널의 비율을 반환
 * 4. 패널이 너무 작아지거나 너무 커지지 않도록 제한
 *
 * 쉽게 말하면:
 * app/page.tsx에서 가운데 막대를 드래그할 수 있게 도와주는 파일임.
 */
export function useResizablePanels() {
  /**
   * 전체 화면 영역을 가리키는 ref
   *
   * app/page.tsx의 main 태그에 연결됨.
   *
   * 이 ref가 필요한 이유:
   * 마우스가 전체 화면에서 몇 퍼센트 위치에 있는지 계산하려면
   * 전체 컨테이너의 위치와 너비를 알아야 하기 때문.
   */
  const containerRef = useRef<HTMLElement | null>(null);

  /**
   * 왼쪽 패널의 너비 비율
   *
   * 기본값 60:
   * 왼쪽 패널 60%
   * 오른쪽 패널 40%
   */
  const [leftPanelWidth, setLeftPanelWidth] = useState(60);

  /**
   * 현재 가운데 막대를 드래그 중인지 여부
   *
   * true:
   * 사용자가 막대를 누른 상태로 움직이는 중
   *
   * false:
   * 드래그 중이 아님
   */
  const [isDragging, setIsDragging] = useState(false);

  /**
   * 드래그 상태가 바뀔 때마다 실행되는 효과
   *
   * isDragging이 true가 되면:
   * 마우스 이동 이벤트와 마우스 버튼 떼기 이벤트를 window에 등록함.
   *
   * isDragging이 false면:
   * 이벤트를 등록하지 않음.
   */
  useEffect(() => {
    /**
     * 드래그 중이 아니면 아무 작업도 하지 않음.
     */
    if (!isDragging) return;

    /**
     * 마우스를 움직일 때 실행되는 함수
     *
     * 역할:
     * 현재 마우스 X좌표를 기준으로 왼쪽 패널 너비를 계산함.
     */
    const handleMouseMove = (event: MouseEvent) => {
      /**
       * 전체 화면 컨테이너를 가져옴.
       */
      const container = containerRef.current;

      /**
       * 아직 ref가 연결되지 않았으면 중단
       */
      if (!container) return;

      /**
       * 컨테이너의 위치와 크기 정보를 가져옴.
       *
       * rect.left:
       * 화면 왼쪽에서 컨테이너 시작점까지의 거리
       *
       * rect.width:
       * 컨테이너 전체 너비
       */
      const rect = container.getBoundingClientRect();

      /**
       * 마우스의 X 위치를 전체 컨테이너 기준 퍼센트로 변환
       *
       * 예:
       * 컨테이너 너비가 1000px이고
       * 마우스가 왼쪽에서 600px 위치라면
       * newLeftWidth는 60이 됨.
       */
      let newLeftWidth = ((event.clientX - rect.left) / rect.width) * 100;

      /**
       * 왼쪽 패널이 너무 작아지는 것을 방지
       *
       * 25보다 작으면 무조건 25로 고정
       */
      if (newLeftWidth < 25) {
        newLeftWidth = 25;
      }

      /**
       * 왼쪽 패널이 너무 커지는 것을 방지
       *
       * 75보다 크면 무조건 75로 고정
       */
      if (newLeftWidth > 75) {
        newLeftWidth = 75;
      }

      /**
       * 계산된 왼쪽 패널 너비를 상태에 저장
       *
       * 이 값이 바뀌면 app/page.tsx에서 패널 너비가 다시 렌더링됨.
       */
      setLeftPanelWidth(newLeftWidth);
    };

    /**
     * 마우스 버튼을 떼면 실행되는 함수
     *
     * 역할:
     * 드래그 상태를 종료함.
     */
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    /**
     * window에 이벤트를 등록하는 이유:
     *
     * 사용자가 가운데 막대를 잡고 움직이다가
     * 마우스가 막대 밖으로 나가도 계속 크기 조절이 되게 하기 위해서임.
     */
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    /**
     * cleanup 함수
     *
     * 역할:
     * 드래그가 끝나거나 컴포넌트가 사라질 때
     * 등록했던 이벤트를 제거함.
     *
     * 이걸 안 하면:
     * 불필요한 이벤트가 계속 남아서 버그나 성능 문제가 생길 수 있음.
     */
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  /**
   * 이 훅을 사용하는 컴포넌트에 필요한 값들을 반환
   */
  return {
    /**
     * 전체 화면 main 태그에 연결할 ref
     */
    containerRef,

    /**
     * 왼쪽 패널 너비 비율
     */
    leftWidth: leftPanelWidth,

    /**
     * 오른쪽 패널 너비 비율
     *
     * 전체가 100이므로:
     * 오른쪽 = 100 - 왼쪽
     */
    rightWidth: 100 - leftPanelWidth,

    /**
     * 현재 드래그 중인지 여부
     *
     * app/page.tsx에서 드래그 중 배경색 변경,
     * 글자 선택 방지 등에 사용함.
     */
    isDragging,

    /**
     * 드래그 시작 함수
     *
     * app/page.tsx의 가운데 막대에서
     * onMouseDown에 연결됨.
     */
    startDragging: () => setIsDragging(true),
  };
}