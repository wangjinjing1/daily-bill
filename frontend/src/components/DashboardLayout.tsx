import {
  LockOutlined,
  LogoutOutlined,
  MenuOutlined,
  TagsOutlined,
  UnorderedListOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Form, Grid, Input, Layout, Menu, Modal, Space, Typography, message } from "antd";
import { PropsWithChildren, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, getApiErrorMessage } from "../api";
import { useAuth } from "../auth";

const { Header, Sider, Content } = Layout;

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

export function DashboardLayout({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const [passwordForm] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const isMobile = !screens.md;

  const items = useMemo(() => {
    const menuItems = [
      { key: "/ledger", icon: <UnorderedListOutlined />, label: "账单流水" },
      { key: "/types", icon: <TagsOutlined />, label: "记账类型" }
    ];

    if (user?.role === "SUPER_ADMIN") {
      menuItems.push({ key: "/users", icon: <UserOutlined />, label: "系统管理" });
    }

    return menuItems;
  }, [user?.role]);

  const handleNavigate = (key: string) => {
    navigate(key);
    setDrawerOpen(false);
  };

  const sideMenu = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => handleNavigate(key)}
      className="side-menu"
    />
  );

  return (
    <Layout className="app-shell">
      {!isMobile && (
        <Sider width={220} className="app-sider">
          <div className="brand-block">
            <div className="brand-mark">
              <img src="/bill-mark.png" alt="每日记账" className="brand-icon" />
              <div>
                <Typography.Title level={3}>每日记账</Typography.Title>
                <Typography.Text>账单管理</Typography.Text>
              </div>
            </div>
          </div>
          {sideMenu}
        </Sider>
      )}
      <Layout>
        <Header className="app-header">
          <Space size={12} align="center">
            {isMobile && (
              <Button type="text" icon={<MenuOutlined />} className="menu-trigger" onClick={() => setDrawerOpen(true)} />
            )}
            <div className="header-user">
              <Avatar>{user?.username?.slice(0, 1).toUpperCase()}</Avatar>
              <div className="header-user-text">
                <Typography.Text strong>{user?.username}</Typography.Text>
                <Typography.Text type="secondary">{user?.role === "SUPER_ADMIN" ? "超级管理员" : "普通用户"}</Typography.Text>
              </div>
            </div>
          </Space>
          <Space size={8} className="header-actions">
            <Button
              icon={<LockOutlined />}
              size={isMobile ? "small" : "middle"}
              onClick={() => {
                passwordForm.resetFields();
                setPasswordOpen(true);
              }}
            >
              {isMobile ? "密码" : "修改密码"}
            </Button>
            <Button
              icon={<LogoutOutlined />}
              size={isMobile ? "small" : "middle"}
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              {isMobile ? "退出" : "退出登录"}
            </Button>
          </Space>
        </Header>
        <Content className="app-content">{children}</Content>
      </Layout>

      <Drawer title="每日记账" placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} className="mobile-drawer">
        <Typography.Paragraph type="secondary">账单管理</Typography.Paragraph>
        {sideMenu}
      </Drawer>

      <Modal
        title="修改密码"
        open={passwordOpen}
        onCancel={() => setPasswordOpen(false)}
        onOk={() => passwordForm.submit()}
        confirmLoading={passwordSubmitting}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              setPasswordSubmitting(true);
              await api.post("/me/change-password", {
                oldPassword: values.oldPassword,
                newPassword: values.newPassword
              });
              message.success("密码修改成功");
              setPasswordOpen(false);
            } catch (error: unknown) {
              message.error(getApiErrorMessage(error));
            } finally {
              setPasswordSubmitting(false);
            }
          }}
        >
          <Form.Item label="原密码" name="oldPassword" rules={[{ required: true, message: "请输入原密码" }]}>
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item label="新密码" name="newPassword" rules={[{ required: true, message: "请输入新密码" }, { min: 6, message: "新密码至少 6 位" }]}>
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "请再次输入新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的新密码不一致"));
                }
              })
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
