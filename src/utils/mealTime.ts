// ★新規(C71)：昼/晩の扱いを1か所にまとめる(「昼・晩どちらも」の追加に合わせて)。

// 店の営業の区分。"both" は昼・晩どちらも営業している店
export type MealTime = "lunch" | "dinner" | "both";

export const MEAL_TIME_LABELS: Record<string, string> = {
  lunch: "昼",
  dinner: "晩",
  both: "昼・晩",
};

// 絞り込み(昼/晩)に合う店か。「昼・晩どちらも」の店は、昼でも晩でも出す
export function matchesMealTime(storeMealTime: string, filter: string): boolean {
  return storeMealTime === filter || storeMealTime === "both";
}

// 店名が住所のように見えるか(検索結果で、店ではなく住所を選んだ場合に起きる)
export function looksLikeAddress(title: string): boolean {
  return /^〒|丁目|番地|[0-9０-９]+-[0-9０-９]+$/.test(title.trim());
}
