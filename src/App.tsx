import { useState } from "react";
import "./App.css";
import { MapComponent } from "./components/Map";
// ↓ 実際の配置場所に合わせてパスを調整してください
import { RegisterStorePage } from "./components/RegistStore";
import { RegisterMenuPage } from "./components/RegistMenu";
import { StoreDetailPage } from "./components/ShowStoreDetail";

// 表示する画面の種類。★変更：store-detailを追加
export type ViewName = "map" | "regist-store" | "regist-menu" | "store-detail";

function App() {
  // 表示するコンポーネントを決定するState
  const [currentView, setCurrentView] = useState<ViewName>("map");
  // ★追加：店舗詳細画面でどのplace_idを表示するかを保持するState
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // ★変更：画面遷移用の関数。store-detailへ遷移する場合は
  // 第2引数にplace_idを渡すことで、どの店舗を表示するか一緒に伝える。
  // (store-detail以外へ遷移する時はplaceIdは省略でよい)
  const handleNavigate = (view: ViewName, placeId?: string) => {
    if (placeId) {
      setSelectedPlaceId(placeId);
    }
    setCurrentView(view);
  };

  // 描画するコンポーネントを決定する処理
  const renderView = () => {
    switch (currentView) {
      case "map":
        return <MapComponent onNavigate={handleNavigate} />;
      case "regist-store":
        return <RegisterStorePage onNavigate={handleNavigate} />;
      case "regist-menu":
        return <RegisterMenuPage onNavigate={handleNavigate} />;
      case "store-detail":
        // 通常はMap.tsxから必ずplaceId付きで遷移してくるが、
        // 型上はnullの可能性があるため、その場合は地図に戻す安全策を入れておく
        if (!selectedPlaceId) {
          return <MapComponent onNavigate={handleNavigate} />;
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
