// 店舗一覧・店舗詳細など、「予算帯」の表示全般で使い回すユーティリティ。

const BAND_WIDTH = 500; // 500円単位で丸め込む

/**
 * 平均価格(生の数値)を、500円単位の予算帯の文字列に変換する。
 * 例: 730 → "¥500〜¥999"
 *
 * avgPriceが0以下(メニュー未登録などでまだ平均が算出されていない)場合は
 * "価格帯未登録" を返す。
 */
export function formatBudgetBand(avgPrice: number): string {
  if (avgPrice <= 0) {
    return "価格帯未登録";
  }

  const lower = Math.floor(avgPrice / BAND_WIDTH) * BAND_WIDTH;
  const upper = lower + BAND_WIDTH - 1;

  return `¥${lower.toLocaleString()}〜¥${upper.toLocaleString()}`;
}

/**
 * ★追加：昼(lunch)の店はメニュー価格の平均(avg_price)、
 * 夜(dinner)の店は来店者からの申告額の平均(price_per_person)を、
 * それぞれ「予算帯」の算出元として使う。
 *
 * 1人1品が基本の昼の店と、複数品を一緒に注文する夜の店とでは、
 * メニュー価格の単純平均をそのまま予算帯に使うと実態と合わないため、
 * 夜の店だけ別の計算元(申告額)に切り替えている。
 */
// ★変更(C71)：昼の店・昼晩どちらもの店でも金額を申告できるようにしたため、
// 主となる算出元が0(未登録)のときは、もう一方を使う。
//   晩の店：申告額の平均 → (無ければ)メニュー価格の平均
//   昼の店・昼晩どちらもの店：メニュー価格の平均 → (無ければ)申告額の平均
export function getBudgetSourcePrice(store: {
  meal_time: string;
  avg_price: number;
  price_per_person: number;
}): number {
  const reported = store.price_per_person ?? 0;
  const menuAverage = store.avg_price ?? 0;
  if (store.meal_time === "dinner") {
    return reported > 0 ? reported : menuAverage;
  }
  return menuAverage > 0 ? menuAverage : reported;
}

// ★追加(C71)：予算帯が「申告額の平均」から出ているか(店舗詳細の注記に使う)
export function isBudgetFromReports(store: {
  meal_time: string;
  avg_price: number;
  price_per_person: number;
}): boolean {
  const reported = store.price_per_person ?? 0;
  return reported > 0 && getBudgetSourcePrice(store) === reported;
}
