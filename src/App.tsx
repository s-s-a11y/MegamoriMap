import { useState } from "react";
import "./App.css";
import { HomePage } from "./components/Home";
import { RegisterStorePage } from "./components/RegistStore";
import { RegisterMenuPage } from "./components/RegistMenu";
import { StoreDetailPage } from "./components/ShowStoreDetail";

// 表示する画面の種類。
export type ViewName = "map" | "regist-store" | "regist-menu" | "store-detail";

function App() {
  // 表示するコンポーネントを決定するState
  const [currentView, setCurrentView] = useState<ViewName>("map");
  // 店舗詳細画面でどのplace_idを表示するかを保持するState
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // 画面遷移用の関数。store-detailへ遷移する場合は
  // 第2引数にplace_idを渡すことで、どの店舗を表示するか一緒に伝える。
  const handleNavigate = (view: ViewName, placeId?: string) => {
    if (placeId) {
      setSelectedPlaceId(placeId);
    }
    setCurrentView(view);
  };

  // 描画するコンポーネントを決定する処理
  const renderView = () => {
    switch (currentView) {
      // ★変更：MapComponent(旧HomeMap) → HomePage(Home) に改名
      case "map":
        return <HomePage onNavigate={handleNavigate} />;
      case "regist-store":
        return <RegisterStorePage onNavigate={handleNavigate} />;
      case "regist-menu":
        return <RegisterMenuPage onNavigate={handleNavigate} />;
      case "store-detail":
        // 通常はHome.tsxから必ずplaceId付きで遷移してくるが、
        // 型上はnullの可能性があるため、その場合はHomeに戻す安全策を入れておく
        if (!selectedPlaceId) {
          return <HomePage onNavigate={handleNavigate} />;
        }
        return (
          <StoreDetailPage
            placeId={selectedPlaceId}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  return (
    <>
      <div className="content-area">{renderView()}</div>
    </>
  );
}

export default App;
