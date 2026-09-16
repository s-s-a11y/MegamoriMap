import { useState } from "react";
import "./App.css";
import { Header } from "./components/Header";
import { HomePage } from "./components/Home";
import { RegisterStorePage } from "./components/RegistStore";
import { RegisterMenuPage } from "./components/RegistMenu";
import { StoreDetailPage } from "./components/ShowStoreDetail";

// 表示する画面の種類。
export type ViewName = "map" | "regist-store" | "regist-menu" | "store-detail";

function App() {
  // 表示するコンポーネントを決定するState
  const [currentView, setCurrentView] = useState<ViewName>("map");
  // 店舗詳細・メニュー登録画面でどのplace_idを扱うかを保持するState
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  // ★追加：メニュー登録画面に「今どの店舗に登録しているか」を表示するための店舗名
  // (place_id自体は画面に表示しないが、店舗名は表示したいためprops経由で運ぶ)
  const [selectedStoreName, setSelectedStoreName] = useState<string | null>(
    null,
  );

  // 画面遷移用の関数。store-detail/regist-menuへ遷移する場合は
  // 第2引数にplace_id、第3引数に店舗名を渡すことで、どの店舗を扱うか伝える。
  const handleNavigate = (
    view: ViewName,
    placeId?: string,
    storeName?: string,
  ) => {
    if (placeId) {
      setSelectedPlaceId(placeId);
    }
    if (storeName) {
      setSelectedStoreName(storeName);
    }
    setCurrentView(view);
  };

  // 描画するコンポーネントを決定する処理
  const renderView = () => {
    switch (currentView) {
      case "map":
        return <HomePage onNavigate={handleNavigate} />;
      case "regist-store":
        return <RegisterStorePage onNavigate={handleNavigate} />;
      case "regist-menu":
        // 通常は店舗詳細画面から必ずplaceId付きで遷移してくるが、
        // 型上はnullの可能性があるため、その場合はHomeに戻す安全策を入れておく
        if (!selectedPlaceId) {
          return <HomePage onNavigate={handleNavigate} />;
        }
        return (
          <RegisterMenuPage
            placeId={selectedPlaceId}
            storeName={selectedStoreName ?? ""}
            onNavigate={handleNavigate}
          />
        );
      case "store-detail":
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
      {/* ★追加：共通ヘッダー。Home画面自身の時だけ「TOPに戻る」ボタンを出さない */}
      <Header
        onGoHome={
          currentView !== "map" ? () => handleNavigate("map") : undefined
        }
      />
      <div className="content-area">{renderView()}</div>
    </>
  );
}

export default App;
