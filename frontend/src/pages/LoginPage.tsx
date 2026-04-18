import { Button, Card, Form, Input, Typography, message } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api";
import { useAuth } from "../auth";

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

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-brand">
          <img src="/bill-mark.png" alt="每日记账" className="login-brand-icon" />
          <div>
            <Typography.Title level={2}>每日记账</Typography.Title>
            <Typography.Paragraph type="secondary">登录后查看账单流水并导出报表。</Typography.Paragraph>
          </div>
        </div>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            try {
              setSubmitting(true);
              await login(values.username, values.password);
              message.success("登录成功");
              navigate("/ledger", { replace: true });
            } catch (error: unknown) {
              message.error(getApiErrorMessage(error));
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
