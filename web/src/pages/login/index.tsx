import { App, Button, Card, Form, Input } from "antd";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { ApiError } from "@/services/api/client";
import { useUserStore } from "@/stores/use-user-store";

type LoginValues = {
    username: string;
    password: string;
};

export default function LoginPage() {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const status = useUserStore((state) => state.status);
    const user = useUserStore((state) => state.user);
    const login = useUserStore((state) => state.login);
    const [submitting, setSubmitting] = useState(false);

    if (status === "authenticated" && user) {
        return <Navigate to="/" replace />;
    }

    const onFinish = async (values: LoginValues) => {
        setSubmitting(true);
        try {
            await login(values.username.trim(), values.password);
            message.success("登录成功");
            navigate("/", { replace: true });
        } catch (error) {
            message.error(error instanceof ApiError ? error.message : error instanceof Error ? error.message : "登录失败");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-dvh items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md shadow-sm" title="登录无限画布">
                <Form layout="vertical" requiredMark={false} onFinish={(values) => void onFinish(values)}>
                    <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                        <Input autoFocus autoComplete="username" placeholder="用户名" />
                    </Form.Item>
                    <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
                        <Input.Password autoComplete="current-password" placeholder="密码" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={submitting}>
                        登录
                    </Button>
                </Form>
            </Card>
        </div>
    );
}
