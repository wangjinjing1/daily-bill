import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Form, Grid, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { api } from "../api";
import { User } from "../types";

type ManagedUser = User & {
  status: "ENABLED" | "DISABLED";
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

export function UserPage() {
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [data, setData] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get<ManagedUser[]>("/users");
      setData(response.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const columns: ColumnsType<ManagedUser> = [
    { title: "用户名", dataIndex: "username", key: "username" },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      render: (value: ManagedUser["role"]) => (value === "SUPER_ADMIN" ? <Tag color="gold">超级管理员</Tag> : <Tag>普通用户</Tag>)
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (value: ManagedUser["status"]) => (value === "ENABLED" ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>)
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
              form.setFieldsValue({ username: record.username, role: record.role, status: record.status });
              setOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该用户？"
            onConfirm={async () => {
              try {
                await api.delete(`/users/${record.id}`);
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
          <Typography.Title level={3}>系统管理</Typography.Title>
          <Typography.Text type="secondary">只有超级管理员可创建、禁用、删除用户。</Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ role: "USER", status: "ENABLED" });
            setOpen(true);
          }}
        >
          新增用户
        </Button>
      </div>

      <Table rowKey="id" loading={loading} dataSource={data} columns={columns} pagination={false} scroll={{ x: 620 }} />

      <Modal
        title={editing ? "编辑用户" : "新增用户"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        width={isMobile ? "calc(100vw - 24px)" : 520}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              if (editing) {
                await api.put(`/users/${editing.id}`, {
                  role: values.role,
                  status: values.status
                });
              } else {
                await api.post("/users", values);
              }
              message.success("保存成功");
              setOpen(false);
              await loadData();
            } catch (error: unknown) {
              message.error(getErrorMessage(error));
            }
          }}
        >
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          {!editing && (
            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item label="角色" name="role" rules={[{ required: true, message: "请选择角色" }]}>
            <Select
              options={[
                { label: "普通用户", value: "USER" },
                { label: "超级管理员", value: "SUPER_ADMIN" }
              ]}
            />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
            <Select
              options={[
                { label: "启用", value: "ENABLED" },
                { label: "禁用", value: "DISABLED" }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
