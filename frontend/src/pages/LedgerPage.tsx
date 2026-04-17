import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
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
import { useEffect, useState } from "react";
import { api } from "../api";
import { BillEntry, BillType } from "../types";

type LedgerResponse = {
  items: BillEntry[];
  total: number;
  page: number;
  pageSize: number;
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

export function LedgerPage() {
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [types, setTypes] = useState<BillType[]>([]);
  const [data, setData] = useState<LedgerResponse>({ items: [], total: 0, page: 1, pageSize: 10 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BillEntry | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs]>(getDefaultRange());
  const [queryTypeId, setQueryTypeId] = useState<number | undefined>();
  const [queryDates, setQueryDates] = useState<[Dayjs | null, Dayjs | null] | null>(null);

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
          endDate: queryDates?.[1]?.format("YYYY-MM-DD")
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

  const openCreateModal = () => {
    setEditingEntry(null);
    form.resetFields();
    form.setFieldsValue({ occurredOn: dayjs(), amount: undefined, note: "" });
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

  const columns: ColumnsType<BillEntry> = [
    { title: "日期", dataIndex: "occurredOn", key: "occurredOn", width: 120 },
    {
      title: "记账类型",
      key: "billType",
      width: 120,
      render: (_, record) => <Tag color="green">{record.billType?.name ?? "-"}</Tag>
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
      render: (_, record) => (
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
      if (end.diff(start, "day") > 31) {
        message.error("导出时间范围不能超过一个月");
        return;
      }

      const response = await api.get(`/bills/export/${type}`, {
        params: {
          startDate: start.format("YYYY-MM-DD"),
          endDate: end.format("YYYY-MM-DD")
        },
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-${start.format("YYYYMMDD")}-${end.format("YYYYMMDD")}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
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
            <Typography.Text type="secondary">支持按日期和记账类型查询，按日期倒序分页展示。</Typography.Text>
          </div>
          <div className="ledger-actions">
            <DatePicker.RangePicker value={range} className="range-picker" onChange={(value) => value && setRange(value as [Dayjs, Dayjs])} />
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
          <DatePicker.RangePicker value={queryDates} className="range-picker" onChange={(value) => setQueryDates((value as [Dayjs | null, Dayjs | null]) ?? null)} />
          <Select
            allowClear
            placeholder="按记账类型筛选"
            className="query-select"
            value={queryTypeId}
            onChange={(value) => setQueryTypeId(value)}
            options={types.filter((item) => item.enabled).map((item) => ({ label: item.name, value: item.id }))}
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
          dataSource={data.items}
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
            <Select placeholder="请选择记账类型" options={types.filter((item) => item.enabled).map((item) => ({ label: item.name, value: item.id }))} />
          </Form.Item>
          <Form.Item label="金额(元)" name="amount" rules={[{ required: true, message: "请输入金额" }]} extra="仅允许输入数字，单位为元">
            <InputNumber min={0} precision={2} style={{ width: "100%" }} placeholder="请输入金额" />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={4} maxLength={255} placeholder="可填写备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
