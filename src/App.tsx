// import { useState } from "react";
import "./App.css";
import { MegamoriMap } from "./components/map";

function App() {
  // 表示するコンポーネントを決定するStateを設定
  // const [currentView, setCurrentView] = useState<string>("map");
  const currentView = "map";

  // 描画するコンポーネントを決定する処理
  const renderView = () => {
    // currentViewStateに伴ってSwitch文で切り替え
    switch (currentView) {
      case "map":
        return <MegamoriMap />;
    }
  };

  return (
    <>
      <div className="content-area">{renderView()}</div>
    </>
  );
}

export default App;
