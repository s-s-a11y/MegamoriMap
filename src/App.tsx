import { useState } from "react";
import "./App.css";
import { MapComponent } from "./components/map";
import { RegisterStorePage } from "./components/RegistStore";
import { RegisterMenuPage } from "./components/RegistMenu";

// 表示する画面の種類。3画面共通でこの型を使う。
export type ViewName = "map" | "regist-store" | "regist-menu";

function App() {
  // 表示するコンポーネントを決定するState
  const [currentView, setCurrentView] = useState<ViewName>("map");

  // 描画するコンポーネントを決定する処理
  // 各画面には setCurrentView をそのまま onNavigate として渡す。
  // 各画面は「onNavigate("regist-menu")」のように呼ぶだけで画面遷移できる。
  const renderView = () => {
    switch (currentView) {
      case "map":
        return <MapComponent onNavigate={setCurrentView} />;
      case "regist-store":
        return <RegisterStorePage onNavigate={setCurrentView} />;
      case "regist-menu":
        return <RegisterMenuPage onNavigate={setCurrentView} />;
    }
  };

  return (
    <>
      <div className="content-area">{renderView()}</div>
    </>
  );
}

export default App;
