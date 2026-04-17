import ExcelJS from "exceljs";
import { BillEntry, BillType } from "./models.js";

function formatAmount(value: number) {
  return Number(value.toFixed(2));
}

export async function buildTransactionWorkbook(entries: Array<BillEntry & { billType?: BillType }>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("流水");

  sheet.columns = [
    { header: "日期", key: "occurredOn", width: 16 },
    { header: "记账类型", key: "typeName", width: 20 },
    { header: "金额(元)", key: "amount", width: 16 },
    { header: "备注", key: "note", width: 40 }
  ];

  entries.forEach((entry) => {
    sheet.addRow({
      occurredOn: entry.occurredOn,
      typeName: entry.billType?.name ?? "",
      amount: entry.amount,
      note: entry.note ?? ""
    });
  });

  return workbook.xlsx.writeBuffer();
}

export async function buildSummaryWorkbook(entries: Array<BillEntry & { billType?: BillType }>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("汇总");

  const typeNames = Array.from(new Set(entries.map((entry) => entry.billType?.name ?? ""))).filter(Boolean);
  const dateMap = new Map<string, Record<string, number>>();
  const typeTotals: Record<string, number> = {};

  entries.forEach((entry) => {
    const date = entry.occurredOn;
    const typeName = entry.billType?.name ?? "";
    const amount = Number(entry.amount);

    if (!dateMap.has(date)) {
      dateMap.set(date, {});
    }

    const current = dateMap.get(date)!;
    current[typeName] = (current[typeName] ?? 0) + amount;
    typeTotals[typeName] = (typeTotals[typeName] ?? 0) + amount;
  });

  sheet.addRow(["日期", ...typeNames, "合计"]);

  Array.from(dateMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([date, amounts]) => {
      const rowValues = typeNames.map((typeName) => formatAmount(amounts[typeName] ?? 0));
      const rowTotal = formatAmount(rowValues.reduce((sum, value) => sum + value, 0));
      sheet.addRow([date, ...rowValues, rowTotal]);
    });

  const columnTotals = typeNames.map((typeName) => formatAmount(typeTotals[typeName] ?? 0));
  const grandTotal = formatAmount(columnTotals.reduce((sum, value) => sum + value, 0));
  sheet.addRow(["合计", ...columnTotals, grandTotal]);

  sheet.columns.forEach((column) => {
    column.width = 18;
  });

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  const totalRow = sheet.getRow(sheet.rowCount);
  totalRow.font = { bold: true };

  return workbook.xlsx.writeBuffer();
}
