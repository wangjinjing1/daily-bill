import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

export function assertAmount(amount: unknown) {
  const text = String(amount ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error("金额只能输入数字，最多保留两位小数");
  }
  return Number(text).toFixed(2);
}

export function assertDate(date: unknown) {
  const value = String(date ?? "").trim();
  if (!dayjs(value, "YYYY-MM-DD", true).isValid()) {
    throw new Error("日期格式不正确");
  }
  return value;
}

export function getPreviousMonthRange() {
  const now = dayjs();
  const start = now.subtract(1, "month").startOf("month").format("YYYY-MM-DD");
  const end = now.subtract(1, "month").endOf("month").format("YYYY-MM-DD");
  return { start, end };
}

export function assertRangeWithinMonth(startDate?: string, endDate?: string) {
  const fallback = getPreviousMonthRange();
  const start = dayjs(startDate ?? fallback.start);
  const end = dayjs(endDate ?? fallback.end);

  if (!start.isValid() || !end.isValid()) {
    throw new Error("导出日期范围不合法");
  }
  if (end.isBefore(start)) {
    throw new Error("结束日期不能早于开始日期");
  }
  if (end.diff(start, "day") > 31) {
    throw new Error("导出时间范围不能超过一个月");
  }

  return {
    start: start.format("YYYY-MM-DD"),
    end: end.format("YYYY-MM-DD")
  };
}
