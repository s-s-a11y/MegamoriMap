import { lazy, Suspense, useState } from "react";
import "./App.css";
import "./css_components/App.css";
import { Header } from "./components/Header";
import { HomePage } from "./components/Home";
import { RegisterStorePage } from "./components/RegistStore";
import { RegisterMenuPage } from "./components/RegistMenu";
import { WishlistPage, type WishlistRegistPreset } from "./components/Wishlist";
import { MyPage } from "./components/MyPage";
import { AdminPage } from "./components/AdminPage";
import { useMyUser } from "./utils/useMyUser";

// ★修正：店舗詳細画面は地図ライブラリ(maplibre-gl)を含み、JS全体の大半を占めるため、
// 画面を開いた時にだけ読み込む(初回表示で読み込むJSを軽くする)
const StoreDetailPage = lazy(() =>
  import("./components/ShowStoreDetail").then((module) => ({
    default: module.StoreDetailPage,
  })),
);

// 表示する画面の種類。
// ★追加(機能追加#4)："wishlist"(行ってみたい店リスト)
export type ViewName =
  | "map"
  | "regist-store"
  | "regist-menu"
  | "store-detail"
  | "wishlist"
  // ★追加(C50・C51)：マイページ・管理者ページ
  | "mypage"
  | "admin";

// ★追加：最初に表示する画面を指定する(確認モード src/dev/preview.tsx 用)。
// 通常の起動では指定しないので、今までどおりHome画面から始まる。
interface AppProps {
  initialView?: ViewName;
  initialPlaceId?: string | null;
}

function App({ initialView = "map", initialPlaceId = null }: AppProps) {
  // ★追加(機能追加#1)：ログイン中の利用者のユーザー名。ヘッダーとHomeで共有する
  const { userName, saveUserName } = useMyUser();

  // 表示するコンポーネントを決定するState
  const [currentView, setCurrentView] = useState<ViewName>(initialView);
  // 店舗詳細・メニュー登録画面でどのplace_idを扱うかを保持するState
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    initialPlaceId,
  );
  // ★追加：メニュー登録画面に「今どの店舗に登録しているか」を表示するための店舗名
  // (place_id自体は画面に表示しないが、店舗名は表示したいためprops経由で運ぶ)
  const [selectedStoreName, setSelectedStoreName] = useState<string | null>(
    null,
  );
  // ★追加(機能追加#4)：行ってみたい店リストから店舗登録へ進むときに引き継ぐ店の情報
  const [registPreset, setRegistPreset] = useState<WishlistRegistPreset | null>(
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
    // 通常の遷移では店舗登録画面に何も引き継がない
    setRegistPreset(null);
    setCurrentView(view);
  };

  // ★追加(機能追加#4)：行ってみたい店リストの店を、店舗登録画面に入れた状態で開く
  const handleRegistFromWishlist = (preset: WishlistRegistPreset) => {
    setRegistPreset(preset);
    setCurrentView("regist-store");
  };

  // 描画するコンポーネントを決定する処理
  const renderView = () => {
    switch (currentView) {
      case "map":
        return (
          <HomePage
            onNavigate={handleNavigate}
            userName={userName}
            onSaveUserName={saveUserName}
          />
        );
      case "regist-store":
        return (
          <RegisterStorePage
            // 引き継ぐ店が変わったら画面を作り直し、入力状態を初期化する
            key={registPreset?.place.PlaceId ?? "new"}
            onNavigate={handleNavigate}
            preset={registPreset}
          />
        );
      case "mypage":
        return <MyPage userName={userName} onNavigate={handleNavigate} />;
      case "admin":
        return <AdminPage />;
      case "wishlist":
        return (
          <WishlistPage
            onNavigate={handleNavigate}
            onRegistStore={handleRegistFromWishlist}
          />
        );
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
          // ★修正：店舗が変わったら画面ごと作り直し、表示状態(カルーセル位置・
          // 読み込み状態など)を初期化する
          <StoreDetailPage
            key={selectedPlaceId}
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
        userName={userName}
        onSaveUserName={saveUserName}
        onOpenWishlist={() => handleNavigate("wishlist")}
        onOpenMyPage={() => handleNavigate("mypage")}
        onOpenAdmin={() => handleNavigate("admin")}
      />
      <div className="content-area">
        <Suspense fallback={<p>読み込み中...</p>}>{renderView()}</Suspense>
      </div>
    </>
  );
}

export default App;
