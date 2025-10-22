import React, { useState } from "react";
import styled from "@emotion/styled";

const TooltipContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const TooltipText = styled.div`
  width: fit-content;
  white-space: nowrap;
  color: ${(props) => props.color || "#fff"};
  text-align: center;
  box-shadow: 0px 3px 6px 0px rgba(0, 0, 0, 0.12),
    0px 6px 16px 0px rgba(0, 0, 0, 0.08), 0px 9px 28px 0px rgba(0, 0, 0, 0.05);
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.75);
  padding: 5px 10px 5px 10px;
  position: absolute;
  z-index: 100;

  left: 50%;
  opacity: 0;
  transition: opacity 0.3s;
  font-size: 13px;

  // 箭头
  &::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;

    border-width: 5px;
    border-style: solid;
    border-color: ${(props) => props.bgColor || "#000000ff"} transparent
      transparent transparent;
  }

  // 根据位置调整样式
  ${(props) => {
    switch (props.position) {
      case "top":
        return `
          bottom: 135%;
          left: 48%;
          transform: translate(-50%, 0);
          &::after {
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-color: ${
              props.bgColor || "#555"
            } transparent transparent transparent;
          }
        `;
      case "bottom":
        return `
          top: 125%;
          left: 50%;
          margin-left: -60px;
          &::after {
            bottom: 100%;
            left: 50%;
            margin-left: -5px;
            border-color: transparent transparent ${
              props.bgColor || "#555"
            } transparent;
          }
        `;
      case "left":
        return `
          top: -5px;
          right: 125%;
          &::after {
            top: 50%;
            left: 100%;
            margin-top: -5px;
            border-color: transparent transparent transparent ${
              props.bgColor || "#555"
            };
          }
        `;
      case "right":
        return `
          top: -5px;
          left: 125%;
          &::after {
            top: 50%;
            right: 100%;
            margin-top: -5px;
            border-color: transparent ${
              props.bgColor || "#555"
            } transparent transparent;
          }
        `;
      default:
        return `
          bottom: 125%;
          left: 50%;
          margin-left: -60px;
          &::after {
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-color: ${
              props.bgColor || "#555"
            } transparent transparent transparent;
          }
        `;
    }
  }}
`;

const Tooltip = ({
  children,
  content,
  position = "top",
  width = "120px",
  bgColor = "#555",
  color = "#fff",
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <TooltipContainer
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <TooltipText
        position={position}
        width={width}
        bgColor={bgColor}
        color={color}
        style={{
          opacity: visible ? "1" : "0",
          visibility: visible ? "visible" : "hidden",
        }}
      >
        {content}
      </TooltipText>
    </TooltipContainer>
  );
};

export default Tooltip;
