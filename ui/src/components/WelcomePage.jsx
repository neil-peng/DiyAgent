import React from "react";
import styled from "@emotion/styled";
import novaai from "../assets/novaai.svg";
import airecommend from "../assets/airecommend.svg";

const WelcomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  text-align: center;
  height: 100%;
  padding-bottom: 2rem;
`;

const Logo = styled.div`
  width: 64px;
  height: 64px;
  min-height: 64px;
  border-radius: 128px;
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
`;

const LogoText = styled.div`
  font-size: 2rem;
  font-weight: bold;
  background: linear-gradient(135deg, #2196f3 0%, #9c27b0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const WelcomeTitle = styled.div`
  font-family: PingFang SC;
  font-size: 20px;
  font-weight: 500;
  line-height: 36px;
  text-align: center;
  letter-spacing: 0px;
  color: #0f172a;
  margin-top: 16px;
`;

const WelcomeSubtitle = styled.p`
  font-size: 1rem;
  color: #666;
  margin-bottom: 2rem;
  line-height: 1.5;
`;

const ExamplesContainer = styled.div`
  max-width: 600px;
  padding-top: 10px;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const ExamplesTitle = styled.div`
  width: 100%;
  display: flex;
  justify-content: left;
  font-family: PingFang SC;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: 0px;
  margin-bottom: 4px;
  background: linear-gradient(
    180deg,
    #00e092 14%,
    #5cb1ff 46%,
    #b978ff 81%,
    #3278ff 107%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-fill-color: transparent;
`;

const ExampleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const ExampleItem = styled.div`
  display: flex;
  align-items: center;
  background: #f7faff;
  border-radius: 8px;
  padding: 6px 16px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e9ecef;
    border-color: #dee2e6;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const ExampleNumber = styled.span`
  display: inline-block;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #2196f3 0%, #9c27b0 100%);
  color: white;
  border-radius: 50%;
  text-align: center;
  line-height: 24px;
  font-size: 0.8rem;
  font-weight: bold;
  margin-right: 0.8rem;
`;

const ExampleText = styled.span`
  font-family: PingFang SC;
  font-weight: 400;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  letter-spacing: 0px;
  color: #1e293b;
`;

const WelcomePage = ({ onExampleClick }) => {
  const examples = [
    "写一篇关于人性，机器，和未来的故事，字数在2万 →",
    "模仿莎士比亚的写作风格，写一篇冲突，复仇和救赎的故事，字数在1万字左右 →",
    "根据西游记的结局，写一篇关于西游记的续集，字数在1万字左右 →"
  ];

  const handleExampleClick = (example) => {
    if (onExampleClick) {
      onExampleClick(example);
    }
  };

  return (
    <WelcomeContainer>
      <Logo>
        <img
          src={novaai}
          alt="Nova AI"
          style={{ width: "36px", height: "36px" }}
        />
      </Logo>

      <WelcomeTitle>Long Story Teller</WelcomeTitle>

      <ExamplesContainer>
        <ExamplesTitle>Examples</ExamplesTitle>
        <ExampleList>
          {examples.map((example, index) => (
            <ExampleItem
              key={index}
              onClick={() => handleExampleClick(example.replace(/→\s*$/, ""))}
            >
              <img
                src={airecommend}
                alt="Example"
                style={{ width: "24px", height: "24px", marginRight: "0.8rem" }}
              />
              <ExampleText>{example}</ExampleText>
            </ExampleItem>
          ))}
        </ExampleList>
      </ExamplesContainer>
    </WelcomeContainer>
  );
};

export default WelcomePage;
