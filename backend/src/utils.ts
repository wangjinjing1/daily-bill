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

export function assertCycleDay(value: unknown) {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error("导出结算日只能设置为 1 到 31 之间的整数");
  }
  return day;
}

export function getPreviousMonthRange() {
  const now = dayjs();
  const start = now.subtract(1, "month").startOf("month").format("YYYY-MM-DD");
  const end = now.subtract(1, "month").endOf("month").format("YYYY-MM-DD");
  return { start, end };
}

function getCycleEnd(baseMonth: dayjs.Dayjs, cycleDay: number) {
  return baseMonth.date(Math.min(cycleDay, baseMonth.daysInMonth()));
}

export function getDefaultRangeByCycleDay(cycleDay: number, now = dayjs()) {
  const currentMonthEnd = getCycleEnd(now.startOf("month"), cycleDay);
  const previousMonthEnd = getCycleEnd(now.subtract(1, "month").startOf("month"), cycleDay);
  const end = now.isBefore(currentMonthEnd, "day") ? now : currentMonthEnd;
  const start = previousMonthEnd.add(1, "day");

  return {
    start: start.format("YYYY-MM-DD"),
    end: end.format("YYYY-MM-DD")
  };
}

export function resolveExportRange(startDate?: string | null, endDate?: string | null, cycleDay?: number | null) {
  const fallback = cycleDay ? getDefaultRangeByCycleDay(cycleDay) : getPreviousMonthRange();
  const start = dayjs(startDate ?? fallback.start);
  const end = dayjs(endDate ?? fallback.end);

  if (!start.isValid() || !end.isValid()) {
    throw new Error("导出日期范围不合法");
  }
  if (end.isBefore(start)) {
    throw new Error("结束日期不能早于开始日期");
  }

  return {
    start: start.format("YYYY-MM-DD"),
    end: end.format("YYYY-MM-DD")
  };
}
