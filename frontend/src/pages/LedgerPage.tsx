import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, SettingOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { exportFilePlugin } from "../exportFilePlugin";
import { isNativeApp } from "../native";
import { BillEntry, BillType, User } from "../types";

type LedgerResponse = {
  items: BillEntry[];
  total: number;
  page: number;
  pageSize: number;
  summaryAmount: string;
};

type ExportRangeForm = {
  exportCycleDay?: number;
};

type LedgerRow = BillEntry & {
  isSummary?: boolean;
};

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (error as { response?: { data?: { message?: string } } }).response!.data!.message!;
  }
  return "操作失败";
}

function getDefaultRange(): [Dayjs, Dayjs] {
  return [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")];
}

function getExportRangeFromUser(user?: User | null): [Dayjs, Dayjs] | null {
  if (!user?.exportCycleDay) {
    return null;
  }

  const cycleDay = user.exportCycleDay;
  const today = dayjs();
  const currentCycleDay = today.startOf("month").date(Math.min(cycleDay, today.daysInMonth()));
  const previousMonth = today.subtract(1, "month");
  const previousCycleDay = previousMonth.startOf("month").date(Math.min(cycleDay, previousMonth.daysInMonth()));
  const end = today.isBefore(currentCycleDay, "day") ? today : currentCycleDay;
  const start = previousCycleDay.add(1, "day");
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    return null;
  }

  return [start, end];
}

function MobileDateRange({
  value,
  onChange,
  placeholders
}: {
  value: [Dayjs | null, Dayjs | null] | null;
  onChange: (next: [Dayjs | null, Dayjs | null] | null) => void;
  placeholders: [string, string];
}) {
  const start = value?.[0] ?? null;
  const end = value?.[1] ?? null;

  return (
    <div className="mobile-date-range">
      <DatePicker value={start} placeholder={placeholders[0]} style={{ width: "100%" }} onChange={(next) => onChange([next, end])} />
      <DatePicker value={end} placeholder={placeholders[1]} style={{ width: "100%" }} onChange={(next) => onChange([start, next])} />
    </div>
  );
}

async function blobToBase64(blob: Blob) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });

  return dataUrl.split(",", 2)[1] ?? "";
}

async function exportBlob(blob: Blob, filename: string) {
  if (isNativeApp()) {
    const base64 = await blobToBase64(blob);
    await exportFilePlugin.saveBase64File({
      filename,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64
    });
    message.success(`已保存到下载目录：${filename}`);
    return;
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1000);
  message.success(`已开始下载：${filename}`);
}

export function LedgerPage() {
  const [form] = Form.useForm();
  const [exportRangeForm] = Form.useForm<ExportRangeForm>();
  const { user, refreshUser } = useAuth();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [types, setTypes] = useState<BillType[]>([]);
  const [data, setData] = useState<LedgerResponse>({ items: [], total: 0, page: 1, pageSize: 10, summaryAmount: "0.00" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BillEntry | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs]>(getDefaultRange());
  const [queryTypeId, setQueryTypeId] = useState<number | undefined>();
  const [queryDates, setQueryDates] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [queryMinAmount, setQueryMinAmount] = useState<number | null>(null);
  const [queryMaxAmount, setQueryMaxAmount] = useState<number | null>(null);
  const [exportSettingsOpen, setExportSettingsOpen] = useState(false);
  const [savingExportSettings, setSavingExportSettings] = useState(false);

  const enabledTypes = useMemo(() => types.filter((item) => item.enabled), [types]);
  const preferredBillTypeId = useMemo(() => {
    const foodType = enabledTypes.find((item) => item.name === "饮食" || item.name === "餐饮");
    return foodType?.id;
  }, [enabledTypes]);

  const loadTypes = async () => {
    const response = await api.get<BillType[]>("/types");
    setTypes(response.data);
  };

  const loadBills = async (targetPage = page, targetPageSize = pageSize) => {
    setLoading(true);
    try {
      const response = await api.get<LedgerResponse>("/bills", {
        params: {
          page: targetPage,
          pageSize: targetPageSize,
          typeId: queryTypeId,
          startDate: queryDates?.[0]?.format("YYYY-MM-DD"),
          endDate: queryDates?.[1]?.format("YYYY-MM-DD"),
          minAmount: queryMinAmount ?? undefined,
          maxAmount: queryMaxAmount ?? undefined
        }
      });
      setData(response.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTypes();
  }, []);

  useEffect(() => {
    void loadBills(page, pageSize);
  }, [page, pageSize]);

  useEffect(() => {
    const userRange = getExportRangeFromUser(user);
    setRange(userRange ?? getDefaultRange());
  }, [user?.exportCycleDay]);

  const openCreateModal = () => {
    setEditingEntry(null);
    form.resetFields();
    form.setFieldsValue({
      occurredOn: dayjs(),
      billTypeId: preferredBillTypeId,
      amount: undefined,
      note: ""
    });
    setModalOpen(true);
  };

  const openEditModal = (entry: BillEntry) => {
    setEditingEntry(entry);
    form.setFieldsValue({
      occurredOn: dayjs(entry.occurredOn),
      billTypeId: entry.billTypeId,
      amount: Number(entry.amount),
      note: entry.note ?? ""
    });
    setModalOpen(true);
  };

  const openExportSettings = () => {
    exportRangeForm.setFieldsValue({
      exportCycleDay: user?.exportCycleDay ?? undefined
    });
    setExportSettingsOpen(true);
  };

  const tableData = useMemo<LedgerRow[]>(
    () => [
      {
        id: -1,
        userId: 0,
        billTypeId: 0,
        occurredOn: "",
        amount: data.summaryAmount,
        note: "查询条件内金额合计",
        isSummary: true
      },
      ...data.items
    ],
    [data.items, data.summaryAmount]
  );

  const columns: ColumnsType<LedgerRow> = [
    { title: "日期", dataIndex: "occurredOn", key: "occurredOn", width: 120 },
    {
      title: "记账类型",
      key: "billType",
      width: 120,
      render: (_, record) => <Tag color={record.isSummary ? "blue" : "green"}>{record.isSummary ? "汇总" : record.billType?.name ?? "-"}</Tag>
    },
    {
      title: "金额(元)",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (value: string) => <Typography.Text strong>{Number(value).toFixed(2)}</Typography.Text>
    },
    { title: "备注", dataIndex: "note", key: "note", width: 220 },
    {
      title: "操作",
      key: "actions",
      width: 160,
      fixed: isMobile ? undefined : "right",
      render: (_, record) => record.isSummary ? null : (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除这条账单？"
            onConfirm={async () => {
              try {
                await api.delete(`/bills/${record.id}`);
                message.success("删除成功");
                await loadBills(page, pageSize);
              } catch (error: unknown) {
                message.error(getErrorMessage(error));
              }
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const exportFile = async (type: "transactions" | "summary") => {
    try {
      const [start, end] = range;
      const response = await api.get<Blob>(`/bills/export/${type}`, {
        params: {
          startDate: start.format("YYYY-MM-DD"),
          endDate: end.format("YYYY-MM-DD")
        },
        responseType: "blob"
      });
      await exportBlob(response.data, `${type}-${start.format("YYYYMMDD")}-${end.format("YYYYMMDD")}.xlsx`);
    } catch (error: unknown) {
      message.error(getErrorMessage(error));
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Card className="page-card">
        <div className="page-head">
          <div>
            <Typography.Title level={3}>账单流水</Typography.Title>
            <Typography.Text type="secondary">支持按日期和记账类型查询，导出范围可按用户单独设置默认值。</Typography.Text>
          </div>
          <div className="ledger-actions">
            {isMobile ? (
              <MobileDateRange
                value={range}
                placeholders={["导出开始日期", "导出结束日期"]}
                onChange={(value) => {
                  if (value?.[0] && value?.[1]) {
                    setRange([value[0], value[1]]);
                  }
                }}
              />
            ) : (
              <DatePicker.RangePicker value={range} className="range-picker" onChange={(value) => value && setRange(value as [Dayjs, Dayjs])} />
            )}
            <Button block={isMobile} icon={<SettingOutlined />} onClick={openExportSettings}>
              导出默认范围
            </Button>
            <Button block={isMobile} onClick={() => void exportFile("transactions")}>
              导出流水
            </Button>
            <Button block={isMobile} onClick={() => void exportFile("summary")}>
              导出汇总
            </Button>
            <Button type="primary" block={isMobile} icon={<PlusOutlined />} onClick={openCreateModal}>
              新增账单
            </Button>
          </div>
        </div>
      </Card>

      <Card className="page-card">
        <div className="query-bar">
          {isMobile ? (
            <MobileDateRange value={queryDates} placeholders={["开始日期", "结束日期"]} onChange={(value) => setQueryDates(value)} />
          ) : (
            <DatePicker.RangePicker value={queryDates} className="range-picker" onChange={(value) => setQueryDates((value as [Dayjs | null, Dayjs | null]) ?? null)} />
          )}
          <Select
            allowClear
            placeholder="按记账类型筛选"
            className="query-select"
            value={queryTypeId}
            onChange={(value) => setQueryTypeId(value)}
            options={enabledTypes.map((item) => ({ label: item.name, value: item.id }))}
          />
          <InputNumber
            min={0}
            precision={2}
            placeholder="最小金额"
            className="query-amount"
            value={queryMinAmount}
            onChange={(value) => setQueryMinAmount(value)}
          />
          <InputNumber
            min={0}
            precision={2}
            placeholder="最大金额"
            className="query-amount"
            value={queryMaxAmount}
            onChange={(value) => setQueryMaxAmount(value)}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={async () => {
              setPage(1);
              await loadBills(1, pageSize);
            }}
          >
            查询
          </Button>
          <Button
            onClick={async () => {
              setQueryDates(null);
              setQueryTypeId(undefined);
              setQueryMinAmount(null);
              setQueryMaxAmount(null);
              setPage(1);
              setTimeout(() => {
                void loadBills(1, pageSize);
              }, 0);
            }}
          >
            重置
          </Button>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={tableData}
          columns={columns}
          scroll={{ x: 780 }}
          pagination={{
            current: data.page,
            pageSize: data.pageSize,
            total: data.total,
            showSizeChanger: true,
            size: isMobile ? "small" : "default",
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            }
          }}
        />
      </Card>

      <Modal
        title={editingEntry ? "编辑账单" : "新增账单"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={isMobile ? "calc(100vw - 24px)" : 520}
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={async (values) => {
            try {
              setSubmitting(true);
              const payload = {
                occurredOn: values.occurredOn.format("YYYY-MM-DD"),
                billTypeId: values.billTypeId,
                amount: values.amount,
                note: values.note
              };

              if (editingEntry) {
                await api.put(`/bills/${editingEntry.id}`, payload);
                message.success("账单更新成功");
              } else {
                await api.post("/bills", payload);
                message.success("账单新增成功");
              }

              setModalOpen(false);
              setEditingEntry(null);
              if (!editingEntry) {
                setPage(1);
                await loadBills(1, pageSize);
              } else {
                await loadBills(page, pageSize);
              }
            } catch (error: unknown) {
              message.error(getErrorMessage(error));
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Form.Item label="日期" name="occurredOn" rules={[{ required: true, message: "请选择日期" }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="记账类型" name="billTypeId" rules={[{ required: true, message: "请选择记账类型" }]}>
            <Select placeholder="请选择记账类型" options={enabledTypes.map((item) => ({ label: item.name, value: item.id }))} />
          </Form.Item>
          <Form.Item label="金额(元)" name="amount" rules={[{ required: true, message: "请输入金额" }]} extra="仅允许输入数字，单位为元">
            <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="请输入金额" />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={4} maxLength={255} placeholder="可填写备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设置默认导出范围"
        open={exportSettingsOpen}
        onCancel={() => setExportSettingsOpen(false)}
        onOk={() => exportRangeForm.submit()}
        confirmLoading={savingExportSettings}
        width={isMobile ? "calc(100vw - 24px)" : 520}
        footer={(_, { OkBtn, CancelBtn }) => (
          <>
            <Button
              onClick={async () => {
                try {
                  setSavingExportSettings(true);
                  await api.put<User>("/me/export-range", {
                    exportCycleDay: null
                  });
                  setRange(getDefaultRange());
                  exportRangeForm.resetFields();
                  setExportSettingsOpen(false);
                  message.success("已恢复默认导出范围");
                  await refreshUser();
                } catch (error: unknown) {
                  message.error(getErrorMessage(error));
                } finally {
                  setSavingExportSettings(false);
                }
              }}
            >
              恢复默认
            </Button>
            <CancelBtn />
            <OkBtn />
          </>
        )}
      >
        <Form
          form={exportRangeForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              setSavingExportSettings(true);
              const payload = {
                exportCycleDay: values.exportCycleDay
              };
              const response = await api.put<User>("/me/export-range", payload);
              const userRange = getExportRangeFromUser(response.data);
              if (userRange) {
                setRange(userRange);
              } else {
                setRange(getDefaultRange());
              }
              setExportSettingsOpen(false);
              message.success("默认导出范围已保存");
              await refreshUser();
            } catch (error: unknown) {
              message.error(getErrorMessage(error));
            } finally {
              setSavingExportSettings(false);
            }
          }}
        >
          <Form.Item
            label="每月几号"
            name="exportCycleDay"
            rules={[{ required: true, message: "请输入每月几号" }]}
            extra="例如填写 10：5 月 20 日导出默认是 4 月 11 日到 5 月 10 日；5 月 4 日导出默认是 4 月 11 日到 5 月 4 日"
          >
            <InputNumber min={1} max={31} precision={0} style={{ width: "100%" }} placeholder="请输入 1 到 31" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
