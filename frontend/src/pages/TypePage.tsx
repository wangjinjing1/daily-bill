import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Form, Grid, Input, InputNumber, Modal, Popconfirm, Space, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { api } from "../api";
import { BillType } from "../types";

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

export function TypePage() {
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [data, setData] = useState<BillType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BillType | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get<BillType[]>("/types");
      setData(response.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const columns: ColumnsType<BillType> = [
    { title: "名称", dataIndex: "name", key: "name" },
    { title: "排序", dataIndex: "sortOrder", key: "sortOrder", width: 120 },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      render: (value: boolean) => (value ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>)
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(record);
              form.setFieldsValue(record);
              setOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该类型？"
            onConfirm={async () => {
              try {
                await api.delete(`/types/${record.id}`);
                message.success("删除成功");
                await loadData();
              } catch (error: unknown) {
                message.error(getErrorMessage(error));
              }
            }}
          >
            <Button danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Card className="page-card">
      <div className="page-head">
        <div>
          <Typography.Title level={3}>记账类型</Typography.Title>
          <Typography.Text type="secondary">每个用户维护自己的记账类型。</Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ sortOrder: 0, enabled: true });
            setOpen(true);
          }}
        >
          新增类型
        </Button>
      </div>

      <Table rowKey="id" loading={loading} dataSource={data} columns={columns} pagination={false} scroll={{ x: 560 }} />

      <Modal
        title={editing ? "编辑记账类型" : "新增记账类型"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        width={isMobile ? "calc(100vw - 24px)" : 520}
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={async (values) => {
            try {
              if (editing) {
                await api.put(`/types/${editing.id}`, values);
              } else {
                await api.post("/types", values);
              }
              message.success("保存成功");
              setOpen(false);
              await loadData();
            } catch (error: unknown) {
              message.error(getErrorMessage(error));
            }
          }}
        >
          <Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="排序" name="sortOrder">
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="启用状态" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
