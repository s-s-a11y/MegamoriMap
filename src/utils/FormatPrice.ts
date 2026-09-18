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
export function getBudgetSourcePrice(store: {
  meal_time: string;
  avg_price: number;
  price_per_person: number;
}): number {
  return store.meal_time === "dinner"
    ? store.price_per_person
    : store.avg_price;
}
