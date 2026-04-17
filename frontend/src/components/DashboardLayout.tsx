import { LogoutOutlined, MenuOutlined, TagsOutlined, UnorderedListOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Button, Drawer, Grid, Layout, Menu, Space, Typography } from "antd";
import { PropsWithChildren, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const { Header, Sider, Content } = Layout;

export function DashboardLayout({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
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
              <img src="/bill-icon.svg" alt="Bill" className="brand-icon" />
              <div>
                <Typography.Title level={3}>Bill</Typography.Title>
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
              <Button
                type="text"
                icon={<MenuOutlined />}
                className="menu-trigger"
                onClick={() => setDrawerOpen(true)}
              />
            )}
            <div className="header-user">
              <Avatar>{user?.username?.slice(0, 1).toUpperCase()}</Avatar>
              <div>
                <Typography.Text strong>{user?.username}</Typography.Text>
                <Typography.Text type="secondary">{user?.role === "SUPER_ADMIN" ? "超级管理员" : "普通用户"}</Typography.Text>
              </div>
            </div>
          </Space>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            {isMobile ? "退出" : "退出登录"}
          </Button>
        </Header>
        <Content className="app-content">{children}</Content>
      </Layout>

      <Drawer title="Bill" placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} className="mobile-drawer">
        <Typography.Paragraph type="secondary">账单管理</Typography.Paragraph>
        {sideMenu}
      </Drawer>
    </Layout>
  );
}
