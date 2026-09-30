// =====================================================================
// 画面確認用の「確認モード」(開発用サーバー専用)
//
// ・`npm run dev` で起動したときだけ、URLに ?preview=シナリオ名 を付けると有効になる
// ・ログイン状態(Cognito)とAPIの応答を「作り物」に差し替えて画面を表示する
//   (本番のAPI・データ・Googleのログインには一切アクセスしない)
// ・main.tsx から import.meta.env.DEV のときだけ読み込むため、本番のビルドには含まれない
// ・Claudeがヘッドレスブラウザで画面を撮影し、見た目を確認するために使う
// =====================================================================
import type { ReactNode } from "react";
import { AuthContext, type AuthContextProps } from "react-oidc-context";
import type { ViewName } from "../App";

const API_BASE_URL =
  "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap";

// 作り物の利用者(実在しないID)
const ME = "preview-user-0000-0000-000000000001";
const OTHER = "preview-user-0000-0000-000000000002";

interface Scenario {
  description: string;
  loggedIn: boolean;
  userName: string; // ""ならユーザー名が未設定
  isAdmin: boolean;
  storeOwner: string; // 表示する店舗の登録者
  initialView: ViewName;
}

// ?preview= に指定できるシナリオ
const SCENARIOS: Record<string, Scenario> = {
  guest: { description: "未ログイン", loggedIn: false, userName: "", isAdmin: false, storeOwner: ME, initialView: "map" },
  unnamed: { description: "ログイン済み・ユーザー名未設定", loggedIn: true, userName: "", isAdmin: false, storeOwner: ME, initialView: "map" },
  named: { description: "ログイン済み・ユーザー名設定済み", loggedIn: true, userName: "プレビュー太郎", isAdmin: false, storeOwner: ME, initialView: "map" },
  "detail-owner": { description: "店舗詳細・自分が登録者", loggedIn: true, userName: "プレビュー太郎", isAdmin: false, storeOwner: ME, initialView: "store-detail" },
  "detail-other": { description: "店舗詳細・他の人が登録者(削除ボタンなし)", loggedIn: true, userName: "プレビュー太郎", isAdmin: false, storeOwner: OTHER, initialView: "store-detail" },
  "detail-admin": { description: "店舗詳細・他の人が登録者だが管理者", loggedIn: true, userName: "プレビュー管理者", isAdmin: true, storeOwner: OTHER, initialView: "store-detail" },
  "detail-guest": { description: "店舗詳細・未ログイン", loggedIn: false, userName: "", isAdmin: false, storeOwner: OTHER, initialView: "store-detail" },
};

export const PREVIEW_PLACE_ID = "preview-place-1";

export function getPreviewScenario(): Scenario | null {
  const name = new URLSearchParams(window.location.search).get("preview");
  if (!name) return null;
  const scenario = SCENARIOS[name];
  if (!scenario) {
    console.warn(`確認モード：不明なシナリオ「${name}」。指定できるもの：${Object.keys(SCENARIOS).join(", ")}`);
    return null;
  }
  return scenario;
}

// ---- 作り物のログイン状態 ----
function createFakeAuth(s: Scenario): AuthContextProps {
  const user = s.loggedIn
    ? {
        id_token: "preview-id-token",
        profile: { sub: ME, ...(s.isAdmin ? { "cognito:groups": ["megamorimap-admin"] } : {}) },
      }
    : null;
  const noop = async () => undefined;
  return {
    isAuthenticated: s.loggedIn,
    isLoading: false,
    user,
    error: undefined,
    activeNavigator: undefined,
    signinRedirect: noop,
    removeUser: noop,
  } as unknown as AuthContextProps;
}

// 確認用の写真。色付きの画像をその場で作る(外部への通信なし)
function fakePhoto(label: string, color: string, w = 800, h = 600): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" font-size="64" text-anchor="middle" dominant-baseline="middle" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// n日前の日付をYYYYMMDD形式で返す(新着(NEW)の印の確認用)
function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// ---- 作り物のAPI応答 ----
function installFakeApi(s: Scenario) {
  let userName = s.userName;
  const names: Record<string, string> = { [ME]: userName, [OTHER]: "となりの花子" };
  const nameOf = (id: string) => (id === ME ? userName : names[id] ?? "");

  const stores = [
    { place_id: PREVIEW_PLACE_ID, title: "プレビュー食堂 池袋本店", avg_price: 1200, address_label: "東京都豊島区西池袋1-1-1", store_url: "https://example.com", longitude: 139.7109, latitude: 35.7295, store_category_name: "定食", image_url: fakePhoto("表紙", "#b23913"), meal_time: "lunch", price_per_person: 0, created_at: daysAgo(2) },
    { place_id: "preview-place-2", title: "プレビュー酒場", avg_price: 0, address_label: "東京都豊島区東池袋1-1-1", store_url: "", longitude: 139.713, latitude: 35.73, store_category_name: "居酒屋", image_url: "", meal_time: "dinner", price_per_person: 3500, created_at: daysAgo(30) },
    { place_id: "preview-place-3", title: "プレビューらーめん", avg_price: 950, address_label: "東京都豊島区南池袋1-1-1", store_url: "", longitude: 139.711, latitude: 35.728, store_category_name: "ラーメン", image_url: fakePhoto("らーめん", "#46684a"), meal_time: "lunch", price_per_person: 0, created_at: daysAgo(10) },
  ];

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(API_BASE_URL)) return realFetch(input, init);
    const path = url.slice(API_BASE_URL.length);
    const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : {};

    switch (path) {
      case "/users/me":
        return json({ user_name: userName });
      case "/users/me/update":
        userName = String(body.user_name ?? "").trim();
        return json({ user_name: userName });
      case "/map":
        return json({ stores });
      case "/categories/stores":
        return json({ categories: ["定食", "居酒屋", "ラーメン"] });
      case "/stores/detail":
        return json({
          ...stores[0],
          created_by: s.storeOwner,
          created_by_name: nameOf(s.storeOwner),
          comments: [
            { comment: "量がとにかく多い。ご飯のおかわり無料。", posted_at: "20260910", posted_by: OTHER, posted_by_name: nameOf(OTHER) },
            { comment: "投稿者の記録がない古いコメント", posted_at: "20260901", posted_by_name: "" },
          ],
          images: [
            { image_url: fakePhoto("縦長の写真", "#46684a", 600, 900), posted_at: "20260920" },
            { image_url: fakePhoto("写真3", "#e8a33d"), posted_at: "20260921" },
          ],
          business_hours: ["月-金: 11:00 - 22:00", "土, 日: 11:00 - 21:00"],
          price_reports: [],
          walk_minutes: 11,
          walk_distance_m: 650,
        });
      case "/stores/menus":
        return json({
          menus: [
            { menu_id: "preview-menu-1", menu_name: "唐揚げ定食 特盛", price: 1200, memo: "ご飯800g", image_url: fakePhoto("唐揚げ定食", "#8c2f22"), created_by: s.storeOwner, created_by_name: nameOf(s.storeOwner), comments: [{ comment: "唐揚げが8個も入っていた", posted_at: "20260920", posted_by: ME, posted_by_name: nameOf(ME) }] },
            { menu_id: "preview-menu-2", menu_name: "カツカレー 大盛り", price: 1100, memo: "", image_url: "", created_by: OTHER, created_by_name: nameOf(OTHER), comments: [] },
          ],
        });
      default:
        // 登録・更新・削除などは、何もせず成功したことにする
        return json("OK");
    }
  };
}

// 確認モードの準備(作り物のAPIを差し込む)をして、ログイン状態を差し替えるProviderを返す
export function setupPreview(s: Scenario) {
  installFakeApi(s);
  const auth = createFakeAuth(s);
  document.title = `[確認モード] ${s.description}`;
  return function PreviewAuthProvider({ children }: { children: ReactNode }) {
    return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
  };
}
