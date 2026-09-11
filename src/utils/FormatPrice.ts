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
